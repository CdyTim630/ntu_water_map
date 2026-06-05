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
  Download,
  FileText,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
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
  const sharePayload = useMemo(
    () =>
      buildSharePayload({
        streak,
        stats,
        score,
        levelName: level.name,
        level: level.level,
        unlocked,
        routesCount: routes.length,
      }),
    [level.level, level.name, routes.length, score, stats, streak, unlocked],
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
      <Card className="overflow-hidden border-0 bg-slate-950 p-0 text-white ring-1 ring-slate-800">
        <CardHeader
          title="分享你的成績單"
          description="輸出成精美圖片，或用列印儲存成 PDF"
          className="px-4 pt-4 [&_h3]:text-white [&_p]:text-white/60"
        />
        <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_310px]">
          <SharePreview payload={sharePayload} />
          <div className="flex flex-col justify-between gap-3 rounded-xl bg-white/[0.08] p-3 ring-1 ring-white/10">
            <div>
              <SectionLabel className="text-white/60">分享文字</SectionLabel>
              <div className="mt-2 rounded-lg bg-black/20 p-3 text-[12px] leading-relaxed text-white/80 ring-1 ring-white/10">
                {buildShareText(sharePayload)
                  .split('\n')
                  .map((line) => (
                    <p key={line || 'blank'}>{line || '\u00a0'}</p>
                  ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => downloadShareImage(sharePayload)}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
                下載分享圖片
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                onClick={() => exportSharePdf(sharePayload)}
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={2.2} />
                匯出 PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                onClick={() => copyShareText(sharePayload)}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                複製文字
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/10 text-white hover:bg-white/15"
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: '台大水資源地圖個人成績單',
                    text: buildShareText(sharePayload),
                  })
                  .catch(() => undefined);
              } else {
                copyShareText(sharePayload);
              }
            }}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
            分享
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            回主頁
          </Link>
        </div>
      </Card>
    </div>
  );
}

interface SharePayload {
  dateLabel: string;
  levelName: string;
  level: number;
  score: number;
  streakDays: number;
  longestStreak: number;
  totalDays: number;
  waterRefill: number;
  bottlesSaved: number;
  co2Kg: string;
  commuteRuns: number;
  routesCount: number;
  reportCount: number;
  unlockedCount: number;
  badgeCount: number;
  unlockedBadges: string[];
}

function buildSharePayload({
  streak,
  stats,
  score,
  levelName,
  level,
  unlocked,
  routesCount,
}: {
  streak: StreakState;
  stats: StatsState;
  score: number;
  levelName: string;
  level: number;
  unlocked: Badge[];
  routesCount: number;
}): SharePayload {
  const reportCount = stats.report_filed + stats.broken_reported;
  return {
    dateLabel: new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    levelName,
    level,
    score,
    streakDays: streak.currentStreak,
    longestStreak: streak.longestStreak,
    totalDays: streak.totalDistinctDays,
    waterRefill: stats.water_refill,
    bottlesSaved: stats.water_refill,
    co2Kg: (stats.water_refill * 0.014).toFixed(1),
    commuteRuns: stats.commute_run,
    routesCount,
    reportCount,
    unlockedCount: unlocked.length,
    badgeCount: BADGES.length,
    unlockedBadges: unlocked.slice(-5).map((b) => b.name),
  };
}

