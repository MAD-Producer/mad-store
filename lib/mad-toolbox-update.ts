import { buildProxyDownloadUrl } from "./proxy-downloads";

export const MAD_TOOLBOX_REPOSITORY = "MAD-Producer/MAD-Toolbox";

const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/MAD-Producer/MAD-Toolbox/releases/latest";
const RELEASE_ASSET_PATH_PREFIX = "/MAD-Producer/MAD-Toolbox/releases/download/";

export type MadToolboxPlatform = "windows" | "macos";
export type MadToolboxArch = "x86_64" | "arm64";
export type MadToolboxEdition = "full" | "lite";

export interface MadToolboxSelection {
  platform: MadToolboxPlatform;
  arch: MadToolboxArch;
  edition: MadToolboxEdition;
}

export interface MadToolboxAsset {
  name: string;
  size: number | null;
  downloadUrl: string;
  browserUrl: string;
  kind: "installer" | "checksum" | "other";
  platform: MadToolboxPlatform | null;
  arch: MadToolboxArch | null;
  edition: MadToolboxEdition | null;
}

export interface MadToolboxUpdate {
  name: string;
  repository: string;
  version: string;
  tag: string;
  notes: string;
  publishedAt: string | null;
  releaseUrl: string;
  assets: MadToolboxAsset[];
  selectedAsset: MadToolboxAsset | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseVersion(tag: string): string {
  const version = tag.trim().replace(/^[vV]/, "");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("MAD Toolbox release tag is not a supported version");
  }
  return version;
}

function classifyAsset(name: string): Pick<
  MadToolboxAsset,
  "kind" | "platform" | "arch" | "edition"
> {
  const lowerName = name.toLowerCase();
  const platform = lowerName.includes("windows") || /\.(?:exe|msi)$/.test(lowerName)
    ? "windows"
    : lowerName.includes("macos") ||
        lowerName.includes("apple-silicon") ||
        /\.dmg$/.test(lowerName)
      ? "macos"
      : null;
  const arch = /aarch64|arm64|apple[-_.\s]?silicon/i.test(name)
    ? "arm64"
    : /x86_64|x64|amd64/i.test(name)
      ? "x86_64"
      : null;
  const edition = /(?:^|[-_.\s])full(?:[-_.\s]|$)/i.test(name)
    ? "full"
    : /(?:^|[-_.\s])lite(?:[-_.\s]|$)/i.test(name)
      ? "lite"
      : null;
  const kind = /sha256/i.test(name)
    ? "checksum"
    : /\.(?:dmg|exe|msi)$/.test(lowerName)
      ? "installer"
      : "other";

  return { kind, platform, arch, edition };
}

function buildDownloadApiUrl(sourceUrl: string, siteUrl: string) {
  const apiUrl = new URL("/api/download-proxy", siteUrl);
  apiUrl.searchParams.set("target", sourceUrl);
  return apiUrl.toString();
}

function buildDownloadPageUrl(sourceUrl: string, siteUrl: string) {
  const pageUrl = new URL("/download-proxy", siteUrl);
  pageUrl.searchParams.set("target", buildProxyDownloadUrl(sourceUrl, siteUrl));
  return pageUrl.toString();
}

function normalizeAsset(value: unknown, siteUrl: string): MadToolboxAsset | null {
  const record = asRecord(value);
  const name = asString(record?.name);
  const sourceUrl = asString(record?.browser_download_url);
  if (!name || !sourceUrl) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "github.com" ||
    !parsedUrl.pathname.startsWith(RELEASE_ASSET_PATH_PREFIX)
  ) {
    return null;
  }

  const size =
    typeof record?.size === "number" && Number.isSafeInteger(record.size) && record.size >= 0
      ? record.size
      : null;
  const normalizedSourceUrl = parsedUrl.toString();

  return {
    name,
    size,
    downloadUrl: buildDownloadApiUrl(normalizedSourceUrl, siteUrl),
    browserUrl: buildDownloadPageUrl(normalizedSourceUrl, siteUrl),
    ...classifyAsset(name)
  };
}

export function selectMadToolboxAsset(
  assets: MadToolboxAsset[],
  selection: MadToolboxSelection | null
): MadToolboxAsset | null {
  if (!selection) return null;
  return (
    assets.find(
      (asset) =>
        asset.kind === "installer" &&
        asset.platform === selection.platform &&
        asset.arch === selection.arch &&
        asset.edition === selection.edition
    ) ?? null
  );
}

export function buildMadToolboxUpdate(
  release: unknown,
  siteUrl: string,
  selection: MadToolboxSelection | null = null
): MadToolboxUpdate {
  const record = asRecord(release);
  const tag = asString(record?.tag_name);
  if (!tag) throw new Error("MAD Toolbox release does not contain a tag");

  const version = parseVersion(tag);
  const releasePageUrl =
    "https://github.com/" +
    MAD_TOOLBOX_REPOSITORY +
    "/releases/tag/" +
    encodeURIComponent(tag);
  const rawAssets = Array.isArray(record?.assets) ? record.assets : [];
  const assets = rawAssets
    .map((asset) => normalizeAsset(asset, siteUrl))
    .filter((asset): asset is MadToolboxAsset => asset !== null);

  return {
    name: asString(record?.name) ?? "MAD Toolbox " + version,
    repository: MAD_TOOLBOX_REPOSITORY,
    version,
    tag,
    notes: asString(record?.body)?.slice(0, 20_000) ?? "",
    publishedAt: asString(record?.published_at),
    releaseUrl: buildProxyDownloadUrl(releasePageUrl, siteUrl),
    assets,
    selectedAsset: selectMadToolboxAsset(assets, selection)
  };
}

export async function fetchLatestMadToolboxRelease(): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MAD-Store-MAD-Toolbox-Update",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) headers.Authorization = "Bearer " + githubToken;

  const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    throw new Error("GitHub latest release request failed");
  }
  return response.json();
}
