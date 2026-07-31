"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LogOut, Save, Sparkles, XCircle } from "lucide-react";
import type { Project, ProjectStatus, SiteSettings } from "@/lib/types";

function splitList(value: string) {
  return [...new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

function ProjectEditor({
  project,
  settings,
  onSaved,
}: {
  project: Project;
  settings: SiteSettings;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(formElement: HTMLFormElement, forcedStatus?: ProjectStatus) {
    setSaving(true);
    setMessage("");
    const form = new FormData(formElement);
    const status = forcedStatus || (form.get("status") as ProjectStatus);
    const response = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.get("slug"),
        name: form.get("name"),
        description: form.get("description"),
        repoUrl: form.get("repoUrl"),
        authorUrl: form.get("authorUrl"),
        authorQQ: form.get("authorQQ"),
        license: form.get("license"),
        category: form.get("category"),
        systems: form.getAll("systems"),
        tags: splitList(String(form.get("tags") || "")),
        status,
      }),
    });
    const data = (await response.json()) as { message?: string };
    setMessage(data.message || (response.ok ? "已保存" : "保存失败"));
    setSaving(false);
    if (response.ok) onSaved();
  }

  return (
    <form
      className="review-card"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <div className="review-heading">
        <div>
          <span className={`status status-${project.status}`}>
            {project.status === "pending" ? "待审核" : project.status === "published" ? "已发布" : "已拒绝"}
          </span>
          <h3>{project.name}</h3>
          <a href={project.repoUrl} target="_blank" rel="noreferrer">{project.repoUrl}</a>
        </div>
        <time>{new Date(project.createdAt).toLocaleDateString("zh-CN")}</time>
      </div>

      {project.aiReview && (
        <div className="ai-review">
          <div>
            <Sparkles size={17} />
            <strong>DeepSeek 初审建议</strong>
            <span>{project.aiReview.score} / 100</span>
          </div>
          <p>{project.aiReview.summary}</p>
          {!!project.aiReview.securityConcerns.length && (
            <p className="ai-warning">注意：{project.aiReview.securityConcerns.join("；")}</p>
          )}
          <small>仅供参考，最终判断必须由管理员完成。</small>
        </div>
      )}

      <div className="admin-form-grid">
        <label>
          仓库名称
          <input name="name" defaultValue={project.name} required />
        </label>
        <label>
          SEO Slug
          <input
            name="slug"
            defaultValue={project.slug}
            pattern="[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*"
            title="使用小写字母、数字、中文和连字符"
            required
          />
        </label>
        <label>
          开源协议
          <input name="license" defaultValue={project.license} required />
        </label>
        <label className="full">
          描述
          <textarea name="description" defaultValue={project.description} rows={3} required />
        </label>
        <label className="full">
          仓库地址
          <input name="repoUrl" defaultValue={project.repoUrl} type="url" required />
        </label>
        <label className="full">
          作者主页
          <input name="authorUrl" defaultValue={project.authorUrl} type="url" required />
        </label>
        <label>
          作者 QQ
          <input name="authorQQ" defaultValue={project.authorQQ || ""} inputMode="numeric" />
        </label>
        <label>
          分类
          <select name="category" defaultValue={project.category}>
            {project.category === "待分类" && <option>待分类</option>}
            {settings.categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          状态
          <select name="status" defaultValue={project.status}>
            <option value="pending">待审核</option>
            <option value="published">已发布</option>
            <option value="rejected">已拒绝</option>
          </select>
        </label>
        <label className="full">
          标签（逗号分隔）
          <input name="tags" defaultValue={project.tags.join(", ")} />
        </label>
      </div>
      <div className="admin-systems">
        <span>适配系统</span>
        {["Windows", "macOS"].map((system) => (
          <label key={system}>
            <input
              type="checkbox"
              name="systems"
              value={system}
              defaultChecked={project.systems.includes(system as "Windows" | "macOS")}
            />
            {system}
          </label>
        ))}
      </div>
      {project.submitterEmail && (
        <p className="submitter-line">提交人：{project.submitterName} · {project.submitterEmail}</p>
      )}
      <div className="review-actions">
        <button type="submit" disabled={saving}>
          <Save size={16} />
          保存信息
        </button>
        <button
          className="reject"
          type="button"
          onClick={(event) => {
            if (event.currentTarget.form) void save(event.currentTarget.form, "rejected");
          }}
          disabled={saving}
        >
          <XCircle size={16} />
          拒绝
        </button>
        <button
          className="publish"
          type="button"
          onClick={(event) => {
            if (event.currentTarget.form) void save(event.currentTarget.form, "published");
          }}
          disabled={saving}
        >
          <CheckCircle2 size={16} />
          人工审核通过
        </button>
        {message && <span>{message}</span>}
      </div>
    </form>
  );
}

