'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  actionScore,
  computeLevel,
  useStats,
  type StatsState,
} from '@/lib/statsStore';
import { useStreakReadOnly, type StreakState } from '@/lib/streakStore';
import {
  BADGES,
  CATEGORY_LABEL,
  badgesByCategory,
  type Badge,
} from '@/lib/badges';
import { useCommuteRoutes } from '@/lib/commuteStore';

export default function MePage() {
  const { state: streak, hydrated: streakReady } = useStreakReadOnly();
  const { state: stats, hydrated: statsReady } = useStats();
  const { routes } = useCommuteRoutes();

  const score = actionScore(stats, streak.currentStreak);
  const level = computeLevel(score);
  const grouped = badgesByCategory();
  const unlocked = useMemo(
    () => BADGES.filter((b) => b.isUnlocked(streak, stats)),
    [streak, stats],
  );

  const hydrated = streakReady && statsReady;

  if (!hydrated) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-500">
        載入中…
      </div>
    );
  }

  // 純新使用者（剛打開、什麼都還沒做）
  const isNewbie = streak.totalDistinctDays <= 1 && score < 5;

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">個人成績單</h1>
          <p className="text-xs text-slate-500">
            你在台大水資源地圖累積的足跡 · 純本機儲存（不上 server）
          </p>
        </div>
      </div>

      {/* 段位卡 */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 ring-1 ring-indigo-100">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-4xl shadow-md ring-4 ring-indigo-100">
            {level.emoji}
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Lv.{level.level}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {level.name}
            </div>
            {level.nextThreshold !== null && level.remainingToNext !== null ? (
              <>
                <div className="mt-1 text-[11px] text-slate-600">
                  距「{level.nextName}」還差{' '}
                  <span className="font-semibold text-indigo-700">
                    {level.remainingToNext}
                  </span>{' '}
                  分
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, (1 - level.remainingToNext / Math.max(1, level.nextThreshold - level.threshold)) * 100))}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-1 text-[11px] font-medium text-amber-700">
                🏆 已達最高段位
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              行動分數
            </div>
            <div className="text-2xl font-bold text-indigo-700 tabular-nums">
              {score}
            </div>
          </div>
        </div>
        {isNewbie && (
          <div className="mt-3 rounded-lg bg-white/70 p-2 text-[11px] text-slate-700">
            👋 歡迎！每天打開、用通勤路線、按飲水機 +1、回報問題都能累積分數。
            <Link href="/" className="ml-1 font-medium text-indigo-700 underline">
              回主頁開始
            </Link>
          </div>
        )}
      </Card>

      {/* 4 格本月成績 */}
      <Card>
        <CardHeader title="累積成績" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="連續打卡"
            value={streak.currentStreak}
            unit="天"
            sub={`歷史最長 ${streak.longestStreak} 天`}
            tone="orange"
            emoji="🔥"
          />
          <Stat
            label="飲水機 +1"
            value={stats.water_refill}
            unit="次"
            sub={`省 ${stats.water_refill} 個 600ml 寶特瓶 ＝ ${(stats.water_refill * 0.014).toFixed(1)} kg CO₂`}
            tone="sky"
            emoji="💧"
          />
          <Stat
            label="通勤路線"
            value={stats.commute_run}
            unit="次"
            sub={`已建立 ${routes.length} 條常用路線`}
            tone="emerald"
            emoji="🚶"
          />
          <Stat
            label="校園回報"
            value={stats.report_filed + stats.broken_reported}
            unit="筆"
            sub={`水資源 ${stats.report_filed} · 飲水機 ${stats.broken_reported}`}
            tone="rose"
            emoji="📣"
          />
        </div>
      </Card>

      {/* 徽章牆 */}
      <Card>
        <CardHeader
          title="徽章牆"
          description={`已解鎖 ${unlocked.length} / ${BADGES.length}`}
        />
        <div className="space-y-3">
          {(Object.keys(grouped) as (keyof typeof grouped)[]).map((cat) => (
            <div key={cat}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABEL[cat]}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                {grouped[cat].map((b) => (
                  <BadgeCard key={b.id} badge={b} streak={streak} stats={stats} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 分享 */}
      <Card className="bg-gradient-to-br from-rose-50 to-amber-50 ring-1 ring-rose-100">
        <CardHeader
          title="分享你的成績單"
          description="長截圖整張 card 或拷貝下方文字"
        />
        <div className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
          <p className="leading-relaxed text-slate-700">
            🔥 連續 {streak.currentStreak} 天打卡台大水資源地圖<br />
            {level.emoji} 段位：{level.name} (Lv.{level.level}) · 行動分數 {score}<br />
            💧 累積 {stats.water_refill} 次飲水機 +1，省下{' '}
            {stats.water_refill} 個寶特瓶<br />
            🚶 通勤路線使用 {stats.commute_run} 次<br />
            📣 校園回報 {stats.report_filed + stats.broken_reported} 筆<br />
            🏆 已解鎖 {unlocked.length} / {BADGES.length} 徽章
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const text = `🔥 連續 ${streak.currentStreak} 天打卡 台大水資源地圖
${level.emoji} ${level.name} (Lv.${level.level}) · 分數 ${score}
💧 飲水機 +1 ${stats.water_refill} 次 / 省 ${stats.water_refill} 瓶寶特瓶
🚶 通勤路線 ${stats.commute_run} 次
📣 校園回報 ${stats.report_filed + stats.broken_reported} 筆
🏆 徽章 ${unlocked.length}/${BADGES.length}

#台大水資源地圖`;
              navigator.clipboard?.writeText(text).then(
                () => alert('已複製到剪貼簿，可貼到 IG / dcard / 群組'),
                () => alert('複製失敗，請手動選取'),
              );
            }}
          >
            📋 複製文字
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            ← 回主頁
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  tone,
  emoji,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  tone: 'orange' | 'sky' | 'emerald' | 'rose';
  emoji: string;
}) {
  const toneClass = {
    orange: 'bg-orange-50 ring-orange-100',
    sky: 'bg-sky-50 ring-sky-100',
    emerald: 'bg-emerald-50 ring-emerald-100',
    rose: 'bg-rose-50 ring-rose-100',
  }[tone];
  const textTone = {
    orange: 'text-orange-700',
    sky: 'text-sky-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone];
  return (
    <div className={`rounded-xl p-2.5 ring-1 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className="text-base">{emoji}</span>
      </div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${textTone}`}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-slate-500">
          {unit}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
        {sub}
      </div>
    </div>
  );
}

function BadgeCard({
  badge,
  streak,
  stats,
}: {
  badge: Badge;
  streak: StreakState;
  stats: StatsState;
}) {
  const unlocked = badge.isUnlocked(streak, stats);
  const progress = badge.progress(streak, stats);
  return (
    <div
      className={`relative flex items-center gap-1.5 rounded-lg p-1.5 ring-1 transition-colors ${
        unlocked
          ? 'bg-amber-50 ring-amber-200'
          : 'bg-slate-50 ring-slate-200'
      }`}
      title={badge.description}
    >
      <div
        className={`grid h-8 w-8 flex-none place-items-center rounded-full text-base ${
          unlocked
            ? 'bg-amber-100 text-amber-900'
            : 'bg-slate-200 text-slate-400 grayscale'
        }`}
      >
        {badge.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[11px] font-medium ${
            unlocked ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {badge.name}
        </div>
        {!unlocked && progress > 0 ? (
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-400"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        ) : (
          <div className="truncate text-[10px] text-slate-500">
            {badge.description}
          </div>
        )}
      </div>
    </div>
  );
}
