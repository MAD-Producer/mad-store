import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createWebsiteSubmission: vi.fn(),
  notifyAdminWebsite: vi.fn(),
  notifyWebsiteSubmitterReceived: vi.fn(),
}));

vi.mock("@/lib/mail", () => ({
  notifyAdminWebsite: dependencies.notifyAdminWebsite,
  notifyWebsiteSubmitterReceived: dependencies.notifyWebsiteSubmitterReceived,
}));
vi.mock("@/lib/websites", () => ({
  createWebsiteSubmission: dependencies.createWebsiteSubmission,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.createWebsiteSubmission.mockResolvedValue("website-id");
  dependencies.notifyAdminWebsite.mockResolvedValue(undefined);
  dependencies.notifyWebsiteSubmitterReceived.mockResolvedValue(undefined);
});

describe("POST /api/websites", () => {
  it("accepts the three required website fields without contact details", async () => {
    const request = new NextRequest("https://store.example/api/websites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "MAD Producer",
        url: "https://madproducer.cn",
        description: "MAD 创作者社区",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(dependencies.createWebsiteSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "MAD Producer",
        url: "https://madproducer.cn",
        description: "MAD 创作者社区",
        tags: [],
      }),
    );
  });
});
