import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SubmitForm } from "@/components/SubmitForm";
import { getSettings } from "@/lib/projects";

export const metadata: Metadata = {
  title: "提交开源项目",
  description: "向 MAD Store 提交面向 MAD / AMV 创作者的公开 GitHub 开源项目，进入管理员人工审核队列。",
  alternates: { canonical: "/submit" },
};

export default async function SubmitPage() {
  const settings = await getSettings();
  return (
    <>
      <Header />
      <main className="submit-page">
        <section className="shell page-heading">
          <span className="eyebrow">SUBMIT</span>
          <h1>提交项目</h1>
          <p>提交公开 GitHub 仓库。管理员会人工审核、修改信息并决定是否收录。</p>
        </section>
        <section className="shell simple-submit">
          <SubmitForm settings={settings} />
        </section>
      </main>
      <Footer />
    </>
  );
}
