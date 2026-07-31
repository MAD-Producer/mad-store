import { NextRequest, NextResponse } from "next/server";
import { reviewWithDeepSeek } from "@/lib/ai";
import { enrichSubmission } from "@/lib/github";
import { notifyAdmin, notifySubmitterReceived } from "@/lib/mail";
import { createSubmission } from "@/lib/projects";
import { rateLimit } from "@/lib/rate-limit";
import { parseSubmission } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`submit:${ip}`, 4, 60 * 60 * 1000)) {
      return NextResponse.json({ message: "提交过于频繁，请一小时后再试" }, { status: 429 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    if (body.website) return NextResponse.json({ message: "提交成功" });
    const input = parseSubmission(body);
    const [enrichment, aiReview] = await Promise.all([
      enrichSubmission(input),
      reviewWithDeepSeek(input),
    ]);
    const projectId = await createSubmission(input, enrichment, aiReview);
    const mailResults = await Promise.allSettled([
      notifyAdmin(input, projectId, aiReview),
      notifySubmitterReceived(input, projectId),
    ]);
    for (const result of mailResults) {
      if (result.status === "rejected") console.error("SMTP notification failed", result.reason);
    }
    return NextResponse.json({
      message: "项目已提交，我们会尽快核对信息",
      id: projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失败，请稍后重试";
    const status = message.includes("数据库尚未配置") ? 503 : 400;
    return NextResponse.json({ message }, { status });
  }
}