export function AdminDashboard({
  initialProjects,
  initialSettings,
}: {
  initialProjects: Project[];
  initialSettings: SiteSettings;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [settings, setSettings] = useState(initialSettings);
  const [filter, setFilter] = useState<ProjectStatus | "all">("pending");
  const [settingsMessage, setSettingsMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/projects");
    if (response.ok) {
      const data = (await response.json()) as { projects: Project[] };
      setProjects(data.projects);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSettings = {
      categories: splitList(String(form.get("categories") || "")),
      tags: splitList(String(form.get("tags") || "")),
    };
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    setSettingsMessage(response.ok ? "字段选项已更新" : "更新失败");
    if (response.ok) setSettings(nextSettings);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const visible = filter === "all" ? projects : projects.filter((project) => project.status === filter);

  return (
    <div className="admin-dashboard">
      <div className="admin-top">
        <div>
          <span className="eyebrow">MAD STORE / ADMIN</span>
          <h1>项目审核工作台</h1>
        </div>
        <button type="button" onClick={logout}>
          <LogOut size={16} />
          退出登录
        </button>
      </div>
      <div className="admin-stats">
        <div><strong>{projects.filter((project) => project.status === "pending").length}</strong><span>待审核</span></div>
        <div><strong>{projects.filter((project) => project.status === "published").length}</strong><span>已发布</span></div>
        <div><strong>{projects.filter((project) => project.status === "rejected").length}</strong><span>已拒绝</span></div>
      </div>
      <div className="admin-layout">
        <aside>
          <div className="admin-tabs">
            {(["pending", "published", "rejected", "all"] as const).map((status) => (
              <button
                type="button"
                key={status}
                className={filter === status ? "active" : ""}
                onClick={() => setFilter(status)}
              >
                {status === "pending" ? "待审核" : status === "published" ? "已发布" : status === "rejected" ? "已拒绝" : "全部项目"}
              </button>
            ))}
          </div>
          <form className="settings-card" onSubmit={saveSettings}>
            <h2>字段选项管理</h2>
            <p>分类和标签使用逗号分隔。更新后会同步到提交表单与前台筛选。</p>
            <label>
              分类
              <textarea name="categories" defaultValue={settings.categories.join(", ")} rows={4} />
            </label>
            <label>
              标签
              <textarea name="tags" defaultValue={settings.tags.join(", ")} rows={6} />
            </label>
            <button type="submit">保存字段选项</button>
            {settingsMessage && <span>{settingsMessage}</span>}
          </form>
        </aside>
        <section className="review-list">
          <div className="review-list-heading">
            <h2>{filter === "pending" ? "等待人工判断" : "项目列表"}</h2>
            <span>{visible.length} 条记录</span>
          </div>
          {visible.map((project) => (
            <ProjectEditor key={project.id} project={project} settings={settings} onSaved={refresh} />
          ))}
          {!visible.length && <div className="admin-empty">当前没有符合条件的项目。</div>}
        </section>
      </div>
    </div>
  );
}
