'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { SeverityBar } from '@/components/dashboard/SeverityBar';
import { RiskRanking } from '@/components/dashboard/RiskRanking';
import { WaterStationHealth } from '@/components/dashboard/WaterStationHealth';
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
    <div className="px-4 py-4 sm:px-6 animate-fade-in">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            校園水資源儀表板
          </h1>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            整合校園回報、飲水機健康度與處理進度，輔助校方優化水資源管理
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={2.2}
          />
          {loading ? '更新中' : '重新整理'}
        </Button>
      </div>

      {loading && !stats && (
        <Card className="py-16 text-center text-[13px] text-slate-400">
          載入中…
        </Card>
      )}

      {error && (
        <Card className="border-rose-100 bg-rose-50/60 text-[13px] text-rose-700">
          {error}
        </Card>
      )}

      {stats && (
        <div className="space-y-4">
          {/* ── 1. Hero KPI ── */}
          <StatsCards stats={stats} />

          {/* ── 2. 趨勢 + 嚴重度 ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <TrendChart data={stats.trend14d} />
            <SeverityBar data={stats.bySeverity} />
          </div>

          {/* ── 3. 類別 + 處理狀態 ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryChart data={stats.byCategory} />
            <StatusDonut
              data={stats.byStatus}
              total={stats.totalReports}
              resolveRate={stats.resolveRate}
              avgResolveDays={stats.avgResolveDays}
            />
          </div>

          {/* ── 4. 高風險地點 + 飲水機健康度 ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
            <RiskRanking ranking={stats.ranking} />
            <WaterStationHealth data={stats.waterStations} />
          </div>
        </div>
      )}
    </div>
  );
}
