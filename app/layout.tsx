import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mad-store.edgeone.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MAD Store｜MAD / AMV 中文开源项目导航",
    template: "%s｜MAD Store",
  },
  description:
    "发现面向 MAD、AMV 创作者的中文开源工具、脚本、下载与转码项目。支持开发者自主提交，由管理员人工审核与分类。",
  keywords: ["MAD", "AMV", "开源工具", "AE", "PR", "转码", "B站视频下载", "MAD制作"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "MAD Store",
    title: "MAD Store｜让好工具被真正需要它的创作者发现",
    description: "面向 MAD / AMV 个体开发者与创作者的中文开源项目导航。",
  },
  twitter: {
    card: "summary",
    title: "MAD Store｜MAD / AMV 中文开源项目导航",
    description: "发现工具、阅读 README、提交你的开源项目。",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1714",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
