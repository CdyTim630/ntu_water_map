'use client';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import type { DashboardStats } from '@/lib/types';

interface Props {
  data: DashboardStats['puddleRegression'];
}

export function PuddleRegressionCard({ data }: Props) {
  const slopeLabel = data.slope.toFixed(2);
  const r2Label = data.rSquared.toFixed(2);
  const expectedLabel = data.expectedAt10mm.toFixed(1);

  return (
    <Card>
      <CardHeader
        title="水漥回歸分析"
        description="Demo 樣本：14 天雨量 × 積水類回報，建立線性預測線"
        action={
          <div className="grid grid-cols-2 gap-3 text-right">
            <div>
              <SectionLabel>R²</SectionLabel>
              <div className="text-lg font-bold tabular text-slate-900">
                {r2Label}
              </div>
            </div>
            <div>
              <SectionLabel>10mm 預估</SectionLabel>
              <div className="text-lg font-bold tabular text-slate-900">
                {expectedLabel}
                <span className="ml-1 text-[10px] font-normal text-slate-400">
                  筆
                </span>
              </div>
            </div>
          </div>
        }
      />

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data.series}
            margin={{ top: 8, right: 10, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="rainfallMm"
              type="number"
              name="雨量"
              unit="mm"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'rainfallMm') return [`${value} mm`, '雨量'];
                if (name === 'predicted') {
                  return [
                    `${Number(value).toFixed(1)} 筆`,
                    '模型預測',
                  ];
                }
                return [`${value} 筆`, '實際回報'];
              }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date
                  ? `${payload[0].payload.date}`
                  : ''
              }
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#475569', fontWeight: 600 }}
            />
            <Scatter
              name="實際回報"
              dataKey="puddleReports"
              fill="#f97316"
              stroke="#ea580c"
            />
            <Line
              name="模型預測"
              dataKey="predicted"
              type="monotone"
              stroke="#1668cc"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
        y = {slopeLabel} × rain(mm) + {data.intercept.toFixed(2)}；樣本{' '}
        {data.sampleSize} 天。此卡使用 demo 雨量序列，用來呈現分析流程與決策口徑。
      </p>
    </Card>
  );
}
