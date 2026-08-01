import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, isAdmin } from "@/lib/auth";
import { notifyWebsiteSubmitterStatus } from "@/lib/mail";
import { parseWebsiteSubmission } from "@/lib/validation";
import { isWebsiteStatus, updateWebsite } from "@/lib/websites";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return NextResponse.json({ message: "未登录" }, { status: 401 });
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (body.status !== undefined && !isWebsiteStatus(body.status)) throw new Error("审核状态无效");
    const input = parseWebsiteSubmission(body);
    const rejectionReason = String(body.rejectionReason || "").trim().slice(0, 600);
    if (body.status === "rejected" && !rejectionReason) {
      throw new Error("拒绝网站投稿时必须填写拒绝理由");
    }
    const result = await updateWebsite(id, {
      ...input,
      rejectionReason,
      status: body.status,
    });
    if (
      result.previous.status !== result.updated.status &&
      (result.updated.status === "published" || result.updated.status === "rejected")
    ) {
      await notifyWebsiteSubmitterStatus(result.updated).catch((error) => {
        console.error("Website submitter status email failed", error);
      });
    }
    return NextResponse.json({
      message: body.status === "published" ? "网站已审核并发布" : "网站投稿已更新",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 400 },
    );
  }
}
