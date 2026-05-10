'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, SectionLabel } from '@/components/ui/Card';
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
 * 主頁最上方「今日水情報」— Daily Trigger 引擎的具現化。
 * 設計重點：左側 verdict hero + 右側 streak hero 雙焦點，下方三條輔助資訊。
 */
export function TodayBriefingCard({ waterStations = [] }: Props) {
  const { state: streak, newlyUnlocked, hydrated } = useStreak();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [horizons, setHorizons] = useState<ForecastHorizon[]>([]);
  const [dateLabel, setDateLabel] = useState<string>('');

  // 客端才產日期字串，避免 hydration mismatch
  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString('zh-TW', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
    );
  }, []);

  useEffect(() => {
    fetch('/api/forecast', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setWeather(d.weather);
        setHorizons(d.horizons ?? []);
      })
      .catch(() => undefined);
  }, []);

  const brokenStations = useMemo(
    () =>
      waterStations.filter(
        (s) => s.status === 'broken' || s.status === 'filter_due',
      ),
    [waterStations],
  );

  const verdict = useMemo(() => {
    const peak = horizons.reduce((mx, h) => Math.max(mx, h.rainFactor), 0);
    if (peak >= 0.55) {
      return {
        emoji: '☔',
        label: '強烈建議帶傘',
        sub: '今天會下中雨以上',
        tone: 'rose' as const,
      };
    }
    if (peak >= 0.25) {
      return {
        emoji: '☂',
        label: '建議帶傘',
        sub: '部分時段有雨機率',
        tone: 'sky' as const,
      };
    }
    return {
      emoji: '☀',
      label: '不必帶傘',
      sub: '今天雨勢輕微',
      tone: 'emerald' as const,
    };
  }, [horizons]);

  const next = nextBadgeProgress(streak);

  if (!hydrated) {
    return (
      <Card className="bg-white">
        <div className="flex items-center gap-2.5 text-[13px] text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
          載入今日水情報…
        </div>
      </Card>
    );
  }

  const isFirstDay =
    streak.currentStreak === 1 && streak.totalDistinctDays === 1;

  // 主色 token by verdict
  const verdictAccent = {
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      ring: 'ring-rose-100',
    },
    sky: {
      bg: 'bg-brand-50',
      text: 'text-brand-700',
      ring: 'ring-brand-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      ring: 'ring-emerald-100',
    },
  }[verdict.tone];

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-brand-50/40 p-0 ring-1 ring-slate-200/60">
      {/* Hero 區：左 verdict / 右 streak — 兩個視覺焦點並列 */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-stretch">
        {/* 左：今天該不該帶傘 */}
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div
            className={`grid h-14 w-14 flex-none place-items-center rounded-2xl text-3xl ring-1 ${verdictAccent.bg} ${verdictAccent.ring}`}
          >
            {verdict.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <SectionLabel className="text-slate-500">
              {dateLabel ? `${dateLabel} · 出門帶傘？` : '今日水情報'}
            </SectionLabel>
            <h2
              className={`mt-0.5 text-xl font-bold tracking-tight ${verdictAccent.text}`}
            >
              {verdict.label}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {weather
                ? `現${RAIN_INTENSITY_LABEL[weather.rainIntensity]} · ${verdict.sub}`
                : verdict.sub}
            </p>
          </div>
        </div>

        {/* 右：streak hero — 在 sm+ 才顯示在右 */}
        <Link
          href="/me"
          className="group flex items-center justify-between gap-3 border-t border-slate-200/60 bg-gradient-to-br from-orange-50/70 to-amber-50/70 p-4 transition-colors hover:from-orange-100/70 hover:to-amber-100/70 sm:min-w-[180px] sm:flex-col sm:items-center sm:justify-center sm:border-l sm:border-t-0 sm:p-5"
        >
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl">🔥</span>
              <span className="text-3xl font-bold text-orange-600 tabular">
                {streak.currentStreak}
              </span>
            </div>
            <SectionLabel className="mt-0.5 text-orange-700/80">
              {isFirstDay ? '第一天打卡' : '連續打卡'}
            </SectionLabel>
          </div>
          <div className="text-right text-[11px] text-slate-500 group-hover:text-slate-700 sm:text-center">
            {next.next ? (
              <>
                距下徽章 <b>{next.remaining}</b> 天
              </>
            ) : (
              <>已蒐集全部徽章 🏆</>
            )}
          </div>
        </Link>
      </div>

      {/* 底部 chip 列：飲水機異常 + onboarding（如果是新使用者） */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/60 bg-white px-4 py-2.5 text-[12px]">
        <SectionLabel>校園水況</SectionLabel>
        {brokenStations.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            ✓ 飲水機 {waterStations.length} 台運作中
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
            ⚠ {brokenStations.length} 台需注意
            <span className="text-rose-500/80">
              · {brokenStations[0].name.slice(0, 12)}
              {brokenStations[0].name.length > 12 && '…'}
            </span>
          </span>
        )}

        {newlyUnlocked.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100 animate-fade-in">
            🎉 解鎖新徽章
            <Link href="/me" className="underline">
              查看
            </Link>
          </span>
        )}

        {isFirstDay && (
          <span className="ml-auto text-[11px] text-slate-500">
            👋 歡迎，每天打開累積徽章 →{' '}
            <Link
              href="/me"
              className="font-medium text-brand-700 hover:underline"
            >
              個人成績單
            </Link>
          </span>
        )}
      </div>
    </Card>
  );
}
