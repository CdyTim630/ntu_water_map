'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Umbrella,
  CloudRain,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Hand,
  type LucideIcon,
} from 'lucide-react';
import { Card, SectionLabel } from '@/components/ui/Card';
import { useStreak, nextBadgeProgress } from '@/lib/streakStore';
import {
  RAIN_INTENSITY_LABEL,
  type WeatherSnapshot,
} from '@/lib/weather';
import type { WaterStation } from '@/lib/types';

interface Props {
  waterStations?: WaterStation[];
}

interface ForecastHorizon {
  horizon: '1h' | '3h' | '6h';
  rainFactor: number;
  estIntensity: WeatherSnapshot['rainIntensity'];
  pop: number;
}

/**
 * 今日水情報 — 主頁 hero。
 * 雙焦點：左 verdict（圖示 + 標語）/ 右 streak（火焰 + 大數字）
 * 底部 chip 列：飲水機運作狀態、徽章解鎖、新人引導。
 */
export function TodayBriefingCard({ waterStations = [] }: Props) {
  const { state: streak, newlyUnlocked, hydrated } = useStreak();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [horizons, setHorizons] = useState<ForecastHorizon[]>([]);
  const [dateLabel, setDateLabel] = useState<string>('');

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

  type VerdictTone = 'rose' | 'sky' | 'emerald';
  interface Verdict {
    Icon: LucideIcon;
    label: string;
    sub: string;
    tone: VerdictTone;
  }

  const verdict: Verdict = useMemo(() => {
    const peak = horizons.reduce((mx, h) => Math.max(mx, h.rainFactor), 0);
    if (peak >= 0.55) {
      return {
        Icon: CloudRain,
        label: '強烈建議帶傘',
        sub: '今天會下中雨以上',
        tone: 'rose',
      };
    }
    if (peak >= 0.25) {
      return {
        Icon: Umbrella,
        label: '建議帶傘',
        sub: '部分時段有雨機率',
        tone: 'sky',
      };
    }
    return {
      Icon: Sun,
      label: '不必帶傘',
      sub: '今天雨勢輕微',
      tone: 'emerald',
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

  const verdictAccent = {
    rose: {
      bg: 'bg-rose-50',
      iconBg: 'bg-rose-100',
      iconText: 'text-rose-600',
      text: 'text-rose-700',
      ring: 'ring-rose-100',
    },
    sky: {
      bg: 'bg-brand-50',
      iconBg: 'bg-brand-100',
      iconText: 'text-brand-600',
      text: 'text-brand-700',
      ring: 'ring-brand-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
      text: 'text-emerald-700',
      ring: 'ring-emerald-100',
    },
  }[verdict.tone];

  const VerdictIcon = verdict.Icon;

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-brand-50/40 p-0 ring-1 ring-slate-200/60">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-stretch">
        {/* 左：今天該不該帶傘 */}
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div
            className={`grid h-14 w-14 flex-none place-items-center rounded-2xl ring-1 ${verdictAccent.iconBg} ${verdictAccent.ring}`}
          >
            <VerdictIcon
              className={`h-7 w-7 ${verdictAccent.iconText}`}
              strokeWidth={2}
            />
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

        {/* 右：streak hero */}
        <Link
          href="/me"
          className="group flex items-center justify-between gap-3 border-t border-slate-200/60 bg-gradient-to-br from-orange-50/70 to-amber-50/70 p-4 transition-colors hover:from-orange-100/70 hover:to-amber-100/70 sm:min-w-[180px] sm:flex-col sm:items-center sm:justify-center sm:border-l sm:border-t-0 sm:p-5"
        >
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              <Flame className="h-7 w-7 text-orange-500" strokeWidth={2.2} fill="currentColor" />
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
              <>已蒐集全部徽章</>
            )}
          </div>
        </Link>
      </div>

      {/* 底部 chip 列 */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/60 bg-white px-4 py-2.5 text-[12px]">
        <SectionLabel>校園水況</SectionLabel>
        {brokenStations.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
            飲水機 {waterStations.length} 台運作中
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
            <AlertTriangle className="h-3 w-3" strokeWidth={2.4} />
            {brokenStations.length} 台需注意
            <span className="text-rose-500/80">
              · {brokenStations[0].name.slice(0, 12)}
              {brokenStations[0].name.length > 12 && '…'}
            </span>
          </span>
        )}

        {newlyUnlocked.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100 animate-fade-in">
            <Sparkles className="h-3 w-3" strokeWidth={2.4} />
            解鎖新徽章
            <Link href="/me" className="underline">
              查看
            </Link>
          </span>
        )}

        {isFirstDay && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Hand className="h-3 w-3" strokeWidth={2.2} />
            歡迎，每天打開累積徽章 →{' '}
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
