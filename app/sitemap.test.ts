import { afterEach, describe, expect, it, vi } from "vitest";

const getPublishedProjects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/projects", () => ({ getPublishedProjects }));

import sitemap from "./sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sitemap", () => {
  it("lists static and published project pages with normalized URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://store.madproducer.cn/");
    getPublishedProjects.mockResolvedValue([
      {
        slug: "mad-toolbox",
        updatedAt: "2026-07-31T00:00:00.000Z",
      },
    ]);

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://store.madproducer.cn",
      "https://store.madproducer.cn/projects",
      "https://store.madproducer.cn/submit",
      "https://store.madproducer.cn/projects/mad-toolbox",
    ]);
    expect(entries[3]).toEqual(expect.objectContaining({
      lastModified: new Date("2026-07-31T00:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  });
});
