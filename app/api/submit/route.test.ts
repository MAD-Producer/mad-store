import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createSubmission: vi.fn(),
  enrichSubmission: vi.fn(),
  notifyAdmin: vi.fn(),
  notifySubmitterReceived: vi.fn(),
  reviewWithDeepSeek: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({ reviewWithDeepSeek: dependencies.reviewWithDeepSeek }));
vi.mock("@/lib/github", () => ({ enrichSubmission: dependencies.enrichSubmission }));
vi.mock("@/lib/mail", () => ({
  notifyAdmin: dependencies.notifyAdmin,
  notifySubmitterReceived: dependencies.notifySubmitterReceived,
}));
vi.mock("@/lib/projects", () => ({ createSubmission: dependencies.createSubmission }));

import { POST } from "./route";

const validSubmission = {
  name: "MAD Toolbox",
  description: "面向 MAD 创作者的开源工具集合",
  repoUrl: "https://github.com/example/mad-toolbox",
  authorUrl: "https://github.com/example",
  license: "MIT",
  systems: ["Windows"],
  tags: ["工具"],
  submitterName: "测试用户",
  submitterEmail: "test@example.com",
};

function createRequest(body: Record<string, unknown>, ip?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (ip) headers.set("x-forwarded-for", ip);
  return new NextRequest("https://store.example/api/submit", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  dependencies.createSubmission.mockResolvedValue("project-id");
  dependencies.enrichSubmission.mockResolvedValue({});
  dependencies.notifyAdmin.mockResolvedValue(undefined);
  dependencies.notifySubmitterReceived.mockResolvedValue(undefined);
  dependencies.reviewWithDeepSeek.mockResolvedValue(null);
});

describe("POST /api/submit", () => {
  it("does not consume submission quota for invalid requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => POST(createRequest({}, "192.0.2.1"))),
    );

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400]);
  });

  it("does not consume submission quota for honeypot requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        POST(createRequest({ companyWebsite: "https://spam.example" }, "192.0.2.2")),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
  });

  it("releases the quota reservation when submission processing fails", async () => {
    dependencies.enrichSubmission.mockRejectedValue(new Error("GitHub unavailable"));

    const responses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      responses.push(await POST(createRequest(validSubmission, "192.0.2.3")));
    }

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400]);
  });

  it("does not share a global quota when the client IP is unavailable", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      responses.push(await POST(createRequest(validSubmission)));
    }

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
  });

  it("returns retry guidance after four successful submissions from one IP", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      responses.push(await POST(createRequest(validSubmission, "192.0.2.4")));
    }

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 429]);
    const retryAfter = Number(responses[4].headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });
});
