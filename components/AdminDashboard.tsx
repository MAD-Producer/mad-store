"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LogOut, Plus, Save, Sparkles, X, XCircle } from "lucide-react";
import { LicenseSelector } from "@/components/LicenseSelector";
import type { Project, ProjectCustomField, ProjectDownload, ProjectStatus, SiteSettings } from "@/lib/types";

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
  const [tags, setTags] = useState(project.tags);
  const [customTag, setCustomTag] = useState("");
  const [customFields, setCustomFields] = useState<ProjectCustomField[]>(project.customFields || []);
  const [downloads, setDownloads] = useState<ProjectDownload[]>(
    project.downloads?.length
      ? project.downloads
      : project.downloadUrl
        ? [{ label: "直接下载", url: project.downloadUrl }]
        : [],
  );

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 12),
    );
  }

  function addCustomTag() {
    const value = customTag.trim().slice(0, 24);
    if (value && !tags.includes(value)) setTags((current) => [...current, value].slice(0, 12));
    setCustomTag("");
  }

  function updateCustomField(index: number, key: keyof ProjectCustomField, value: string) {
    setCustomFields((current) =>
      current.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field),
    );
  }

  function updateDownload(index: number, key: keyof ProjectDownload, value: string) {
    setDownloads((current) =>
      current.map((download, downloadIndex) =>
        downloadIndex === index ? { ...download, [key]: value } : download,
      ),
    );
  }

  async function save(formElement: HTMLFormElement, forcedStatus?: ProjectStatus) {
    const form = new FormData(formElement);
    const status = forcedStatus || (form.get("status") as ProjectStatus);
    const rejectionReason = String(form.get("rejectionReason") || "").trim();
    if (status === "rejected" && !rejectionReason) {
      setMessage("拒绝项目时请填写拒绝理由");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.get("slug"),
        name: form.get("name"),
        description: form.get("description"),
        repoUrl: form.get("repoUrl"),
        authorUrl: form.get("authorUrl"),
        contactQQ: form.get("contactQQ"),
        officialUrl: form.get("officialUrl"),
        license: form.get("license"),
        category: form.get("category"),
        systems: form.getAll("systems"),
        tags,
        downloads: downloads
          .map((download) => ({
            label: download.label.trim(),
            url: download.url.trim(),
          }))
          .filter((download) => download.label && download.url),
        customFields: customFields
          .map((field) => ({
            label: field.label.trim(),
            value: field.value.trim(),
            url: field.url?.trim() || undefined,
          }))
          .filter((field) => field.label && field.value),
        rejectionReason,
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
          <LicenseSelector defaultValue={project.license} />
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
          联系人 QQ
          <input name="contactQQ" defaultValue={project.contactQQ || ""} inputMode="numeric" />
        </label>
        <label>
          官网地址
          <input name="officialUrl" defaultValue={project.officialUrl || ""} type="url" placeholder="https://..." />
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
          拒绝理由（选择拒绝时必填）
          <textarea
            name="rejectionReason"
            defaultValue={project.rejectionReason || ""}
            rows={3}
            placeholder="说明未收录的具体原因和可修改的方向，这段内容会发送给联系人。"
          />
        </label>
      </div>
      <div className="admin-choice-block">
        <strong>项目标签（最多 12 个）</strong>
        <div className="selectable-tags">
          {settings.tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={tags.includes(tag) ? "active" : ""}
              onClick={() => toggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
        <div className="custom-tag">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTag();
              }
            }}
            maxLength={24}
            placeholder="自定义标签"
          />
          <button type="button" onClick={addCustomTag} aria-label="添加自定义标签"><Plus size={16} /></button>
        </div>
        {!!tags.length && (
          <div className="selected-tags">
            {tags.map((tag) => (
              <button type="button" key={tag} onClick={() => toggleTag(tag)}>
                {tag}<X size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="admin-custom-fields admin-downloads">
        <div className="admin-custom-heading">
          <div>
            <strong>下载选项</strong>
            <p>填写选项名称与 HTTPS 下载链接；只有一个选项时，项目页会直接下载。</p>
          </div>
          <button
            type="button"
            onClick={() => setDownloads((current) => [...current, { label: "", url: "" }].slice(0, 12))}
          >
            <Plus size={14} /> 添加下载
          </button>
        </div>
        {downloads.map((download, index) => (
          <div className="admin-download-row" key={index}>
            <input
              value={download.label}
              onChange={(event) => updateDownload(index, "label", event.target.value)}
              placeholder="选项名，例如 Windows x64"
              maxLength={40}
            />
            <input
              value={download.url}
              onChange={(event) => updateDownload(index, "url", event.target.value)}
              placeholder="下载链接 https://..."
              type="url"
            />
            <button
              type="button"
              aria-label={`删除下载选项 ${index + 1}`}
              onClick={() => setDownloads((current) => current.filter((_, downloadIndex) => downloadIndex !== index))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="admin-custom-fields">
        <div className="admin-custom-heading">
          <div>
            <strong>自定义展示字段</strong>
            <p>用于版本号、文档地址、软件大小等额外信息；链接可不填。</p>
          </div>
          <button
            type="button"
            onClick={() => setCustomFields((current) => [...current, { label: "", value: "", url: "" }].slice(0, 12))}
          >
            <Plus size={14} /> 添加字段
          </button>
        </div>
        {customFields.map((field, index) => (
          <div className="admin-custom-row" key={index}>
            <input
              value={field.label}
              onChange={(event) => updateCustomField(index, "label", event.target.value)}
              placeholder="字段名称，例如 当前版本"
              maxLength={30}
            />
            <input
              value={field.value}
              onChange={(event) => updateCustomField(index, "value", event.target.value)}
              placeholder="字段内容，例如 v1.2.0"
              maxLength={160}
            />
            <input
              value={field.url || ""}
              onChange={(event) => updateCustomField(index, "url", event.target.value)}
              placeholder="可选链接 https://..."
              type="url"
            />
            <button
              type="button"
              aria-label={`删除字段 ${index + 1}`}
              onClick={() => setCustomFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="admin-systems">
        <span>适配系统</span>
        {["Windows", "macOS", "Web"].map((system) => (
          <label key={system}>
            <input
              type="checkbox"
              name="systems"
              value={system}
              defaultChecked={project.systems.includes(system as "Windows" | "macOS" | "Web")}
            />
            {system}
          </label>
        ))}
      </div>
      <div className="admin-contact-card">
        <strong>提交联系人</strong>
        <div>
          <span>称呼</span>
          <b>{project.submitterName || "历史项目未记录"}</b>
        </div>
        <div>
          <span>邮箱</span>
          {project.submitterEmail ? (
            <a href={`mailto:${project.submitterEmail}`}>{project.submitterEmail}</a>
          ) : (
            <b>历史项目未记录</b>
          )}
        </div>
        <div>
          <span>QQ</span>
          <b>{project.contactQQ || "未填写"}</b>
        </div>
      </div>
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
