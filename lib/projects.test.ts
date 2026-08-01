import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const projects = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
  };
  const settings = { updateOne: vi.fn() };
  return {
    projects,
    settings,
    collection: vi.fn((name: string) => name === "projects" ? projects : settings),
  };
});

vi.mock("./mongodb", () => ({
  hasMongoConfig: () => true,
  getDatabase: () => Promise.resolve({ collection: database.collection }),
}));

import { createSubmission, updateProject } from "./projects";

const submission = {
  name: "视频素材自动提纯工具",
  description: "用于视频素材自动提纯的开源工具",
  repoUrl: "https://github.com/TuanAMV/Auto-scenes-extraction",
  authorUrl: "https://github.com/TuanAMV",
  license: "Apache-2.0",
  systems: ["Windows" as const],
  tags: ["素材", "自定义标签"],
  submitterName: "Tester",
  submitterEmail: "tester@example.com",
};

const enrichment = {
  repositoryName: "Auto-scenes-extraction",
  readme: "README",
  stars: 1,
  language: "Python",
  canonicalRepoUrl: submission.repoUrl,
  canonicalAuthorUrl: submission.authorUrl,
  detectedLicense: "Apache-2.0",
};

beforeEach(() => {
  vi.clearAllMocks();
  database.projects.findOne.mockResolvedValue(null);
  database.projects.insertOne.mockResolvedValue({ insertedId: { toString: () => "project-id" } });
  database.projects.updateOne.mockResolvedValue({});
  database.settings.updateOne.mockResolvedValue({});
});

describe("createSubmission", () => {
  it("uses the canonical repository name for the slug and adds submitted tags to settings", async () => {
    await createSubmission(submission, enrichment, null);

    expect(database.projects.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        name: submission.name,
        slug: "auto-scenes-extraction",
      }),
    );
    expect(database.settings.updateOne).toHaveBeenCalledWith(
      { key: "site" },
      { $addToSet: { tags: { $each: submission.tags } } },
    );
  });
});

describe("updateProject", () => {
  it("removes the legacy download field when all download options are deleted", async () => {
    database.projects.findOne.mockResolvedValue({
      _id: "legacy-id",
      id: "legacy-id",
      slug: "legacy-project",
      name: "Legacy project",
      description: "Legacy project description",
      repoUrl: "https://github.com/example/legacy-project",
      authorUrl: "https://github.com/example",
      license: "MIT",
      systems: ["Windows"],
      tags: ["工具"],
      category: "制作工具",
      status: "published",
      downloadUrl: "https://example.com/download",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await updateProject("legacy-id", { downloads: [] });

    expect(database.projects.updateOne).toHaveBeenCalledWith(
      { id: "legacy-id" },
      expect.objectContaining({
        $set: expect.objectContaining({ downloads: [] }),
        $unset: { downloadUrl: "" },
      }),
    );
    expect(result.updated.downloads).toEqual([]);
    expect(result.updated.downloadUrl).toBeUndefined();
  });
});
