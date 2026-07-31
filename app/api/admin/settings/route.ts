import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, isAdmin } from "@/lib/auth";
import { updateSettings } from "@/lib/projects";

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ message: "未登录" }, { status: 401 });
  if (!hasValidOrigin(request)) return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  try {
    const body = (await request.json()) as { categories?: unknown; tags?: unknown };
    const categories = Array.isArray(body.categories)
      ? [...new Set(body.categories.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 30)
      : [];
    const tags = Array.isArray(body.tags)
      ? [...new Set(body.tags.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 80)
      : [];
    if (!categories.length || !tags.length) throw new Error("分类和标签不能为空");
    await updateSettings({ categories, tags });
    return NextResponse.json({ message: "字段选项已更新" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 400 },
    );
  }
}
