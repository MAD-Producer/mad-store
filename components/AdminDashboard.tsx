"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LogOut, Plus, Save, Sparkles, X, XCircle } from "lucide-react";
import { LicenseSelector } from "@/components/LicenseSelector";
import type { Project, ProjectCustomField, ProjectDownload, ProjectStatus, SiteSettings, Website } from "@/lib/types";

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
  const [downloads, setDownloads] = useState<ProjectDownload[]>(project.downloads || []);

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

function WebsiteEditor({
  website,
  settings,
  onSaved,
}: {
  website: Website;
  settings: SiteSettings;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState(website.tags);
  const [customTag, setCustomTag] = useState("");

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 8),
    );
  }

  function addCustomTag() {
    const value = customTag.trim().slice(0, 24);
    if (value && !tags.includes(value)) setTags((current) => [...current, value].slice(0, 8));
    setCustomTag("");
  }

  async function save(formElement: HTMLFormElement, forcedStatus?: ProjectStatus) {
    const form = new FormData(formElement);
    const status = forcedStatus || (form.get("status") as ProjectStatus);
    const rejectionReason = String(form.get("rejectionReason") || "").trim();
    if (status === "rejected" && !rejectionReason) {
      setMessage("拒绝网站投稿时请填写拒绝理由");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/websites/${website.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        url: form.get("url"),
        description: form.get("description"),
        category: form.get("category"),
        tags,
        submitterName: form.get("submitterName"),
        submitterEmail: form.get("submitterEmail"),
        contactQQ: form.get("contactQQ"),
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
      className="review-card review-card-expanded"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <div className="review-heading">
        <div>
          <span className={`status status-${website.status}`}>
            {website.status === "pending" ? "待审核" : website.status === "published" ? "已发布" : "已拒绝"}
          </span>
          <h3>{website.name}</h3>
          <a href={website.url} target="_blank" rel="noreferrer">{website.url}</a>
        </div>
        <time>{new Date(website.createdAt).toLocaleDateString("zh-CN")}</time>
      </div>
      <div className="admin-form-grid">
        <label>
          网站名称
          <input name="name" defaultValue={website.name} required maxLength={80} />
        </label>
        <label>
          网站分类（选填）
          <input name="category" defaultValue={website.category || ""} maxLength={40} />
        </label>
        <label className="full">
          网站链接
          <input name="url" defaultValue={website.url} type="url" required />
        </label>
        <label className="full">
          网站介绍
          <textarea name="description" defaultValue={website.description} rows={4} required maxLength={320} />
        </label>
        <label>
          联系人（选填）
          <input name="submitterName" defaultValue={website.submitterName || ""} maxLength={60} />
        </label>
        <label>
          联系邮箱（选填）
          <input name="submitterEmail" defaultValue={website.submitterEmail || ""} type="email" />
        </label>
        <label>
          联系人 QQ（选填）
          <input name="contactQQ" defaultValue={website.contactQQ || ""} inputMode="numeric" />
        </label>
        <label>
          状态
          <select name="status" defaultValue={website.status}>
            <option value="pending">待审核</option>
            <option value="published">已发布</option>
            <option value="rejected">已拒绝</option>
          </select>
        </label>
        <label className="full">
          拒绝理由（选择拒绝时必填）
          <textarea name="rejectionReason" defaultValue={website.rejectionReason || ""} rows={3} />
        </label>
      </div>
      <div className="admin-choice-block">
        <strong>网站标签（选填，最多 8 个）</strong>
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
          <button type="button" onClick={addCustomTag} aria-label="添加网站标签"><Plus size={16} /></button>
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
      <div className="review-actions">
        <button type="submit" disabled={saving}><Save size={16} />保存信息</button>
        <button
          className="reject"
          type="button"
          onClick={(event) => {
            if (event.currentTarget.form) void save(event.currentTarget.form, "rejected");
          }}
          disabled={saving}
        >
          <XCircle size={16} />拒绝
        </button>
        <button
          className="publish"
          type="button"
          onClick={(event) => {
            if (event.currentTarget.form) void save(event.currentTarget.form, "published");
          }}
          disabled={saving}
        >
          <CheckCircle2 size={16} />人工审核通过
        </button>
        {message && <span>{message}</span>}
      </div>
    </form>
  );
}

export function AdminDashboard({
  initialProjects,
  initialWebsites,
  initialSettings,
}: {
  initialProjects: Project[];
  initialWebsites: Website[];
  initialSettings: SiteSettings;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [websites, setWebsites] = useState(initialWebsites);
  const [settings, setSettings] = useState(initialSettings);
  const [contentType, setContentType] = useState<"project" | "website">("project");
  const [filter, setFilter] = useState<ProjectStatus | "all">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");

  async function refresh() {
    const endpoint = contentType === "project" ? "/api/admin/projects" : "/api/admin/websites";
    const response = await fetch(endpoint);
    if (!response.ok) return;
    if (contentType === "project") {
      const data = (await response.json()) as { projects: Project[] };
      setProjects(data.projects);
    } else {
      const data = (await response.json()) as { websites: Website[] };
      setWebsites(data.websites);
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

  const records = contentType === "project" ? projects : websites;
  const visible = filter === "all" ? records : records.filter((record) => record.status === filter);

  function selectContentType(nextType: "project" | "website") {
    setContentType(nextType);
    setFilter("pending");
    setExpandedId(null);
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-top">
        <div>
          <span className="eyebrow">MAD STORE / ADMIN</span>
          <h1>投稿审核工作台</h1>
        </div>
        <button type="button" onClick={logout}>
          <LogOut size={16} />
          退出登录
        </button>
      </div>
      <div className="admin-content-switch" role="tablist" aria-label="投稿类型">
        <button
          type="button"
          role="tab"
          aria-selected={contentType === "project"}
          className={contentType === "project" ? "active" : ""}
          onClick={() => selectContentType("project")}
        >
          项目投稿 <span>{projects.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={contentType === "website"}
          className={contentType === "website" ? "active" : ""}
          onClick={() => selectContentType("website")}
        >
          网站投稿 <span>{websites.length}</span>
        </button>
      </div>
      <div className="admin-stats">
        <div><strong>{records.filter((record) => record.status === "pending").length}</strong><span>待审核</span></div>
        <div><strong>{records.filter((record) => record.status === "published").length}</strong><span>已发布</span></div>
        <div><strong>{records.filter((record) => record.status === "rejected").length}</strong><span>已拒绝</span></div>
      </div>
      <div className="admin-layout">
        <aside>
          <div className="admin-tabs">
            {(["pending", "published", "rejected", "all"] as const).map((status) => (
              <button
                type="button"
                key={status}
                className={filter === status ? "active" : ""}
                onClick={() => {
                  setFilter(status);
                  setExpandedId(null);
                }}
              >
                {status === "pending" ? "待审核" : status === "published" ? "已发布" : status === "rejected" ? "已拒绝" : "全部投稿"}
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
            <h2>{contentType === "project" ? "项目列表" : "网站列表"}</h2>
            <span>{visible.length} 条记录</span>
          </div>
          {!!visible.length && (
            <div className="admin-list-table" role="table" aria-label={contentType === "project" ? "项目投稿" : "网站投稿"}>
              <div className="admin-list-header" role="row">
                <span role="columnheader">名称</span>
                <span role="columnheader">状态</span>
                <span role="columnheader">链接</span>
                <span role="columnheader">提交日期</span>
                <span role="columnheader">操作</span>
              </div>
              {visible.map((record) => {
                const link = contentType === "project" ? (record as Project).repoUrl : (record as Website).url;
                const expanded = expandedId === record.id;
                return (
                  <div className={`admin-list-item${expanded ? " expanded" : ""}`} key={record.id}>
                    <div className="admin-list-row" role="row">
                      <strong role="cell">{record.name}</strong>
                      <span role="cell"><i className={`status status-${record.status}`}>
                        {record.status === "pending" ? "待审核" : record.status === "published" ? "已发布" : "已拒绝"}
                      </i></span>
                      <a role="cell" href={link} target="_blank" rel="noreferrer">{new URL(link).hostname}</a>
                      <time role="cell">{new Date(record.createdAt).toLocaleDateString("zh-CN")}</time>
                      <span role="cell">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : record.id)}
                        >
                          {expanded ? "收起" : "编辑"}
                        </button>
                      </span>
                    </div>
                    {expanded && contentType === "project" && (
                      <ProjectEditor project={record as Project} settings={settings} onSaved={refresh} />
                    )}
                    {expanded && contentType === "website" && (
                      <WebsiteEditor website={record as Website} settings={settings} onSaved={refresh} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!visible.length && <div className="admin-empty">当前没有符合条件的投稿。</div>}
        </section>
      </div>
    </div>
  );
}
