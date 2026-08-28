# MAD Toolbox 更新接口

镜像站提供一个固定项目的更新元数据接口：

`GET /api/updates/mad-toolbox`

接口由服务端读取 `MAD-Producer/MAD-Toolbox` 的最新 GitHub Release，并将 Release 页面和安装包地址改写为当前镜像站地址。GitHub Token 只在服务端使用，不会出现在响应中。

## 按平台选择安装包

可同时传入以下参数：

`GET /api/updates/mad-toolbox?platform=macos&arch=arm64&edition=full`

| 参数 | 支持值 |
| --- | --- |
| `platform` | `windows`、`macos` |
| `arch` | `x86_64`、`arm64` |
| `edition` | `full`、`lite` |

也兼容 `win`、`darwin`、`x64`、`aarch64` 和大小写不同的版本。三个参数需要同时提供；不传参数时返回 Release 的全部安全资源，`selectedAsset` 为 `null`。

返回内容包含：

- `version`、`tag`、`notes` 和 `publishedAt`
- 改写后的 `releaseUrl`
- 经过校验的 `assets`
- 按请求参数匹配到的 `selectedAsset`，找不到时为 `null`

只会返回 HTTPS 且属于 MAD Toolbox GitHub Release 下载路径的资源。要使 `releaseUrl` 和 `selectedAsset.url` 正常下载，后台需要登记 MAD Toolbox 的 `/releases` 代理范围。

此接口只负责提供版本信息和镜像下载地址，不负责自动安装或签名校验。
