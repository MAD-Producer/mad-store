import { NextRequest, NextResponse } from "next/server";
import { notifyAdminWebsite, notifyWebsiteSubmitterReceived } from "@/lib/mail";
import { reserveRateLimit } from "@/lib/rate-limit";
import { parseWebsiteSubmission } from "@/lib/validation";
import { createWebsiteSubmission } from "@/lib/websites";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let releaseRateLimit: (() => void) | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.companyWebsite) return NextResponse.json({ message: "提交成功" });
    const input = parseWebsiteSubmission(body);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) {
      const reservation = reserveRateLimit(`website-submit:${ip}`, 4, 60 * 60 * 1000);
      if (!reservation.allowed) {
        return NextResponse.json(
          { message: "提交过于频繁，请一小时后再试" },
          { status: 429, headers: { "Retry-After": String(reservation.retryAfterSeconds) } },
        );
      }
      releaseRateLimit = reservation.release;
    }
    const websiteId = await createWebsiteSubmission(input);
    const mailResults = await Promise.allSettled([
      notifyAdminWebsite(input, websiteId),
      notifyWebsiteSubmitterReceived(input, websiteId),
    ]);
    for (const result of mailResults) {
      if (result.status === "rejected") console.error("SMTP notification failed", result.reason);
    }
    return NextResponse.json({
      message: "网站已提交，我们会尽快审核",
      id: websiteId,
    });
  } catch (error) {
    releaseRateLimit?.();
    const message = error instanceof Error ? error.message : "提交失败，请稍后重试";
    return NextResponse.json(
      { message },
      { status: message.includes("数据库尚未配置") ? 503 : 400 },
    );
  }
}
