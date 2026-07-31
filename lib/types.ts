export type SystemName = "Windows" | "macOS";
export type ProjectStatus = "pending" | "published" | "rejected";

export interface AIReview {
  score: number;
  summary: string;
  reasons: string[];
  securityConcerns: string[];
  suggestedCategory?: string;
  normalizedTags?: string[];
  reviewedAt: string;
  provider: "deepseek";
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string;
  repoUrl: string;
  authorUrl: string;
  license: string;
  systems: SystemName[];
  tags: string[];
  category: string;
  readme?: string;
  stars?: number;
  language?: string;
  status: ProjectStatus;
  submitterName?: string;
  submitterEmail?: string;
  authorQQ?: string;
  aiReview?: AIReview | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  categories: string[];
  tags: string[];
}

export interface SubmissionInput {
  name: string;
  description: string;
  repoUrl: string;
  authorUrl: string;
  license: string;
  systems: SystemName[];
  tags: string[];
  submitterName: string;
  submitterEmail: string;
  authorQQ?: string;
}
