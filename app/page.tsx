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
            <span className="eyebrow"><i /> MAD PRODUCER PROJECT</span>
            <h1>为创作，找到合适的工具。</h1>
            <p>
              MAD Store 收集服务于 MAD / AMV 创作的开源项目与网站。你可以在这里找到工具、脚本、文档与站点，也可以把值得被看见的内容分享给更多创作者。
            </p>
            <div className="intro-actions">
              <Link href="/projects">浏览项目 <ArrowRight size={17} /></Link>
              <Link href="/websites">浏览网站</Link>
              <Link href="/submit">我要投稿</Link>
            </div>
          </div>
          <div className="intro-motif" aria-hidden="true">
            <span className="motif-label">CREATIVE TOOLCHAIN</span>
            <div className="motif-track"><i /><b>EDIT</b></div>
            <div className="motif-track"><i /><b>ENCODE</b></div>
            <div className="motif-track"><i /><b>SHARE</b></div>
            <span className="motif-playhead" />
          </div>
        </section>
        <section className="shell intro-guide" aria-label="站点功能">
          <div><span>01</span><strong>发现</strong><p>浏览适合创作流程的开源项目与网站。</p></div>
          <div><span>02</span><strong>了解</strong><p>直接查看仓库信息与完整 README。</p></div>
          <div><span>03</span><strong>分享</strong><p>提交你正在维护的项目或推荐的网站。</p></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
