'use client';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import type { RiskRankingEntry } from '@/lib/types';

interface Props {
  ranking: RiskRankingEntry[];
  title?: string;
  description?: string;
  onSelect?: (entry: RiskRankingEntry) => void;
  compact?: boolean;
}

const levelTone: Record<RiskRankingEntry['risk_level'], 'red' | 'orange' | 'blue'> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const levelLabel: Record<RiskRankingEntry['risk_level'], string> = {
  high: '高風險',
  medium: '中風險',
  low: '低風險',
};

export function RiskRanking({
  ranking,
  title = '高風險地點排行',
  description = 'risk_score = 數量 × 2 + 高嚴重 × 3 + 近 7 日 × 2',
  onSelect,
  compact,
}: Props) {
  if (!ranking.length) {
    return (
      <Card>
        <CardHeader title={title} description={description} />
        <p className="py-6 text-center text-sm text-slate-400">尚無資料</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <ol className="space-y-2">
        {ranking.map((entry, idx) => (
          <li key={entry.location_name + idx}>
            <button
              onClick={() => onSelect?.(entry)}
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
            >
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                  idx === 0
                    ? 'bg-red-100 text-red-700'
                    : idx === 1
                      ? 'bg-amber-100 text-amber-700'
                      : idx === 2
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {entry.location_name}
                  </p>
                  <Badge tone={levelTone[entry.risk_level]}>
                    {levelLabel[entry.risk_level]}
                  </Badge>
                </div>
                {!compact && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    共 {entry.report_count} 筆 · 高嚴重 {entry.high_severity_count}
                    {' '}· 近 7 日 {entry.recent_7_days_count}
                  </p>
                )}
              </div>
              <div className="flex-none text-right">
                <p className="text-lg font-semibold text-slate-900 leading-none">
                  {entry.risk_score}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  score
                </p>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
