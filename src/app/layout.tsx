import './globals.css';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';

export const metadata: Metadata = {
  title: '台大水資源地圖｜NTU Water Risk Map',
  description:
    '台大師生即時回報淹水、積水、設施漏水的互動式校園地圖。雨天路徑規劃、水災預警、飲水機地圖、個人成績單一站完成。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-[1400px]">{children}</main>
      </body>
    </html>
  );
}
