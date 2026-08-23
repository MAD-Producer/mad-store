import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({
  selectChineseReadme: vi.fn(),
}));

vi.mock("./ai", () => ai);

import { fetchReadme } from "./github";

const fetchMock = vi.fn();
const repoUrl = "https://github.com/example/project";

function encoded(content: string) {
  return Buffer.from(content, "utf8").toString("base64");
}

function githubResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function queueReadmes(chineseContent: string) {
  fetchMock
    .mockResolvedValueOnce(githubResponse({
      name: "README.md",
      path: "README.md",
      content: encoded("English documentation for this project."),
      encoding: "base64",
    }))
    .mockResolvedValueOnce(githubResponse([
      { type: "file", name: "README.md", path: "README.md" },
      { type: "file", name: "README.zh-CN.md", path: "README.zh-CN.md" },
    ]))
    .mockResolvedValueOnce(githubResponse({
      name: "README.zh-CN.md",
      path: "README.zh-CN.md",
      content: encoded(chineseContent),
      encoding: "base64",
    }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  fetchMock.mockReset();
  ai.selectChineseReadme.mockResolvedValue(null);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchReadme", () => {
  it("uses the AI-selected Chinese README when multiple candidates exist", async () => {
    queueReadmes("这是中文项目说明，提供安装和使用方法。");
    ai.selectChineseReadme.mockResolvedValue("README.zh-CN.md");

    const readme = await fetchReadme(repoUrl);

    expect(readme).toContain("这是中文项目说明");
    expect(ai.selectChineseReadme).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: "README.md" }),
      expect.objectContaining({ id: "README.zh-CN.md" }),
    ]));
  });

  it("falls back to Chinese content when AI selection is unavailable", async () => {
    queueReadmes("这是中文项目说明，提供安装和使用方法。");

    await expect(fetchReadme(repoUrl)).resolves.toContain("这是中文项目说明");
  });

  it("keeps the default README when no Chinese candidate exists", async () => {
    fetchMock
      .mockResolvedValueOnce(githubResponse({
        name: "README.md",
        path: "README.md",
        content: encoded("English documentation for this project."),
        encoding: "base64",
      }))
      .mockResolvedValueOnce(githubResponse([
        { type: "file", name: "README.md", path: "README.md" },
      ]));

    await expect(fetchReadme(repoUrl)).resolves.toContain("English documentation");
  });
});
