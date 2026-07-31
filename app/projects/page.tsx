import type { Metadata } from "next";
import { ExternalLink, GitFork } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { fetchReadme } from "@/lib/github";
import { getProjectBySlug, getPublishedProjects, getSettings } from "@/lib/projects";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "开源项目",
  description: "浏览面向 MAD / AMV 创作者的开源工具、脚本、下载、转码与文档项目。",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: slug } = await searchParams;
  const [projects, settings, selected] = await Promise.all([
    getPublishedProjects(),
    getSettings(),
    slug ? getProjectBySlug(slug) : Promise.resolve(null),
  ]);
  const readme = selected ? selected.readme || (await fetchReadme(selected.repoUrl)) : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "MAD Store 开源项目",
    inLanguage: "zh-CN",
    hasPart: projects.map((project) => ({
      "@type": "SoftwareSourceCode",
      name: project.name,
      description: project.description,
      codeRepository: project.repoUrl,
      license: project.license,
      operatingSystem: project.systems,
    })),
  };

  return (
    <>
      <Header />
      <main className="projects-page">
        <section className="shell page-heading">
          <span className="eyebrow">PROJECTS</span>
          <h1>项目</h1>
          <p>找到需要的工具，并在这里读完它的 README。</p>
        </section>
        <section className="shell">
          <ProjectExplorer projects={projects} settings={settings} />
        </section>
        {selected && (
          <section className="shell inline-readme" id="readme">
            <header>
              <div>
                <span>{selected.category}</span>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
              </div>
              <a href={selected.repoUrl} target="_blank" rel="noreferrer">
                <GitFork size={17} />
                GitHub
                <ExternalLink size={13} />
              </a>
            </header>
            <div className="readme-meta">
              <span>{selected.systems.join(" / ")}</span>
              <span>{selected.license}</span>
              <span>{selected.tags.map((tag) => `#${tag}`).join(" ")}</span>
            </div>
            <article className="markdown-body">
              {readme ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
                    img: ({ alt }) => <span className="readme-image-placeholder">图片：{alt || "仓库图片"}</span>,
                  }}
                >
                  {readme}
                </ReactMarkdown>
              ) : (
                <p>暂未读取到 README，请前往 GitHub 查看。</p>
              )}
            </article>
          </section>
        )}
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
