'use client';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { CATEGORY_LABEL, type DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['byCategory'];
}

const CATEGORY_COLOR: Record<string, string> = {
  flooding: '#1668cc',
  standing_water: '#4d9cf5',
  facility_leak: '#f59e0b',
  poor_drainage: '#a855f7',
  other: '#94a3b8',
};

export function CategoryChart({ data }: Props) {
  // 排序：count 大→小，視覺更舒適
  const chartData = [...data]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({
      name: CATEGORY_LABEL[d.category],
      count: d.count,
      key: d.category,
    }));

  return (
    <Card>
      <CardHeader title="問題類別" description="校園回報依問題型態統計" />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: -12, bottom: 0 }}
          >
            <XAxis
              type="number"
              hide
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                padding: '6px 10px',
              }}
              cursor={{ fill: 'rgba(38,128,227,0.06)' }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={CATEGORY_COLOR[entry.key] ?? '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
