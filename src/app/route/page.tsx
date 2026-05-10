'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { RoutePanel } from '@/components/route/RoutePanel';
import { WeatherBadge } from '@/components/route/WeatherBadge';
import { CAMPUS_NODES, getNode } from '@/lib/campus';
import type { Report } from '@/lib/types';
import type { WeatherSnapshot } from '@/lib/weather';
import type { PlanSegment } from '@/lib/denseGraph';

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-slate-100 text-sm text-slate-500">
      地圖載入中…
    </div>
  ),
});

export interface ApiPlan {
  coords: [number, number][];
  segments: PlanSegment[];
  totalDistance: number;
  totalCost: number;
  coverageScore: number;
  lowLyingShare: number;
  passingFloodReports: number;
  startVertex: { lat: number; lng: number };
  endVertex: { lat: number; lng: number };
}

export interface AvoidedStats {
  floodReports: number;
  lowLyingMeters: number;
  detourMeters: number;
  coverageGain: number;
}

interface ApiResp {
  weather: WeatherSnapshot;
  rainFactor: number;
  avoidWater: boolean;
  recommended: ApiPlan | null;
  shortest: ApiPlan | null;
  avoided: AvoidedStats;
}

export type MockRain = null | 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy';

export type Endpoint =
  | { kind: 'landmark'; id: string }
  | { kind: 'pin'; lat: number; lng: number };

export interface ResolvedEndpoint {
  lat: number;
  lng: number;
  label: string;
  kind: 'landmark' | 'pin';
}

function resolveEndpoint(ep: Endpoint): ResolvedEndpoint | null {
  if (ep.kind === 'landmark') {
    const n = getNode(ep.id);
    if (!n) return null;
    return { lat: n.lat, lng: n.lng, label: n.name, kind: 'landmark' };
  }
  return {
    lat: ep.lat,
    lng: ep.lng,
    label: `自訂點 (${ep.lat.toFixed(5)}, ${ep.lng.toFixed(5)})`,
    kind: 'pin',
  };
}

