import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminLogin } from "@/components/AdminLogin";
import { isAdmin } from "@/lib/auth";
import { getAllProjects, getSettings } from "@/lib/projects";
import { getAllWebsites } from "@/lib/websites";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "管理员工作台", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const authenticated = await isAdmin();
  if (!authenticated) {
    return <main className="admin-page"><AdminLogin /></main>;
  }
  const [projects, websites, settings] = await Promise.all([
    getAllProjects(),
    getAllWebsites(),
    getSettings(),
  ]);
  return (
    <main className="admin-page">
      <AdminDashboard
        initialProjects={projects}
        initialWebsites={websites}
        initialSettings={settings}
      />
    </main>
  );
}
