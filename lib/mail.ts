import nodemailer from "nodemailer";
import type { Project, SubmissionInput } from "./types";

export async function notifyAdmin(input: SubmissionInput, projectId: string, aiReview: Project["aiReview"]) {
  const host = process.env.SMTP_HOST;
  const to = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL;
  if (!host || !to) return;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `【MAD Store】新项目待审核：${input.name}`,
    text: [
      `项目：${input.name}`,
      `仓库：${input.repoUrl}`,
      `提交人：${input.submitterName} <${input.submitterEmail}>`,
      `作者 QQ：${input.authorQQ || "未填写"}`,
      `AI 建议：${aiReview ? `${aiReview.score} 分，${aiReview.summary}` : "未启用或未完成"}`,
      `记录 ID：${projectId}`,
      `审核入口：${adminUrl}`,
      "",
      "提示：AI 结果仅供参考，必须由管理员人工完成最终判断。",
    ].join("\n"),
  });
}
