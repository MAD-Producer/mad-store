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
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("该页面不在国内下载范围内");
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

  it("renders GitHub release pages from the releases API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      tag_name: "v1.0",
      name: "MAD Toolbox 1.0",
      published_at: "2026-01-02T00:00:00Z",
      body: "## Changes\n\n- **首个稳定版本**\n\n[Full Changelog](https://github.com/MAD-Producer/MAD-Toolbox/releases)",
      assets: [{
        name: "MAD-Toolbox.zip",
        size: 5,
        browser_download_url: releaseAssetUrl,
      }],
    }]), {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("https://github.com/MAD-Producer/MAD-Toolbox/releases"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("MAD Toolbox 1.0");
    expect(html).toContain("国内下载");
    expect(html).toContain("<h2>Changes</h2>");
    expect(html).toContain("<strong>首个稳定版本</strong>");
    expect(html).toContain("<a href=\"https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases\"");
    expect(html).not.toContain("← 返回版本列表");
    expect(html).toContain("https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/MAD-Toolbox.zip");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.github.com/repos/MAD-Producer/MAD-Toolbox/releases?per_page=30",
    );
  });

  it("shows a working version-list link on a release detail page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tag_name: "v1.0",
      name: "MAD Toolbox 1.0",
      published_at: "2026-01-02T00:00:00Z",
      body: "### Changes\n\n- **修复** 下载问题",
      assets: [],
    }), {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("https://github.com/MAD-Producer/MAD-Toolbox/releases/tag/v1.0"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h3>Changes</h3>");
    expect(html).toContain("<strong>修复</strong>");
    expect(html).toContain("<a class=\"back\" href=\"https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases\">← 返回版本列表</a>");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.github.com/repos/MAD-Producer/MAD-Toolbox/releases/tags/v1.0",
    );
  });

  it("rewrites only links that stay inside the registered release scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      '<a href="https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip">下载</a><a href="https://github.com/MAD-Producer/MAD-Toolbox/issues">Issues</a>',
      { headers: { "content-type": "text/html; charset=utf-8" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("https://github.com/MAD-Producer/MAD-Toolbox/releases/notes"));
    const html = await response.text();

    expect(html).toContain("https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip");
    expect(html).toContain("https://github.com/MAD-Producer/MAD-Toolbox/issues");
  });
});
