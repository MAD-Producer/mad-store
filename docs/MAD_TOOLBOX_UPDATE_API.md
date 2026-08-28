# MAD Toolbox 更新与分片下载接口

## 更新信息

GET /api/updates/mad-toolbox

按平台选择安装包：

GET /api/updates/mad-toolbox?platform=windows&arch=x86_64&edition=full

支持：

| 参数 | 支持值 |
| --- | --- |
| platform | windows、macos |
| arch | x86_64、arm64 |
| edition | full、lite |

接口由服务端读取 MAD-Producer/MAD-Toolbox 的最新 GitHub Release。返回的安装包资源包含：

- downloadUrl：给程序调用的分片下载 API 地址
- browserUrl：给浏览器打开的现有下载页面地址
- size、name、平台、架构和版本类型

downloadUrl 示例：

    https://store.madproducer.cn/api/download-proxy?target=https%3A%2F%2Fgithub.com%2FMAD-Producer%2FMAD-Toolbox%2Freleases%2Fdownload%2Fv1.0.1%2FMAD.Toolbox_1.0.1_x64-Full-setup.exe

GitHub Token 只在镜像站服务端使用，不会返回给客户端。

## 分片下载

downloadUrl 是机器调用接口，不是浏览器下载页面。

### 读取文件信息

    HEAD /api/download-proxy?target={URL-encoded-source-url}

响应会返回：

- Content-Length
- Content-Type
- Content-Disposition
- X-Proxy-Chunk-Size: 4194304

### 下载分片

    GET /api/download-proxy?target={URL-encoded-source-url}
    Range: bytes=0-4194303

成功时返回 HTTP 206 Partial Content，并包含 Content-Range。每次请求只能获取一个不超过 4 MiB 的分片：

    Range: bytes={start}-{end}

不带 Range 的 GET 请求会返回 416，不会返回完整大文件。客户端需要根据文件大小循环请求分片，并自行写入和合并文件。

接口支持 GET、HEAD 和 OPTIONS，并开放必要的 CORS 响应头，方便桌面客户端或其他程序调用。

## 工作流程

1. 客户端请求更新信息接口。
2. 镜像站服务端读取最新 Release，并过滤不属于 MAD Toolbox Release 路径的资源。
3. 客户端通过 HEAD 获取文件大小。
4. 客户端使用 Range 请求分片。
5. 镜像站校验目标地址属于后台登记的代理范围，然后安全跟随 GitHub 的资源重定向。
6. 客户端合并全部分片。

要让接口正常工作，后台需要登记 MAD Toolbox 的 GitHub /releases 代理范围。现有的浏览器分片下载页面仍然保留，可通过返回的 browserUrl 使用。
