/**
 * 徽章定義表 — streak / stats / 行為解鎖三類。
 *
 * 加新徽章只需在這裡 + 一行條件，UI 會自動列出。
 */
import {
  Flame,
  Sparkles,
  Trophy,
  Crown,
  Star,
  Droplet,
  Recycle,
  Leaf,
  Award,
  Footprints,
  Bike,
  Eye,
  Megaphone,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { StatsState } from './statsStore';
import type { StreakState } from './streakStore';

export interface Badge {
  id: string;
  name: string;
  Icon: LucideIcon;
  description: string;
  isUnlocked: (s: StreakState, stats: StatsState) => boolean;
  progress: (s: StreakState, stats: StatsState) => number;
  category: 'streak' | 'water' | 'commute' | 'community';
}

const STREAK_THRESHOLDS = [3, 7, 30, 100, 365];
const STREAK_ICONS: LucideIcon[] = [Sparkles, Flame, Star, Trophy, Crown];

function pct(cur: number, target: number) {
  return Math.min(1, cur / target);
}

export const BADGES: Badge[] = [
  // ─── streak ───
  ...STREAK_THRESHOLDS.map(
    (d, i): Badge => ({
      id: `streak_${d}`,
      name:
        d >= 365
          ? '一年水文宗師'
          : d >= 100
            ? '百日不斷流'
            : d >= 30
              ? '三十日水流'
              : d >= 7
                ? '一週水文'
                : '初次入流',
      Icon: STREAK_ICONS[i] ?? Flame,
      description: `連續打開 ${d} 天`,
      isUnlocked: (s) => s.currentStreak >= d || s.longestStreak >= d,
      progress: (s) => pct(Math.max(s.currentStreak, s.longestStreak), d),
      category: 'streak',
    }),
  ),

  // ─── water (減塑/飲水) ───
  {
    id: 'refill_1',
    name: '初次裝水',
    Icon: Droplet,
    description: '在飲水機按下第一個 +1',
    isUnlocked: (_, st) => st.water_refill >= 1,
    progress: (_, st) => pct(st.water_refill, 1),
    category: 'water',
  },
  {
    id: 'refill_10',
    name: '減塑入門',
    Icon: Recycle,
    description: '累積裝水 10 次（省 10 個 600ml 寶特瓶）',
    isUnlocked: (_, st) => st.water_refill >= 10,
    progress: (_, st) => pct(st.water_refill, 10),
    category: 'water',
  },
  {
    id: 'refill_50',
    name: '減塑達人',
    Icon: Leaf,
    description: '累積裝水 50 次（省下 ~700g CO₂）',
    isUnlocked: (_, st) => st.water_refill >= 50,
    progress: (_, st) => pct(st.water_refill, 50),
    category: 'water',
  },
  {
    id: 'refill_100',
    name: '減塑王',
    Icon: Award,
    description: '累積裝水 100 次',
    isUnlocked: (_, st) => st.water_refill >= 100,
    progress: (_, st) => pct(st.water_refill, 100),
    category: 'water',
  },

  // ─── commute ───
  {
    id: 'commute_5',
    name: '通勤新手',
    Icon: Footprints,
    description: '使用通勤路線規劃 5 次',
    isUnlocked: (_, st) => st.commute_run >= 5,
    progress: (_, st) => pct(st.commute_run, 5),
    category: 'commute',
  },
  {
    id: 'commute_30',
    name: '通勤老手',
    Icon: Bike,
    description: '使用通勤路線規劃 30 次',
    isUnlocked: (_, st) => st.commute_run >= 30,
    progress: (_, st) => pct(st.commute_run, 30),
    category: 'commute',
  },

  // ─── community (回報) ───
  {
    id: 'report_1',
    name: '校園守護者',
    Icon: Eye,
    description: '提交第 1 筆水資源回報',
    isUnlocked: (_, st) => st.report_filed >= 1,
    progress: (_, st) => pct(st.report_filed, 1),
    category: 'community',
  },
  {
    id: 'report_5',
    name: '回報達人',
    Icon: Megaphone,
    description: '提交 5 筆回報',
    isUnlocked: (_, st) => st.report_filed >= 5,
    progress: (_, st) => pct(st.report_filed, 5),
    category: 'community',
  },
  {
    id: 'broken_3',
    name: '故障獵人',
    Icon: Wrench,
    description: '標出 3 台故障飲水機',
    isUnlocked: (_, st) => st.broken_reported >= 3,
    progress: (_, st) => pct(st.broken_reported, 3),
    category: 'community',
  },
];

export function badgesByCategory() {
  const groups: Record<Badge['category'], Badge[]> = {
    streak: [],
    water: [],
    commute: [],
    community: [],
  };
  for (const b of BADGES) groups[b.category].push(b);
  return groups;
}

export const CATEGORY_LABEL: Record<Badge['category'], string> = {
  streak: '連續登入',
  water: '減塑/飲水',
  commute: '通勤路線',
  community: '校園回報',
};
