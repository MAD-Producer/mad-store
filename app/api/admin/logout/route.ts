import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...sessionCookieOptions(), value: "", maxAge: 0 });
  return response;
}
