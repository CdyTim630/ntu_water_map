'use client';
import {
  ArrowUpDown,
  Target,
  MapPin,
  Footprints,
  Bike,
  CloudLightning,
  CloudRain,
  CloudDrizzle,
  Cloud,
  Sun,
  RefreshCw,
  Shield,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import { CAMPUS_NODES } from '@/lib/campus';
import type {
  Endpoint,
  ResolvedEndpoint,
  AvoidedStats,
  MockRain,
} from '@/app/route/page';
import type { WeatherSnapshot } from '@/lib/weather';

const baseSelect =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-soft transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export interface PlanLike {
  coords: [number, number][];
  totalDistance: number;
  coverageScore: number;
  lowLyingShare: number;
  passingFloodReports: number;
}

interface Props {
  start: Endpoint;
  end: Endpoint;
  startResolved: ResolvedEndpoint | null;
  endResolved: ResolvedEndpoint | null;
  mode: 'walk' | 'bike';
  avoidWater: boolean;
  rainFactor: number;
  weather: WeatherSnapshot | null;
  mockRain: MockRain;
  showFloodOverlay: boolean;
  pickMode: null | 'start' | 'end';
  onChangeStart: (ep: Endpoint) => void;
  onChangeEnd: (ep: Endpoint) => void;
  onChangeMode: (m: 'walk' | 'bike') => void;
  onChangeAvoidWater: (on: boolean) => void;
  onChangeMockRain: (m: MockRain) => void;
  onChangeShowFloodOverlay: (on: boolean) => void;
  onChangePickMode: (m: null | 'start' | 'end') => void;
  onSwap: () => void;
  recommended: PlanLike | null;
  shortest: PlanLike | null;
  avoided: AvoidedStats | null;
  loading?: boolean;
  error?: string | null;
}

/** mock 雨勢模擬器 — 三排兩格更緊湊 */
function MockRainPicker({
  value,
  onChange,
  isMockSource,
}: {
  value: MockRain;
  onChange: (v: MockRain) => void;
  isMockSource: boolean;
}) {
  if (!isMockSource) return null;
  const options: { value: MockRain; label: string; Icon: LucideIcon }[] = [
    { value: null, label: '自動', Icon: RefreshCw },
    { value: 'none', label: '無雨', Icon: Sun },
    { value: 'drizzle', label: '毛毛雨', Icon: CloudDrizzle },
    { value: 'light', label: '小雨', Icon: CloudRain },
    { value: 'moderate', label: '中雨', Icon: CloudRain },
    { value: 'heavy', label: '大雨', Icon: CloudLightning },
  ];
  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <SectionLabel className="text-amber-800">雨勢模擬</SectionLabel>
        {value && (
          <span className="rounded-full bg-amber-200/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-amber-800">
            OVERRIDE
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((opt) => {
          const Icon = opt.Icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value ?? 'auto'}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/70'
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={2.2} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtMin(distance: number, mode: 'walk' | 'bike') {
  const speed = mode === 'walk' ? 80 : 200;
  return Math.max(1, Math.round(distance / speed));
}

/** 雨勢狀態 banner — 低調、不搶焦點 */
function RainBanner({
  weather,
  rainFactor,
  avoidWater,
  avoided,
}: {
  weather: WeatherSnapshot | null;
  rainFactor: number;
  avoidWater: boolean;
  avoided: AvoidedStats | null;
}) {
  if (!weather) return null;
  const mm = weather.rainfall1h ?? 0;
  let level: 'heavy' | 'moderate' | 'light' | 'pop' | 'dry' = 'dry';
  if (mm >= 10 || weather.rainIntensity === 'heavy') level = 'heavy';
  else if (mm >= 2 || weather.rainIntensity === 'moderate') level = 'moderate';
  else if (mm > 0 || weather.isRaining) level = 'light';
  else if (weather.pop3h >= 0.5) level = 'pop';

  if (level === 'dry' && !avoidWater) return null;

  const config: Record<
    typeof level,
    { bg: string; iconBg: string; iconText: string; Icon: LucideIcon; title: string; msg: string }
  > = {
    heavy: {
      bg: 'border-rose-200 bg-rose-50/70',
      iconBg: 'bg-rose-500',
      iconText: 'text-white',
      Icon: CloudLightning,
      title: '大雨警示',
      msg: '已啟動最高避水權重，積水回報附近會強制繞行',
    },
    moderate: {
      bg: 'border-amber-200 bg-amber-50/70',
      iconBg: 'bg-amber-500',
      iconText: 'text-white',
      Icon: CloudRain,
      title: '雨天模式運作中',
      msg: '優先選擇遮蔽路段，避開易積水區',
    },
    light: {
      bg: 'border-brand-200 bg-brand-50/70',
      iconBg: 'bg-brand-500',
      iconText: 'text-white',
      Icon: CloudDrizzle,
      title: '輕度降雨',
      msg: '小幅偏好遮蔽路段',
    },
    pop: {
      bg: 'border-slate-200 bg-slate-50/70',
      iconBg: 'bg-slate-500',
      iconText: 'text-white',
      Icon: Cloud,
      title: '預期降雨',
      msg: `未來 3 小時降雨機率 ${(weather.pop3h * 100).toFixed(0)}%`,
    },
    dry: {
      bg: 'border-emerald-200 bg-emerald-50/70',
      iconBg: 'bg-emerald-500',
      iconText: 'text-white',
      Icon: Shield,
      title: '避水模式',
      msg: '即使無雨也優先選遮蔽路段',
    },
  };
  const c = config[level];
  const Icon = c.Icon;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border ${c.bg} px-3 py-2`}>
      <span
        className={`mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg ${c.iconBg} ${c.iconText}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-900">
            {c.title}
          </span>
          <span className="text-[10px] text-slate-500 tabular">
            雨勢 {(rainFactor * 100).toFixed(0)}%
            {avoidWater && ' · 避水'}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600">
          {c.msg}
        </p>
        {avoided && (avoided.floodReports > 0 || avoided.lowLyingMeters > 5) && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200/60">
            <Shield className="h-3 w-3 text-emerald-600" strokeWidth={2.4} />
            已避開
            {avoided.floodReports > 0 && (
              <span className="font-semibold text-rose-700">
                {' '}
                {avoided.floodReports} 處積水
              </span>
            )}
            {avoided.lowLyingMeters > 5 && (
              <span className="font-semibold text-amber-700">
                {' · '}
                {avoided.lowLyingMeters.toFixed(0)} m 易積水
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function PlanSummary({
  title,
  tone,
  plan,
  mode,
  hint,
}: {
  title: string;
  tone: 'green' | 'blue' | 'gray';
  plan: PlanLike | null;
  mode: 'walk' | 'bike';
  hint?: string;
}) {
  if (!plan) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[12.5px] text-slate-400">
        無法找到路徑
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <Badge tone={tone}>{title}</Badge>
        <span className="text-[11.5px] text-slate-500 tabular">
          {plan.totalDistance.toFixed(0)} m · {fmtMin(plan.totalDistance, mode)} 分
        </span>
      </div>
      {hint && (
        <p className="mb-1.5 text-[11px] leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[10.5px] text-slate-500">
        <div>
          <SectionLabel className="text-slate-400">遮蔽率</SectionLabel>
          <div
            className={`mt-0.5 text-[15px] font-semibold tabular ${plan.coverageScore > 0.4 ? 'text-emerald-600' : 'text-slate-900'}`}
          >
            {(plan.coverageScore * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <SectionLabel className="text-slate-400">易積水</SectionLabel>
          <div
            className={`mt-0.5 text-[15px] font-semibold tabular ${plan.lowLyingShare > 0.3 ? 'text-rose-600' : 'text-slate-900'}`}
          >
            {(plan.lowLyingShare * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <SectionLabel className="text-slate-400">途中積水</SectionLabel>
          <div
            className={`mt-0.5 text-[15px] font-semibold tabular ${plan.passingFloodReports > 0 ? 'text-amber-600' : 'text-slate-900'}`}
          >
            {plan.passingFloodReports}
          </div>
        </div>
      </div>
    </div>
  );
}

function EndpointPicker({
  label,
  endpoint,
  resolved,
  pickActive,
  onChange,
  onPickFromMap,
}: {
  label: '出發' | '目的地';
  endpoint: Endpoint;
  resolved: ResolvedEndpoint | null;
  pickActive: boolean;
  onChange: (ep: Endpoint) => void;
  onPickFromMap: () => void;
}) {
  const isPin = endpoint.kind === 'pin';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {isPin && (
          <Badge tone="brand">
            自訂 {resolved ? `${resolved.lat.toFixed(4)}, ${resolved.lng.toFixed(4)}` : ''}
          </Badge>
        )}
      </div>
      <select
        className={baseSelect}
        value={endpoint.kind === 'landmark' ? endpoint.id : '__pin__'}
        onChange={(e) => {
          if (e.target.value === '__pin__') return;
          onChange({ kind: 'landmark', id: e.target.value });
        }}
      >
        {isPin && (
          <option value="__pin__">
            自訂 ({resolved?.lat.toFixed(4)}, {resolved?.lng.toFixed(4)})
          </option>
        )}
        {CAMPUS_NODES.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onPickFromMap}
        className={`mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
          pickActive
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
        }`}
      >
        {pickActive ? (
          <>
            <Target className="h-3.5 w-3.5" strokeWidth={2.2} />
            點地圖任一處設為{label === '出發' ? '起點' : '終點'}
          </>
        ) : (
          <>
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.2} />
            在地圖上點選{label === '出發' ? '起點' : '終點'}
          </>
        )}
      </button>
    </div>
  );
}

/** 一致風格的 toggle row（避水模式 / 顯示易積水） */
function ToggleRow({
  Icon,
  label,
  description,
  active,
  onClick,
  tone,
}: {
  Icon: LucideIcon;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  tone: 'amber' | 'emerald';
}) {
  const activeClasses =
    tone === 'amber'
      ? 'border-amber-300 bg-amber-50/70 text-amber-900'
      : 'border-emerald-300 bg-emerald-50/70 text-emerald-900';
  const trackBg = active
    ? tone === 'amber'
      ? 'bg-amber-500'
      : 'bg-emerald-500'
    : 'bg-slate-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 transition-colors ${
        active
          ? activeClasses
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      <span className="flex items-center gap-2.5 text-left">
        <Icon className="h-4 w-4 flex-none" strokeWidth={2} />
        <span>
          <span className="block text-[12.5px] font-semibold">{label}</span>
          <span className="block text-[10.5px] leading-tight text-slate-500">
            {description}
          </span>
        </span>
      </span>
      <span
        className={`relative inline-flex h-4 w-7 flex-none rounded-full transition ${trackBg}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
            active ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function RoutePanel({
  start,
  end,
  startResolved,
  endResolved,
  mode,
  avoidWater,
  rainFactor,
  weather,
  mockRain,
  showFloodOverlay,
  pickMode,
  onChangeStart,
  onChangeEnd,
  onChangeMode,
  onChangeAvoidWater,
  onChangeMockRain,
  onChangeShowFloodOverlay,
  onChangePickMode,
  onSwap,
  recommended,
  shortest,
  avoided,
  loading,
  error,
}: Props) {
  const isMockSource = weather?.source === 'mock';
  const detour =
    recommended && shortest
      ? recommended.totalDistance - shortest.totalDistance
      : 0;
  return (
    <Card className="space-y-3">
      <CardHeader
        title="路徑規劃"
        description="依即時氣象與校園回報計算最舒適的路徑"
      />

      <RainBanner
        weather={weather}
        rainFactor={rainFactor}
        avoidWater={avoidWater}
        avoided={avoided}
      />

      <MockRainPicker
        value={mockRain}
        onChange={onChangeMockRain}
        isMockSource={isMockSource}
      />

      <div className="space-y-2">
        <EndpointPicker
          label="出發"
          endpoint={start}
          resolved={startResolved}
          pickActive={pickMode === 'start'}
          onChange={onChangeStart}
          onPickFromMap={() =>
            onChangePickMode(pickMode === 'start' ? null : 'start')
          }
        />
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onSwap} type="button">
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2.2} />
            交換起終點
          </Button>
        </div>
        <EndpointPicker
          label="目的地"
          endpoint={end}
          resolved={endResolved}
          pickActive={pickMode === 'end'}
          onChange={onChangeEnd}
          onPickFromMap={() =>
            onChangePickMode(pickMode === 'end' ? null : 'end')
          }
        />
      </div>

      {/* 步行 / 腳踏車 segment */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChangeMode('walk')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium transition-all duration-150 ${
            mode === 'walk'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Footprints className="h-3.5 w-3.5" strokeWidth={2.2} />
          步行
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('bike')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium transition-all duration-150 ${
            mode === 'bike'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bike className="h-3.5 w-3.5" strokeWidth={2.2} />
          腳踏車
        </button>
      </div>

      <ToggleRow
        Icon={CloudRain}
        label="顯示易積水區"
        description="舟山路、小椰林道、醉月湖等"
        active={showFloodOverlay}
        onClick={() => onChangeShowFloodOverlay(!showFloodOverlay)}
        tone="amber"
      />
      <ToggleRow
        Icon={Umbrella}
        label="避水模式"
        description={avoidWater ? '強制走遮蔽 + 繞積水' : '不論雨勢都偏好遮蔽路段'}
        active={avoidWater}
        onClick={() => onChangeAvoidWater(!avoidWater)}
        tone="emerald"
      />

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading && !recommended ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[13px] text-slate-400">
            計算路徑中…
          </div>
        ) : (
          <>
            <PlanSummary
              title="防雨建議"
              tone="green"
              plan={recommended}
              mode={mode}
              hint={
                recommended && shortest && detour > 30
                  ? `比最短路多 ${detour.toFixed(0)} m，但遮蔽率提升 ${(
                      (recommended.coverageScore - shortest.coverageScore) *
                      100
                    ).toFixed(0)}%`
                  : recommended && shortest && detour <= 5
                    ? '最短路本來就是最佳防雨路徑'
                    : undefined
              }
            />
            <PlanSummary
              title="最短路徑"
              tone="gray"
              plan={shortest}
              mode={mode}
            />
          </>
        )}
      </div>
    </Card>
  );
}
