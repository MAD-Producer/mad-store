# MAD Store

MAD Store 是面向 MAD / AMV 创作者与独立开发者的开源项目导航。它把分散在 GitHub 的工具、脚本、下载器、转码方案和文档集中到一个易于查找、阅读和提交的站点中。

线上地址：[store.madproducer.top](https://store.madproducer.top)

代码仓库：[MAD-Producer/mad-store](https://github.com/MAD-Producer/mad-store)

## 主要能力

- 介绍、项目、提交三个公开页面
- 按分类筛选和关键词搜索项目
- 在站内渲染 GitHub README
- 用户提交公开 GitHub 仓库及作者联系方式
- 管理员修改项目名称、描述、仓库地址、协议、系统、标签和分类
- 多管理员账号登录
- 项目发布、拒绝与重新编辑
- 管理员维护分类和可选标签
- MongoDB Atlas 持久化
- SMTP 新提交提醒，支持多个收件人
- DeepSeek 辅助整理初审建议
- sitemap、robots、canonical、JSON-LD 和页面级 metadata
- EdgeOne Pages 自动部署与 Cloud Functions 支持

## 页面与接口

| 路径 | 用途 |
| --- | --- |
| `/` | 站点介绍 |
| `/projects` | 项目浏览、筛选和 README 阅读 |
| `/submit` | 项目提交表单 |
| `/admin` | 管理员审核工作台，不参与搜索引擎收录 |
| `/api/submit` | 接收项目提交 |
| `/api/admin/login` | 管理员登录 |
| `/api/admin/logout` | 管理员退出 |
| `/api/admin/projects` | 获取全部待审与已发布项目 |
| `/api/admin/projects/:id` | 修改信息、分类和审核状态 |
| `/api/admin/settings` | 管理分类与标签 |

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- MongoDB Node.js Driver
- MongoDB Atlas M0
- React Markdown + remark-gfm
- Nodemailer
- DeepSeek API
- EdgeOne Pages / Makers

## 本地运行

需要 Node.js 22 和 pnpm。

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

访问 `http://localhost:3000`。未配置 MongoDB 时，项目页会展示内置的 `MAD-Toolbox` 和 `MAD-DOC`，但提交和后台写入不可用。

正式构建：

```bash
pnpm lint
pnpm build
```

## 环境变量

### 基础配置

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 是 | 正式站点地址，用于 canonical、sitemap 和邮件中的后台链接 |
| `MONGODB_URI` | 是 | MongoDB Atlas 连接字符串 |
| `MONGODB_DB` | 是 | 数据库名称，推荐 `mad_store` |
| `ADMIN_SESSION_SECRET` | 是 | 管理员 Session 的 HMAC 密钥，建议至少 32 个随机字符 |
| `GITHUB_TOKEN` | 否 | 提高 GitHub API 请求限额 |

### 多管理员

推荐使用 `ADMIN_ACCOUNTS` 配置多个管理员：

```env
ADMIN_ACCOUNTS=[{"username":"editor-a","password":"long-random-password-a"},{"username":"editor-b","password":"long-random-password-b"}]
```

每名管理员应使用独立账号和长随机密码。为了兼容早期部署，也可以继续使用：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=long-random-password
```

当 `ADMIN_ACCOUNTS` 存在时，旧版单管理员变量不会参与登录验证。

### SMTP 通知

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mailer@example.com
SMTP_PASS=app-password
SMTP_FROM=MAD Store <mailer@example.com>
ADMIN_EMAILS=admin-a@example.com,admin-b@example.com
```

`ADMIN_EMAILS` 支持使用英文逗号分隔多个收件人。SMTP 未配置时不会阻断项目提交。

### DeepSeek

```env
DEEPSEEK_API_KEY=
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

未配置 DeepSeek 时，项目仍可正常提交并进入后台。DeepSeek 只生成后台可见的结构化建议，发布动作始终需要管理员操作。

## MongoDB Atlas M0 配置

1. 在 Atlas 创建 M0 共享集群。
2. 创建只用于 MAD Store 的数据库用户，并生成高强度密码。
3. 在 Network Access 中配置 EdgeOne 函数可访问的来源。
4. 获取 `mongodb+srv://` 连接字符串。
5. 把连接字符串和数据库名加入 EdgeOne 项目环境变量。
6. 重新部署项目。

应用首次连接数据库时会自动完成以下初始化：

- 创建 `projects`、`settings` 集合
- 创建仓库地址和 slug 的唯一索引
- 写入默认分类与标签
- 写入 `MAD-Toolbox`、`MAD-DOC` 两个初始项目

项目数据的主要字段：

| 字段 | 说明 |
| --- | --- |
| `name` | 仓库名称 |
| `description` | 仓库描述 |
| `repoUrl` | GitHub 仓库地址 |
| `authorUrl` | 作者 GitHub 主页 |
| `license` | 开源协议 |
| `systems` | Windows、macOS |
| `tags` | 项目标签 |
| `category` | 管理员指定的分类 |
| `readme` | 提交时读取的 README |
| `submitterName` | 联系人 |
| `submitterEmail` | 联系邮箱，仅后台可见 |
| `authorQQ` | 作者 QQ，仅后台可见 |
| `status` | `pending`、`published` 或 `rejected` |
| `aiReview` | 可选的 DeepSeek 初审建议 |

## EdgeOne Pages 部署

仓库根目录的 `edgeone.json` 已包含构建配置：

- Node.js `22.11.0`
- 安装命令 `pnpm install --frozen-lockfile`
- 构建命令 `pnpm run build`
- 输出目录 `.next`
- 中国大陆函数地域 `ap-shanghai`
- 海外函数地域 `ap-singapore`

部署步骤：

1. 在 EdgeOne Pages 中选择“导入 Git 仓库”。
2. 选择 `MAD-Producer/mad-store` 和 `main` 分支。
3. 添加 `.env.example` 中需要的环境变量。
4. 开始部署。
5. 绑定正式域名。
6. 将 `NEXT_PUBLIC_SITE_URL` 更新为正式域名后重新部署。

`main` 分支开启自动部署后，每次推送都会触发新的生产构建。

## 审核流程

1. 用户在提交页填写仓库、适配系统、标签和联系方式。
2. 服务端校验 GitHub 地址并读取公开仓库信息与 README。
3. 如果配置了 DeepSeek，则生成后台可见的整理建议。
4. 项目以 `pending` 状态写入 MongoDB。
5. SMTP 向一个或多个管理员发送提醒。
6. 管理员登录 `/admin`，核对并修改信息。
7. 管理员选择分类，随后发布或拒绝项目。
8. 只有 `published` 状态的项目会出现在项目页。

## 安全设计

- 管理员 Session 使用 HttpOnly、SameSite=Strict Cookie
- Session 使用 HMAC-SHA256 签名并设置 12 小时有效期
- 管理员账号密码只从服务端环境变量读取
- 登录与提交接口带基础限流
- 管理端写操作校验同源请求
- README 使用 React Markdown 渲染，不执行仓库中的 HTML
- README 远程图片不会直接载入，避免额外的跟踪和内容风险
- 联系邮箱和作者 QQ 只在管理员后台与通知邮件中使用
- `.env.local` 与生产密钥不得提交到 Git

## 项目结构

```text
app/
  page.tsx                 介绍页
  projects/page.tsx        项目与 README
  submit/page.tsx          提交页
  admin/page.tsx           管理员工作台
  api/                     提交与管理接口
components/
  Header.tsx
  Footer.tsx
  ProjectExplorer.tsx
  SubmitForm.tsx
  AdminLogin.tsx
  AdminDashboard.tsx
lib/
  auth.ts                  多管理员认证与 Session
  mongodb.ts               Atlas 连接与索引初始化
  projects.ts              项目和站点设置读写
  github.ts                GitHub 仓库信息与 README
  ai.ts                    DeepSeek 初审
  mail.ts                  SMTP 通知
  validation.ts            提交数据校验
```

## 维护建议

- 定期更新依赖并执行 `pnpm lint`、`pnpm build`
- 定期检查被收录仓库是否删除、归档或更换协议
- 管理员离开团队后立即从 `ADMIN_ACCOUNTS` 中移除账号并重新部署
- 定期轮换管理员密码、Session Secret、SMTP 密码和 API Key
- 如果 EdgeOne 获得固定函数出口 IP，应收紧 Atlas Network Access

## License

项目许可证以仓库中的 `LICENSE` 文件为准。
