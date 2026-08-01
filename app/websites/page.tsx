import type { Metadata } from "next";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getPublishedWebsites } from "@/lib/websites";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "网站",
  description: "浏览与 MAD / AMV 创作、学习和社区相关的网站。",
  alternates: { canonical: "/websites" },
};

export default async function WebsitesPage() {
  const websites = await getPublishedWebsites();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "MAD Store 网站",
    inLanguage: "zh-CN",
    hasPart: websites.map((website) => ({
      "@type": "WebSite",
      name: website.name,
      description: website.description,
      url: website.url,
    })),
  };

  return (
    <>
      <Header />
      <main className="projects-page">
        <section className="shell page-heading project-heading">
          <div>
            <span className="eyebrow">WEBSITE INDEX</span>
            <h1>网站</h1>
          </div>
          <p>发现与创作、学习和社区相关的优质站点。</p>
        </section>
        <section className="shell">
          <div className="project-grid website-grid">
            {websites.map((website) => (
              <a
                className="project-tile website-tile"
                href={website.url}
                target="_blank"
                rel="noreferrer"
                key={website.id}
              >
                <div className="project-tile-top">
                  <span className="project-tile-icon"><Globe2 /></span>
                  <span className="project-tile-category">{website.category || "网站"}</span>
                </div>
                <h2>{website.name}</h2>
                <p>{website.description}</p>
                {!!website.tags.length && (
                  <div className="project-tile-tags">
                    {website.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                )}
                <div className="project-tile-footer">
                  <span>{new URL(website.url).hostname}</span>
                  <span>访问网站</span>
                  <ArrowUpRight size={17} />
                </div>
              </a>
            ))}
          </div>
          {!websites.length && <div className="simple-empty"><p>暂时还没有已收录的网站。</p></div>}
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
