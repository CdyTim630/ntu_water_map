'use client';
import {
  Inbox,
  AlertTriangle,
  Droplet,
  Recycle,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { Card, SectionLabel } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  stats: DashboardStats;
}

export function StatsCards({ stats }: Props) {
  const wow =
    stats.prevWeekReports > 0
      ? (stats.pastWeekReports - stats.prevWeekReports) / stats.prevWeekReports
      : null;
  const fountainHealthy =
    stats.waterStations.total > 0
      ? stats.waterStations.normal / stats.waterStations.total
      : 1;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        Icon={Inbox}
        accent="brand"
        label="總回報數"
        value={stats.totalReports}
        sub={
          <DeltaIndicator
            delta={wow}
            note={`本週 ${stats.pastWeekReports} 筆`}
          />
        }
      />
      <KpiCard
        Icon={AlertTriangle}
        accent="rose"
        label="處理中"
        value={stats.activeReports}
        sub={
          <span className="text-[11px] text-slate-500">
            高嚴重度{' '}
            <span className="font-semibold text-rose-700 tabular">
              {stats.highSeverityReports}
            </span>{' '}
            筆
          </span>
        }
      />
      <KpiCard
        Icon={Droplet}
        accent="brand"
        label="飲水機運作率"
        value={`${Math.round(fountainHealthy * 100)}%`}
        sub={
          <span className="text-[11px] text-slate-500 tabular">
            {stats.waterStations.normal} / {stats.waterStations.total} 正常
            {stats.waterStations.broken > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="font-semibold text-rose-700">
                  {stats.waterStations.broken}
                </span>{' '}
                故障
              </>
            )}
          </span>
        }
      />
      <KpiCard
        Icon={Recycle}
        accent="emerald"
        label="累積減塑"
        value={stats.waterStations.totalBottlesSaved}
        unit="瓶"
        sub={
          <span className="text-[11px] text-slate-500 tabular">
            ≈ {(stats.waterStations.totalBottlesSaved * 0.014).toFixed(1)} kg
            CO₂
          </span>
        }
      />
    </div>
  );
}

function KpiCard({
  Icon,
  accent,
  label,
  value,
  unit,
  sub,
}: {
  Icon: LucideIcon;
  accent: 'brand' | 'rose' | 'emerald';
  label: string;
  value: number | string;
  unit?: string;
  sub?: React.ReactNode;
}) {
  const accentClass = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  }[accent];
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <span
          className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${accentClass}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tight tabular text-slate-900">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-slate-400">
            {unit}
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] leading-tight">{sub}</div>}
    </Card>
  );
}

function DeltaIndicator({
  delta,
  note,
}: {
  delta: number | null;
  note: string;
}) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="text-[11px] text-slate-500">{note}</span>;
  }
  const pct = Math.round(delta * 100);
  const Icon = delta > 0.02 ? TrendingUp : delta < -0.02 ? TrendingDown : Minus;
  const tone =
    delta > 0.02
      ? 'text-rose-600'
      : delta < -0.02
        ? 'text-emerald-600'
        : 'text-slate-500';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <span className={`inline-flex items-center gap-0.5 ${tone} tabular`}>
        <Icon className="h-3 w-3" strokeWidth={2.4} />
        {Math.abs(pct)}%
      </span>
      <span>· {note}</span>
    </span>
  );
}
