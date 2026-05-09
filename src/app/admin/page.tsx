'use client';
import { useCallback, useEffect, useState } from 'react';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { AdminReportTable } from '@/components/admin/AdminReportTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { downloadCSV } from '@/lib/utils';
import type { Report } from '@/lib/types';

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 從 sessionStorage 還原密碼
  useEffect(() => {
    const stored = sessionStorage.getItem('ntu-water-admin-pw');
    if (stored) setPassword(stored);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', { cache: 'no-store' });
      if (!res.ok) throw new Error('讀取失敗');
      const data = (await res.json()) as { reports: Report[] };
      setReports(data.reports);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法讀取');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (password) load();
  }, [password, load]);

  if (!password) {
    return <AdminLogin onAuthed={setPassword} />;
  }

  function handleExportCSV() {
    if (!reports.length) return;
    const rows = reports.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      category: r.category,
      severity: r.severity,
      status: r.status,
      location_name: r.location_name ?? '',
      latitude: r.latitude,
      longitude: r.longitude,
      reporter_name: r.reporter_name ?? '',
      upvote_count: r.upvote_count,
      resolved_count: r.resolved_count,
      admin_note: r.admin_note ?? '',
      image_url: r.image_url ?? '',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(`ntu-water-reports-${ts}.csv`, rows);
  }

  function handleLogout() {
    sessionStorage.removeItem('ntu-water-admin-pw');
    setPassword(null);
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">管理後台</h1>
          <p className="text-xs text-slate-500">
            檢視、編輯、刪除回報，並可匯出 CSV。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            ↻ 重新整理
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={!reports.length}
          >
            ⬇ 匯出 CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            登出
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-3 border-red-100 bg-red-50 text-sm text-red-700">
          {error}
        </Card>
      )}

      {loading && !reports.length ? (
        <Card className="py-16 text-center text-sm text-slate-400">
          載入中…
        </Card>
      ) : (
        <AdminReportTable
          reports={reports}
          password={password}
          onChanged={load}
        />
      )}
    </div>
  );
}
