export type SystemName = "Windows" | "macOS" | "Web";
export type ProjectStatus = "pending" | "published" | "rejected";

export interface ProjectCustomField {
  label: string;
  value: string;
  url?: string;
}

export interface ProjectDownload {
  label: string;
  url: string;
}

/** 由管理员手动登记的本站代理范围。sourceUrl 及其子路径都会被代理。 */
export interface ProjectProxyDownload {
  label: string;
  sourceUrl: string;
}

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
  contactQQ?: string;
  downloads?: ProjectDownload[];
  /** 兼容早期版本中的单下载地址。 */
  downloadUrl?: string;
  proxyDownloads?: ProjectProxyDownload[];
  officialUrl?: string;
  customFields?: ProjectCustomField[];
  rejectionReason?: string;
  aiReview?: AIReview | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  categories: string[];
  tags: string[];
}

export interface Website {
  id: string;
  name: string;
  url: string;
  description: string;
  category?: string;
  tags: string[];
  status: ProjectStatus;
  submitterName?: string;
  submitterEmail?: string;
  contactQQ?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
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
  contactQQ?: string;
  officialUrl?: string;
}

export interface WebsiteSubmissionInput {
  name: string;
  url: string;
  description: string;
  category?: string;
  tags: string[];
  submitterName?: string;
  submitterEmail?: string;
  contactQQ?: string;
}
