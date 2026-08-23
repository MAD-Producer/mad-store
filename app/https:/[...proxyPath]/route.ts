import { NextRequest, NextResponse } from "next/server";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { findPublishedProxyDownload } from "@/lib/projects";
import {
  buildProxyDownloadUrl,
  extractProxySourceUrl,
  isSafeProxyTarget,
  isLikelyDownloadPath,
  normalizeProxySourceUrl,
  PROXY_DOWNLOAD_CHUNK_SIZE,
  proxySourceMatchesScope,
} from "@/lib/proxy-downloads";

export const runtime = "nodejs";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const forwardedRequestHeaders = [
  "accept",
  "accept-language",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "range",
];
const forwardedResponseHeaders = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

function cappedRangeHeader(value: string) {
  const firstRange = value.split(",", 1)[0].trim();
  const explicitRange = /^bytes=(\d+)-(\d*)$/i.exec(firstRange);
  if (explicitRange) {
    const start = Number(explicitRange[1]);
    if (!Number.isSafeInteger(start)) return firstRange;
    const requestedEnd = explicitRange[2] ? Number(explicitRange[2]) : null;
    const maxEnd = start + PROXY_DOWNLOAD_CHUNK_SIZE - 1;
    if (!Number.isSafeInteger(maxEnd)) return firstRange;
    if (requestedEnd === null || requestedEnd - start + 1 > PROXY_DOWNLOAD_CHUNK_SIZE) {
      return `bytes=${start}-${maxEnd}`;
    }
    return `bytes=${start}-${requestedEnd}`;
  }

  const suffixRange = /^bytes=-(\d+)$/i.exec(firstRange);
  if (suffixRange) {
    const length = Number(suffixRange[1]);
    return Number.isSafeInteger(length)
      ? `bytes=-${Math.min(length, PROXY_DOWNLOAD_CHUNK_SIZE)}`
      : firstRange;
  }
  return firstRange;
}