export default function RoutePage() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [rainFactor, setRainFactor] = useState<number>(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [start, setStart] = useState<Endpoint>({
    kind: 'landmark',
    id: 'main_gate',
  });
  const [end, setEnd] = useState<Endpoint>({
    kind: 'landmark',
    id: 'engineering',
  });
  const [mode, setMode] = useState<'walk' | 'bike'>('walk');
  const [avoidWater, setAvoidWater] = useState(false);
  const [pickMode, setPickMode] = useState<null | 'start' | 'end'>(null);
  /** mock 階段的雨勢 override；null = 用即時 / cycled mock */
  const [mockRain, setMockRain] = useState<null | 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy'>(null);
  const [showFloodOverlay, setShowFloodOverlay] = useState(true);

  const [recommended, setRecommended] = useState<ApiPlan | null>(null);
  const [shortest, setShortest] = useState<ApiPlan | null>(null);
  const [avoided, setAvoided] = useState<AvoidedStats | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const startResolved = useMemo(() => resolveEndpoint(start), [start]);
  const endResolved = useMemo(() => resolveEndpoint(end), [end]);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch('/api/reports', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { reports: Report[] };
        setReports(data.reports);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!startResolved || !endResolved) return;
    const ctrl = new AbortController();
    let cancelled = false;
    setRouting(true);
    setRouteError(null);
    fetch('/api/route', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        start: { lat: startResolved.lat, lng: startResolved.lng },
        end: { lat: endResolved.lat, lng: endResolved.lng },
        mode,
        avoidWater,
        mockRain,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ApiResp;
      })
      .then((data) => {
        if (cancelled) return;
        setWeather(data.weather);
        setRainFactor(data.rainFactor);
        setRecommended(data.recommended);
        setShortest(data.shortest);
        setAvoided(data.avoided);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setRouteError(e instanceof Error ? e.message : '路徑計算失敗');
      })
      .finally(() => {
        if (!cancelled) setRouting(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [startResolved, endResolved, mode, avoidWater, mockRain]);

  // 5 分鐘自動 refresh weather
  useEffect(() => {
    const t = setInterval(() => {
      fetch('/api/weather', { cache: 'no-store' })
        .then((r) => r.json())
        .then((w: WeatherSnapshot) => setWeather(w))
        .catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const handleMapPick = useCallback(
    (lat: number, lng: number) => {
      if (pickMode === 'start') {
        setStart({ kind: 'pin', lat, lng });
      } else if (pickMode === 'end') {
        setEnd({ kind: 'pin', lat, lng });
      }
      setPickMode(null);
    },
    [pickMode],
  );

  return (
    <div className="px-4 py-4 sm:px-6 space-y-3 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          雨天路徑規劃
        </h1>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          結合即時氣象與校園積水回報，導航最少淋雨的走法。
          可從 {CAMPUS_NODES.length} 個地標選起終點，或直接在地圖上點選任意位置。
        </p>
      </div>

      <WeatherBadge weather={weather} loading={routing && !weather} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        <RoutePanel
          start={start}
          end={end}
          startResolved={startResolved}
          endResolved={endResolved}
          mode={mode}
          avoidWater={avoidWater}
          rainFactor={rainFactor}
          weather={weather}
          mockRain={mockRain}
          showFloodOverlay={showFloodOverlay}
          pickMode={pickMode}
          onChangeStart={setStart}
          onChangeEnd={setEnd}
          onChangeMode={setMode}
          onChangeAvoidWater={setAvoidWater}
          onChangeMockRain={setMockRain}
          onChangeShowFloodOverlay={setShowFloodOverlay}
          onChangePickMode={setPickMode}
          onSwap={() => {
            setStart(end);
            setEnd(start);
          }}
          recommended={recommended}
          shortest={shortest}
          avoided={avoided}
          loading={routing}
          error={routeError}
        />
        <Card className="overflow-hidden p-0">
          <div
            className={`relative h-[60vh] min-h-[460px] lg:h-[calc(100vh-220px)] ${
              pickMode ? 'cursor-crosshair' : ''
            }`}
          >
            <RouteMap
              recommended={recommended}
              shortest={shortest}
              reports={reports}
              startResolved={startResolved}
              endResolved={endResolved}
              pickMode={pickMode}
              rainFactor={rainFactor}
              showFloodOverlay={showFloodOverlay}
              onMapPick={handleMapPick}
            />
            {pickMode && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
                點地圖任一處設為{pickMode === 'start' ? '起點' : '終點'}
                <span
                  className="pointer-events-auto ml-2 cursor-pointer underline"
                  onClick={() => setPickMode(null)}
                >
                  取消
                </span>
              </div>
            )}
            {routing && !pickMode && (
              <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-full bg-white/95 px-3 py-1 text-[11px] text-slate-500 shadow-sm ring-1 ring-slate-200">
                正在計算路徑…
              </div>
            )}
            <RouteLegend />
          </div>
        </Card>
      </div>
    </div>
  );
}

function RouteLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex max-w-[420px] flex-col gap-1 text-[11px] leading-tight text-slate-700">
      <div className="pointer-events-auto rounded-xl bg-white/95 p-2 shadow-sm ring-1 ring-slate-200">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          路徑圖例
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <LegendRow color="#0f766e" label="完全遮蔽段" />
          <LegendRow color="#10b981" label="一般路段" />
          <LegendRow color="#f59e0b" label="易積水路段" />
          <LegendRow color="#dc2626" label="積水回報附近" pulse />
          <LegendRow color="#64748b" label="最短路徑（虛線）" dashed />
          <LegendRow color="#10b981" label="點選位置 → 路網" thinDash />
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  dashed,
  thinDash,
  pulse,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  thinDash?: boolean;
  pulse?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={pulse ? 'animate-pulse' : ''}
        style={{
          background: thinDash ? 'transparent' : color,
          width: 22,
          height: thinDash ? 0 : dashed ? 0 : 4,
          borderTop: thinDash ? `2px dotted ${color}` : dashed ? `3px dashed ${color}` : 'none',
          borderRadius: 2,
        }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
