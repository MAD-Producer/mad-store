import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="MAD Store 首页">
          <Image src="/mad-producer-logo.webp" alt="" width={32} height={32} priority />
          <span>
            <strong>MAD Store</strong>
          </span>
        </Link>
        <nav className="main-nav" aria-label="主导航">
          <Link href="/">介绍</Link>
          <Link href="/projects">项目</Link>
          <Link href="/submit">提交项目</Link>
        </nav>
      </div>
    </header>
  );
}
