'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useStreak, nextBadgeProgress } from '@/lib/streakStore';
import {
  RAIN_INTENSITY_LABEL,
  type WeatherSnapshot,
} from '@/lib/weather';
import type { WaterStation } from '@/lib/types';

interface Props {
  /** 主頁已抓的飲水機資料，避免重複 fetch */
  waterStations?: WaterStation[];
}

interface ForecastHorizon {
  horizon: '1h' | '3h' | '6h';
  rainFactor: number;
  estIntensity: WeatherSnapshot['rainIntensity'];
  pop: number;
}

/**
 * 主頁最上方「今日水情報」卡 — 是 Daily Trigger 的具現化。
 * 4 個資訊：streak 火焰、雨勢/帶傘、飲水機異常、最近熱點。
 *
 * 自動 check-in：把 useStreak 掛在這個 component 裡（主頁第一個 render 的元件）。
 */
export function TodayBriefingCard({ waterStations = [] }: Props) {
  const { state: streak, newlyUnlocked, hydrated } = useStreak();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [horizons, setHorizons] = useState<ForecastHorizon[]>([]);

  // 拉今日預測（一次取所有 horizon，比直接打 weather 更有意義）
  useEffect(() => {
    fetch('/api/forecast', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setWeather(d.weather);
        setHorizons(d.horizons ?? []);
      })
      .catch(() => undefined);
  }, []);

  // 飲水機異常（broken / filter_due）
  const brokenStations = useMemo(
    () =>
      waterStations.filter(
        (s) => s.status === 'broken' || s.status === 'filter_due',
      ),
    [waterStations],
  );

  // 該不該帶傘的 verdict
  const verdict = useMemo(() => {
    const peak = horizons.reduce(
      (mx, h) => Math.max(mx, h.rainFactor),
      0,
    );
    if (peak >= 0.55) {
      return {
        label: '🚨 強烈建議帶傘',
        sub: `今天會下中雨以上`,
        tone: 'rose' as const,
      };
    }
    if (peak >= 0.25) {
      return {
        label: '☂ 建議帶傘',
        sub: `部分時段有雨機率`,
        tone: 'sky' as const,
      };
    }
    return {
      label: '☀️ 不必帶傘',
      sub: `今天雨勢輕微`,
      tone: 'emerald' as const,
    };
  }, [horizons]);

  const next = nextBadgeProgress(streak);

  // SSR / hydration 期間先 render skeleton 避免閃爍
  if (!hydrated) {
    return (
      <Card className="bg-gradient-to-br from-sky-50 to-emerald-50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
          載入今日水情報…
        </div>
      </Card>
    );
  }

  const isFirstDay = streak.currentStreak === 1 && streak.totalDistinctDays === 1;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-sky-50 via-white to-emerald-50 ring-1 ring-sky-100">
      {/* 標題列 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">今日水情報</h2>
          <p className="text-[11px] text-slate-500">
            {new Date().toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>
        <Link
          href="/me"
          className="group flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-orange-200 transition-all hover:ring-orange-300"
          title="個人成績單"
        >
          <span className="text-base" role="img">
            🔥
          </span>
          <span className="text-sm font-bold text-orange-600 tabular-nums">
            {streak.currentStreak}
          </span>
          <span className="text-[10px] text-slate-500">
            {isFirstDay ? '第一天' : '連續'}
          </span>
        </Link>
      </div>

      {/* 4 格摘要 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* ─ 帶不帶傘 verdict ─ */}
        <div
          className={`rounded-xl p-2.5 ring-1 ${
            verdict.tone === 'rose'
              ? 'bg-rose-50 ring-rose-200'
              : verdict.tone === 'sky'
                ? 'bg-sky-50 ring-sky-200'
                : 'bg-emerald-50 ring-emerald-200'
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            出門帶傘？
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {verdict.label}
          </div>
          <div className="text-[10px] text-slate-500">
            {weather
              ? `現${RAIN_INTENSITY_LABEL[weather.rainIntensity]} · ${verdict.sub}`
              : verdict.sub}
          </div>
        </div>

        {/* ─ 飲水機異常 ─ */}
        <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            飲水機異常
          </div>
          {brokenStations.length === 0 ? (
            <>
              <div className="mt-0.5 text-sm font-semibold text-emerald-700">
                ✅ 全部正常
              </div>
              <div className="text-[10px] text-slate-500">
                校內 {waterStations.length} 台都運作中
              </div>
            </>
          ) : (
            <>
              <div className="mt-0.5 text-sm font-semibold text-rose-700">
                ⚠ {brokenStations.length} 台需注意
              </div>
              <div className="truncate text-[10px] text-slate-500">
                {brokenStations[0].name}
                {brokenStations.length > 1 && ` 等 ${brokenStations.length} 台`}
              </div>
            </>
          )}
        </div>

        {/* ─ Streak 進度 ─ */}
        <div className="rounded-xl bg-white p-2.5 ring-1 ring-orange-200">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            連續登入
          </div>
          <div className="mt-0.5 text-sm font-semibold text-orange-700">
            🔥 {streak.currentStreak} 天
          </div>
          <div className="text-[10px] text-slate-500">
            {next.next
              ? `距下個徽章剩 ${next.remaining} 天`
              : `已蒐集全部徽章 🏆`}
          </div>
        </div>
      </div>

      {/* 解鎖徽章 toast */}
      {newlyUnlocked.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs ring-1 ring-amber-200">
          <span className="font-semibold text-amber-900">
            🎉 解鎖新徽章
          </span>
          <span className="ml-1.5 text-amber-700">
            連續登入 {streak.currentStreak} 天 — 到{' '}
            <Link href="/me" className="underline">
              個人成績單
            </Link>{' '}
            看看
          </span>
        </div>
      )}

      {/* 連續首日 onboarding */}
      {isFirstDay && (
        <div className="mt-3 rounded-lg bg-sky-50 p-2 text-xs text-sky-800 ring-1 ring-sky-200">
          👋 歡迎！每天打開連續打卡，解鎖徽章 → 看{' '}
          <Link href="/me" className="font-medium underline">
            個人成績單
          </Link>
        </div>
      )}
    </Card>
  );
}

// 提供徽章顯示用的 helper（給 toast / /me 用，避免重複定義）
export { Badge };
