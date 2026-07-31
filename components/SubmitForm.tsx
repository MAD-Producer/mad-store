"use client";

import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { SiteSettings } from "@/lib/types";

export function SubmitForm({ settings }: { settings: SiteSettings }) {
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      description: form.get("description"),
      repoUrl: form.get("repoUrl"),
      authorUrl: form.get("authorUrl"),
      license: form.get("license"),
      systems: form.getAll("systems"),
      tags,
      submitterName: form.get("submitterName"),
      submitterEmail: form.get("submitterEmail"),
      website: form.get("website"),
    };
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "提交失败，请稍后重试");
      setState("success");
      setMessage(data.message || "提交成功");
      event.currentTarget.reset();
      setTags([]);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试");
    }
  }

  if (state === "success") {
    return (
      <div className="form-success" role="status">
        <span>
          <Check size={26} aria-hidden="true" />
        </span>
        <h2>已经进入人工审核队列</h2>
        <p>{message}。管理员会核对仓库内容、分类和标签，审核通过后才会公开展示。</p>
        <button type="button" onClick={() => setState("idle")}>
          再提交一个项目
        </button>
      </div>
    );
  }

  return (
    <form className="submit-form" onSubmit={submit}>
      <input
        name="website"
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <fieldset>
        <legend>
          <span>01</span>
          仓库信息
        </legend>
        <div className="form-grid">
          <label>
            仓库名称 <em>*</em>
            <input name="name" required maxLength={80} placeholder="例如：MAD Toolbox" />
          </label>
          <label>
            开源协议 <em>*</em>
            <input name="license" required maxLength={80} placeholder="例如：MIT / GPL-3.0" />
          </label>
          <label className="full">
            仓库描述 <em>*</em>
            <textarea
              name="description"
              required
              minLength={12}
              maxLength={320}
              rows={4}
              placeholder="用中文说明它解决了什么问题、适合谁使用"
            />
          </label>
          <label className="full">
            GitHub 仓库地址 <em>*</em>
            <input name="repoUrl" type="url" required placeholder="https://github.com/owner/repo" />
          </label>
          <label className="full">
            作者 GitHub 主页 <em>*</em>
            <input name="authorUrl" type="url" required placeholder="https://github.com/owner" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span>02</span>
          适配与标签
        </legend>
        <div className="choice-group">
          <strong>适配系统 <em>*</em></strong>
          <div className="check-row">
            {["Windows", "macOS"].map((system) => (
              <label className="check-chip" key={system}>
                <input type="checkbox" name="systems" value={system} />
                <span>{system}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="choice-group">
          <strong>项目标签（最多 8 个） <em>*</em></strong>
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
            <button type="button" onClick={addCustomTag} aria-label="添加自定义标签">
              <Plus size={18} />
            </button>
          </div>
          {!!tags.length && (
            <div className="selected-tags">
              {tags.map((tag) => (
                <button type="button" key={tag} onClick={() => toggleTag(tag)}>
                  {tag}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>
          <span>03</span>
          联系方式
        </legend>
        <div className="form-grid">
          <label>
            联系人 <em>*</em>
            <input name="submitterName" required maxLength={60} placeholder="你的称呼" />
          </label>
          <label>
            联系邮箱 <em>*</em>
            <input name="submitterEmail" type="email" required placeholder="用于审核沟通，不会公开" />
          </label>
        </div>
        <label className="consent">
          <input type="checkbox" required />
          <span>我确认该仓库公开可访问，且提交信息真实；理解最终是否收录由管理员人工判断。</span>
        </label>
      </fieldset>

      {state === "error" && <p className="form-error" role="alert">{message}</p>}
      <button className="submit-button" type="submit" disabled={state === "loading"}>
        {state === "loading" ? (
          <>
            <LoaderCircle className="spin" size={19} />
            正在读取仓库并提交
          </>
        ) : (
          "提交人工审核"
        )}
      </button>
      <p className="form-note">系统会读取公开 README，并可使用 DeepSeek 生成初审建议；AI 不会自动发布项目。</p>
    </form>
  );
}
