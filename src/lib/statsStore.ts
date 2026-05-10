/**
 * 個人累積行為統計 — 純 client localStorage（與 streak 分離，避免相互污染）。
 *
 * Events 與計分權重：
 *   commute_run     +1   通勤路線實際打開導航
 *   water_refill    +1   按下飲水機 +1（裝水）
 *   report_filed    +1   提交了一筆水資源回報
 *   broken_reported +1   標記某飲水機壞了
 *
 * 等級行動分數 = streak_days * 1 + water_refill * 2 + report_filed * 3 + commute_run * 1
 *   Lv.0 水文小白    < 10
 *   Lv.1 水文學徒    10–49
 *   Lv.2 水文達人    50–199
 *   Lv.3 水文宗師    200–499
 *   Lv.4 水文神話    ≥ 500
 */
'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Droplet,
  Droplets,
  Waves,
  Wind,
  Crown,
  type LucideIcon,
} from 'lucide-react';

const KEY = 'ntu-water-stats-v1';

export type StatEvent =
  | 'commute_run'
  | 'water_refill'
  | 'report_filed'
  | 'broken_reported';

export interface StatsState {
  commute_run: number;
  water_refill: number;
  report_filed: number;
  broken_reported: number;
  /** YYYY-MM 月份（檢查月切換做月報重置；目前先不做月重置，保留為將來用） */
  currentMonth: string;
}

const EMPTY: StatsState = {
  commute_run: 0,
  water_refill: 0,
  report_filed: 0,
  broken_reported: 0,
  currentMonth: '',
};

function readState(): StatsState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      commute_run: Number(parsed.commute_run ?? 0),
      water_refill: Number(parsed.water_refill ?? 0),
      report_filed: Number(parsed.report_filed ?? 0),
      broken_reported: Number(parsed.broken_reported ?? 0),
      currentMonth: typeof parsed.currentMonth === 'string' ? parsed.currentMonth : '',
    };
  } catch {
    return EMPTY;
  }
}

function writeState(s: StatsState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('ntu-stats-changed'));
}

export function incrementStat(event: StatEvent, by = 1) {
  if (typeof window === 'undefined') return;
  const cur = readState();
  const next: StatsState = { ...cur, [event]: cur[event] + by };
  writeState(next);
}

export function actionScore(stats: StatsState, streakDays: number): number {
  return (
    streakDays * 1 +
    stats.water_refill * 2 +
    stats.report_filed * 3 +
    stats.commute_run * 1 +
    stats.broken_reported * 2
  );
}

export interface LevelInfo {
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  Icon: LucideIcon;
  threshold: number;
  /** 升級到下一級還差多少分 */
  nextThreshold: number | null;
  nextName: string | null;
  remainingToNext: number | null;
}

const LEVELS: {
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  Icon: LucideIcon;
  threshold: number;
}[] = [
  { level: 0, name: '水文小白', Icon: Droplet, threshold: 0 },
  { level: 1, name: '水文學徒', Icon: Droplets, threshold: 10 },
  { level: 2, name: '水文達人', Icon: Waves, threshold: 50 },
  { level: 3, name: '水文宗師', Icon: Wind, threshold: 200 },
  { level: 4, name: '水文神話', Icon: Crown, threshold: 500 },
];

export function computeLevel(score: number): LevelInfo {
  let cur = LEVELS[0];
  for (const l of LEVELS) {
    if (score >= l.threshold) cur = l;
  }
  const next = LEVELS.find((l) => l.threshold > cur.threshold);
  return {
    level: cur.level,
    name: cur.name,
    Icon: cur.Icon,
    threshold: cur.threshold,
    nextThreshold: next?.threshold ?? null,
    nextName: next?.name ?? null,
    remainingToNext: next ? next.threshold - score : null,
  };
}

export function useStats(): { state: StatsState; hydrated: boolean } {
  const [state, setState] = useState<StatsState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  const reload = useCallback(() => setState(readState()), []);

  useEffect(() => {
    reload();
    setHydrated(true);
    window.addEventListener('ntu-stats-changed', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('ntu-stats-changed', reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  return { state, hydrated };
}
