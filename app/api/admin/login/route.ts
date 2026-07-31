import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  hasAdminSessionSecret,
  hasValidOrigin,
  sessionCookieOptions,
  verifyAdminCredentials,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  if (!hasAdminSessionSecret()) {
    return NextResponse.json({ message: "管理员会话密钥尚未配置" }, { status: 503 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "尝试次数过多，请稍后再试" }, { status: 429 });
  }
  const body = (await request.json()) as { username?: unknown; password?: unknown };
  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ message: "请输入管理员账号和密码" }, { status: 400 });
  }
  const username = verifyAdminCredentials(body.username, body.password);
  if (!username) {
    return NextResponse.json({ message: "账号或密码不正确" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...sessionCookieOptions(), value: createSessionToken(username) });
  return response;
}
