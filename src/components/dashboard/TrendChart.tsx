'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['trend14d'];
}

export function TrendChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const past7 = data.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = data.slice(0, 7).reduce((s, d) => s + d.count, 0);
  return (
    <Card>
      <CardHeader
        title="近 14 天每日新增"
        description="後 7 天 vs 前 7 天 — 看趨勢急升或趨緩"
        action={
          <div className="text-right">
            <SectionLabel>後 7 天</SectionLabel>
            <div className="text-lg font-bold tabular text-slate-900">
              {past7}
              <span className="ml-1 text-[10px] font-normal text-slate-400">
                / 前 {prev7}
              </span>
            </div>
          </div>
        }
      />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2680e3" stopOpacity={0.42} />
                <stop offset="100%" stopColor="#2680e3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#475569', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#1668cc"
              strokeWidth={2}
              fill="url(#trendArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10.5px] text-slate-400">
        14 天累積 {total} 筆 · 平均每天 {(total / 14).toFixed(1)} 筆
      </p>
    </Card>
  );
}
