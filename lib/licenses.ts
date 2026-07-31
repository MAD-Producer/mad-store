export const licenseOptions = [
  { value: "auto", label: "从 GitHub 自动识别（推荐）", description: "仓库已配置 LICENSE 时，提交后会自动读取。" },
  { value: "MIT", label: "MIT", description: "限制宽松，允许商业使用、修改和再分发。" },
  { value: "Apache-2.0", label: "Apache License 2.0", description: "宽松协议，并明确提供专利授权。" },
  { value: "GPL-3.0", label: "GNU GPL v3", description: "衍生作品通常也需要使用 GPL v3 开源。" },
  { value: "AGPL-3.0", label: "GNU AGPL v3", description: "通过网络提供服务时也需要公开对应源代码。" },
  { value: "LGPL-3.0", label: "GNU LGPL v3", description: "常用于允许闭源程序链接使用的开源库。" },
  { value: "MPL-2.0", label: "Mozilla Public License 2.0", description: "以文件为范围要求公开修改后的源代码。" },
  { value: "BSD-3-Clause", label: "BSD 3-Clause", description: "宽松协议，包含署名与非背书条款。" },
  { value: "Unlicense", label: "The Unlicense", description: "尽可能将作品贡献到公共领域。" },
] as const;

export function describeLicense(value: string) {
  return licenseOptions.find((item) => item.value === value)?.description || "具体授权范围请以仓库中的 LICENSE 文件为准。";
}
