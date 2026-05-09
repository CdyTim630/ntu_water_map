'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Props {
  onAuthed: (password: string) => void;
}

/**
 * 簡易 Password 登入。把使用者輸入的密碼存到 sessionStorage，
 * 之後 admin API 用 x-admin-password header 驗證。
 */
export function AdminLogin({ onAuthed }: Props) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // 用一次 PATCH 不存在 id 來驗證；server 會回 401 / 404 區分
      const res = await fetch('/api/reports/__probe__', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        setError('密碼錯誤');
        return;
      }
      // 任何非 401 都視為密碼正確（包含 404 not found）
      sessionStorage.setItem('ntu-water-admin-pw', pw);
      onAuthed(pw);
    } catch {
      setError('連線錯誤');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900">管理員登入</h2>
        <p className="mt-1 text-xs text-slate-500">
          請輸入管理密碼，密碼存放於環境變數 <code>ADMIN_PASSWORD</code>。
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="管理密碼"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            autoFocus
          />
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? '驗證中…' : '登入'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
