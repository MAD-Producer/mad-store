import type { SubmissionInput } from "./types";

interface GitHubRepository {
  name: string;
  description: string | null;
  html_url: string;
  owner: { html_url: string };
  license: { spdx_id: string; name: string } | null;
  stargazers_count: number;
  language: string | null;
  archived: boolean;
  disabled: boolean;
}

function parseRepositoryUrl(repoUrl: string) {
  const url = new URL(repoUrl);
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("仅支持 GitHub 仓库");
  }
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, "");
  if (!owner || !repo) throw new Error("GitHub 仓库地址无效");
  return { owner, repo };
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MAD-Store",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function fetchRepository(repoUrl: string) {
  const { owner, repo } = parseRepositoryUrl(repoUrl);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(),
    next: { revalidate: 1800 },
  });
  if (!response.ok) throw new Error("无法读取该 GitHub 仓库，请确认仓库为公开状态");
  const data = (await response.json()) as GitHubRepository;
  if (data.archived || data.disabled) throw new Error("该仓库已归档或不可用");
  return data;
}

export async function fetchReadme(repoUrl: string) {
  const { owner, repo } = parseRepositoryUrl(repoUrl);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: githubHeaders(),
    next: { revalidate: 3600 },
  });
  if (!response.ok) return "";
  const data = (await response.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return "";
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 200_000);
}

export async function enrichSubmission(input: SubmissionInput) {
  const repo = await fetchRepository(input.repoUrl);
  const readme = await fetchReadme(input.repoUrl);
  return {
    readme,
    stars: repo.stargazers_count,
    language: repo.language || undefined,
    canonicalRepoUrl: repo.html_url,
    canonicalAuthorUrl: repo.owner.html_url,
    detectedLicense:
      repo.license?.spdx_id ||
      repo.license?.name ||
      (input.license === "auto" ? "未声明开源协议" : input.license),
  };
}
