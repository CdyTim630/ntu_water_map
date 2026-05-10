/**
 * 連續登入 streak 系統 — 純 client localStorage。
 *
 * 規則：
 *   - 每天首次打開主頁時 auto-check-in 一次
 *   - 昨天有打開 → 今天 +1 (current streak ++)
 *   - 昨天沒打開 → reset 為 1（保留 longest）
 *   - 同一天多次打開只算 1 次
 *   - 達到 7 / 30 / 100 / 365 自動解鎖徽章
 *
 * 為什麼 localStorage：跟 commuteStore 同邏輯，無需登入、零 PII、無後端負擔。
 */
'use client';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'ntu-water-streak-v1';

export interface StreakState {
  /** YYYY-MM-DD（local time），上次打開的日期 */
  lastVisitDate: string | null;
  /** 目前連續天數 */
  currentStreak: number;
  /** 歷史最長連續天數 */
  longestStreak: number;
  /** 累積打開過幾個不同日期 */
  totalDistinctDays: number;
  /** 已解鎖的 streak 徽章 ID */
  badges: string[];
}

const EMPTY: StreakState = {
  lastVisitDate: null,
  currentStreak: 0,
  longestStreak: 0,
  totalDistinctDays: 0,
  badges: [],
};

const STREAK_BADGE_THRESHOLDS: { id: string; days: number }[] = [
  { id: 'streak_3', days: 3 },
  { id: 'streak_7', days: 7 },
  { id: 'streak_30', days: 30 },
  { id: 'streak_100', days: 100 },
  { id: 'streak_365', days: 365 },
];

export function getTodayLocal(): string {
  // YYYY-MM-DD in user's local timezone
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDays(yyyymmddA: string, yyyymmddB: string): number {
  const a = new Date(yyyymmddA + 'T00:00:00');
  const b = new Date(yyyymmddB + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000));
}

function readState(): StreakState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      lastVisitDate: parsed.lastVisitDate ?? null,
      currentStreak: Number(parsed.currentStreak ?? 0),
      longestStreak: Number(parsed.longestStreak ?? 0),
      totalDistinctDays: Number(parsed.totalDistinctDays ?? 0),
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeState(s: StreakState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('ntu-streak-changed'));
}

/**
 * Pure check-in 計算（給 useStreak 用）。
 * 給定當前 state 和今天日期，回傳更新後 state + 本次新解鎖的徽章 list。
 */
export function checkInPure(
  prev: StreakState,
  today: string,
): { next: StreakState; newlyUnlocked: string[] } {
  // 同一天多次 → no-op
  if (prev.lastVisitDate === today) {
    return { next: prev, newlyUnlocked: [] };
  }

  let nextStreak = 1;
  if (prev.lastVisitDate) {
    const gap = diffDays(prev.lastVisitDate, today);
    if (gap === 1) nextStreak = prev.currentStreak + 1;
    // gap >= 2 → reset to 1
    // gap < 1 (時鐘亂跳) → 維持原值
    else if (gap < 0) nextStreak = prev.currentStreak;
  }

  const longest = Math.max(prev.longestStreak, nextStreak);
  const totalDays = prev.totalDistinctDays + 1;

  // 解鎖徽章
  const newlyUnlocked: string[] = [];
  const badgeSet = new Set(prev.badges);
  for (const b of STREAK_BADGE_THRESHOLDS) {
    if (nextStreak >= b.days && !badgeSet.has(b.id)) {
      badgeSet.add(b.id);
      newlyUnlocked.push(b.id);
    }
  }

  return {
    next: {
      lastVisitDate: today,
      currentStreak: nextStreak,
      longestStreak: longest,
      totalDistinctDays: totalDays,
      badges: Array.from(badgeSet),
    },
    newlyUnlocked,
  };
}

/** 下個 streak 徽章還差幾天 */
export function nextBadgeProgress(state: StreakState): {
  next: { id: string; days: number } | null;
  remaining: number;
} {
  const upcoming = STREAK_BADGE_THRESHOLDS.find(
    (b) => !state.badges.includes(b.id) && b.days > state.currentStreak,
  );
  if (!upcoming) return { next: null, remaining: 0 };
  return { next: upcoming, remaining: upcoming.days - state.currentStreak };
}

/**
 * useStreak — 自動 check-in（call 一次 useStreakAutoCheckIn 即可）
 * 回傳 state + 本次新解鎖徽章（給彈窗 toast 用）
 */
export function useStreak(): {
  state: StreakState;
  newlyUnlocked: string[];
  hydrated: boolean;
} {
  const [state, setState] = useState<StreakState>(EMPTY);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const cur = readState();
    const today = getTodayLocal();
    const { next, newlyUnlocked: unlocked } = checkInPure(cur, today);
    if (next !== cur) {
      writeState(next);
    }
    setState(next);
    setNewlyUnlocked(unlocked);
    setHydrated(true);

    const onChange = () => setState(readState());
    window.addEventListener('ntu-streak-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('ntu-streak-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return { state, newlyUnlocked, hydrated };
}

/** 給 /me 頁面用 — 不觸發 check-in，只讀 state */
export function useStreakReadOnly(): {
  state: StreakState;
  hydrated: boolean;
} {
  const [state, setState] = useState<StreakState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  const reload = useCallback(() => setState(readState()), []);

  useEffect(() => {
    reload();
    setHydrated(true);
    window.addEventListener('ntu-streak-changed', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('ntu-streak-changed', reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  return { state, hydrated };
}
