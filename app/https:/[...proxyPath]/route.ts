import { NextRequest, NextResponse } from "next/server";
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

async function handleProxyRequest(request: NextRequest, method: "GET" | "HEAD") {
  const sourceUrl = extractProxySourceUrl(request.nextUrl.pathname, request.nextUrl.search);
  if (!sourceUrl) return proxyError("代理地址无效", 404);

  let configuredProxy;
  try {
    configuredProxy = await findPublishedProxyDownload(sourceUrl);
  } catch (error) {
    console.error("Proxy scope lookup failed", error);
    return proxyError("代理服务暂时不可用", 503);
  }
  if (!configuredProxy) return proxyError("这个地址没有被管理员登记为本站代理范围", 404);

  try {
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
    return proxyError("代理请求失败，请稍后重试", 502);
  }
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return handleProxyRequest(request, "HEAD");
}
