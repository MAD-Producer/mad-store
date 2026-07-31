"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";

export function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json()) as { message?: string };
    if (response.ok) {
      window.location.reload();
      return;
    }
    setError(data.message || "登录失败");
    setLoading(false);
  }

  return (
    <div className="admin-login">
      <span className="admin-lock">
        <LockKeyhole size={27} />
      </span>
      <span className="eyebrow">ADMIN / 管理</span>
      <h1>审核工作台</h1>
      <p>仅站点管理员可访问。登录后可以审核、修改、分类并发布项目。</p>
      <form onSubmit={submit}>
        <label>
          管理员账号
          <input name="username" required autoFocus autoComplete="username" />
        </label>
        <label>
          密码
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={18} /> : null}
          进入工作台
        </button>
      </form>
    </div>
  );
}
