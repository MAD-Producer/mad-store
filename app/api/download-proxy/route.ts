import { NextRequest, NextResponse } from "next/server";
import { findPublishedProxyDownload } from "@/lib/projects";
import {
  isSafeProxyTarget,
  normalizeProxySourceUrl,
  PROXY_DOWNLOAD_CHUNK_SIZE,
} from "@/lib/proxy-downloads";

export const runtime = "nodejs";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
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
const baseHeaders = {
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers":
    "Accept-Ranges, Content-Disposition, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Proxy-Chunk-Size": String(PROXY_DOWNLOAD_CHUNK_SIZE),
  "X-Robots-Tag": "noindex, nofollow",
};

function proxyError(message: string, status: 400 | 404 | 416 | 502 | 503) {
  return NextResponse.json({ message }, { status, headers: baseHeaders });
}

function parseRangeHeader(value: string | null) {
  if (!value) return null;
  const firstRange = value.split(",", 1)[0].trim();
  const match = /^bytes=(\d+)-(\d*)$/i.exec(firstRange);
  if (!match) return null;

  const start = Number(match[1]);
  if (!Number.isSafeInteger(start)) return null;

  const requestedEnd = match[2] ? Number(match[2]) : start + PROXY_DOWNLOAD_CHUNK_SIZE - 1;
  if (
    !Number.isSafeInteger(requestedEnd) ||
    requestedEnd < start ||
    requestedEnd - start + 1 > PROXY_DOWNLOAD_CHUNK_SIZE
  ) {
    return null;
  }
  return `bytes=${start}-${requestedEnd}`;
}

function responseHeaders(response: Response) {
  const headers = new Headers(baseHeaders);
  for (const name of forwardedResponseHeaders) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function upstreamHeaders(range: string | null) {
  const headers = new Headers({ "User-Agent": "MAD-Store-API-Download" });
  if (range) headers.set("Range", range);
  return headers;
}

async function fetchUpstream(
  sourceUrl: string,
  method: "GET" | "HEAD",
  range: string | null,
) {
  let target = new URL(sourceUrl);
  let response: Response | null = null;

  for (let redirect = 0; redirect < 5; redirect += 1) {
    response = await fetch(target, {
      method,
      headers: upstreamHeaders(range),
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

function contentRangeTotal(value: string | null) {
  const total = value?.match(/\/(\d+)$/)?.[1];
  const parsed = total ? Number(total) : 0;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function fetchHead(sourceUrl: string) {
  const head = await fetchUpstream(sourceUrl, "HEAD", null);
  if (head.response.status !== 405 && head.response.headers.get("content-length")) {
    return head.response;
  }

  const probe = await fetchUpstream(sourceUrl, "GET", "bytes=0-0");
  if (probe.response.status !== 206) return head.response;

  const headers = responseHeaders(probe.response);
  const total = contentRangeTotal(probe.response.headers.get("content-range"));
  headers.delete("content-range");
  if (total) headers.set("content-length", String(total));
  return new Response(null, { status: 200, headers });
}

function readTarget(request: NextRequest) {
  const rawTarget = request.nextUrl.searchParams.get("target");
  if (!rawTarget) throw new Error("缺少 target 参数");
  return normalizeProxySourceUrl(rawTarget);
}

async function authorizeTarget(sourceUrl: string) {
  const configuredProxy = await findPublishedProxyDownload(sourceUrl);
  return configuredProxy ? sourceUrl : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: baseHeaders });
}

export async function HEAD(request: NextRequest) {
  let sourceUrl: string;
  try {
    sourceUrl = readTarget(request);
  } catch (error) {
    return proxyError(error instanceof Error ? error.message : "下载地址无效", 400);
  }

  try {
    if (!(await authorizeTarget(sourceUrl))) {
      return proxyError("下载地址不在国内下载范围内", 404);
    }
    const response = await fetchHead(sourceUrl);
    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders(response),
    });
  } catch (error) {
    console.error("API download HEAD request failed", error);
    return proxyError("无法读取文件信息，请稍后重试", 502);
  }
}

export async function GET(request: NextRequest) {
  let sourceUrl: string;
  try {
    sourceUrl = readTarget(request);
  } catch (error) {
    return proxyError(error instanceof Error ? error.message : "下载地址无效", 400);
  }

  const range = parseRangeHeader(request.headers.get("range"));
  if (!range) {
    return proxyError(
      `GET 请求必须包含单个不超过 ${PROXY_DOWNLOAD_CHUNK_SIZE} 字节的 Range`,
      416,
    );
  }

  try {
    if (!(await authorizeTarget(sourceUrl))) {
      return proxyError("下载地址不在国内下载范围内", 404);
    }
    const { response } = await fetchUpstream(sourceUrl, "GET", range);
    if (response.status === 416) {
      return new NextResponse(null, { status: 416, headers: responseHeaders(response) });
    }
    const length = Number(response.headers.get("content-length"));
    if (
      response.status !== 206 ||
      (Number.isSafeInteger(length) && length > PROXY_DOWNLOAD_CHUNK_SIZE)
    ) {
      return proxyError("上游没有按分片范围返回内容", 502);
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders(response),
    });
  } catch (error) {
    console.error("API download range request failed", error);
    return proxyError("分片下载请求失败，请稍后重试", 502);
  }
}
