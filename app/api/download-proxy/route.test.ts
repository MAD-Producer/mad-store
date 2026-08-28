import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  findPublishedProxyDownload: vi.fn(),
}));

vi.mock("@/lib/projects", () => ({
  findPublishedProxyDownload: dependencies.findPublishedProxyDownload,
}));

import { GET, HEAD } from "./route";

const sourceUrl =
  "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0.1/MAD.Toolbox_1.0.1_x64-Full-setup.exe";

function request(headers?: HeadersInit) {
  const url = new URL("https://store.example/api/download-proxy");
  url.searchParams.set("target", sourceUrl);
  return new NextRequest(url, { headers });
}

function mockUpstream(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
  dependencies.findPublishedProxyDownload.mockResolvedValue({
    label: "MAD Toolbox Release",
    sourceUrl: "https://github.com/MAD-Producer/MAD-Toolbox/releases",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API download proxy", () => {
  it("returns file metadata through HEAD", async () => {
    const fetchMock = mockUpstream(
      new Response(null, {
        status: 200,
        headers: {
          "content-disposition": "attachment; filename=MAD-Toolbox.exe",
          "content-length": "1234",
          "content-type": "application/octet-stream",
        },
      }),
    );

    const response = await HEAD(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("1234");
    expect(response.headers.get("content-disposition")).toContain("MAD-Toolbox.exe");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-proxy-chunk-size")).toBe("4194304");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
  });

  it("returns one binary range without redirecting to the browser page", async () => {
    const fetchMock = mockUpstream(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: {
          "content-length": "3",
          "content-range": "bytes 0-2/10",
          "content-type": "application/octet-stream",
        },
      }),
    );

    const response = await GET(request({ Range: "bytes=0-2" }));

    expect(response.status).toBe(206);
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
    expect(response.headers.get("content-range")).toBe("bytes 0-2/10");
    expect(fetchMock.mock.calls[0][1]?.headers.get("range")).toBe("bytes=0-2");
  });

  it("preserves the range while following a safe upstream redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://objects.githubusercontent.com/assets/mad-toolbox.exe",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 206,
          headers: {
            "content-length": "1",
            "content-range": "bytes 0-0/1",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request({ Range: "bytes=0-0" }));

    expect(response.status).toBe(206);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers.get("range")).toBe("bytes=0-0");
    expect(fetchMock.mock.calls[1][1]?.headers.get("range")).toBe("bytes=0-0");
  });

  it("requires a single range no larger than one proxy chunk", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request({ Range: "bytes=0-4194304" }));
    const body = await response.json();

    expect(response.status).toBe(416);
    expect(body.message).toContain("Range");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch an unregistered target", async () => {
    dependencies.findPublishedProxyDownload.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request({ Range: "bytes=0-2" }));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an upstream response that ignored the requested range", async () => {
    const fetchMock = mockUpstream(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-length": "3" },
      }),
    );

    const response = await GET(request({ Range: "bytes=0-2" }));

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
