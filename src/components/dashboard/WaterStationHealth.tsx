'use client';
import { Wrench, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['waterStations'];
}

const SOURCE_LABEL: Record<string, string> = {
  osm: 'OSM 社群',
  official: '北水處官方',
  merged: '雙源',
};

const SOURCE_COLOR: Record<string, string> = {
  osm: '#94a3b8',
  official: '#f59e0b',
  merged: '#10b981',
};

export function WaterStationHealth({ data }: Props) {
  const healthy = data.total > 0 ? data.normal / data.total : 1;
  const totalSrc = data.bySource.reduce((s, x) => s + x.count, 0);

  return (
    <Card className="space-y-3">
      <CardHeader
        title="飲水機健康度"
        description={`校內 ${data.total} 台 · 累積減塑 ${data.totalBottlesSaved} 瓶`}
      />

      {/* 運作率水平條 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
          <SectionLabel>運作率</SectionLabel>
          <span className="font-semibold tabular text-slate-900">
            {Math.round(healthy * 100)}%
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-soft-out"
            style={{ width: `${healthy * 100}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <Mini
            label="正常"
            value={data.normal}
            tone="text-emerald-700"
            Icon={CheckCircle2}
          />
          <Mini
            label="故障"
            value={data.broken}
            tone="text-rose-700"
            Icon={Wrench}
          />
          <Mini
            label="濾心過期"
            value={data.filterDue}
            tone="text-amber-700"
            Icon={AlertTriangle}
          />
        </div>
      </div>

      {/* 故障清單 */}
      {data.brokenList.length > 0 ? (
        <div>
          <SectionLabel className="mb-1.5">需校方處理</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {data.brokenList.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50/40 p-2 text-[11.5px]"
              >
                <Wrench
                  className="mt-0.5 h-3.5 w-3.5 flex-none text-rose-500"
                  strokeWidth={2.2}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">
                    {item.name}
                  </div>
                  {item.location_hint && (
                    <div className="inline-flex items-center gap-0.5 truncate text-[10px] text-slate-500">
                      <MapPin className="h-2.5 w-2.5" strokeWidth={2.2} />
                      {item.location_hint}
                    </div>
                  )}
                </div>
                {item.daysSinceReport !== null && (
                  <span className="flex-none whitespace-nowrap text-[10px] text-slate-400 tabular">
                    {item.daysSinceReport < 1
                      ? '今日'
                      : `${Math.round(item.daysSinceReport)} 天前回報`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-50 p-2.5 text-center text-[12px] text-emerald-700 ring-1 ring-emerald-100">
          全部飲水機運作中
        </div>
      )}

      {/* 來源組成 */}
      {totalSrc > 0 && (
        <div>
          <SectionLabel className="mb-1.5">資料來源</SectionLabel>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {data.bySource.map((s) => {
              const pct = totalSrc > 0 ? (s.count / totalSrc) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={s.source}
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    background: SOURCE_COLOR[s.source],
                  }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
            {data.bySource.map((s) => (
              <span key={s.source} className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: SOURCE_COLOR[s.source] }}
                />
                {SOURCE_LABEL[s.source]}{' '}
                <span className="tabular text-slate-400">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Mini({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: string;
  Icon: typeof Wrench;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className={`flex items-center gap-1 ${tone}`}>
        <Icon className="h-3 w-3" strokeWidth={2.2} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-0.5 text-base font-semibold tabular text-slate-900">
        {value}
      </div>
    </div>
  );
}
