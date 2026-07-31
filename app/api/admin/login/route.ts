import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, hasValidOrigin, sessionCookieOptions, verifyAdminPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "尝试次数过多，请稍后再试" }, { status: 429 });
  }
  const body = (await request.json()) as { password?: unknown };
  if (typeof body.password !== "string" || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ message: "密码不正确" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...sessionCookieOptions(), value: createSessionToken() });
  return response;
}
