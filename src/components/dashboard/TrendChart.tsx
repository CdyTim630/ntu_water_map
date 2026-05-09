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
import { Card, CardHeader } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['trend7d'];
}

export function TrendChart({ data }: Props) {
  return (
    <Card>
      <CardHeader title="近 7 天每日新增" description="回報數隨時間的變化" />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b87f1" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#3b87f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#2569e6"
              strokeWidth={2}
              fill="url(#trendArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
