import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const release = {
  tag_name: "v1.0.1",
  name: "MAD Toolbox 1.0.1",
  body: "修复更新检查与下载问题",
  published_at: "2026-08-28T00:00:00Z",
  assets: [
    {
      name: "MAD.Toolbox_1.0.1_aarch64-Full.dmg",
      size: 123,
      browser_download_url:
        "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0.1/MAD.Toolbox_1.0.1_aarch64-Full.dmg"
    },
    {
      name: "MAD.Toolbox_1.0.1_x64-Full-setup.exe",
      size: 456,
      browser_download_url:
        "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0.1/MAD.Toolbox_1.0.1_x64-Full-setup.exe"
    },
    {
      name: "SHA256SUMS.txt",
      size: 789,
      browser_download_url:
        "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0.1/SHA256SUMS.txt"
    },
    {
      name: "not-from-mad-toolbox.zip",
      size: 100,
      browser_download_url: "https://example.com/not-from-mad-toolbox.zip"
    }
  ]
};

function makeRequest(query = "") {
  return new NextRequest("https://store.example/api/updates/mad-toolbox" + query);
}

function mockGithubResponse(status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(release), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /api/updates/mad-toolbox", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the latest release and selects the requested installer", async () => {
    mockGithubResponse();

    const response = await GET(
      makeRequest("?platform=macos&arch=arm64&edition=full")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe("1.0.1");
    expect(body.notes).toBe("修复更新检查与下载问题");
    expect(body.releaseUrl).toBe(
      "https://store.example/https://github.com/MAD-Producer/MAD-Toolbox/releases/tag/v1.0.1"
    );
    expect(body.selectedAsset).toMatchObject({
      name: "MAD.Toolbox_1.0.1_aarch64-Full.dmg",
      downloadUrl:
        "https://store.example/api/download-proxy?target=https%3A%2F%2Fgithub.com%2FMAD-Producer%2FMAD-Toolbox%2Freleases%2Fdownload%2Fv1.0.1%2FMAD.Toolbox_1.0.1_aarch64-Full.dmg",
      browserUrl: expect.stringContaining("https://store.example/download-proxy?target="),
      platform: "macos",
      arch: "arm64",
      edition: "full"
    });
    expect(body.assets).toHaveLength(3);
  });

  it("returns all safe assets when no platform selection is provided", async () => {
    mockGithubResponse();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.selectedAsset).toBeNull();
    expect(body.assets.some((asset: { kind: string }) => asset.kind === "checksum")).toBe(true);
  });

  it("rejects incomplete selection parameters before contacting GitHub", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(makeRequest("?platform=macos"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("必须同时提供");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a gateway error when GitHub cannot provide the release", async () => {
    mockGithubResponse(500);

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "无法读取 MAD Toolbox 最新版本，请稍后重试"
    });
  });
});
