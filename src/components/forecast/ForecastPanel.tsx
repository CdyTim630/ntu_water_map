'use client';
import Link from 'next/link';
import {
  RefreshCw,
  Sun,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import { CAMPUS_NODES } from '@/lib/campus';
import {
  HORIZON_LABEL,
  HORIZONS,
  type ForecastHotspot,
  type Horizon,
  type HorizonForecast,
} from '@/lib/forecast';
import { RAIN_INTENSITY_LABEL, type WeatherSnapshot } from '@/lib/weather';

const MOCK_RAIN_OPTIONS: { value: MockRain; label: string; Icon: LucideIcon }[] = [
  { value: null, label: '自動', Icon: RefreshCw },
  { value: 'none', label: '無雨', Icon: Sun },
  { value: 'drizzle', label: '毛毛雨', Icon: CloudDrizzle },
  { value: 'light', label: '小雨', Icon: CloudRain },
  { value: 'moderate', label: '中雨', Icon: CloudRain },
  { value: 'heavy', label: '大雨', Icon: CloudLightning },
];

export type MockRain = null | 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy';

interface Props {
  weather: WeatherSnapshot | null;
  generatedAt: string | null;
  horizons: HorizonForecast[];
  hotspots: ForecastHotspot[];
  selectedHorizon: Horizon;
  onSelectHorizon: (h: Horizon) => void;
  mockRain: MockRain;
  onChangeMockRain: (m: MockRain) => void;
  showBaseFloodAreas: boolean;
  onToggleBaseFloodAreas: (v: boolean) => void;
  onSelectHotspot: (h: ForecastHotspot) => void;
  loading: boolean;
  error: string | null;
  cellsRendered: number;
}

const RAIN_COLOR: Record<HorizonForecast['estIntensity'], string> = {
  none: 'text-slate-500',
  drizzle: 'text-sky-600',
  light: 'text-blue-600',
  moderate: 'text-indigo-600',
  heavy: 'text-rose-600',
};

export function ForecastPanel({
  weather,
  generatedAt,
  horizons,
  hotspots,
  selectedHorizon,
  onSelectHorizon,
  mockRain,
  onChangeMockRain,
  showBaseFloodAreas,
  onToggleBaseFloodAreas,
  onSelectHotspot,
  loading,
  error,
  cellsRendered,
}: Props) {
  const isMockSource = weather?.source === 'mock';
  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="flex flex-col gap-3">
      {/* 主標 + 即時資訊 */}
      <Card>
        <CardHeader
          title="水災預警"
          description={
            <span>
              統計法預測：歷史回報密度 × 低窪地形 × 即時氣象。
              {generatedAt && <span className="ml-1">· 生成於 {generatedLabel}</span>}
            </span>
          }
          action={
            weather && (
              <Badge tone={weather.source === 'cwa' ? 'green' : 'gray'}>
                {weather.source === 'cwa' ? 'CWA 即時' : 'Mock 模擬'}
              </Badge>
            )
          }
        />
        {error && (
          <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {loading && !horizons.length && (
          <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
            計算中…（首次載入需從 OSM 路網抽風險，約 1–2 秒）
          </div>
        )}

        {/* Horizon toggle — 三段時間視窗 */}
        <div className="mt-1 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
          {HORIZONS.map((h) => {
            const hf = horizons.find((x) => x.horizon === h);
            const active = selectedHorizon === h;
            return (
              <button
                key={h}
                onClick={() => onSelectHorizon(h)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div>{HORIZON_LABEL[h]}</div>
                {hf && (
                  <div
                    className={`mt-0.5 text-[10px] ${
                      active ? RAIN_COLOR[hf.estIntensity] : 'text-slate-500'
                    }`}
                  >
                    {RAIN_INTENSITY_LABEL[hf.estIntensity]} · 機率{' '}
                    {Math.round(hf.pop * 100)}%
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 來源透明化：series（CWA / mock 真實序列）vs derived（fallback 推估） */}
        {(() => {
          const cur = horizons.find((x) => x.horizon === selectedHorizon);
          if (!cur) return null;
          const isReal = cur.source === 'series';
          return (
            <div
              className={`mt-2 flex items-center justify-between rounded-lg px-2 py-1 text-[10px] ${
                isReal
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                  : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
              }`}
            >
              <span>
                {isReal
                  ? weather?.source === 'cwa'
                    ? 'CWA F-D0047-061 多時段資料'
                    : 'Mock 多時段序列'
                  : '無 series — 用 pop3h 推估'}
              </span>
              {cur.wx && (
                <span className="truncate text-right">{cur.wx}</span>
              )}
            </div>
          );
        })()}

        {/* 概觀數字 */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="熱區" value={hotspots.length.toString()} suffix="點" />
          <Stat
            label="風險網格"
            value={cellsRendered.toString()}
            suffix="格"
          />
          <Stat
            label="現雨勢"
            value={weather ? RAIN_INTENSITY_LABEL[weather.rainIntensity] : '—'}
          />
        </div>
      </Card>

      {/* 雨勢模擬（mock 才顯示） */}
      {isMockSource && (
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="mb-1.5 flex items-center justify-between">
            <SectionLabel className="text-amber-800">雨勢模擬</SectionLabel>
            {mockRain && (
              <button
                className="text-[10px] text-amber-700 underline"
                onClick={() => onChangeMockRain(null)}
              >
                重設
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MOCK_RAIN_OPTIONS.map((opt) => {
              const active = mockRain === opt.value;
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => onChangeMockRain(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                    active
                      ? 'border-amber-400 bg-white text-amber-900 shadow-sm'
                      : 'border-amber-100/70 bg-white/60 text-amber-800 hover:bg-white'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 顯示控制 */}
      <Card>
        <CardHeader title="顯示" />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showBaseFloodAreas}
            onChange={(e) => onToggleBaseFloodAreas(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
          />
          顯示既有低窪基準區（灰色虛線）
        </label>
      </Card>

      {/* Top 熱區清單 */}
      <Card>
        <CardHeader
          title="高風險熱區"
          description={
            hotspots.length === 0
              ? '目前沒有顯著風險點。'
              : `風險 ≥ 35% 列入；可點擊查看建議路線。`
          }
        />
        {hotspots.length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
            晴天時這裡會空著。試試切換右上「雨勢模擬」即可看見熱區。
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {hotspots.map((h, i) => (
              <HotspotItem
                key={`${h.lat},${h.lng}`}
                rank={i + 1}
                spot={h}
                selectedHorizon={selectedHorizon}
                onSelect={onSelectHotspot}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* 圖例 */}
      <Card>
        <CardHeader title="圖例" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
          <Legend color="#fde68a" label="輕度 15–30%" />
          <Legend color="#fbbf24" label="中度 30–50%" />
          <Legend color="#f97316" label="高 50–70%" />
          <Legend color="#ef4444" label="極高 70–85%" />
          <Legend color="#b91c1c" label="爆表 ≥85%" />
          <LegendHotspot color="#dc2626" label="熱區" />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          每格 50m × 50m。分數由低窪×雨勢、歷史回報密度、現場 active
          回報三項加權合成。
        </p>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-900">
        {value}
        {suffix && <span className="text-[10px] font-normal text-slate-500"> {suffix}</span>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        style={{
          background: color,
          width: 18,
          height: 10,
          borderRadius: 3,
          opacity: 0.7,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function LegendHotspot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-white"
        style={{ background: color }}
      >
        <AlertTriangle className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <span>{label}</span>
    </span>
  );
}

function HotspotItem({
  rank,
  spot,
  selectedHorizon,
  onSelect,
}: {
  rank: number;
  spot: ForecastHotspot;
  selectedHorizon: Horizon;
  onSelect: (h: ForecastHotspot) => void;
}) {
  const score = spot.scores[selectedHorizon] ?? spot.peakScore;
  const peakIsCurrent = spot.peakHorizon === selectedHorizon;

  // 推薦路線：以該點為「終點要避開」 → 把它當 end，找最近其他熱點/校園主節點當 start
  // 簡單做法：從 main_gate 走到附近最近的有名地標
  const nearestNodeId = nearestNodeForHotspot(spot);

  return (
    <li
      onClick={() => onSelect(spot)}
      className="cursor-pointer rounded-xl border border-slate-100 bg-white p-2.5 transition-colors hover:border-rose-200 hover:bg-rose-50/40"
    >
      <div className="flex items-start gap-2">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-rose-100 text-[11px] font-semibold text-rose-700">
          {rank}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">
              {spot.name}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                score >= 0.75
                  ? 'bg-rose-100 text-rose-700'
                  : score >= 0.5
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {(score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
            {spot.reasons.map((r) => (
              <span
                key={r}
                className="rounded-md bg-slate-100 px-1.5 py-0.5"
              >
                {r}
              </span>
            ))}
            {!peakIsCurrent && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-700">
                峰值在 {HORIZON_LABEL[spot.peakHorizon]} ({(spot.peakScore * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-600">{spot.advice}</p>
          {nearestNodeId && (
            <Link
              href={`/route?endNode=${encodeURIComponent(nearestNodeId)}&mockRain=${selectedHorizonToMockRain(spot.peakScore)}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:text-brand-700"
            >
              查看避開此處的建議路線
              <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

/** 找熱點最近的 named campus node，用於跳轉 /route 預設終點 */
function nearestNodeForHotspot(spot: ForecastHotspot): string | null {
  let bestId: string | null = null;
  let bestD = Infinity;
  for (const n of CAMPUS_NODES) {
    const d = haversineDeg(spot, n);
    if (d < bestD) {
      bestD = d;
      bestId = n.id;
    }
  }
  return bestId;
}

function haversineDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  // 度數平方距離 — 排序用，不需精確公尺
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

/** 把 score 轉成 mockRain 強度（給 /route 預覽用） */
function selectedHorizonToMockRain(score: number): MockRain {
  if (score >= 0.8) return 'heavy';
  if (score >= 0.6) return 'moderate';
  if (score >= 0.4) return 'light';
  if (score >= 0.2) return 'drizzle';
  return 'none';
}
