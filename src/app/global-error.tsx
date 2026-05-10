'use client';
/**
 * Next.js App Router 全局 error boundary — 連 root layout 出錯都 catch。
 *
 * 此 fallback 必須自己 render 完整 <html>/<body>（取代壞掉的 layout）。
 */
import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[ntu-water-map] global error:', error);
  }, [error]);

  return (
    <html lang="zh-Hant">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: '64px 16px',
          background: '#f8fafc',
          color: '#0f172a',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: 24,
            background: 'white',
            borderRadius: 16,
            border: '1px solid #fecdd3',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌊💥</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>系統暫時無法載入</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            應用程式架構出錯了，已自動截獲。請重試或回首頁。
          </p>
          {error.message && (
            <pre
              style={{
                marginTop: 12,
                padding: 8,
                background: '#fff1f2',
                borderRadius: 8,
                fontSize: 10,
                color: '#9f1239',
                overflowX: 'auto',
                textAlign: 'left',
              }}
            >
              {error.message}
              {error.digest && `\nID: ${error.digest}`}
            </pre>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '8px 16px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              重試
            </button>
            <a
              href="/"
              style={{
                padding: '8px 16px',
                background: 'white',
                color: '#334155',
                textDecoration: 'none',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              回主頁
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