function SharePreview({ payload }: { payload: SharePayload }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#f7fbff] p-4 text-slate-950 shadow-2xl ring-1 ring-white/20">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand-600 via-cyan-500 to-emerald-400" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 text-white">
          <div>
            <SectionLabel className="text-white/75">
              NTU Water Risk Map
            </SectionLabel>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">
              我的水資源成績單
            </h3>
            <p className="mt-1 text-[11px] text-white/75">
              {payload.dateLabel}
            </p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/95 text-brand-700 shadow-lg">
            <Droplet className="h-7 w-7" fill="currentColor" strokeWidth={2} />
          </div>
        </div>

        <div className="mt-7 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionLabel>目前段位</SectionLabel>
              <div className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                {payload.levelName}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                Lv.{payload.level} · {payload.score} 行動分數
              </div>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-orange-600 ring-1 ring-orange-200">
              <Trophy className="h-8 w-8" strokeWidth={2.1} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ShareStat label="連續打卡" value={payload.streakDays} unit="天" tone="orange" />
            <ShareStat label="減塑瓶數" value={payload.bottlesSaved} unit="瓶" tone="emerald" />
            <ShareStat label="通勤路線" value={payload.commuteRuns} unit="次" tone="brand" />
            <ShareStat label="校園回報" value={payload.reportCount} unit="筆" tone="rose" />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center">
            <MiniStat label="最長連續" value={`${payload.longestStreak}天`} />
            <MiniStat label="減碳估計" value={`${payload.co2Kg}kg`} />
            <MiniStat
              label="徽章"
              value={`${payload.unlockedCount}/${payload.badgeCount}`}
            />
          </div>

          <div className="mt-3">
            <SectionLabel>代表徽章</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(payload.unlockedBadges.length
                ? payload.unlockedBadges
                : ['水資源新星']
              ).map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100"
                >
                  <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-500 ring-1 ring-slate-200">
          <span>讓校園少一點積水，多一點補水。</span>
          <span className="font-semibold text-brand-700">ntu-water-map</span>
        </div>
      </div>
    </div>
  );
}

function ShareStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: 'orange' | 'emerald' | 'brand' | 'rose';
}) {
  const toneClass = {
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }[tone];
  return (
    <div className={`rounded-xl p-3 ring-1 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular">
        {value}
        <span className="ml-0.5 text-xs font-medium opacity-70">{unit}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-800 tabular">
        {value}
      </div>
    </div>
  );
}

function buildShareText(payload: SharePayload) {
  return `我的台大水資源地圖成績單
${payload.levelName} Lv.${payload.level} · ${payload.score} 分
連續打卡 ${payload.streakDays} 天，最長 ${payload.longestStreak} 天
飲水機 +1 ${payload.waterRefill} 次，省下 ${payload.bottlesSaved} 瓶寶特瓶
通勤路線 ${payload.commuteRuns} 次，校園回報 ${payload.reportCount} 筆
徽章 ${payload.unlockedCount}/${payload.badgeCount}

#台大水資源地圖`;
}

function copyShareText(payload: SharePayload) {
  navigator.clipboard?.writeText(buildShareText(payload)).then(
    () => alert('已複製到剪貼簿'),
    () => alert('複製失敗，請手動選取'),
  );
}

function makeShareCanvas(payload: SharePayload): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const font = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#0f5fd7');
  gradient.addColorStop(0.42, '#14b8a6');
  gradient.addColorStop(1, '#f59e0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  drawBlob(ctx, 895, 130, 185, 'rgba(255,255,255,0.18)');
  drawBlob(ctx, 155, 1070, 260, 'rgba(255,255,255,0.16)');

  roundRect(ctx, 70, 70, 940, 1210, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 54px ${font}`;
  ctx.fillText('我的水資源成績單', 130, 175);
  ctx.font = `600 25px ${font}`;
  ctx.fillStyle = '#64748b';
  ctx.fillText('NTU Water Risk Map', 132, 218);
  ctx.fillText(payload.dateLabel, 132, 252);

  drawWaterMark(ctx, 875, 162);

  roundRect(ctx, 130, 305, 820, 245, 34);
  const levelGradient = ctx.createLinearGradient(130, 305, 950, 550);
  levelGradient.addColorStop(0, '#eff6ff');
  levelGradient.addColorStop(1, '#ecfdf5');
  ctx.fillStyle = levelGradient;
  ctx.fill();
  ctx.strokeStyle = '#dbeafe';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.font = `700 28px ${font}`;
  ctx.fillText(`Lv.${payload.level}`, 178, 373);
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 66px ${font}`;
  ctx.fillText(payload.levelName, 178, 455);
  ctx.fillStyle = '#2563eb';
  ctx.font = `800 42px ${font}`;
  ctx.fillText(`${payload.score} 行動分數`, 178, 510);
  drawMedal(ctx, 805, 425);

  const statY = 610;
  const stats = [
    ['連續打卡', payload.streakDays, '天', '#f97316'],
    ['減塑瓶數', payload.bottlesSaved, '瓶', '#059669'],
    ['通勤路線', payload.commuteRuns, '次', '#2563eb'],
    ['校園回報', payload.reportCount, '筆', '#e11d48'],
  ] as const;
  stats.forEach((s, i) => {
    const x = 130 + (i % 2) * 420;
    const y = statY + Math.floor(i / 2) * 185;
    drawCanvasStat(ctx, x, y, s[0], s[1], s[2], s[3], font);
  });

  roundRect(ctx, 130, 1010, 820, 105, 26);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  const mini = [
    ['最長連續', `${payload.longestStreak} 天`],
    ['減碳估計', `${payload.co2Kg} kg`],
    ['徽章解鎖', `${payload.unlockedCount}/${payload.badgeCount}`],
  ];
  mini.forEach(([label, value], i) => {
    const x = 205 + i * 270;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 22px ${font}`;
    ctx.fillText(label, x, 1052);
    ctx.fillStyle = '#0f172a';
    ctx.font = `900 32px ${font}`;
    ctx.fillText(value, x, 1094);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = '#64748b';
  ctx.font = `700 24px ${font}`;
  ctx.fillText('代表徽章', 132, 1175);
  const badges = payload.unlockedBadges.length
    ? payload.unlockedBadges.slice(-3)
    : ['水資源新星'];
  let badgeX = 132;
  badges.forEach((badge) => {
    const w = Math.min(250, 42 + badge.length * 26);
    roundRect(ctx, badgeX, 1200, w, 46, 23);
    ctx.fillStyle = '#fef3c7';
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.font = `700 21px ${font}`;
    ctx.fillText(badge, badgeX + 22, 1230);
    badgeX += w + 14;
  });

  ctx.fillStyle = '#1d4ed8';
  ctx.font = `800 25px ${font}`;
  ctx.fillText('讓校園少一點積水，多一點補水。', 130, 1276);
  ctx.fillStyle = '#64748b';
  ctx.font = `600 21px ${font}`;
  ctx.fillText('ntu-water-map', 805, 1276);

  return canvas;
}

function downloadShareImage(payload: SharePayload) {
  const canvas = makeShareCanvas(payload);
  const link = document.createElement('a');
  link.download = `ntu-water-report-card-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function exportSharePdf(payload: SharePayload) {
  const image = makeShareCanvas(payload).toDataURL('image/png');
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert('瀏覽器阻擋彈出視窗，請允許後再試一次。');
    return;
  }
  win.document.write(`<!doctype html>
<html>
<head>
  <title>台大水資源地圖成績單</title>
  <style>
    @page { size: 1080px 1350px; margin: 0; }
    html, body { margin: 0; background: #0f172a; }
    img { display: block; width: 100vw; height: auto; }
    @media print { img { width: 100%; } }
  </style>
</head>
<body>
  <img src="${image}" alt="台大水資源地圖個人成績單" />
  <script>
    window.onload = () => setTimeout(() => window.print(), 250);
  </script>
</body>
</html>`);
  win.document.close();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawWaterMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, -54, -54, 108, 108, 28);
  ctx.fillStyle = '#1d4ed8';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -33);
  ctx.bezierCurveTo(29, 0, 32, 18, 17, 33);
  ctx.bezierCurveTo(7, 43, -7, 43, -17, 33);
  ctx.bezierCurveTo(-32, 18, -29, 0, 0, -33);
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.restore();
}

function drawMedal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-58, -58, 58, 58);
  g.addColorStop(0, '#fde68a');
  g.addColorStop(1, '#f97316');
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = '900 54px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('水', 0, 3);
  ctx.restore();
}

function drawCanvasStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  unit: string,
  color: string,
  font: string,
) {
  roundRect(ctx, x, y, 370, 145, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `800 26px ${font}`;
  ctx.fillText(label, x + 28, y + 46);
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 52px ${font}`;
  ctx.fillText(String(value), x + 28, y + 108);
  ctx.fillStyle = '#64748b';
  ctx.font = `700 24px ${font}`;
  ctx.fillText(unit, x + 28 + String(value).length * 31, y + 108);
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
