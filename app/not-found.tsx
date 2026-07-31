import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>这里没有找到项目</h1>
      <p>它可能还在审核中，或者地址已经发生变化。</p>
      <Link href="/"><ArrowLeft size={17} />回到 MAD Store</Link>
    </main>
  );
}
