'use client';
import { Card } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  stats: Pick<
    DashboardStats,
    'totalReports' | 'activeReports' | 'resolvedReports' | 'highSeverityReports'
  >;
}

const items: {
  key: keyof Props['stats'];
  label: string;
  tone: string;
  hint: string;
}[] = [
  { key: 'totalReports', label: '總回報數', tone: 'text-slate-900', hint: '所有回報累積' },
  { key: 'activeReports', label: '處理中 / 審查中', tone: 'text-amber-600', hint: '尚未結案的問題' },
  { key: 'resolvedReports', label: '已改善', tone: 'text-emerald-600', hint: '已標記為解決' },
  { key: 'highSeverityReports', label: '高嚴重度', tone: 'text-red-600', hint: 'severity = high' },
];

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.key} className="p-4">
          <p className="text-xs text-slate-500">{it.label}</p>
          <p className={`mt-1 text-3xl font-semibold ${it.tone}`}>
            {stats[it.key]}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{it.hint}</p>
        </Card>
      ))}
    </div>
  );
}
