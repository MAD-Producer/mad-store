# MAD Store

MAD Store 是面向 MAD / AMV 创作者与独立开发者的开源项目导航。它把分散在 GitHub 的工具、脚本、下载器、转码方案和文档集中到一个易于查找、阅读和提交的站点中。

线上地址：[store.madproducer.cn](https://store.madproducer.cn)

代码仓库：[MAD-Producer/mad-store](https://github.com/MAD-Producer/mad-store)

本项目以 [MIT License](./LICENSE) 开源。

## 主要能力

- 介绍、项目、提交三个公开页面
- 按关键词、分类、系统和标签多层筛选项目
- 每个项目拥有独立的可编辑 slug、SEO 元信息和详情页
- 在独立详情页渲染 GitHub README，并正确解析仓库内的相对链接
- GitHub 图片通过带域名白名单、体积限制和缓存策略的本站代理加载
- 用户提交公开 GitHub 仓库及作者联系方式
- 常见开源协议提供用途说明，也可从 GitHub 自动识别或选择“其他协议”手动填写
- 管理员修改项目 slug、名称、描述、仓库地址、直链下载、协议、系统、标签和分类
- 每个项目可添加版本号、文件大小、文档地址等自定义展示字段
- 多管理员账号登录
- 项目发布、拒绝与重新编辑
- 管理员维护分类和可选标签
- MongoDB Atlas 持久化
- SMTP 同时通知管理员和联系人，覆盖已提交、已收录与被拒绝状态
- 拒绝项目时必须填写拒绝理由，并随状态邮件发送
- DeepSeek 辅助整理初审建议
- sitemap、robots、canonical、JSON-LD 和页面级 metadata
- EdgeOne Pages 自动部署与 Cloud Functions 支持

## 页面与接口

| 路径 | 用途 |
| --- | --- |
| `/` | 站点介绍 |
| `/projects` | 项目浏览与多层筛选 |
| `/projects/:slug` | 项目详情、结构化信息和 README |
| `/submit` | 项目提交表单 |
| `/admin` | 管理员审核工作台，不参与搜索引擎收录 |
| `/api/submit` | 接收项目提交 |
| `/api/github-image` | 受限代理并缓存 GitHub README 图片 |
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
- React Icons
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
| `ADMIN_SESSION_SECRET` | 推荐 | 管理员 Session 的独立 HMAC 密钥，建议至少 32 个随机字符 |
| `GITHUB_TOKEN` | 推荐 | 读取 GitHub 仓库信息和 README；不配置时容易遇到匿名请求限额 |

### 每个基础变量从哪里获得

#### `NEXT_PUBLIC_SITE_URL`

填写用户最终访问的完整 HTTPS 地址，不要带末尾斜杠，例如：

```env
NEXT_PUBLIC_SITE_URL=https://store.madproducer.cn
```

它会用于 canonical、sitemap、Open Graph URL 和审核邮件中的后台链接。修改后需要重新部署。

#### `MONGODB_URI` 与 `MONGODB_DB`

1. 登录 [MongoDB Atlas](https://cloud.mongodb.com/)。
2. 进入项目的 **Database → Connect → Drivers**。
3. 复制 `mongodb+srv://...` 连接字符串。
4. 将 `<password>` 替换为数据库用户密码；密码中的 `@`、`:`、`/` 等字符需要进行 URL 编码。
5. `MONGODB_DB` 推荐保持为 `mad_store`。

数据库用户只需要 `readWrite` 权限，并将权限范围限制到 `mad_store`，不要给应用账号配置 Atlas Admin。

#### `ADMIN_SESSION_SECRET`

这是管理员登录 Cookie 的签名密钥，不是管理员密码。可以在本地生成：

```bash
openssl rand -hex 32
```

把输出的完整字符串保存到 EdgeOne 的加密环境变量中。修改它会让现有管理员会话立即失效。

为了兼容已经上线的早期部署，未配置该变量时会使用 `ADMIN_ACCOUNTS`（或旧版管理员账号与密码）作为签名材料，因此后台不会出现“登录接口成功但马上退出”的情况。生产环境仍建议配置独立密钥，便于单独轮换会话签名而不改管理员密码。

#### `GITHUB_TOKEN`

站点只读取公开仓库，不需要写入权限。GitHub 匿名 REST API 默认只有每个出口 IP 每小时 60 次请求，使用 Token 后通常为每小时 5,000 次。

推荐创建 Fine-grained personal access token：

1. 打开 [GitHub Fine-grained token 创建页](https://github.com/settings/personal-access-tokens/new)。
2. 填写名称，例如 `MAD Store repository reader`，并设置合理的过期时间。
3. 选择自己的账号作为 Resource owner。
4. 本项目只读取公开仓库，不需要添加写权限；保持最小权限即可。
5. 生成后立即复制 Token，保存为 EdgeOne 的加密变量 `GITHUB_TOKEN`。

Token 只会显示一次，不要写入 `.env.example`、README、Git 提交或前端代码。详细规则参见 [GitHub 官方 Token 文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

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

`ADMIN_ACCOUNTS` 必须是合法 JSON，外层使用方括号，字段名与字符串都使用英文双引号。建议在本地用以下命令检查：

```bash
node -e 'JSON.parse(process.argv[1]); console.log("JSON OK")' \
  '[{"username":"editor-a","password":"long-random-password-a"}]'
```

### SMTP 通知

```env
SMTP_HOST=smtp.feishu.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=store@madproducer.com
SMTP_PASS=飞书公共邮箱的-IMAP-SMTP-密码
SMTP_FROM=store@madproducer.com
SMTP_FROM_NAME=MAD Store
ADMIN_EMAILS=admin-a@example.com,admin-b@example.com
```

`ADMIN_EMAILS` 支持使用英文逗号分隔多个管理员收件人。SMTP 同时用于：

- 新项目提交后提醒管理员
- 告知联系人“已提交，等待审核”
- 项目发布后告知联系人“已收录”
- 项目拒绝后发送管理员填写的拒绝理由

SMTP 未配置时不会阻断项目提交或审核操作。飞书公共邮箱的 `SMTP_PASS` 是公共邮箱详情页显示的 IMAP/SMTP 密码，不是飞书账号登录密码。

EdgeOne 环境变量编辑器不接受 `MAD Store <store@madproducer.com>` 这种带空格和尖括号的值，因此发件地址与显示名称必须分别填写到 `SMTP_FROM` 和 `SMTP_FROM_NAME`。

获取 SMTP 配置的一般步骤：

1. 在邮箱服务商后台开启 SMTP。
2. 创建“应用专用密码”或“授权码”，不要直接使用邮箱登录密码。
3. 将服务商给出的主机、端口和加密方式填入环境变量。
4. `SMTP_FROM` 使用已通过服务商验证的发件地址。
5. 先只填写一个 `ADMIN_EMAILS` 收件人完成测试，再添加其他管理员。

常见配置示例：

| 邮箱 | `SMTP_HOST` | 端口 | `SMTP_SECURE` | `SMTP_PASS` |
| --- | --- | --- | --- | --- |
| 飞书公共邮箱 | `smtp.feishu.cn` | `465` | `true` | 公共邮箱详情中的 IMAP/SMTP 密码 |
| QQ 邮箱 | `smtp.qq.com` | `465` | `true` | QQ 邮箱生成的授权码 |
| Gmail | `smtp.gmail.com` | `465` | `true` | 开启两步验证后生成的应用专用密码 |
| Microsoft 365 | `smtp.office365.com` | `587` | `false` | 租户允许 SMTP AUTH 后使用的凭据 |

不同邮箱服务商可能调整认证策略，应以邮箱后台显示的 SMTP 参数为准。

### DeepSeek

```env
DEEPSEEK_API_KEY=
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-v4-flash
```

`/chat/completions` 接口本身没有被弃用。被弃用的是旧模型别名 `deepseek-chat` 和 `deepseek-reasoner`；DeepSeek 官方已于 2026 年 7 月 24 日停止这两个旧名称。本项目默认使用 `deepseek-v4-flash`，并关闭 thinking 模式以降低审核延迟。

获取 DeepSeek Key：

1. 登录 [DeepSeek 开放平台](https://platform.deepseek.com/)。
2. 完成充值或确认账号有可用额度。
3. 在 API Keys 页面创建新密钥。
4. 将密钥保存为 EdgeOne 的加密变量 `DEEPSEEK_API_KEY`。
5. 保持 `DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions`。

当前模型名称与接口格式以 [DeepSeek API 文档](https://api-docs.deepseek.com/api/create-chat-completion) 和 [更新日志](https://api-docs.deepseek.com/updates/) 为准。未配置 DeepSeek 或调用失败时，项目仍会写入数据库并进入人工审核流程。

## MongoDB Atlas M0 配置

1. 在 Atlas 创建 M0 共享集群。
2. 创建只用于 MAD Store 的数据库用户，并生成高强度密码。
3. 在 Network Access 中配置 EdgeOne 函数可访问的来源。Atlas 只接受 IP Access List 中的来源。
4. 获取 `mongodb+srv://` 连接字符串。
5. 把连接字符串和数据库名加入 EdgeOne 项目环境变量。
6. 重新部署项目。

EdgeOne Pages Functions 当前没有可直接填写到 Atlas 的固定出口 IP 时，可以添加 `0.0.0.0/0` 以允许函数连接，但必须同时做到：

- 应用数据库用户只拥有 `readWrite@mad_store`
- 使用高强度随机数据库密码
- 连接字符串仅保存为 EdgeOne 加密环境变量
- 不将 Atlas 管理员账号用于应用
- 定期轮换数据库密码并检查 Atlas 访问日志

如果之后获得固定出口 IP，应立即将 `0.0.0.0/0` 替换为更小的 CIDR 范围。Atlas 网络规则说明见 [MongoDB 官方文档](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/)。

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
| `systems` | Windows、macOS、Web |
| `tags` | 项目标签 |
| `category` | 管理员指定的分类 |
| `readme` | 提交时读取的 README |
| `submitterName` | 联系人 |
| `submitterEmail` | 联系邮箱，仅后台可见 |
| `contactQQ` | 联系人 QQ，仅后台可见；读取旧数据时兼容 `authorQQ` |
| `downloadUrl` | 管理员添加的 HTTPS 直链下载地址 |
| `customFields` | 管理员添加的自定义展示字段，可选附带 HTTPS 链接 |
| `rejectionReason` | 拒绝项目时填写并发送给联系人的原因 |
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

环境变量建议分为两类：

- 普通变量：`NEXT_PUBLIC_SITE_URL`、`MONGODB_DB`、`SMTP_PORT`、`SMTP_SECURE`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`
- 加密变量：`MONGODB_URI`、`ADMIN_ACCOUNTS`、`ADMIN_SESSION_SECRET`、`SMTP_PASS`、`DEEPSEEK_API_KEY`、`GITHUB_TOKEN`

部署后至少检查：

```text
/                 首页能打开
/projects         能从 Atlas 读取已发布项目
/submit           表单选项能从 Atlas 读取
/admin            管理员可以登录
/sitemap.xml      URL 使用正式域名
/robots.txt       Sitemap 地址正确
```

如果 `/projects` 返回 500，优先检查 Atlas IP Access List、数据库用户权限、连接字符串中的密码编码，以及 EdgeOne 环境变量是否已应用到最新部署。

## 审核流程

1. 用户在提交页填写仓库、适配系统、标签和联系方式。
2. 服务端校验 GitHub 地址并读取公开仓库信息与 README。
3. 如果配置了 DeepSeek，则生成后台可见的整理建议。
4. 项目以 `pending` 状态写入 MongoDB。
5. SMTP 向管理员发送提醒，并向联系人发送“已提交”回执。
6. 管理员登录 `/admin`，核对并修改信息。
7. 管理员选择分类，随后发布或填写拒绝理由并拒绝项目。
8. 状态变化后，联系人会收到“已收录”或包含拒绝理由的邮件。
9. 只有 `published` 状态的项目会出现在项目页。

## 安全设计

- 管理员 Session 使用 HttpOnly、SameSite=Strict Cookie
- Session 使用 HMAC-SHA256 签名并设置 12 小时有效期
- 管理员账号密码只从服务端环境变量读取
- 登录与提交接口带基础限流
- 管理端写操作校验同源请求
- README 使用 React Markdown 渲染，不执行仓库中的 HTML
- README 只加载 HTTPS 图片；GitHub 图片通过 `/api/github-image` 代理并由 EdgeOne 缓存
- 图片代理只允许 GitHub 官方图片域名、最多跟随三次受限重定向，并限制单图 8 MB
- README 相对文档链接会转为对应 GitHub 仓库文件地址，不会误跳到本站目录
- 联系邮箱和联系人 QQ 只在管理员后台与通知邮件中使用
- 管理员后台始终展示联系人信息块；早期内置项目没有提交记录时会明确显示“历史项目未记录”
- `.env.local` 与生产密钥不得提交到 Git

## 项目结构

```text
app/
  page.tsx                 介绍页
  projects/page.tsx        项目总览与筛选
  projects/[slug]/page.tsx 独立项目详情与 README
  submit/page.tsx          提交页
  admin/page.tsx           管理员工作台
  api/                     提交、图片代理与管理接口
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
  licenses.ts              常见开源协议选项与说明
  ai.ts                    DeepSeek 初审
  mail.ts                  管理员与联系人状态邮件
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
