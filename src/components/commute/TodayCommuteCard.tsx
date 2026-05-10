'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sun,
  Umbrella,
  CloudRain,
  Ruler,
  Home,
  AlertTriangle,
  ArrowRight,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCommuteRoutes } from '@/lib/commuteStore';
import { CAMPUS_NODES, getNode } from '@/lib/campus';
import { incrementStat } from '@/lib/statsStore';
import type { CommuteRoute } from '@/lib/types';
import {
  RAIN_INTENSITY_LABEL,
  type WeatherSnapshot,
} from '@/lib/weather';

interface RouteOutcome {
  route: CommuteRoute;
  loading: boolean;
  error: string | null;
  /** 距離 / 遮蔽率 */
  totalDistance: number | null;
  coverageScore: number | null;
  detourMeters: number | null;
  /** 是否避開了 active 積水回報 */
  avoidedFloodReports: number | null;
  /** verdict 等級：no_umbrella / take_umbrella / strong_warn */
  verdict: 'no_umbrella' | 'take_umbrella' | 'strong_warn';
  /** 一句建議文 */
  advice: string;
}

type RouteApiPlan = {
  totalDistance: number;
  coverageScore: number;
  passingFloodReports: number;
} | null;

interface RouteApiResp {
  weather: WeatherSnapshot;
  rainFactor: number;
  recommended: RouteApiPlan;
  shortest: RouteApiPlan;
  avoided?: {
    floodReports: number;
    detourMeters: number;
    coverageGain: number;
  };
}

interface Props {
  onAddRoute: () => void;
}

/** 依雨勢與路徑特徵產 verdict + advice 文字 */
function buildVerdict(
  rainFactor: number,
  weather: WeatherSnapshot,
  rec: RouteApiPlan,
  short: RouteApiPlan,
  avoidedFloodReports: number,
  detourMeters: number,
): { verdict: RouteOutcome['verdict']; advice: string } {
  const intensity = weather.rainIntensity;

  if (rainFactor < 0.18) {
    return {
      verdict: 'no_umbrella',
      advice: `今天雨勢不重（${RAIN_INTENSITY_LABEL[intensity]}），不必特別帶傘。`,
    };
  }

  // 強警示條件：避開了 ≥1 個積水 OR 雨勢 moderate+ OR 遮蔽率明顯不足
  const coverage = rec?.coverageScore ?? 0;
  const isHeavy = rainFactor >= 0.6;
  const hasFlood = avoidedFloodReports >= 1;

  if (isHeavy || hasFlood) {
    const parts: string[] = [];
    parts.push(`預估${RAIN_INTENSITY_LABEL[intensity]}`);
    if (avoidedFloodReports > 0)
      parts.push(`避開 ${avoidedFloodReports} 個積水回報`);
    if (detourMeters > 30) parts.push(`多走 ${Math.round(detourMeters)} m 換遮蔽`);
    if (coverage < 0.4) parts.push(`沿途遮蔽率僅 ${Math.round(coverage * 100)}%`);
    return {
      verdict: 'strong_warn',
      advice: `強烈建議帶傘並走推薦路徑。${parts.join('、')}。`,
    };
  }

  return {
    verdict: 'take_umbrella',
    advice: `建議帶傘。沿推薦路徑遮蔽率 ${Math.round(coverage * 100)}%，比最短路徑省約 ${Math.max(0, Math.round(detourMeters))} m 暴露。`,
  };
}

const VERDICT_STYLE: Record<
  RouteOutcome['verdict'],
  { bg: string; border: string; text: string; Icon: LucideIcon; label: string }
> = {
  no_umbrella: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    Icon: Sun,
    label: '不必帶傘',
  },
  take_umbrella: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    text: 'text-brand-800',
    Icon: Umbrella,
    label: '建議帶傘',
  },
  strong_warn: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    Icon: CloudRain,
    label: '強烈建議',
  },
};

