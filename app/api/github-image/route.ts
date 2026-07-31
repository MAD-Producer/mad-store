import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "camo.githubusercontent.com",
  "avatars.githubusercontent.com",
  "user-images.githubusercontent.com",
  "private-user-images.githubusercontent.com",
]);

function allowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error("只允许代理 GitHub 图片");
  }
  return url;
}

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url");
  if (!value) return NextResponse.json({ message: "缺少图片地址" }, { status: 400 });

  try {
    let url = allowedUrl(value);
    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect += 1) {
      response = await fetch(url, {
        redirect: "manual",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*",
          "User-Agent": "MAD-Store-Image-Proxy",
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("GitHub 图片重定向无效");
      url = allowedUrl(new URL(location, url).toString());
    }
    if (!response?.ok) throw new Error("GitHub 图片读取失败");
    const contentType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!contentType.startsWith("image/")) throw new Error("目标内容不是图片");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("图片超过 8 MB");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "图片代理失败" },
      { status: 400 },
    );
  }
}
