import nodemailer from "nodemailer";
import type { Project, SubmissionInput } from "./types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function mailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function fromAddress() {
  const address = process.env.SMTP_FROM || process.env.SMTP_USER;
  return address
    ? { name: process.env.SMTP_FROM_NAME || "MAD Store", address }
    : undefined;
}

function emailShell({
  eyebrow,
  title,
  intro,
  content,
  action,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  content: string;
  action?: { label: string; url: string };
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://store.madproducer.cn").replace(/\/$/, "");
  const iconUrl = `${siteUrl}/mad-store-icon.webp`;
  const actionHtml = action
    ? `<a href="${escapeHtml(action.url)}" style="display:inline-block;margin-top:24px;padding:12px 18px;border-radius:8px;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">${escapeHtml(action.label)}</a>`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;background:#f4f4f2;color:#2b2b2b;font-family:Inter,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f2;padding:32px 14px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e7e7e5;border-radius:14px;overflow:hidden">
          <tr><td style="height:5px;background:#e85f4a"></td></tr>
          <tr><td style="padding:30px 34px 18px">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td><img src="${escapeHtml(iconUrl)}" width="42" height="42" alt="" style="display:block;border:0;border-radius:9px"></td>
              <td style="padding-left:12px">
                <strong style="display:block;color:#171717;font-size:17px">MAD Store</strong>
                <span style="color:#a3a3a3;font-size:9px;letter-spacing:1.4px">OPEN SOURCE INDEX</span>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 34px 34px">
            <div style="color:#e85f4a;font-size:10px;font-weight:700;letter-spacing:1.5px">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:12px 0 12px;color:#171717;font-size:28px;line-height:1.3">${escapeHtml(title)}</h1>
            <p style="margin:0 0 22px;color:#737373;font-size:14px;line-height:1.8">${escapeHtml(intro)}</p>
            ${content}
            ${actionHtml}
          </td></tr>
          <tr><td style="padding:22px 34px;background:#f7f7f5;border-top:1px solid #e7e7e5">
            <p style="margin:0;color:#737373;font-size:11px;line-height:1.8">MAD Producer 麦德工坊旗下项目 · MAD Store</p>
            <p style="margin:3px 0 0;color:#a3a3a3;font-size:10px">
              <a href="mailto:store@madproducer.com" style="color:#737373;text-decoration:none">store@madproducer.com</a>
              &nbsp;·&nbsp;
              <a href="${escapeHtml(siteUrl)}" style="color:#737373;text-decoration:none">${escapeHtml(siteUrl)}</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function infoRows(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e7e7e5;border-radius:9px;border-collapse:separate;overflow:hidden">
    ${rows.map(([label, value], index) => `<tr>
      <td style="width:92px;padding:11px 13px;color:#a3a3a3;font-size:11px;${index ? "border-top:1px solid #e7e7e5;" : ""}">${escapeHtml(label)}</td>
      <td style="padding:11px 13px;color:#2b2b2b;font-size:12px;line-height:1.6;${index ? "border-top:1px solid #e7e7e5;" : ""}">${escapeHtml(value)}</td>
    </tr>`).join("")}
  </table>`;
}

export async function notifyAdmin(input: SubmissionInput, projectId: string, aiReview: Project["aiReview"]) {
  const transporter = mailTransport();
  const to = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL;
  if (!transporter || !to) return;

  const adminUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}/admin`;
  const rows: Array<[string, string]> = [
    ["项目", input.name],
    ["仓库", input.repoUrl],
    ["官网", input.officialUrl || "未填写"],
    ["联系人", `${input.submitterName} <${input.submitterEmail}>`],
    ["联系人 QQ", input.contactQQ || "未填写"],
    ["AI 建议", aiReview ? `${aiReview.score} 分，${aiReview.summary}` : "未启用或未完成"],
    ["记录 ID", projectId],
  ];
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: `【MAD Store】新项目待审核：${input.name}`,
    text: [
      ...rows.map(([label, value]) => `${label}：${value}`),
      `审核入口：${adminUrl}`,
      "",
      "AI 结果仅供参考，必须由管理员人工完成最终判断。",
    ].join("\n"),
    html: emailShell({
      eyebrow: "NEW SUBMISSION",
      title: "有新项目等待审核",
      intro: "提交内容已写入 MAD Store，请登录审核工作台核对项目信息。",
      content: infoRows(rows),
      action: { label: "前往审核工作台", url: adminUrl },
    }),
  });
}

export async function notifySubmitterReceived(input: SubmissionInput, projectId: string) {
  const transporter = mailTransport();
  if (!transporter || !input.submitterEmail) return;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://store.madproducer.cn").replace(/\/$/, "");
  await transporter.sendMail({
    from: fromAddress(),
    to: input.submitterEmail,
    subject: `【MAD Store】已收到你的项目：${input.name}`,
    text: [
      `${input.submitterName}，你好：`,
      `我们已经收到项目「${input.name}」，当前状态为“已提交，等待人工审核”。`,
      `仓库：${input.repoUrl}`,
      `记录 ID：${projectId}`,
      "审核状态发生变化时，我们会继续通过此邮箱通知你。",
    ].join("\n"),
    html: emailShell({
      eyebrow: "SUBMITTED",
      title: "项目已经提交",
      intro: `${input.submitterName}，我们已经收到「${input.name}」，当前正在等待人工审核。`,
      content: infoRows([
        ["当前状态", "已提交 · 等待人工审核"],
        ["项目", input.name],
        ["仓库", input.repoUrl],
        ["记录 ID", projectId],
      ]),
      action: { label: "浏览 MAD Store", url: `${siteUrl}/projects` },
    }),
  });
}

export async function notifySubmitterStatus(project: Project) {
  const transporter = mailTransport();
  if (!transporter || !project.submitterEmail) return;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://store.madproducer.cn").replace(/\/$/, "");
  const published = project.status === "published";
  if (!published && project.status !== "rejected") return;
  const projectUrl = `${siteUrl}/projects/${encodeURIComponent(project.slug)}`;
  const statusText = published ? "已收录" : "未收录";
  const reason = project.rejectionReason || "本次审核暂未通过，欢迎完善项目后再次联系我们。";
  const rows: Array<[string, string]> = [
    ["审核结果", statusText],
    ["项目", project.name],
    ["仓库", project.repoUrl],
  ];
  if (!published) rows.push(["拒绝理由", reason]);

  await transporter.sendMail({
    from: fromAddress(),
    to: project.submitterEmail,
    subject: `【MAD Store】${project.name} ${published ? "已被收录" : "审核未通过"}`,
    text: published
      ? `你的项目「${project.name}」已被 MAD Store 收录。\n项目页：${projectUrl}`
      : `你的项目「${project.name}」本次未被收录。\n拒绝理由：${reason}\n如有疑问，请联系 store@madproducer.com。`,
    html: emailShell({
      eyebrow: published ? "PUBLISHED" : "REVIEW RESULT",
      title: published ? "项目已被收录" : "项目本次未被收录",
      intro: published
        ? `感谢提交，「${project.name}」现在已经可以在 MAD Store 中访问。`
        : `感谢提交。管理员完成审核后，决定暂不收录「${project.name}」。`,
      content: infoRows(rows),
      action: published ? { label: "查看项目页面", url: projectUrl } : { label: "联系 MAD Store", url: "mailto:store@madproducer.com" },
    }),
  });
}
