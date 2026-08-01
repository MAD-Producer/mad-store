import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SubmitForm } from "@/components/SubmitForm";
import { getSettings } from "@/lib/projects";

export const metadata: Metadata = {
  title: "投稿",
  description: "向 MAD Store 提交开源项目或值得推荐的网站。",
  alternates: { canonical: "/submit" },
};

// 表单选项由管理员维护，需要在请求时读取数据库，避免在部署构建阶段连接 Atlas。
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const settings = await getSettings();
  return (
    <>
      <Header />
      <main className="submit-page">
        <section className="shell page-heading">
          <span className="eyebrow">SUBMIT</span>
          <h1>投稿</h1>
          <p>把值得被更多人看见的开源项目或网站告诉我们。</p>
        </section>
        <section className="shell simple-submit">
          <SubmitForm settings={settings} />
        </section>
      </main>
      <Footer />
    </>
  );
}
