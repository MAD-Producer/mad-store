import { ObjectId, type Document } from "mongodb";
import { getDatabase, hasMongoConfig } from "./mongodb";
import { proxySourceMatchesScope } from "./proxy-downloads";
import { defaultSettings, seedProjects } from "./seed";
import { createSlug } from "./slug";
import type { Project, ProjectProxyDownload, ProjectStatus, SiteSettings, SubmissionInput } from "./types";

function serializeProject(document: Document): Project {
  const downloads = Array.isArray(document.downloads)
    ? document.downloads.map((download) => ({
        ...download,
        label: download.label === "直接下载" ? "下载" : download.label,
      }))
    : document.downloadUrl
      ? [{ label: "下载", url: document.downloadUrl }]
      : [];
  const proxyDownloads: ProjectProxyDownload[] = Array.isArray(document.proxyDownloads)
    ? document.proxyDownloads
        .map((download) => ({
          label: String(download.label || "").trim(),
          sourceUrl: String(download.sourceUrl || "").trim(),
        }))
        .filter((download) => download.label && download.sourceUrl)
    : [];

  return {
    id: document._id?.toString?.() || document.id || "",
    slug: document.slug,
    name: document.name,
    description: document.description,
    repoUrl: document.repoUrl,
    authorUrl: document.authorUrl,
    license: document.license,
    systems: document.systems || [],
    tags: document.tags || [],
    category: document.category || "其他",
    readme: document.readme,
    stars: document.stars,
    language: document.language,
    status: document.status,
    submitterName: document.submitterName,
    submitterEmail: document.submitterEmail,
    contactQQ: document.contactQQ || document.authorQQ,
    downloads,
    downloadUrl: document.downloadUrl,
    proxyDownloads,
    officialUrl: document.officialUrl,
    customFields: Array.isArray(document.customFields) ? document.customFields : [],
    rejectionReason: document.rejectionReason,
    aiReview: document.aiReview || null,
    createdAt: new Date(document.createdAt).toISOString(),
    updatedAt: new Date(document.updatedAt).toISOString(),
  };
}

export async function getPublishedProjects() {
  if (!hasMongoConfig()) return seedProjects;
  const db = await getDatabase();
  const documents = await db
    .collection("projects")
    .find({ status: "published" })
    .sort({ updatedAt: -1 })
    .toArray();
  return documents.map(serializeProject);
}

export async function getProjectBySlug(slug: string) {
  if (!hasMongoConfig()) return seedProjects.find((project) => project.slug === slug) || null;
  const db = await getDatabase();
  const document = await db.collection("projects").findOne({ slug, status: "published" });
  return document ? serializeProject(document) : null;
}

export async function getAllProjects() {
  if (!hasMongoConfig()) return seedProjects;
  const db = await getDatabase();
  const documents = await db.collection("projects").find({}).sort({ createdAt: -1 }).toArray();
  return documents.map(serializeProject);
}

export async function findPublishedProxyDownload(sourceUrl: string) {
  if (!hasMongoConfig()) return null;
  const db = await getDatabase();
  const documents = await db.collection("projects").find(
    { status: "published", proxyDownloads: { $exists: true } },
    { projection: { proxyDownloads: 1 } },
  ).toArray();
  for (const document of documents) {
    if (!Array.isArray(document.proxyDownloads)) continue;
    const match = document.proxyDownloads.find(
      (download: { sourceUrl?: unknown }) =>
        typeof download.sourceUrl === "string" && proxySourceMatchesScope(sourceUrl, download.sourceUrl),
    );
    if (match && typeof match.sourceUrl === "string") {
      return { label: String(match.label || "本站代理下载"), sourceUrl: match.sourceUrl };
    }
  }
  return null;
}

export async function getSettings(): Promise<SiteSettings> {
  if (!hasMongoConfig()) return defaultSettings;
  const db = await getDatabase();
  const settings = await db.collection("settings").findOne({ key: "site" });
  return {
    categories: settings?.categories || defaultSettings.categories,
    tags: settings?.tags || defaultSettings.tags,
  };
}

export async function createSubmission(
  input: SubmissionInput,
  enrichment: {
    repositoryName: string;
    readme: string;
    stars: number;
    language?: string;
    canonicalRepoUrl: string;
    canonicalAuthorUrl: string;
    detectedLicense: string;
  },
  aiReview: Project["aiReview"],
) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  const createdAt = new Date();
  const baseSlug = createSlug(enrichment.repositoryName);
  const existing = await db.collection("projects").findOne({ repoUrl: enrichment.canonicalRepoUrl });
  if (existing) throw new Error("这个仓库已经提交过了");

  let slug = baseSlug;
  if (await db.collection("projects").findOne({ slug })) slug = `${baseSlug}-${Date.now().toString(36)}`;

  const result = await db.collection("projects").insertOne({
    ...input,
    repoUrl: enrichment.canonicalRepoUrl,
    authorUrl: enrichment.canonicalAuthorUrl,
    license: enrichment.detectedLicense,
    slug,
    readme: enrichment.readme,
    stars: enrichment.stars,
    language: enrichment.language,
    category: aiReview?.suggestedCategory || "待分类",
    tags: aiReview?.normalizedTags?.length ? aiReview.normalizedTags : input.tags,
    status: "pending",
    aiReview,
    createdAt,
    updatedAt: createdAt,
  });
  if (input.tags.length) {
    await db.collection("settings").updateOne(
      { key: "site" },
      { $addToSet: { tags: { $each: input.tags } } },
    );
  }
  return result.insertedId.toString();
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "slug" | "name" | "description" | "repoUrl" | "authorUrl" | "contactQQ" | "license" | "systems" | "tags" | "category" | "status" | "downloads" | "proxyDownloads" | "officialUrl" | "customFields" | "rejectionReason">>,
) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
  const allowed: Record<string, unknown> = {};
  const existing = await db.collection("projects").findOne(filter);
  if (!existing) throw new Error("未找到项目");
  const keys = ["slug", "name", "description", "repoUrl", "authorUrl", "contactQQ", "license", "systems", "tags", "category", "status", "downloads", "proxyDownloads", "officialUrl", "customFields", "rejectionReason"] as const;
  for (const key of keys) if (updates[key] !== undefined) allowed[key] = updates[key];
  if (typeof allowed.slug === "string") {
    if (!allowed.slug.trim()) throw new Error("slug 不能为空");
    allowed.slug = createSlug(allowed.slug);
    const duplicate = await db.collection("projects").findOne({
      slug: allowed.slug,
      _id: { $ne: ObjectId.isValid(id) ? new ObjectId(id) : new ObjectId() },
    });
    if (duplicate) throw new Error("这个 slug 已被其他项目使用");
  }
  allowed.updatedAt = new Date();
  const replacesLegacyDownload = updates.downloads !== undefined;
  await db.collection("projects").updateOne(
    filter,
    replacesLegacyDownload
      ? { $set: allowed, $unset: { downloadUrl: "" } }
      : { $set: allowed },
  );
  const updatedDocument = { ...existing, ...allowed };
  if (replacesLegacyDownload) delete updatedDocument.downloadUrl;
  return {
    previous: serializeProject(existing),
    updated: serializeProject(updatedDocument),
  };
}

export async function updateSettings(settings: SiteSettings) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  await db.collection("settings").updateOne(
    { key: "site" },
    { $set: { categories: settings.categories, tags: settings.tags, updatedAt: new Date() } },
    { upsert: true },
  );
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "pending" || value === "published" || value === "rejected";
}
