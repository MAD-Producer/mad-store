import Link from "next/link";
import Image from "next/image";
import { Globe2 } from "lucide-react";
import { SiBilibili, SiDiscord, SiGithub, SiQq, SiX, SiYoutube } from "react-icons/si";

const socialLinks = [
  { href: "https://madproducer.com", label: "国际站", icon: Globe2 },
  { href: "https://madproducer.cn", label: "中国站", icon: Globe2 },
  { href: "https://space.bilibili.com/3546821106338121", label: "Bilibili", icon: SiBilibili },
  { href: "https://www.youtube.com/@InfiniteTeamOfficial", label: "YouTube", icon: SiYoutube },
  { href: "https://qm.qq.com/q/LDaTG07qaC", label: "QQ", icon: SiQq },
  { href: "https://discord.gg/vmtJcs5nxk", label: "Discord", icon: SiDiscord },
  { href: "https://x.com/Infinite_Team_X", label: "X", icon: SiX },
  { href: "https://github.com/MAD-Producer/mad-store", label: "GitHub", icon: SiGithub },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-brand">
          <span>MAD PRODUCER PROJECT</span>
          <div className="footer-title">
            <Image src="/mad-store-icon.webp" alt="" width={42} height={42} />
            <strong>MAD STORE</strong>
          </div>
          <p>MAD Producer 麦德工坊旗下项目 · 由 MAD Producer Studio 开发与维护</p>
        </div>
        <nav className="footer-links" aria-label="MAD Producer 官方链接">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <a href={href} target="_blank" rel="noreferrer" key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} MAD Producer Studio</span>
        <Link href="/projects">MAD / AMV 开源项目索引</Link>
      </div>
    </footer>
  );
}