function upstreamRequestHeaders(request: NextRequest, rangeOverride?: string | null) {
  const headers = new Headers({ "User-Agent": "MAD-Store-Download-Proxy" });
  for (const name of forwardedRequestHeaders) {
    const value = name === "range" && rangeOverride !== undefined
      ? rangeOverride
      : request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const range = headers.get("range");
  if (range) headers.set("range", cappedRangeHeader(range));
  return headers;
}

function proxyError(message: string, status: 404 | 502 | 503) {
  return NextResponse.json(
    { message },
    { status, headers: { "X-Robots-Tag": "noindex, nofollow" } },
  );
}

function proxyScopeNotFound() {
  const body = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>页面不在国内下载范围内｜MAD Store</title>
    <style>
      :root { color-scheme: light; font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; color: #2b2b2b; background: #fafaf8; }
      body { min-height: 100vh; box-sizing: border-box; display: grid; place-items: center; margin: 0; padding: 24px; }
      main { width: min(560px, 100%); box-sizing: border-box; padding: 48px 42px; border: 1px solid #e7e7e5; border-radius: 14px; background: #fff; text-align: center; box-shadow: 0 18px 50px rgba(35,34,30,.07); }
      strong { display: block; color: #e85f4a; font-size: 72px; line-height: 1; }
      h1 { margin: 22px 0 12px; color: #171717; font-size: clamp(24px, 5vw, 34px); letter-spacing: -.04em; }
      p { margin: 0; color: #737373; font-size: 13px; line-height: 1.8; }
      a { display: inline-flex; margin-top: 26px; padding: 11px 15px; border-radius: 7px; background: #171717; color: #fff; font-size: 11px; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <strong>404</strong>
      <h1>该页面不在国内下载范围内</h1>
      <p>当前页面未被管理员登记，暂不提供国内下载。请返回上一级继续浏览。</p>
      <a href="/">回到 MAD Store</a>
    </main>
  </body>
</html>`;
  return new NextResponse(body, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function rewriteScopedHtmlLinks(html: string, currentUrl: string, scopeUrl: string, proxyOrigin: string) {
  return html.replace(
    /(\b(?:href|src|action)\s*=\s*)(["'])([^"']+)(\2)/gi,
    (match, prefix: string, quote: string, value: string) => {
      if (value.startsWith("#") || value.startsWith("data:") || value.startsWith("javascript:")) {
        return match;
      }
      try {
        const candidate = normalizeProxySourceUrl(new URL(value, currentUrl).toString());
        return proxySourceMatchesScope(candidate, scopeUrl)
          ? `${prefix}${quote}${buildProxyDownloadUrl(candidate, proxyOrigin)}${quote}`
          : match;
      } catch {
        return match;
      }
    },
  );
}

function responseHeaders(response: Response) {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  for (const name of forwardedResponseHeaders) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function fetchUpstream(
  request: NextRequest,
  sourceUrl: string,
  method: "GET" | "HEAD",
  rangeOverride?: string | null,
) {
  let target = new URL(sourceUrl);
  let response: Response | null = null;
  for (let redirect = 0; redirect < 5; redirect += 1) {
    response = await fetch(target, {
      method,
      headers: upstreamRequestHeaders(request, rangeOverride),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!redirectStatuses.has(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("上游重定向地址无效");
    const nextTarget = new URL(location, target).toString();
    if (!isSafeProxyTarget(nextTarget)) throw new Error("上游重定向地址不安全");
    target = new URL(normalizeProxySourceUrl(nextTarget));
  }

  if (!response) throw new Error("代理没有收到上游响应");
  if (redirectStatuses.has(response.status)) throw new Error("上游重定向次数过多");
  return { response, target };
}

function redirectToChunkedDownload(request: NextRequest) {
  const downloadPage = new URL("/download-proxy", request.nextUrl.origin);
  downloadPage.searchParams.set(
    "target",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(downloadPage, 302);
}

function contentLength(response: Response) {
  const value = response.headers.get("content-length");
  if (!value) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : null;
}

function resolveReleaseUrl(
  value: string | undefined,
  baseUrl: string,
  scopeUrl: string,
  proxyOrigin: string,
) {
  if (!value) return "";
  if (value.startsWith("#")) return value;

  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== "https:") return "";
    const normalized = normalizeProxySourceUrl(resolved.toString());
    return proxySourceMatchesScope(normalized, scopeUrl)
      ? buildProxyDownloadUrl(normalized, proxyOrigin)
      : normalized;
  } catch {
    return "";
  }
}

type ReleaseMarkdownNode = {
  children?: ReleaseMarkdownNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type?: string;
  value?: string;
};

function isReleaseMarkdownNode(value: unknown): value is ReleaseMarkdownNode {
  return Boolean(value && typeof value === "object");
}

function releaseMarkdownLinks(
  baseUrl: string,
  scopeUrl: string,
  proxyOrigin: string,
) {
  return (tree: ReleaseMarkdownNode) => {
    function visit(node: ReleaseMarkdownNode) {
      if (node.type === "element" && node.properties) {
        const attribute = node.tagName === "a"
          ? "href"
          : node.tagName === "img"
            ? "src"
            : "";
        const value = attribute ? node.properties[attribute] : undefined;
        if (attribute && typeof value === "string") {
          const resolved = resolveReleaseUrl(value, baseUrl, scopeUrl, proxyOrigin);
          if (resolved) {
            node.properties[attribute] = resolved;
            if (node.tagName === "a" && !resolved.startsWith("#")) {
              node.properties.target = "_blank";
              node.properties.rel = "noreferrer";
            }
          } else if (node.tagName === "img") {
            node.type = "text";
            node.value = String(node.properties.alt || "");
            delete node.tagName;
            delete node.properties;
            delete node.children;
          } else {
            delete node.properties[attribute];
          }
        }
      }
      if (node.children) node.children.forEach(visit);
    }

    if (isReleaseMarkdownNode(tree)) visit(tree);
  };
}

function renderReleaseMarkdown(
  markdown: string,
  baseUrl: string,
  scopeUrl: string,
  proxyOrigin: string,
) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(releaseMarkdownLinks, baseUrl, scopeUrl, proxyOrigin)
    .use(rehypeSanitize)
    .use(rehypeStringify);
  const tree = processor.parse(markdown);
  return String(processor.stringify(processor.runSync(tree)));
}

type GithubReleasePage = {
  owner: string;
  repo: string;
  tag: string | null;
};

function parseGithubReleasePage(sourceUrl: string): GithubReleasePage | null {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 3 && parts[2] === "releases") {
      return { owner: parts[0], repo: parts[1], tag: null };
    }
    if (parts.length >= 5 && parts[2] === "releases" && parts[3] === "tag") {
      return {
        owner: parts[0],
        repo: parts[1],
        tag: decodeURIComponent(parts.slice(4).join("/")),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function escapeHtml(value: unknown) {
  return stringValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReleaseAssetSize(value: unknown) {
  const size = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KiB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}

async function fetchGithubReleases(page: GithubReleasePage) {
  const repository = `${encodeURIComponent(page.owner)}/${encodeURIComponent(page.repo)}`;
  const endpoint = page.tag
    ? `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(page.tag)}`
    : `https://api.github.com/repos/${repository}/releases?per_page=30`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MAD-Store-Download-Proxy",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`GitHub Releases API returned ${response.status}`);
  const payload: unknown = await response.json();
  const values = Array.isArray(payload) ? payload : [payload];
  return values.filter(
    (value): value is Record<string, unknown> => isRecord(value) && value.draft !== true,
  );
}

function releasePageHtml(
  page: GithubReleasePage,
  releases: Record<string, unknown>[],
  scopeUrl: string,
  proxyOrigin: string,
) {
  const releaseCards = releases.map((release) => {
    const tag = stringValue(release.tag_name);
    const name = stringValue(release.name) || tag || "未命名版本";
    const publishedAt = stringValue(release.published_at).slice(0, 10);
    const body = stringValue(release.body).slice(0, 6_000);
    const releaseSourceUrl = page.tag
      ? `https://github.com/${page.owner}/${page.repo}/releases/tag/${encodeURIComponent(page.tag)}`
      : `https://github.com/${page.owner}/${page.repo}/releases`;
    const bodyHtml = body
      ? renderReleaseMarkdown(body, releaseSourceUrl, scopeUrl, proxyOrigin)
      : "";
    const tagSourceUrl = `https://github.com/${page.owner}/${page.repo}/releases/tag/${encodeURIComponent(tag)}`;
    const tagUrl = tag
      ? buildProxyDownloadUrl(tagSourceUrl, proxyOrigin)
      : "#";
    const assets = Array.isArray(release.assets) ? release.assets.filter(isRecord) : [];
    const assetLinks = assets.map((asset) => {
      const sourceAssetUrl = stringValue(asset.browser_download_url);
      try {
        const normalizedAssetUrl = normalizeProxySourceUrl(sourceAssetUrl);
        if (!proxySourceMatchesScope(normalizedAssetUrl, scopeUrl)) return "";
        const href = buildProxyDownloadUrl(normalizedAssetUrl, proxyOrigin);
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(asset.name || "下载文件")}</a><span>${escapeHtml(formatReleaseAssetSize(asset.size))}</span></li>`;
      } catch {
        return "";
      }
    }).filter(Boolean).join("");

    return `<article class="release-card">
      <h2><a href="${escapeHtml(tagUrl)}">${escapeHtml(name)}</a></h2>
      <p class="release-meta">${escapeHtml(tag)}${publishedAt ? ` · ${escapeHtml(publishedAt)}` : ""}</p>
      ${bodyHtml ? `<div class="release-body">${bodyHtml}</div>` : ""}
      ${assetLinks ? `<ul class="release-assets">${assetLinks}</ul>` : '<p class="release-empty">这个版本暂时没有可下载文件。</p>'}
    </article>`;
  }).join("");
  const backUrl = buildProxyDownloadUrl(`https://github.com/${page.owner}/${page.repo}/releases`, proxyOrigin);
  const navigation = page.tag
    ? `<a class="back" href="${escapeHtml(backUrl)}">← 返回版本列表</a>`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>国内下载 · ${escapeHtml(page.owner)}/${escapeHtml(page.repo)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; color: #2b2b2b; background: #fafaf8; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fafaf8; }
      main { width: min(1040px, calc(100% - 48px)); margin: 0 auto; padding: 54px 0 88px; }
      .back { color: #737373; font-size: 14px; line-height: 1.5; text-decoration: none; }
      h1 { margin: 28px 0 34px; color: #171717; font-size: clamp(32px, 5vw, 52px); line-height: 1.15; letter-spacing: -.035em; }
      .release-card { margin-top: 20px; padding: 30px; border: 1px solid #e7e7e5; border-radius: 14px; background: #fff; }
      h2 { margin: 0; font-size: 23px; line-height: 1.35; }
      h2 a, .release-assets a { color: #171717; text-decoration: none; }
      h2 a:hover, .release-assets a:hover { color: #e85f4a; }
      .release-meta { margin: 10px 0 0; color: #8c8c8c; font-size: 13px; line-height: 1.5; }
      .release-body { margin: 22px 0 0; color: #595959; font-size: 15px; line-height: 1.9; white-space: normal; overflow-wrap: break-word; word-break: normal; }
      .release-body > :first-child { margin-top: 0; }
      .release-body > :last-child { margin-bottom: 0; }
      .release-body p { margin: 0 0 15px; }
      .release-body h1, .release-body h2, .release-body h3, .release-body h4 { margin: 24px 0 10px; color: #2b2b2b; line-height: 1.4; letter-spacing: -.02em; }
      .release-body h1 { font-size: 24px; }
      .release-body h2 { font-size: 21px; }
      .release-body h3 { font-size: 18px; }
      .release-body h4 { font-size: 16px; }
      .release-body ul, .release-body ol { margin: 0 0 16px; padding-left: 24px; }
      .release-body li { margin: 5px 0; }
      .release-body a { color: #e85f4a; text-decoration: underline; text-underline-offset: 2px; }
      .release-body code { padding: 2px 5px; border-radius: 4px; background: #f1f1ef; color: #414141; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .release-body pre { overflow-x: auto; margin: 0 0 16px; padding: 14px 16px; border-radius: 8px; background: #202020; color: #f1f1f1; }
      .release-body pre code { padding: 0; background: none; color: inherit; }
      .release-body blockquote { margin: 0 0 16px; padding: 3px 0 3px 15px; border-left: 3px solid #e85f4a; color: #737373; }
      .release-body hr { margin: 18px 0; border: 0; border-top: 1px solid #e7e7e5; }
      .release-body table { width: 100%; margin: 0 0 16px; border-collapse: collapse; font-size: 13px; }
      .release-body th, .release-body td { padding: 9px 11px; border: 1px solid #e7e7e5; text-align: left; }
      .release-body img { display: block; max-width: 100%; height: auto; margin: 14px 0; border-radius: 8px; }
      .release-assets { display: grid; gap: 10px; margin: 24px 0 0; padding: 0; list-style: none; }
      .release-assets li { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 13px 15px; border-radius: 8px; background: #f4f4f2; font-size: 13px; line-height: 1.5; }
      .release-assets li a { min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; }
      .release-assets span { flex: 0 0 auto; white-space: nowrap; }
      .release-assets span, .release-empty { color: #8c8c8c; font-size: 12px; }
      .release-empty { margin: 20px 0 0; line-height: 1.6; }
      @media (max-width: 640px) {
        main { width: calc(100% - 24px); padding: 32px 0 56px; }
        h1 { margin: 22px 0 24px; font-size: 34px; }
        .release-card { padding: 22px 18px; }
        h2 { font-size: 21px; }
        .release-body { font-size: 14px; line-height: 1.85; }
        .release-assets li { flex-direction: column; gap: 6px; }
        .release-assets span { font-size: 11px; }
      }
    </style>
  </head>
  <body><main>${navigation}<h1>${escapeHtml(page.owner)}/${escapeHtml(page.repo)}</h1>${releaseCards || "<p class=\"release-empty\">暂时没有可用的发布版本。</p>"}</main></body>
</html>`;
}

async function proxyGithubReleasePage(
  page: GithubReleasePage,
  configuredProxySourceUrl: string,
  proxyOrigin: string,
) {
  const releases = await fetchGithubReleases(page);
  return releasePageHtml(page, releases, configuredProxySourceUrl, proxyOrigin);
}

async function handleProxyRequest(request: NextRequest, method: "GET" | "HEAD") {
  const sourceUrl = extractProxySourceUrl(request.nextUrl.pathname, request.nextUrl.search);
  if (!sourceUrl) return proxyError("下载地址无效", 404);

  let configuredProxy;
  try {
    configuredProxy = await findPublishedProxyDownload(sourceUrl);
  } catch (error) {
    console.error("Proxy scope lookup failed", error);
    return proxyError("下载服务暂时不可用", 503);
  }
  if (!configuredProxy) return proxyScopeNotFound();

  try {
    const githubReleasePage = method === "GET" ? parseGithubReleasePage(sourceUrl) : null;
    if (githubReleasePage) {
      const html = await proxyGithubReleasePage(
        githubReleasePage,
        configuredProxy.sourceUrl,
        request.nextUrl.origin,
      );
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
    const hasRange = Boolean(request.headers.get("range"));
    if (method === "GET" && !hasRange && isLikelyDownloadPath(sourceUrl)) {
      const head = await fetchUpstream(request, sourceUrl, "HEAD", null);
      const type = head.response.headers.get("content-type")?.toLowerCase() || "";
      const size = contentLength(head.response);
      const isHtml = type.startsWith("text/html");
      if (
        head.response.status === 405 ||
        (head.response.ok && !isHtml && (size === null || size > PROXY_DOWNLOAD_CHUNK_SIZE))
      ) {
        return redirectToChunkedDownload(request);
      }
      if (!head.response.ok && head.response.status !== 405) {
        return new NextResponse(null, {
          status: head.response.status,
          headers: responseHeaders(head.response),
        });
      }
    }

    const { response, target } = await fetchUpstream(request, sourceUrl, method);
    const headers = responseHeaders(response);
    const size = contentLength(response);
    if (method === "GET" && hasRange && size !== null && size > PROXY_DOWNLOAD_CHUNK_SIZE) {
      return proxyError("上游没有按分片范围返回内容", 502);
    }
    if (
      method === "GET" &&
      response.ok &&
      response.headers.get("content-type")?.toLowerCase().startsWith("text/html")
    ) {
      const html = await response.text();
      const rewritten = rewriteScopedHtmlLinks(
        html,
        target.toString(),
        configuredProxy.sourceUrl,
        request.nextUrl.origin,
      );
      headers.delete("content-length");
      return new NextResponse(rewritten, { status: response.status, headers });
    }
    return new NextResponse(method === "HEAD" ? null : response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Proxy request failed", error);
    return proxyError("下载请求失败，请稍后重试", 502);
  }
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return handleProxyRequest(request, "HEAD");
}
