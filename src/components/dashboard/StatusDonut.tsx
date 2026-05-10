'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import { STATUS_LABEL, type DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['byStatus'];
  total: number;
  resolveRate: number;
  avgResolveDays: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#f59e0b',
  reviewing: '#94a3b8',
  resolved: '#10b981',
  rejected: '#cbd5e1',
};

export function StatusDonut({
  data,
  total,
  resolveRate,
  avgResolveDays,
}: Props) {
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABEL[d.status],
      value: d.count,
      key: d.status,
    }));

  return (
    <Card className="space-y-2">
      <CardHeader title="處理狀態" description="校方回應進度" />
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div className="relative h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="white"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={STATUS_COLOR[entry.key] ?? '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  padding: '6px 10px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold tabular text-slate-900">
              {Math.round(resolveRate * 100)}%
            </div>
            <SectionLabel className="mt-0.5">解決率</SectionLabel>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-[11.5px]">
          {data.map((d) => {
            const pct = total > 0 ? (d.count / total) * 100 : 0;
            return (
              <li key={d.status} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-none rounded-sm"
                  style={{ background: STATUS_COLOR[d.status] }}
                />
                <span className="text-slate-700">
                  {STATUS_LABEL[d.status]}
                </span>
                <span className="ml-auto tabular text-slate-500">
                  {d.count}
                </span>
                <span className="w-9 text-right tabular text-slate-400">
                  {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {avgResolveDays !== null && (
        <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          已解決平均處理時間：
          <span className="font-semibold text-slate-700 tabular">
            {avgResolveDays.toFixed(1)} 天
          </span>
        </p>
      )}
    </Card>
  );
}