export function TodayCommuteCard({ onAddRoute }: Props) {
  const { routes, remove } = useCommuteRoutes();
  const [outcomes, setOutcomes] = useState<RouteOutcome[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // 對每條路線打 /api/route，組 verdict
  const computeAll = useCallback(async () => {
    if (!routes.length) {
      setOutcomes([]);
      return;
    }
    const next: RouteOutcome[] = routes.map((r) => ({
      route: r,
      loading: true,
      error: null,
      totalDistance: null,
      coverageScore: null,
      detourMeters: null,
      avoidedFloodReports: null,
      verdict: 'no_umbrella',
      advice: '計算中…',
    }));
    setOutcomes(next);

    const computed: RouteOutcome[] = await Promise.all(
      routes.map(async (r) => {
        const start = getNode(r.startNodeId);
        const end = getNode(r.endNodeId);
        if (!start || !end) {
          return {
            route: r,
            loading: false,
            error: '路線地標已不存在',
            totalDistance: null,
            coverageScore: null,
            detourMeters: null,
            avoidedFloodReports: null,
            verdict: 'no_umbrella' as const,
            advice: '路線無效',
          };
        }
        try {
          const res = await fetch('/api/route', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              start: { lat: start.lat, lng: start.lng },
              end: { lat: end.lat, lng: end.lng },
              mode: r.mode,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as RouteApiResp;
          const avoided = data.avoided?.floodReports ?? 0;
          const detour = data.avoided?.detourMeters ?? 0;
          const { verdict, advice } = buildVerdict(
            data.rainFactor,
            data.weather,
            data.recommended,
            data.shortest,
            avoided,
            detour,
          );
          return {
            route: r,
            loading: false,
            error: null,
            totalDistance: data.recommended?.totalDistance ?? null,
            coverageScore: data.recommended?.coverageScore ?? null,
            detourMeters: detour,
            avoidedFloodReports: avoided,
            verdict,
            advice,
          };
        } catch (e) {
          return {
            route: r,
            loading: false,
            error: e instanceof Error ? e.message : '計算失敗',
            totalDistance: null,
            coverageScore: null,
            detourMeters: null,
            avoidedFloodReports: null,
            verdict: 'no_umbrella' as const,
            advice: '無法計算',
          };
        }
      }),
    );
    setOutcomes(computed);
  }, [routes]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    computeAll();
  }, [hydrated, computeAll]);

  // SSR 期間不渲染（localStorage 還沒讀），避免 hydration 不一致
  if (!hydrated) {
    return (
      <Card>
        <CardHeader title="今日通勤" />
        <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          載入中…
        </div>
      </Card>
    );
  }

  if (routes.length === 0) {
    return (
      <Card>
        <CardHeader
          title="今日通勤"
          description="加 1–3 條每天必走路線，每次打開 app 自動計算今天該不該帶傘 + 建議走法。"
        />
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-3 text-center">
          <p className="text-xs text-slate-500">
            還沒設定通勤路線。
          </p>
          <Button size="sm" className="mt-2" onClick={onAddRoute}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            新增第一條路線
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="今日通勤"
        description={`${routes.length} 條路線 · 即時計算`}
        action={
          <Button size="sm" variant="ghost" onClick={onAddRoute}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            新增
          </Button>
        }
      />
      <ul className="flex flex-col gap-2">
        {outcomes.map((o) => {
          const style = VERDICT_STYLE[o.verdict];
          const VerdictIcon = style.Icon;
          const start = CAMPUS_NODES.find((n) => n.id === o.route.startNodeId);
          const end = CAMPUS_NODES.find((n) => n.id === o.route.endNodeId);
          return (
            <li
              key={o.route.id}
              className={`rounded-xl border ${style.border} ${style.bg} p-2.5`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {o.route.label}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.text}`}
                  >
                    <VerdictIcon className="h-3 w-3" strokeWidth={2.4} />
                    {style.label}
                  </span>
                  <button
                    onClick={() => remove(o.route.id)}
                    className="text-slate-300 hover:text-rose-500"
                    title="移除"
                  >
                    ×
                  </button>
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {start?.name ?? '?'} → {end?.name ?? '?'} ·{' '}
                {o.route.mode === 'walk' ? '步行' : '腳踏車'}
              </div>
              <p className={`mt-1 text-[11px] ${style.text}`}>
                {o.loading ? '計算中…' : o.error ?? o.advice}
              </p>
              {!o.loading && !o.error && o.totalDistance != null && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5 tabular">
                    <Ruler className="h-3 w-3" strokeWidth={2.2} />
                    {Math.round(o.totalDistance)} m
                  </span>
                  {o.coverageScore != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <Home className="h-3 w-3" strokeWidth={2.2} />
                      遮蔽 {Math.round(o.coverageScore * 100)}%
                    </span>
                  )}
                  {o.avoidedFloodReports! > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-rose-600">
                      <AlertTriangle className="h-3 w-3" strokeWidth={2.2} />
                      避開 {o.avoidedFloodReports} 個積水
                    </span>
                  )}
                  <Link
                    href={`/route?startNode=${encodeURIComponent(o.route.startNodeId)}&endNode=${encodeURIComponent(o.route.endNodeId)}&mode=${o.route.mode}`}
                    onClick={() => incrementStat('commute_run')}
                    className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand-600 hover:text-brand-700"
                  >
                    在地圖開啟
                    <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
