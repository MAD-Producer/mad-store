import { NextRequest, NextResponse } from "next/server";
import { findPublishedProxyDownload } from "@/lib/projects";
import {
  buildProxyDownloadUrl,
  extractProxySourceUrl,
  isSafeProxyTarget,
  normalizeProxySourceUrl,
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

function upstreamRequestHeaders(request: NextRequest) {
  const headers = new Headers({ "User-Agent": "MAD-Store-Download-Proxy" });
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
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
    let target = new URL(sourceUrl);
    let response: Response | null = null;
    for (let redirect = 0; redirect < 5; redirect += 1) {
      response = await fetch(target, {
        method,
        headers: upstreamRequestHeaders(request),
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

    const headers = new Headers({
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    });
    for (const name of forwardedResponseHeaders) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
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
