import type { Metadata } from "next";
import { DownloadProxyClient } from "@/components/DownloadProxyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分片下载",
  robots: { index: false, follow: false },
};

export default async function DownloadProxyPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string | string[] }>;
}) {
  const params = await searchParams;
  const target = Array.isArray(params.target) ? params.target[0] : params.target;
  return <DownloadProxyClient target={target || ""} />;
}
