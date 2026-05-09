'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { RiskRanking } from '@/components/dashboard/RiskRanking';
import type { DashboardStats } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error('讀取失敗');
      setStats((await res.json()) as DashboardStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法讀取');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">儀表板</h1>
          <p className="text-xs text-slate-500">
            快速掌握校園水資源問題的整體狀況。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? '更新中…' : '↻ 重新整理'}
        </Button>
      </div>

      {loading && !stats && (
        <Card className="py-16 text-center text-sm text-slate-400">
          載入中…
        </Card>
      )}

      {error && (
        <Card className="border-red-100 bg-red-50 text-sm text-red-700">
          {error}
        </Card>
      )}

      {stats && (
        <div className="space-y-4">
          <StatsCards stats={stats} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CategoryChart data={stats.byCategory} />
            <TrendChart data={stats.trend7d} />
          </div>
          <RiskRanking ranking={stats.ranking} />
        </div>
      )}
    </div>
  );
}
