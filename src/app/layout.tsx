import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NTU Water Risk Map｜台大水資源問題地圖',
  description:
    '台大師生即時回報淹水、積水、設施漏水、排水不良等水資源問題的互動式校園地圖。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
                💧
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">
                  NTU Water Risk Map
                </p>
                <p className="text-[11px] text-slate-500">
                  台大水資源問題地圖
                </p>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                地圖
              </Link>
              <Link
                href="/route"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                雨天路徑
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                儀表板
              </Link>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                管理
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px]">{children}</main>
      </body>
    </html>
  );
}
