import type { SubmissionInput, SystemName } from "./types";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validHttpUrl(value: string, host?: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!host || url.hostname === host || url.hostname === `www.${host}`);
  } catch {
    return false;
  }
}

function optionalHttpsUrl(value: unknown, max = 500) {
  const cleaned = clean(value, max);
  if (!cleaned) return "";
  if (!validHttpUrl(cleaned)) throw new Error("官网和下载地址必须使用有效的 HTTPS 地址");
  return cleaned;
}

export function parseSubmission(body: Record<string, unknown>): SubmissionInput {
  const systems = Array.isArray(body.systems)
    ? body.systems.filter(
        (value): value is SystemName =>
          value === "Windows" || value === "macOS" || value === "Web",
      )
    : [];
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => clean(tag, 24)).filter(Boolean))].slice(0, 8)
    : [];
  const input: SubmissionInput = {
    name: clean(body.name, 80),
    description: clean(body.description, 320),
    repoUrl: clean(body.repoUrl, 300),
    authorUrl: clean(body.authorUrl, 300),
    license: clean(body.license, 80),
    systems,
    tags,
    submitterName: clean(body.submitterName, 60),
    submitterEmail: clean(body.submitterEmail, 120).toLowerCase(),
    contactQQ: clean(body.contactQQ, 20),
    officialUrl: optionalHttpsUrl(body.officialUrl),
  };
  if (input.name.length < 2) throw new Error("请填写仓库名称");
  if (input.description.length < 12) throw new Error("仓库描述至少需要 12 个字");
  if (!validHttpUrl(input.repoUrl, "github.com")) throw new Error("请填写有效的 GitHub 仓库地址");
  if (!validHttpUrl(input.authorUrl, "github.com")) throw new Error("请填写有效的作者 GitHub 主页");
  if (!input.license) throw new Error("请选择开源协议");
  if (!input.systems.length) throw new Error("请至少选择一个适配系统");
  if (!tags.length) throw new Error("请至少填写一个标签");
  if (!input.submitterName) throw new Error("请填写联系人");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.submitterEmail)) throw new Error("请填写有效邮箱");
  if (input.contactQQ && !/^[1-9]\d{4,11}$/.test(input.contactQQ)) throw new Error("请填写有效的联系人 QQ 号");
  return input;
}
