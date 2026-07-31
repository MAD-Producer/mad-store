"use client";

import { ArrowUpRight, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import type { Project, SiteSettings } from "@/lib/types";

export function ProjectExplorer({
  projects,
  settings,
}: {
  projects: Project[];
  settings: SiteSettings;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesText =
        !needle ||
        [project.name, project.description, ...project.tags].join(" ").toLowerCase().includes(needle);
      return matchesText && (category === "全部" || project.category === category);
    });
  }, [projects, query, category]);

  return (
    <div className="simple-explorer">
      <div className="project-tools">
        <label>
          <Search size={17} />
          <span className="sr-only">搜索项目</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索项目或标签"
          />
        </label>
        <div className="category-row">
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
      <div className="simple-project-list">
        {filtered.map((project) => (
          <a className="simple-project-card" href={`/projects?project=${project.slug}#readme`} key={project.id}>
            <div className="project-card-meta">
              <span>{project.category}</span>
              {typeof project.stars === "number" && <small><Star size={12} />{project.stars}</small>}
            </div>
            <div className="project-card-body">
              <h2>{project.name}</h2>
              <p>{project.description}</p>
            </div>
            <div className="project-card-tail">
              <span>{project.systems.join(" / ")}</span>
              <span>{project.tags.slice(0, 3).map((tag) => `#${tag}`).join("  ")}</span>
              <ArrowUpRight size={18} />
            </div>
          </a>
        ))}
      </div>
      {!filtered.length && <p className="simple-empty">没有匹配的项目。</p>}
    </div>
  );
}
