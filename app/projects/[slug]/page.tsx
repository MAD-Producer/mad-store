import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Info,
  Laptop,
  Scale,
  Star,
  Tags,
  UserRound,
} from "lucide-react";
import { SiGithub } from "react-icons/si";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { fetchReadme } from "@/lib/github";
import { describeLicense } from "@/lib/licenses";
import { getProjectBySlug } from "@/lib/projects";

export const revalidate = 300;

function resolveReadmeUrl(value: string | undefined, repoUrl: string, image = false) {
  if (!value) return "";
  if (value.startsWith("#")) return value;
  try {
    const absolute = new URL(value);
    return absolute.protocol === "https:" ? absolute.toString() : "";
  } catch {
    const repo = new URL(repoUrl);
    const [owner, name] = repo.pathname.split("/").filter(Boolean);
    if (!owner || !name) return "";
    const clean = value.replace(/^\.?\//, "");
    return image
      ? `https://raw.githubusercontent.com/${owner}/${name}/HEAD/${clean}`
      : `https://github.com/${owner}/${name}/blob/HEAD/${clean}`;
  }
}

function imageSource(value: string) {
  try {
    const url = new URL(value);
    const githubHosts = [
      "github.com",
      "raw.githubusercontent.com",
      "camo.githubusercontent.com",
      "avatars.githubusercontent.com",
      "user-images.githubusercontent.com",
      "private-user-images.githubusercontent.com",
    ];
    return githubHosts.includes(url.hostname)
      ? `/api/github-image?url=${encodeURIComponent(url.toString())}`
      : url.toString();
  } catch {
    return "";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "项目不存在" };
  return {
    title: project.name,
    description: project.description,
    keywords: [project.name, project.category, ...project.tags, ...project.systems],
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      type: "website",
      title: `${project.name}｜MAD Store`,
      description: project.description,
      url: `/projects/${project.slug}`,
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const readme = project.readme || (await fetchReadme(project.repoUrl));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: project.name,
    description: project.description,
    codeRepository: project.repoUrl,
    license: project.license,
    operatingSystem: project.systems,
    programmingLanguage: project.language,
    downloadUrl: project.downloadUrl,
    author: { "@type": "Person", url: project.authorUrl },
  };

  return (
    <>
      <Header />
      <main className="project-detail-page">
        <section className="shell project-detail-head">
          <Link href="/projects" className="back-link"><ArrowLeft size={15} /> 返回项目</Link>
          <div className="project-title-row">
            <div>
              <span className="eyebrow">{project.category}</span>
              <h1>{project.name}</h1>
              <p>{project.description}</p>
            </div>
            <div className="project-actions">
              {project.downloadUrl && (
                <a className="repo-button primary" href={project.downloadUrl} target="_blank" rel="noreferrer">
                  <Download size={17} /> 直接下载 <ExternalLink size={13} />
                </a>
              )}
              <a className="repo-button" href={project.repoUrl} target="_blank" rel="noreferrer">
                <SiGithub size={17} /> 查看仓库 <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </section>

        <section className="shell project-summary-card" aria-label="项目信息">
          <div>
            <SiGithub /><span>仓库地址</span>
            <a href={project.repoUrl} target="_blank" rel="noreferrer">{project.repoUrl}</a>
          </div>
          <div>
            <UserRound /><span>作者主页</span>
            <a href={project.authorUrl} target="_blank" rel="noreferrer">{project.authorUrl}</a>
          </div>
          <div>
            <Scale /><span>开源协议</span><strong>{project.license}</strong>
            <small>{describeLicense(project.license)}</small>
          </div>
          <div>
            <Laptop /><span>适配系统</span><strong>{project.systems.join(" / ")}</strong>
          </div>
          <div>
            <Tags /><span>标签</span><strong>{project.tags.map((tag) => `#${tag}`).join(" ")}</strong>
          </div>
          <div>
            <Star /><span>仓库信息</span>
            <strong>{typeof project.stars === "number" ? `${project.stars} Stars` : "公开仓库"}{project.language ? ` · ${project.language}` : ""}</strong>
          </div>
          {project.downloadUrl && (
            <div>
              <Download /><span>直链下载</span>
              <a href={project.downloadUrl} target="_blank" rel="noreferrer">直接获取项目文件</a>
            </div>
          )}
          {(project.customFields || []).map((field) => (
            <div key={`${field.label}-${field.value}`}>
              <Info /><span>{field.label}</span>
              {field.url ? (
                <a href={field.url} target="_blank" rel="noreferrer">{field.value}</a>
              ) : (
                <strong>{field.value}</strong>
              )}
            </div>
          ))}
        </section>

        <section className="shell readme-section">
          <header>
            <span className="eyebrow">README</span>
            <h2>项目说明</h2>
            <p>内容同步自项目仓库，外部链接将在 GitHub 或原始站点打开。</p>
          </header>
          <article className="markdown-body">
            {readme ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  a: ({ href, children }) => {
                    const resolved = resolveReadmeUrl(href, project.repoUrl);
                    return resolved ? <a href={resolved} target={resolved.startsWith("#") ? undefined : "_blank"} rel="noreferrer">{children}</a> : <>{children}</>;
                  },
                  img: ({ src, alt }) => {
                    const resolved = resolveReadmeUrl(typeof src === "string" ? src : undefined, project.repoUrl, true);
                    if (!resolved) return null;
                    const displayUrl = imageSource(resolved);
                    if (!displayUrl) return null;
                    // GitHub 图片由本站受限代理转发，其他 HTTPS 图片保留原地址。
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={displayUrl} alt={alt || "项目图片"} loading="lazy" referrerPolicy="no-referrer" />;
                  },
                }}
              >
                {readme}
              </ReactMarkdown>
            ) : (
              <p>暂未读取到 README，请前往 GitHub 查看。</p>
            )}
          </article>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
