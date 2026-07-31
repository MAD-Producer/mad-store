# MAD Store

面向 MAD / AMV 个体开发者与创作者的中文开源项目导航站。项目基于 Next.js App Router，适配 EdgeOne Makers（原 EdgeOne Pages）的 SSR、ISR 与 Route Handlers。

## 功能

- 三个公开页面：介绍、项目、提交
- 项目搜索、分类筛选与 GitHub README 页内安全渲染
- 用户提交公开 GitHub 仓库
- MongoDB Atlas M0 持久化
- 管理员登录、编辑、分类、标签管理、人工审核发布/拒绝
- SMTP 新提交提醒
- DeepSeek 辅助初审（仅生成建议，不自动发布）
- 中文 metadata、JSON-LD、sitemap、robots 与 Open Graph

## 本地运行

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

未配置 MongoDB 时，首页会使用内置的两个 MAD-Producer 测试项目；提交与后台写入需要数据库配置。

## MongoDB Atlas M0

1. 在 Atlas 创建 M0 共享集群和数据库用户。
2. 在 Network Access 中允许 EdgeOne 函数访问。由于函数出口 IP 可能变化，可先使用 `0.0.0.0/0`，同时务必使用强密码与最小权限数据库用户；如后续获得固定出口信息，再收紧白名单。
3. 将连接字符串写入 EdgeOne 项目变量 `MONGODB_URI`，数据库名写入 `MONGODB_DB`。
4. 首次访问时应用会自动创建索引、站点字段选项和两个测试项目。

## EdgeOne 部署

1. 将仓库导入 EdgeOne Makers，框架选择 Next.js。
2. 构建命令和输出目录会从 `edgeone.json` 读取。
3. 在项目设置中添加 `.env.example` 列出的变量；密码、Session Secret、SMTP 密码、DeepSeek Key 和 GitHub Token 应设为 Secret。
4. 部署完成后，将 `NEXT_PUBLIC_SITE_URL` 更新为正式域名并重新部署，以生成正确 canonical、sitemap 和分享链接。

正式启用前至少需要：

- `MONGODB_URI`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL`

SMTP 与 DeepSeek 均为可选增强；未配置时不会阻断人工审核流程。

## 安全说明

- 管理员 Session 使用 HttpOnly、SameSite=Strict Cookie 和 HMAC 签名。
- 登录与提交接口带基础限流，写操作校验同源请求。
- README 使用 React Markdown 渲染，不注入仓库 HTML；远程图片以文字占位展示。
- DeepSeek 结果只保存在待审记录中，发布动作必须由管理员点击确认。
