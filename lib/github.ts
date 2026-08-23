import { selectChineseReadme, type ReadmeCandidateForSelection } from "./ai";
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

interface GitHubContent {
  type?: string;
  name?: string;
  path?: string;
  content?: string;
  encoding?: string;
}

interface ReadmeCandidate extends ReadmeCandidateForSelection {
  path: string;
}

const README_FILE_PATTERN = /^readme(?:[._-].*)?$/i;

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

function decodeGitHubContent(data: GitHubContent) {
  if (!data.content || data.encoding !== "base64") return "";
  return Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf8").slice(0, 200_000);
}

async function fetchGitHubJson<T>(url: string, revalidate: number) {
  const response = await fetch(url, {
    headers: githubHeaders(),
    next: { revalidate },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function githubContentUrl(owner: string, repo: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
}

function chineseCharacterCount(value: string) {
  return (value.match(/[\u3400-\u9fff]/g) || []).length;
}

function chineseReadmeScore(candidate: Pick<ReadmeCandidate, "name" | "content">) {
  const chinese = chineseCharacterCount(candidate.content);
  const latin = (candidate.content.match(/[A-Za-z]/g) || []).length;
  const ratio = chinese / Math.max(chinese + latin, 1);
  const filenameHint = /(?:zh|cn|chinese|中文|简体|繁體)/i.test(candidate.name) ? 0.25 : 0;
  return ratio + filenameHint;
}

function isChineseReadme(candidate: Pick<ReadmeCandidate, "name" | "content">) {
  const chinese = chineseCharacterCount(candidate.content);
  const latin = (candidate.content.match(/[A-Za-z]/g) || []).length;
  return chinese >= 4 && (chinese / Math.max(chinese + latin, 1) >= 0.03 || /(?:zh|cn|chinese|中文|简体|繁體)/i.test(candidate.name));
}

async function selectReadme(candidates: ReadmeCandidate[], fallbackPath?: string) {
  if (!candidates.length) return "";
  const fallback = candidates.find((candidate) => candidate.path === fallbackPath) || candidates[0];
  const aiSelectedId = await selectChineseReadme(candidates.map(({ id, name, content }) => ({ id, name, content })));
  const aiSelected = aiSelectedId ? candidates.find((candidate) => candidate.id === aiSelectedId) : undefined;
  if (aiSelected && isChineseReadme(aiSelected)) return aiSelected.content;

  const likelyChinese = candidates
    .filter(isChineseReadme)
    .sort((left, right) => chineseReadmeScore(right) - chineseReadmeScore(left))[0];
  return likelyChinese?.content || fallback.content;
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
  const defaultReadme = await fetchGitHubJson<GitHubContent>(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    3600,
  );
  const rootContents = await fetchGitHubJson<GitHubContent[]>(
    `https://api.github.com/repos/${owner}/${repo}/contents/`,
    3600,
  );
  const readmeEntries = (rootContents || []).filter(
    (entry) => entry.type === "file" && entry.name && entry.path && README_FILE_PATTERN.test(entry.name),
  );
  const paths = Array.from(
    new Set([defaultReadme?.path, ...readmeEntries.map((entry) => entry.path)]),
  ).filter((path): path is string => Boolean(path)).slice(0, 8);
  const candidates = (
    await Promise.all(
      paths.map(async (path) => {
        const data = path === defaultReadme?.path
          ? defaultReadme
          : await fetchGitHubJson<GitHubContent>(githubContentUrl(owner, repo, path), 3600);
        const content = data ? decodeGitHubContent(data) : "";
        if (!content) return null;
        return {
          id: path,
          name: data?.name || path.split("/").pop() || path,
          path,
          content,
        } satisfies ReadmeCandidate;
      }),
    )
  ).filter((candidate): candidate is ReadmeCandidate => Boolean(candidate));
  return selectReadme(candidates, defaultReadme?.path);
}

export async function enrichSubmission(input: SubmissionInput) {
  const repo = await fetchRepository(input.repoUrl);
  const readme = await fetchReadme(input.repoUrl);
  return {
    repositoryName: repo.name,
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
