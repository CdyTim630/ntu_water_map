'use client';
/**
 * Next.js App Router 單頁 error boundary。
 *
 * 任何 client component 在 render / event handler 拋錯都會 fallback 到這裡，
 * 不會讓整個 React app 「炸掉只剩 HTML」。
 */
import { useEffect } from 'react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    // 把錯誤推到 console 方便 debug；prod 可改接 Sentry / Logflare
    console.error('[ntu-water-map] page error:', error);
  }, [error]);

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center shadow-sm">
        <div className="mb-3 text-4xl">💧💥</div>
        <h2 className="text-lg font-semibold text-slate-900">這頁出了點狀況</h2>
        <p className="mt-1 text-xs text-slate-600">
          頁面元件爆出例外，我們把它接住了。試試重整或回主頁。
        </p>
        {error.message && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-white p-2 text-left text-[10px] text-slate-500 ring-1 ring-rose-100">
            {error.message}
            {error.digest && `\nID: ${error.digest}`}
          </pre>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
          >
            重試本頁
          </button>
          <Link
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            回主頁
          </Link>
        </div>
      </div>
    </div>
  );
}
