'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import {
  Flame,
  Droplet,
  Footprints,
  Megaphone,
  Trophy,
  Copy,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
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

  const isNewbie = streak.totalDistinctDays <= 1 && score < 5;
  const LevelIcon = level.Icon;

  return (
    <div className="px-4 py-4 sm:px-6 space-y-3 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">個人成績單</h1>
        <p className="text-[11.5px] text-slate-500">
          你在台大水資源地圖累積的足跡 · 純本機儲存（不上 server）
        </p>
      </div>

      {/* 段位卡 */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand-50 via-white to-emerald-50/60 ring-1 ring-brand-100">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 flex-none place-items-center rounded-full bg-white shadow-sm ring-2 ring-brand-100">
            <LevelIcon
              className="h-10 w-10 text-brand-600"
              strokeWidth={1.8}
            />
          </div>
          <div className="min-w-0 flex-1">
            <SectionLabel className="text-brand-600/80">
              Lv.{level.level}
            </SectionLabel>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {level.name}
            </div>
            {level.nextThreshold !== null && level.remainingToNext !== null ? (
              <>
                <div className="mt-1 text-[11px] text-slate-600">
                  距「{level.nextName}」還差{' '}
                  <span className="font-semibold text-brand-700 tabular">
                    {level.remainingToNext}
                  </span>{' '}
                  分
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500 ease-soft-out"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (1 -
                            level.remainingToNext /
                              Math.max(
                                1,
                                level.nextThreshold - level.threshold,
                              )) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                <Trophy className="h-3 w-3" strokeWidth={2.4} />
                已達最高段位
              </div>
            )}
          </div>
          <div className="flex-none text-right">
            <SectionLabel className="text-slate-500">行動分數</SectionLabel>
            <div className="text-3xl font-bold text-brand-700 tabular">
              {score}
            </div>
          </div>
        </div>
        {isNewbie && (
          <div className="mt-3 rounded-lg bg-white/80 p-2.5 text-[11.5px] text-slate-700 ring-1 ring-slate-200/60">
            歡迎！每天打開、用通勤路線、按飲水機 +1、回報問題都能累積分數。
            <Link href="/" className="ml-1 font-medium text-brand-700 underline">
              回主頁開始 →
            </Link>
          </div>
        )}
      </Card>

      {/* 4 格累積成績 */}
      <Card>
        <CardHeader title="累積成績" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="連續打卡"
            value={streak.currentStreak}
            unit="天"
            sub={`歷史最長 ${streak.longestStreak} 天`}
            tone="orange"
            Icon={Flame}
          />
          <Stat
            label="飲水機 +1"
            value={stats.water_refill}
            unit="次"
            sub={`省 ${stats.water_refill} 瓶 600ml = ${(stats.water_refill * 0.014).toFixed(1)} kg CO₂`}
            tone="sky"
            Icon={Droplet}
          />
          <Stat
            label="通勤路線"
            value={stats.commute_run}
            unit="次"
            sub={`已建立 ${routes.length} 條常用路線`}
            tone="emerald"
            Icon={Footprints}
          />
          <Stat
            label="校園回報"
            value={stats.report_filed + stats.broken_reported}
            unit="筆"
            sub={`水資源 ${stats.report_filed} · 飲水機 ${stats.broken_reported}`}
            tone="rose"
            Icon={Megaphone}
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
              <SectionLabel className="mb-1.5">
                {CATEGORY_LABEL[cat]}
              </SectionLabel>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                {grouped[cat].map((b) => (
                  <BadgeCard
                    key={b.id}
                    badge={b}
                    streak={streak}
                    stats={stats}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 分享 */}
      <Card className="bg-gradient-to-br from-amber-50/60 to-rose-50/60 ring-1 ring-amber-100">
        <CardHeader
          title="分享你的成績單"
          description="長截圖整張卡片，或拷貝下方文字到 IG / dcard / 群組"
        />
        <div className="rounded-lg bg-white p-3 text-[12.5px] leading-relaxed text-slate-700 ring-1 ring-slate-200/60">
          <p>連續 {streak.currentStreak} 天打卡台大水資源地圖</p>
          <p>
            段位：{level.name} (Lv.{level.level}) · 行動分數 {score}
          </p>
          <p>累積 {stats.water_refill} 次飲水機 +1，省下 {stats.water_refill} 個寶特瓶</p>
          <p>通勤路線使用 {stats.commute_run} 次</p>
          <p>校園回報 {stats.report_filed + stats.broken_reported} 筆</p>
          <p>
            已解鎖 {unlocked.length} / {BADGES.length} 徽章
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const text = `連續 ${streak.currentStreak} 天打卡 台大水資源地圖
${level.name} (Lv.${level.level}) · 分數 ${score}
飲水機 +1 ${stats.water_refill} 次 / 省 ${stats.water_refill} 瓶寶特瓶
通勤路線 ${stats.commute_run} 次
校園回報 ${stats.report_filed + stats.broken_reported} 筆
徽章 ${unlocked.length}/${BADGES.length}

#台大水資源地圖`;
              navigator.clipboard?.writeText(text).then(
                () => alert('已複製到剪貼簿'),
                () => alert('複製失敗，請手動選取'),
              );
            }}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
            複製文字
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            回主頁
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
  Icon,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  tone: 'orange' | 'sky' | 'emerald' | 'rose';
  Icon: LucideIcon;
}) {
  const toneClass = {
    orange: 'bg-orange-50 ring-orange-100',
    sky: 'bg-brand-50 ring-brand-100',
    emerald: 'bg-emerald-50 ring-emerald-100',
    rose: 'bg-rose-50 ring-rose-100',
  }[tone];
  const textTone = {
    orange: 'text-orange-700',
    sky: 'text-brand-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone];
  const iconTone = {
    orange: 'text-orange-500',
    sky: 'text-brand-500',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
  }[tone];
  return (
    <div className={`rounded-xl p-3 ring-1 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <Icon className={`h-4 w-4 ${iconTone}`} strokeWidth={2.2} />
      </div>
      <div className={`mt-1 text-2xl font-bold tabular ${textTone}`}>
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
  const Icon = badge.Icon;
  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg p-2 ring-1 transition-colors ${
        unlocked
          ? 'bg-amber-50 ring-amber-200'
          : 'bg-slate-50 ring-slate-200'
      }`}
      title={badge.description}
    >
      <div
        className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${
          unlocked
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-200/70 text-slate-400'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[12px] font-medium ${
            unlocked ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {badge.name}
        </div>
        {!unlocked && progress > 0 ? (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-400 transition-all"
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
