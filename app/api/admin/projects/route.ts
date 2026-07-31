import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getAllProjects } from "@/lib/projects";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ message: "未登录" }, { status: 401 });
  return NextResponse.json({ projects: await getAllProjects() });
}
