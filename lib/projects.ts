import { ObjectId, type Document } from "mongodb";
import { getDatabase, hasMongoConfig } from "./mongodb";
import { defaultSettings, seedProjects } from "./seed";
import { createSlug } from "./slug";
import type { Project, ProjectStatus, SiteSettings, SubmissionInput } from "./types";

function serializeProject(document: Document): Project {
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
    authorQQ: document.authorQQ,
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
  const baseSlug = createSlug(input.name);
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
  return result.insertedId.toString();
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "description" | "repoUrl" | "authorUrl" | "authorQQ" | "license" | "systems" | "tags" | "category" | "status">>,
) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
  const allowed: Record<string, unknown> = {};
  const keys = ["name", "description", "repoUrl", "authorUrl", "authorQQ", "license", "systems", "tags", "category", "status"] as const;
  for (const key of keys) if (updates[key] !== undefined) allowed[key] = updates[key];
  if (typeof allowed.name === "string") allowed.slug = createSlug(allowed.name);
  allowed.updatedAt = new Date();
  const result = await db.collection("projects").updateOne(filter, { $set: allowed });
  if (!result.matchedCount) throw new Error("未找到项目");
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
