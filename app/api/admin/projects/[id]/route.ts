import { NextRequest, NextResponse } from "next/server";
import { hasValidOrigin, isAdmin } from "@/lib/auth";
import { notifySubmitterStatus } from "@/lib/mail";
import { hasProxyScope, normalizeProxySourceUrl } from "@/lib/proxy-downloads";
import { isProjectStatus, updateProject } from "@/lib/projects";
import type { ProjectCustomField, ProjectDownload, ProjectProxyDownload } from "@/lib/types";

function optionalHttpsUrl(value: unknown, field: string) {
  const clean = String(value || "").trim().slice(0, 500);
  if (!clean) return "";
  try {
    if (new URL(clean).protocol !== "https:") throw new Error();
    return clean;
  } catch {
    throw new Error(`${field}必须是有效的 HTTPS 地址`);
  }
}

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
      ? body.systems.filter(
          (item) => item === "Windows" || item === "macOS" || item === "Web",
        )
      : [];
    const tags = Array.isArray(body.tags)
      ? [...new Set(body.tags.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 12)
      : [];
    const customFields: ProjectCustomField[] = Array.isArray(body.customFields)
      ? body.customFields
          .map((item) => {
            const field = item && typeof item === "object" ? item as Record<string, unknown> : {};
            return {
              label: String(field.label || "").trim().slice(0, 30),
              value: String(field.value || "").trim().slice(0, 160),
              url: optionalHttpsUrl(field.url, "自定义字段链接") || undefined,
            };
          })
          .filter((field) => field.label && field.value)
          .slice(0, 12)
      : [];
    const downloads: ProjectDownload[] = Array.isArray(body.downloads)
      ? body.downloads
          .map((item) => {
            const download = item && typeof item === "object" ? item as Record<string, unknown> : {};
            return {
              label: String(download.label || "").trim().slice(0, 40),
              url: optionalHttpsUrl(download.url, "下载链接"),
            };
          })
          .filter((download) => download.label && download.url)
          .slice(0, 12)
      : [];
    const proxyDownloads: ProjectProxyDownload[] = Array.isArray(body.proxyDownloads)
      ? body.proxyDownloads
          .map((item) => {
            const download = item && typeof item === "object" ? item as Record<string, unknown> : {};
            const sourceUrl = normalizeProxySourceUrl(download.sourceUrl);
            if (sourceUrl && !hasProxyScope(sourceUrl)) {
              throw new Error("本站代理链接必须指向具体目录，不能代理整个站点");
            }
            return {
              label: String(download.label || "").trim().slice(0, 40),
              sourceUrl,
            };
          })
          .filter((download) => download.label && download.sourceUrl)
          .slice(0, 12)
      : [];
    const rejectionReason = String(body.rejectionReason || "").trim().slice(0, 600);
    if (body.status === "rejected" && !rejectionReason) throw new Error("拒绝项目时必须填写拒绝理由");
    const result = await updateProject(id, {
      slug: String(body.slug || "").trim().slice(0, 72),
      name: String(body.name || "").trim().slice(0, 80),
      description: String(body.description || "").trim().slice(0, 320),
      repoUrl: String(body.repoUrl || "").trim().slice(0, 300),
      authorUrl: String(body.authorUrl || "").trim().slice(0, 300),
      contactQQ: String(body.contactQQ || "").trim().slice(0, 20),
      downloads,
      proxyDownloads,
      officialUrl: optionalHttpsUrl(body.officialUrl, "官网地址"),
      license: String(body.license || "").trim().slice(0, 80),
      category: String(body.category || "其他").trim().slice(0, 40),
      systems,
      tags,
      customFields,
      rejectionReason,
      status: body.status,
    });
    if (
      result.previous.status !== result.updated.status &&
      (result.updated.status === "published" || result.updated.status === "rejected")
    ) {
      await notifySubmitterStatus(result.updated).catch((error) => {
        console.error("Submitter status email failed", error);
      });
    }
    return NextResponse.json({ message: body.status === "published" ? "已人工审核并发布" : "项目已更新" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新失败" },
      { status: 400 },
    );
  }
}
