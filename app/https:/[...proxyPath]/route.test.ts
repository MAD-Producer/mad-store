import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROXY_DOWNLOAD_CHUNK_SIZE } from "@/lib/proxy-downloads";

const dependencies = vi.hoisted(() => ({
  findPublishedProxyDownload: vi.fn(),
}));

vi.mock("@/lib/projects", () => ({
  findPublishedProxyDownload: dependencies.findPublishedProxyDownload,
}));

import { GET } from "./route";

const releaseAssetUrl = "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/MAD-Toolbox.zip";

function request(url: string, headers?: HeadersInit) {
  return new NextRequest(`https://store.example/${url}`, { headers });
}

beforeEach(() => {
  vi.restoreAllMocks();
  dependencies.findPublishedProxyDownload.mockResolvedValue({
    label: "MAD Toolbox Release",
    sourceUrl: "https://github.com/MAD-Producer/MAD-Toolbox/releases",
  });
});

describe("release proxy route", () => {
  it("does not fetch an unregistered path", async () => {
    dependencies.findPublishedProxyDownload.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("https://github.com/MAD-Producer/MAD-Toolbox/releases-other/file.zip"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows release download redirects and preserves range responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://objects.githubusercontent.com/assets/MAD-Toolbox.zip" },
      }))
      .mockResolvedValueOnce(new Response("asset", {
        status: 206,
        headers: {
          "content-disposition": "attachment; filename=MAD-Toolbox.zip",
          "content-range": "bytes 0-4/5",
          "content-type": "application/zip",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request(releaseAssetUrl, { range: "bytes=0-4" }));

    expect(response.status).toBe(206);
    expect(await response.text()).toBe("asset");
    expect(response.headers.get("content-range")).toBe("bytes 0-4/5");
    expect(response.headers.get("content-disposition")).toContain("MAD-Toolbox.zip");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(releaseAssetUrl);
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://objects.githubusercontent.com/assets/MAD-Toolbox.zip");
    expect(fetchMock.mock.calls[0][1]?.headers.get("range")).toBe("bytes=0-4");
  });

  it("caps an oversized range before sending it upstream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("asset", {
      status: 206,
      headers: {
        "content-length": "5",
        "content-range": "bytes 0-4/5",
        "content-type": "application/zip",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request(releaseAssetUrl, { range: "bytes=0-99999999" }));

    expect(response.status).toBe(206);
    expect(fetchMock.mock.calls[0][1]?.headers.get("range")).toBe(
      `bytes=0-${PROXY_DOWNLOAD_CHUNK_SIZE - 1}`,
    );
  });

  it("redirects a large direct download to the browser chunk downloader", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200,
      headers: {
        "content-disposition": "attachment; filename=MAD-Toolbox.zip",
        "content-length": String(PROXY_DOWNLOAD_CHUNK_SIZE + 1),
        "content-type": "application/zip",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request(releaseAssetUrl));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/download-proxy?target=");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
  });

  it("rewrites only links that stay inside the registered release scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      '<a href="https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip">下载</a><a href="https://github.com/MAD-Producer/MAD-Toolbox/issues">Issues</a>',
      { headers: { "content-type": "text/html; charset=utf-8" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("https://github.com/MAD-Producer/MAD-Toolbox/releases"));
    const html = await response.text();

    expect(html).toContain("https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip");
    expect(html).toContain("https://github.com/MAD-Producer/MAD-Toolbox/issues");
  });
});
