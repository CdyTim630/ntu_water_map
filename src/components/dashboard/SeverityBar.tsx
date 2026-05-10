'use client';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import { SEVERITY_LABEL, type DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['bySeverity'];
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};

/**
 * 嚴重度水平堆疊條 — 一眼看出高/中/低嚴重比例。
 * 比 PieChart 更節省垂直空間。
 */
export function SeverityBar({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card className="space-y-2">
      <CardHeader title="嚴重度分布" />
      {total === 0 ? (
        <p className="py-6 text-center text-[13px] text-slate-400">
          尚無資料
        </p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {data.map((d) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={d.severity}
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: SEVERITY_COLOR[d.severity],
                  }}
                />
              );
            })}
          </div>
          <ul className="grid grid-cols-3 gap-2 pt-1">
            {data.map((d) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              return (
                <li key={d.severity}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: SEVERITY_COLOR[d.severity] }}
                    />
                    <SectionLabel>
                      {SEVERITY_LABEL[d.severity]}
                    </SectionLabel>
                  </div>
                  <div className="mt-0.5 text-lg font-semibold tabular text-slate-900">
                    {d.count}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
