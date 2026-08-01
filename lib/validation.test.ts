import { describe, expect, it } from "vitest";
import { parseWebsiteSubmission } from "./validation";

describe("parseWebsiteSubmission", () => {
  it("requires only name, url, and description", () => {
    expect(parseWebsiteSubmission({
      name: "MAD Producer",
      url: "https://madproducer.cn",
      description: "MAD 创作者社区",
    })).toEqual({
      name: "MAD Producer",
      url: "https://madproducer.cn",
      description: "MAD 创作者社区",
      category: undefined,
      tags: [],
      submitterName: undefined,
      submitterEmail: undefined,
      contactQQ: undefined,
    });
  });

  it("rejects a non-HTTPS website URL", () => {
    expect(() => parseWebsiteSubmission({
      name: "Example",
      url: "http://example.com",
      description: "Example website",
    })).toThrow("有效的 HTTPS 网站链接");
  });
});
