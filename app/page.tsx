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
          <div className="intro-lead">
            <span className="eyebrow">MAD PRODUCER PROJECT</span>
            <h1>为创作，找到合适的工具。</h1>
            <p>
              MAD Store 收集服务于 MAD / AMV 创作的开源项目。你可以在这里找到工具、脚本与文档，也可以把正在维护的项目分享给更多创作者。
            </p>
            <div className="intro-actions">
              <Link href="/projects">浏览项目 <ArrowRight size={17} /></Link>
              <Link href="/submit">提交项目</Link>
            </div>
          </div>
        </section>
        <section className="shell intro-guide" aria-label="站点功能">
          <div><strong>发现</strong><p>按用途浏览适合创作流程的开源项目。</p></div>
          <div><strong>了解</strong><p>直接查看仓库信息与完整 README。</p></div>
          <div><strong>分享</strong><p>提交你开发或正在维护的项目。</p></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
