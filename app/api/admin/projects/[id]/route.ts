import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, isAdmin } from "@/lib/auth";
import { isProjectStatus, updateProject } from "@/lib/projects";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return NextResponse.json({ message: "未登录" }, { status: 401 });
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (body.status !== undefined && !isProjectStatus(body.status)) throw new Error("审核状态无效");
    const systems = Array.isArray(body.systems)
      ? body.systems.filter((item) => item === "Windows" || item === "macOS")
      : [];
    const tags = Array.isArray(body.tags)
      ? [...new Set(body.tags.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 12)
      : [];
    await updateProject(id, {
      name: String(body.name || "").trim().slice(0, 80),
      description: String(body.description || "").trim().slice(0, 320),
      repoUrl: String(body.repoUrl || "").trim().slice(0, 300),
      authorUrl: String(body.authorUrl || "").trim().slice(0, 300),
      license: String(body.license || "").trim().slice(0, 80),
      category: String(body.category || "其他").trim().slice(0, 40),
      systems,
      tags,
      status: body.status,
    });
    return NextResponse.json({ message: body.status === "published" ? "已人工审核并发布" : "项目已更新" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 400 },
    );
  }
}
