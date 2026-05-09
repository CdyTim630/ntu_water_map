'use client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { CAMPUS_NODES } from '@/lib/campus';
import type {
  Endpoint,
  ResolvedEndpoint,
  AvoidedStats,
  MockRain,
} from '@/app/route/page';
import type { WeatherSnapshot } from '@/lib/weather';

const baseSelect =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

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

/** mock 階段的雨勢模擬器 — 讓使用者快速測試「大雨情境會走怎樣的路」 */
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
  const options: { value: MockRain; label: string; emoji: string }[] = [
    { value: null, label: '自動', emoji: '🔄' },
    { value: 'none', label: '無雨', emoji: '☀️' },
    { value: 'drizzle', label: '毛毛雨', emoji: '🌦' },
    { value: 'light', label: '小雨', emoji: '🌧' },
    { value: 'moderate', label: '中雨', emoji: '⛈' },
    { value: 'heavy', label: '大雨', emoji: '🌊' },
  ];
  return (
    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-amber-900">
          🧪 雨勢模擬（mock 模式）
        </span>
        {value && (
          <span className="text-[10px] text-amber-700">已 override</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value ?? 'auto'}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-1.5 py-1 text-[11px] font-medium transition ${
              value === opt.value
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100'
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtMin(distance: number, mode: 'walk' | 'bike') {
  const speed = mode === 'walk' ? 80 : 200;
  return Math.max(1, Math.round(distance / speed));
}

/** 大雨 / 雨天 / 預期降雨 三段式提示，把演算法在做什麼講白話 */
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

  const config = {
    heavy: {
      bg: 'bg-red-50 border-red-200',
      pill: 'bg-red-600 text-white',
      icon: '⛈',
      title: '大雨警示',
      msg: '已啟動最高避水權重，積水回報附近會強制繞行',
    },
    moderate: {
      bg: 'bg-amber-50 border-amber-200',
      pill: 'bg-amber-500 text-white',
      icon: '🌧',
      title: '雨天模式運作中',
      msg: '優先選擇遮蔽路段，避開易積水區',
    },
    light: {
      bg: 'bg-sky-50 border-sky-200',
      pill: 'bg-sky-500 text-white',
      icon: '🌦',
      title: '輕度降雨',
      msg: '小幅偏好遮蔽路段',
    },
    pop: {
      bg: 'bg-slate-50 border-slate-200',
      pill: 'bg-slate-500 text-white',
      icon: '☁️',
      title: '預期降雨',
      msg: `未來 3 小時降雨機率 ${(weather.pop3h * 100).toFixed(0)}%，可考慮走遮蔽路段`,
    },
    dry: {
      bg: 'bg-emerald-50 border-emerald-200',
      pill: 'bg-emerald-600 text-white',
      icon: '☀️',
      title: '避水模式（手動）',
      msg: '即使無雨也優先選遮蔽路段',
    },
  }[level];

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${config.bg} px-3 py-2`}
    >
      <span
        className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm ${config.pill}`}
      >
        {config.icon}
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">{config.title}</span>
          <span className="text-[10px] text-slate-500">
            雨勢權重 {(rainFactor * 100).toFixed(0)}%
            {avoidWater && ' · 避水模式'}
          </span>
        </div>
        <p className="mt-0.5 text-slate-700">{config.msg}</p>
        {avoided && (avoided.floodReports > 0 || avoided.lowLyingMeters > 5) && (
          <p className="mt-1 rounded-md bg-white/70 px-2 py-1 text-[11px] text-slate-700">
            🛡 已替你避開
            {avoided.floodReports > 0 && (
              <span className="font-semibold text-red-700">
                {' '}
                {avoided.floodReports} 處積水通報
              </span>
            )}
            {avoided.lowLyingMeters > 5 && (
              <span className="font-semibold text-amber-700">
                {' · '}
                {avoided.lowLyingMeters.toFixed(0)} m 易積水路段
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
      <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-400">
        無法找到路徑。
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-1 flex items-center justify-between">
        <Badge tone={tone}>{title}</Badge>
        <span className="text-xs text-slate-500">
          約 {plan.totalDistance.toFixed(0)} m · {fmtMin(plan.totalDistance, mode)} 分鐘
        </span>
      </div>
      {hint && <p className="mb-1 text-[11px] text-slate-500">{hint}</p>}
      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
        <div>
          遮蔽率
          <div
            className={`text-sm font-semibold ${plan.coverageScore > 0.4 ? 'text-emerald-600' : 'text-slate-900'}`}
          >
            {(plan.coverageScore * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          易積水
          <div
            className={`text-sm font-semibold ${plan.lowLyingShare > 0.3 ? 'text-red-600' : 'text-slate-900'}`}
          >
            {(plan.lowLyingShare * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          途中積水回報
          <div
            className={`text-sm font-semibold ${plan.passingFloodReports > 0 ? 'text-amber-600' : 'text-slate-900'}`}
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
        <span className="text-xs text-slate-600">{label}</span>
        {isPin && (
          <Badge tone="blue">
            自訂點 {resolved ? `(${resolved.lat.toFixed(4)}, ${resolved.lng.toFixed(4)})` : ''}
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
            自訂點（{resolved?.lat.toFixed(4)}, {resolved?.lng.toFixed(4)}）
          </option>
        )}
        {CAMPUS_NODES.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
      <div className="mt-1.5">
        <button
          type="button"
          onClick={onPickFromMap}
          className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            pickActive
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600'
          }`}
        >
          {pickActive
            ? `🎯 點地圖任一處設為${label === '出發' ? '起點' : '終點'}…`
            : `📍 在地圖上點選${label === '出發' ? '起點' : '終點'}`}
        </button>
      </div>
    </div>
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
        description="依即時氣象與校園回報計算最舒適的路徑。"
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
            ↕ 交換起終點
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

      <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChangeMode('walk')}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
            mode === 'walk'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🚶 步行
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('bike')}
          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
            mode === 'bike'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🚲 腳踏車
        </button>
      </div>

      {/* 顯示易積水區 toggle — 把 flood-areas.json 裡的多邊形 / 沿路 buffer 畫到地圖 */}
      <button
        type="button"
        onClick={() => onChangeShowFloodOverlay(!showFloodOverlay)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-xs transition ${
          showFloodOverlay
            ? 'border-amber-300 bg-amber-50 text-amber-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🌧</span>
          <span className="text-left">
            <span className="font-semibold">顯示易積水區</span>
            <span className="ml-1 text-[10px] text-slate-500">
              （含舟山路、小椰林道、醉月湖等）
            </span>
          </span>
        </span>
        <span
          className={`relative inline-flex h-4 w-7 rounded-full transition ${
            showFloodOverlay ? 'bg-amber-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
              showFloodOverlay ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {/* 避水模式 toggle — 強制把雨勢權重拉到 ≥ 0.85，即使大晴天也偏好遮蔽 */}
      <button
        type="button"
        onClick={() => onChangeAvoidWater(!avoidWater)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
          avoidWater
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🛡</span>
          <span className="text-left">
            <span className="font-semibold">避水模式</span>
            <span className="ml-1 text-[10px] text-slate-500">
              {avoidWater ? '已啟動：強制走遮蔽 + 繞積水' : '不論雨勢都偏好遮蔽路段'}
            </span>
          </span>
        </span>
        <span
          className={`relative inline-flex h-4 w-7 rounded-full transition ${
            avoidWater ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
              avoidWater ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading && !recommended ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
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
                  ? `比最短路多走 ${detour.toFixed(0)} m，但遮蔽率提升 ${(
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
