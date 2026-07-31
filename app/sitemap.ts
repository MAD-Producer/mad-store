import type { MetadataRoute } from "next";
import { getPublishedProjects } from "@/lib/projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mad-store.edgeone.app";
  const projects = await getPublishedProjects();
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/projects`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/submit`, changeFrequency: "monthly", priority: 0.7 },
    ...projects.map((project) => ({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: new Date(project.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
