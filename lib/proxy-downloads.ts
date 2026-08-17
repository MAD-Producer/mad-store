const DEFAULT_SITE_URL = "https://store.madproducer.cn";
const MAX_PROXY_SOURCE_URL_LENGTH = 2_000;

function hostnameIsLocal(hostname: string) {
  const clean = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean === "0.0.0.0" ||
    clean === "::" ||
    clean === "::1"
  ) {
    return true;
  }

  const ipv4 = clean.split(".").map(Number);
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [first, second] = ipv4;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (clean.startsWith("::ffff:")) return hostnameIsLocal(clean.slice(7));
  return clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe8") || clean.startsWith("fe9") || clean.startsWith("fea") || clean.startsWith("feb");
}

export function isSafeProxyTarget(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !hostnameIsLocal(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeProxySourceUrl(value: unknown) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.length > MAX_PROXY_SOURCE_URL_LENGTH) {
    throw new Error("本站代理地址不能超过 2000 个字符");
  }

  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new Error("本站代理地址必须是有效的 HTTPS 地址");
  }
  if (!isSafeProxyTarget(url.toString())) {
    throw new Error("本站代理地址必须是公开的 HTTPS 地址，且不能包含账号信息");
  }
  // Fragment 不会随 HTTP 请求发送，去掉它可以避免生成一个永远无法匹配的代理地址。
  url.hash = "";
  return url.toString();
}

export function hasProxyScope(sourceUrl: string) {
  try {
    return new URL(sourceUrl).pathname !== "/";
  } catch {
    return false;
  }
}

function normalizedPath(pathname: string) {
  const clean = pathname.replace(/\/+$/, "");
  return clean || "/";
}

/** 判断请求地址是否位于管理员登记的源地址目录下。 */
export function proxySourceMatchesScope(candidateUrl: string, scopeUrl: string) {
  try {
    const candidate = new URL(candidateUrl);
    const scope = new URL(scopeUrl);
    if (
      candidate.protocol !== scope.protocol ||
      candidate.hostname !== scope.hostname ||
      candidate.port !== scope.port
    ) {
      return false;
    }
    const candidatePath = normalizedPath(candidate.pathname);
    const scopePath = normalizedPath(scope.pathname);
    return candidatePath === scopePath || candidatePath.startsWith(`${scopePath}/`);
  } catch {
    return false;
  }
}

/** 生成类似 https://store.madproducer.cn/https://github.com/... 的本站代理地址。 */
export function buildProxyDownloadUrl(sourceUrl: string, siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL) {
  return `${siteUrl.replace(/\/+$/, "")}/${sourceUrl.replace(/^\/+/, "")}`;
}

/** 从 /https://... 形式的请求路径中还原源地址。 */
export function extractProxySourceUrl(pathname: string, search = "") {
  function safelyNormalize(value: string) {
    try {
      return normalizeProxySourceUrl(value) || null;
    } catch {
      return null;
    }
  }

  const unnormalizedPrefix = "/https://";
  if (pathname.startsWith(unnormalizedPrefix)) {
    return safelyNormalize(`${pathname.slice(1)}${search}`);
  }

  // Next.js normalizes repeated slashes in request paths and redirects
  // /https://github.com/... to /https:/github.com/.... Accept both forms.
  const normalizedPrefix = "/https:/";
  if (!pathname.startsWith(normalizedPrefix)) return null;
  return safelyNormalize(`https://${pathname.slice(normalizedPrefix.length)}${search}`);
}
