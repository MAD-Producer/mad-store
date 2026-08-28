import { NextRequest, NextResponse } from "next/server";
import {
  buildMadToolboxUpdate,
  fetchLatestMadToolboxRelease,
  type MadToolboxArch,
  type MadToolboxEdition,
  type MadToolboxPlatform,
  type MadToolboxSelection
} from "@/lib/mad-toolbox-update";

export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "X-Content-Type-Options": "nosniff"
};

const PLATFORM_ALIASES: Record<string, MadToolboxPlatform> = {
  windows: "windows",
  win: "windows",
  macos: "macos",
  darwin: "macos"
};

const ARCH_ALIASES: Record<string, MadToolboxArch> = {
  x86_64: "x86_64",
  x64: "x86_64",
  amd64: "x86_64",
  arm64: "arm64",
  aarch64: "arm64"
};

const EDITION_ALIASES: Record<string, MadToolboxEdition> = {
  full: "full",
  lite: "lite"
};

function parseSelection(request: NextRequest): MadToolboxSelection | null {
  const searchParams = request.nextUrl.searchParams;
  const hasSelection = ["platform", "arch", "edition"].some((key) => searchParams.has(key));
  if (!hasSelection) return null;

  const platformValue = searchParams.get("platform")?.trim().toLowerCase();
  const archValue = searchParams.get("arch")?.trim().toLowerCase();
  const editionValue = searchParams.get("edition")?.trim().toLowerCase();
  if (!platformValue || !archValue || !editionValue) {
    throw new Error("platform、arch、edition 必须同时提供");
  }

  const platform = PLATFORM_ALIASES[platformValue];
  const arch = ARCH_ALIASES[archValue];
  const edition = EDITION_ALIASES[editionValue];
  if (!platform || !arch || !edition) {
    throw new Error("platform、arch 或 edition 不受支持");
  }

  return { platform, arch, edition };
}

export async function GET(request: NextRequest) {
  let selection: MadToolboxSelection | null;
  try {
    selection = parseSelection(request);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "更新参数无效" },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  try {
    const release = await fetchLatestMadToolboxRelease();
    return NextResponse.json(buildMadToolboxUpdate(release, request.nextUrl.origin, selection), {
      headers: RESPONSE_HEADERS
    });
  } catch (error) {
    console.error("Failed to fetch MAD Toolbox update metadata", error);
    return NextResponse.json(
      { message: "无法读取 MAD Toolbox 最新版本，请稍后重试" },
      { status: 502, headers: RESPONSE_HEADERS }
    );
  }
}
