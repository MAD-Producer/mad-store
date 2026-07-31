import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="intro-page">
        <section className="shell intro-main">
          <div>
            <span className="eyebrow">MAD PRODUCER PROJECT</span>
            <h1><span>MAD Store</span><br />让好工具被创作者发现。</h1>
          </div>
          <div className="intro-copy">
            <p>
              MAD Store 是一个中文开源项目导航，为 MAD / AMV 个体开发者提供展示入口，也帮助创作者找到真正可用的工具与文档。
            </p>
            <div className="intro-actions">
              <Link href="/projects">浏览项目 <ArrowRight size={17} /></Link>
              <Link href="/submit">提交项目</Link>
            </div>
          </div>
        </section>
        <section className="shell intro-notes">
          <div><span>01</span><p>仅收录公开的 GitHub 开源仓库。</p></div>
          <div><span>02</span><p>项目由用户提交，管理员人工审核与分类。</p></div>
          <div><span>03</span><p>DeepSeek 只提供初审建议，不自动发布。</p></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
