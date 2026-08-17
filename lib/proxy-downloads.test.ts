import { describe, expect, it } from "vitest";
import {
  buildProxyDownloadUrl,
  extractProxySourceUrl,
  hasProxyScope,
  isLikelyDownloadPath,
  normalizeProxySourceUrl,
  proxySourceMatchesScope,
} from "./proxy-downloads";

const releasesUrl = "https://github.com/MAD-Producer/MAD-Toolbox/releases";

describe("proxy download scopes", () => {
  it("generates the requested site-prefixed proxy URL", () => {
    expect(buildProxyDownloadUrl(releasesUrl)).toBe(
      "https://store.madproducer.cn/https://github.com/MAD-Producer/MAD-Toolbox/releases",
    );
  });

  it("treats a release path as a directory scope", () => {
    expect(proxySourceMatchesScope(
      "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/MAD-Toolbox.zip",
      releasesUrl,
    )).toBe(true);
    expect(proxySourceMatchesScope(
      "https://github.com/MAD-Producer/MAD-Toolbox/releases/tag/v1.0",
      releasesUrl,
    )).toBe(true);
    expect(proxySourceMatchesScope(
      "https://github.com/MAD-Producer/MAD-Toolbox/releases-other/file.zip",
      releasesUrl,
    )).toBe(false);
    expect(proxySourceMatchesScope(
      "https://github.com/other-project/releases/download/v1.0/file.zip",
      releasesUrl,
    )).toBe(false);
  });

  it("recognizes release assets without treating the release page as a file", () => {
    expect(isLikelyDownloadPath(
      "https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/MAD-Toolbox.zip",
    )).toBe(true);
    expect(isLikelyDownloadPath(releasesUrl)).toBe(false);
  });

  it("recovers a source URL from the unencoded proxy path", () => {
    expect(extractProxySourceUrl(
      "/https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip",
    )).toBe("https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip");
    expect(extractProxySourceUrl(
      "/https:/github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip",
    )).toBe("https://github.com/MAD-Producer/MAD-Toolbox/releases/download/v1.0/file.zip");
    expect(extractProxySourceUrl("/https:/")).toBeNull();
  });

  it("rejects a whole-site scope while accepting a path scope", () => {
    expect(hasProxyScope(normalizeProxySourceUrl(releasesUrl))).toBe(true);
    expect(hasProxyScope(normalizeProxySourceUrl("https://github.com/"))).toBe(false);
    expect(() => normalizeProxySourceUrl("http://github.com/MAD-Producer/MAD-Toolbox/releases"))
      .toThrow("公开的 HTTPS 地址");
  });
});
