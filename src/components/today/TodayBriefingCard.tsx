'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CloudSun,
  CloudDrizzle,
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
  type ForecastSlot,
  type WeatherSnapshot,
} from '@/lib/weather';
import type { WaterStation } from '@/lib/types';

interface Props {
  waterStations?: WaterStation[];
}

/**
 * 今日水情報 — 主頁 hero。
 * 雙焦點：左當天天氣預報（圖示 + 時段摘要）/ 右 streak（火焰 + 大數字）
 * 底部 chip 列：飲水機運作狀態、徽章解鎖、新人引導。
 */
export function TodayBriefingCard({ waterStations = [] }: Props) {
  const { state: streak, newlyUnlocked, hydrated } = useStreak();
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
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
  interface WeatherBrief {
    Icon: LucideIcon;
    label: string;
    sub: string;
    meta: string;
    sourceLabel: string;
    tone: VerdictTone;
  }

  const brief: WeatherBrief = useMemo(() => {
    if (!weather) {
      return {
        Icon: CloudSun,
        label: '今日天氣預報',
        sub: '正在取得大安區即時預報',
        meta: '載入中',
        sourceLabel: 'CWA',
        tone: 'sky',
      };
    }

    const now = new Date();
    const startOfTomorrow =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() +
      24 * 3600 * 1000;
    const remainingToday = (weather.forecastSeries ?? [])
      .filter((slot) => isSlotRelevantToday(slot, now.getTime(), startOfTomorrow))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    const activeSlot =
      remainingToday.find((slot) => {
        const start = new Date(slot.startTime).getTime();
        const end = new Date(slot.endTime).getTime();
        return start <= now.getTime() && now.getTime() < end;
      }) ?? remainingToday[0];
    const todayPeakPop = Math.max(
      activeSlot?.pop ?? weather.pop3h,
      ...remainingToday.map((slot) => slot.pop),
    );
    const slotIntensity = activeSlot?.intensityHint ?? weather.rainIntensity;
    const wx = activeSlot?.wx || weather.description || '天氣資料更新中';
    const pop = activeSlot?.pop ?? weather.pop3h;
    const timeRange = activeSlot
      ? formatSlotRange(activeSlot)
      : '目前時段';

    let Icon: LucideIcon = CloudSun;
    let tone: VerdictTone = 'emerald';
    let label = wx;

    if (slotIntensity === 'heavy' || slotIntensity === 'moderate' || pop >= 0.7) {
      Icon = CloudRain;
      tone = 'rose';
      label = `${wx} · 降雨明顯`;
    } else if (slotIntensity === 'light' || slotIntensity === 'drizzle' || pop >= 0.35) {
      Icon = CloudDrizzle;
      tone = 'sky';
      label = `${wx} · 有雨機率`;
    } else if (weather.isRaining) {
      Icon = CloudDrizzle;
      tone = 'sky';
      label = `${wx} · 觀測有雨`;
    }

    const sourceLabel = weather.source === 'cwa' ? 'CWA 大安區預報' : 'Mock 模擬預報';

    return {
      Icon,
      label,
      sub: `${timeRange} · 降雨機率 ${Math.round(pop * 100)}%`,
      meta: `今日剩餘最高 ${Math.round(todayPeakPop * 100)}% · ${RAIN_INTENSITY_LABEL[slotIntensity]}`,
      sourceLabel,
      tone,
    };
  }, [weather]);

  const observationMeta = useMemo(() => {
    if (!weather) return null;
    const parts: string[] = [];
    if (weather.temperature !== null) parts.push(`${weather.temperature.toFixed(0)}°C`);
    if (weather.humidity !== null) parts.push(`濕度 ${weather.humidity.toFixed(0)}%`);
    if (weather.rainfall1h !== null) {
      parts.push(`觀測雨量 ${weather.rainfall1h.toFixed(1)} mm/h`);
    }
    return parts.join(' · ');
  }, [weather]);

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

  const briefAccent = {
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
  }[brief.tone];

  const WeatherIcon = brief.Icon;

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-white via-white to-brand-50/40 p-0 ring-1 ring-slate-200/60">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-stretch">
        {/* 左：今日天氣預報 */}
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div
            className={`grid h-14 w-14 flex-none place-items-center rounded-2xl ring-1 ${briefAccent.iconBg} ${briefAccent.ring}`}
          >
            <WeatherIcon
              className={`h-7 w-7 ${briefAccent.iconText}`}
              strokeWidth={2}
            />
          </div>
          <div className="min-w-0 flex-1">
            <SectionLabel className="text-slate-500">
              {dateLabel ? `${dateLabel} · 今日天氣預報` : '今日天氣預報'}
            </SectionLabel>
            <h2
              className={`mt-0.5 truncate text-xl font-bold tracking-tight ${briefAccent.text}`}
            >
              {brief.label}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {brief.sub}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
              <span>{brief.sourceLabel}</span>
              <span>{brief.meta}</span>
              {observationMeta && <span>{observationMeta}</span>}
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

function isSlotRelevantToday(
  slot: ForecastSlot,
  nowMs: number,
  startOfTomorrow: number,
): boolean {
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end > nowMs && start < startOfTomorrow;
}

function formatSlotRange(slot: ForecastSlot): string {
  const fmt = new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(new Date(slot.startTime))}-${fmt.format(new Date(slot.endTime))}`;
}
