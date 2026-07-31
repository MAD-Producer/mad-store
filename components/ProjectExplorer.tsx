"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  Download,
  PackageOpen,
  Palette,
  Search,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Project, SiteSettings, SystemName } from "@/lib/types";

function CategoryIcon({ category }: { category: string }) {
  if (category.includes("文档") || category.includes("教程")) return <BookOpen />;
  if (category.includes("下载") || category.includes("转码")) return <Download />;
  if (category.includes("素材") || category.includes("资源")) return <Palette />;
  if (category.includes("制作")) return <Clapperboard />;
  return <PackageOpen />;
}

export function ProjectExplorer({
  projects,
  settings,
}: {
  projects: Project[];
  settings: SiteSettings;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [system, setSystem] = useState<"全部" | SystemName>("全部");
  const [tag, setTag] = useState("全部");

  const availableTags = useMemo(
    () => settings.tags.filter((item) => projects.some((project) => project.tags.includes(item))),
    [projects, settings.tags],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesText =
        !needle ||
        [project.name, project.description, project.category, project.language, ...project.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesCategory = category === "全部" || project.category === category;
      const matchesSystem = system === "全部" || project.systems.includes(system);
      const matchesTag = tag === "全部" || project.tags.includes(tag);
      return matchesText && matchesCategory && matchesSystem && matchesTag;
    });
  }, [projects, query, category, system, tag]);

  function resetFilters() {
    setQuery("");
    setCategory("全部");
    setSystem("全部");
    setTag("全部");
  }

  return (
    <div className="project-explorer">
      <div className="project-search-row">
        <label>
          <Search size={17} />
          <span className="sr-only">搜索项目</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、用途、语言或标签"
          />
        </label>
        <span>找到 {filtered.length} 个项目</span>
      </div>

      <div className="project-filters" aria-label="项目筛选">
        <div className="filter-level">
          <strong>分类</strong>
          <div>
            {["全部", ...settings.categories].map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-level">
          <strong>系统</strong>
          <div>
            {(["全部", "Windows", "macOS"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={system === item ? "active" : ""}
                onClick={() => setSystem(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-level">
          <strong>标签</strong>
          <div>
            {["全部", ...availableTags].map((item) => (
              <button
                key={item}
                type="button"
                className={tag === item ? "active" : ""}
                onClick={() => setTag(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="project-grid">
        {filtered.map((project) => (
          <Link className="project-tile" href={`/projects/${project.slug}`} key={project.id}>
            <div className="project-tile-top">
              <span className="project-tile-icon"><CategoryIcon category={project.category} /></span>
              <span className="project-tile-category">{project.category}</span>
              {typeof project.stars === "number" && (
                <small><Star size={12} />{project.stars}</small>
              )}
            </div>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
            <div className="project-tile-tags">
              {project.tags.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="project-tile-footer">
              <span>{project.systems.join(" / ")}</span>
              <span>{project.language || project.license}</span>
              <ArrowUpRight size={17} />
            </div>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <div className="simple-empty">
          <p>没有匹配的项目。</p>
          <button type="button" onClick={resetFilters}>清除筛选</button>
        </div>
      )}
    </div>
  );
}
