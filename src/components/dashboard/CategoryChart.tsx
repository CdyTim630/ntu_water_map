'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function CategoryChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: CATEGORY_LABEL[d.category],
    count: d.count,
  }));

  return (
    <Card>
      <CardHeader title="各類別回報數量" description="按問題類別統計" />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(59,130,246,0.06)' }}
            />
            <Bar dataKey="count" fill="#2569e6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
