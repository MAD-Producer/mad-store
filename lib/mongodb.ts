import { Db, MongoClient, ServerApiVersion } from "mongodb";
import { defaultSettings, seedProjects } from "./seed";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "mad_store";

declare global {
  var __madMongoPromise: Promise<MongoClient> | undefined;
}

export function hasMongoConfig() {
  return Boolean(uri);
}

async function getClient() {
  if (!uri) throw new Error("MONGODB_URI 未配置");
  if (!global.__madMongoPromise) {
    const client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      maxPoolSize: 8,
    });
    global.__madMongoPromise = client.connect();
  }
  return global.__madMongoPromise;
}

let initialized = false;

async function initialize(db: Db) {
  if (initialized) return;
  const projects = db.collection("projects");
  const settings = db.collection("settings");
  await Promise.all([
    projects.createIndex({ slug: 1 }, { unique: true }),
    projects.createIndex({ status: 1, category: 1, updatedAt: -1 }),
    projects.createIndex({ repoUrl: 1 }, { unique: true }),
    projects.createIndex({ tags: 1 }),
  ]);

  await settings.updateOne(
    { key: "site" },
    { $setOnInsert: { key: "site", ...defaultSettings } },
    { upsert: true },
  );

  for (const project of seedProjects) {
    const document: Partial<typeof project> = { ...project };
    delete document.id;
    await projects.updateOne(
      { repoUrl: project.repoUrl },
      { $setOnInsert: document },
      { upsert: true },
    );
  }
  initialized = true;
}

export async function getDatabase() {
  const client = await getClient();
  const db = client.db(dbName);
  await initialize(db);
  return db;
}
