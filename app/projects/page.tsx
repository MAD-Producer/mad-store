import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { getPublishedProjects, getSettings } from "@/lib/projects";

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
  const { project: legacySlug } = await searchParams;
  if (legacySlug) redirect(`/projects/${encodeURIComponent(legacySlug)}`);

  const [projects, settings] = await Promise.all([getPublishedProjects(), getSettings()]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "MAD Store 开源项目",
    inLanguage: "zh-CN",
    hasPart: projects.map((project) => ({
      "@type": "SoftwareSourceCode",
      name: project.name,
      description: project.description,
      url: `/projects/${project.slug}`,
      codeRepository: project.repoUrl,
      license: project.license,
      operatingSystem: project.systems,
    })),
  };

  return (
    <>
      <Header />
      <main className="projects-page">
        <section className="shell page-heading project-heading">
          <div>
            <span className="eyebrow">PROJECT INDEX</span>
            <h1>项目</h1>
          </div>
          <p>从创作工具到知识文档，按工作流找到合适的开源项目。</p>
        </section>
        <section className="shell">
          <ProjectExplorer projects={projects} settings={settings} />
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
