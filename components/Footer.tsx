import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-brand">
          <span>MAD PRODUCER PROJECT</span>
          <strong>MAD STORE</strong>
          <p>MAD Producer 麦德工坊旗下项目 · 由 MAD Producer Studio 开发与维护</p>
        </div>
        <nav className="footer-links" aria-label="MAD Producer 官方链接">
          <a href="https://madproducer.com" target="_blank" rel="noreferrer">国际站</a>
          <a href="https://madproducer.cn" target="_blank" rel="noreferrer">中国站</a>
          <a href="https://space.bilibili.com/3546821106338121" target="_blank" rel="noreferrer">Bilibili</a>
          <a href="https://www.youtube.com/@InfiniteTeamOfficial" target="_blank" rel="noreferrer">YouTube</a>
          <a href="https://qm.qq.com/q/LDaTG07qaC" target="_blank" rel="noreferrer">QQ</a>
          <a href="https://discord.gg/vmtJcs5nxk" target="_blank" rel="noreferrer">Discord</a>
          <a href="https://x.com/Infinite_Team_X" target="_blank" rel="noreferrer">X</a>
          <a href="https://github.com/MAD-Producer/mad-store" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} MAD Producer Studio</span>
        <Link href="/projects">MAD / AMV 开源项目索引</Link>
      </div>
    </footer>
  );
}
