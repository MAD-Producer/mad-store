import { ObjectId, type Document } from "mongodb";
import { getDatabase, hasMongoConfig } from "./mongodb";
import type { ProjectStatus, Website, WebsiteSubmissionInput } from "./types";

function serializeWebsite(document: Document): Website {
  return {
    id: document._id?.toString?.() || document.id || "",
    name: document.name,
    url: document.url,
    description: document.description,
    category: document.category || undefined,
    tags: Array.isArray(document.tags) ? document.tags : [],
    status: document.status,
    submitterName: document.submitterName || undefined,
    submitterEmail: document.submitterEmail || undefined,
    contactQQ: document.contactQQ || undefined,
    rejectionReason: document.rejectionReason || undefined,
    createdAt: new Date(document.createdAt).toISOString(),
    updatedAt: new Date(document.updatedAt).toISOString(),
  };
}

function canonicalWebsiteUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

export async function getPublishedWebsites() {
  if (!hasMongoConfig()) return [];
  const db = await getDatabase();
  const documents = await db
    .collection("websites")
    .find({ status: "published" })
    .sort({ updatedAt: -1 })
    .toArray();
  return documents.map(serializeWebsite);
}

export async function getAllWebsites() {
  if (!hasMongoConfig()) return [];
  const db = await getDatabase();
  const documents = await db.collection("websites").find({}).sort({ createdAt: -1 }).toArray();
  return documents.map(serializeWebsite);
}

export async function createWebsiteSubmission(input: WebsiteSubmissionInput) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  const url = canonicalWebsiteUrl(input.url);
  if (await db.collection("websites").findOne({ url })) {
    throw new Error("这个网站已经提交过了");
  }
  const now = new Date();
  const result = await db.collection("websites").insertOne({
    ...input,
    url,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  if (input.tags.length) {
    await db.collection("settings").updateOne(
      { key: "site" },
      { $addToSet: { tags: { $each: input.tags } } },
    );
  }
  return result.insertedId.toString();
}

export async function updateWebsite(
  id: string,
  updates: Partial<Pick<Website, "name" | "url" | "description" | "category" | "tags" | "status" | "submitterName" | "submitterEmail" | "contactQQ" | "rejectionReason">>,
) {
  if (!hasMongoConfig()) throw new Error("站点数据库尚未配置");
  const db = await getDatabase();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
  const existing = await db.collection("websites").findOne(filter);
  if (!existing) throw new Error("未找到网站投稿");
  const allowed: Record<string, unknown> = { ...updates };
  if (typeof allowed.url === "string") {
    allowed.url = canonicalWebsiteUrl(allowed.url);
    const duplicate = await db.collection("websites").findOne({
      url: allowed.url,
      _id: { $ne: ObjectId.isValid(id) ? new ObjectId(id) : new ObjectId() },
    });
    if (duplicate) throw new Error("这个网站已经存在");
  }
  allowed.updatedAt = new Date();
  await db.collection("websites").updateOne(filter, { $set: allowed });
  return {
    previous: serializeWebsite(existing),
    updated: serializeWebsite({ ...existing, ...allowed }),
  };
}

export function isWebsiteStatus(value: unknown): value is ProjectStatus {
  return value === "pending" || value === "published" || value === "rejected";
}
