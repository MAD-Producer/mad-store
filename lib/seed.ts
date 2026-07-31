import type { Project, SiteSettings } from "./types";

const now = "2026-07-31T00:00:00.000Z";

export const seedProjects: Project[] = [
  {
    id: "seed-mad-toolbox",
    slug: "mad-toolbox",
    name: "MAD Toolbox",
    description: "面向 MAD / AMV 创作者的一站式工具箱，集中整理常用制作能力与创作工作流。",
    repoUrl: "https://github.com/MAD-Producer/MAD-Toolbox",
    authorUrl: "https://github.com/MAD-Producer",
    license: "开源仓库",
    systems: ["Windows"],
    tags: ["MAD", "AE", "工具箱"],
    category: "制作工具",
    status: "published",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "seed-mad-doc",
    slug: "mad-doc",
    name: "MAD DOC",
    description: "MAD / AMV 制作知识文档与学习资料，为创作者提供可持续维护的中文参考。",
    repoUrl: "https://github.com/MAD-Producer/MAD-DOC",
    authorUrl: "https://github.com/MAD-Producer",
    license: "开源仓库",
    systems: ["Windows", "macOS"],
    tags: ["MAD", "文档", "教程"],
    category: "文档与教程",
    status: "published",
    createdAt: now,
    updatedAt: now,
  },
];

export const defaultSettings: SiteSettings = {
  categories: ["制作工具", "下载与转码", "素材与资源", "文档与教程", "其他"],
  tags: ["MAD", "AMV", "AE", "PR", "转码", "B站视频下载", "素材", "文档", "教程", "工具箱"],
};
