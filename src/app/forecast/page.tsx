'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ForecastPanel, type MockRain } from '@/components/forecast/ForecastPanel';
import type {
  ForecastCell,
  ForecastHotspot,
  ForecastResult,
  Horizon,
  HorizonForecast,
} from '@/lib/forecast';
import type { Report } from '@/lib/types';
import type { WeatherSnapshot } from '@/lib/weather';

const ForecastMap = dynamic(() => import('@/components/map/ForecastMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-slate-100 text-sm text-slate-500">
      地圖載入中…
    </div>
  ),
});

export default function ForecastPage() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [horizons, setHorizons] = useState<HorizonForecast[]>([]);
  const [cells, setCells] = useState<ForecastCell[]>([]);
  const [hotspots, setHotspots] = useState<ForecastHotspot[]>([]);
  const [cellLatStep, setCellLatStep] = useState(0);
  const [cellLngStep, setCellLngStep] = useState(0);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState<Horizon>('3h');
  const [mockRain, setMockRain] = useState<MockRain>(null);
  const [showBaseFloodAreas, setShowBaseFloodAreas] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 地圖選中熱點時的閃爍效果用（簡單做法：把 hotspot 提到清單頂端 / 維持 popup）
  const lastSelectedRef = useRef<string | null>(null);

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

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/forecast', window.location.origin);
      if (mockRain) url.searchParams.set('mockRain', mockRain);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ForecastResult;
      setWeather(data.weather);
      setGeneratedAt(data.generatedAt);
      setHorizons(data.horizons);
      setCells(data.cells);
      setHotspots(data.hotspots);
      setCellLatStep(data.cellLatStep);
      setCellLngStep(data.cellLngStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : '預測載入失敗');
    } finally {
      setLoading(false);
    }
  }, [mockRain]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  // 5 分鐘自動重新預測（沿用 /route 的 cadence）
  useEffect(() => {
    const t = setInterval(() => {
      loadForecast();
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadForecast]);

  // cells 數量（給 panel 顯示）
  const visibleCellCount = useMemo(() => {
    if (!cells.length) return 0;
    return cells.filter((c) => (c.scores[selectedHorizon] ?? 0) >= 0.15).length;
  }, [cells, selectedHorizon]);

  const handleSelectHotspot = useCallback((h: ForecastHotspot) => {
    lastSelectedRef.current = `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`;
  }, []);

  return (
    <div className="px-4 py-4 sm:px-6 space-y-3 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          水災預警地圖
        </h1>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          融合 90 天回報密度、OSM 低窪標記與即時氣象，推估校園各區未來 1 / 3 / 6 小時積水機率。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
        <ForecastPanel
          weather={weather}
          generatedAt={generatedAt}
          horizons={horizons}
          hotspots={hotspots}
          selectedHorizon={selectedHorizon}
          onSelectHorizon={setSelectedHorizon}
          mockRain={mockRain}
          onChangeMockRain={setMockRain}
          showBaseFloodAreas={showBaseFloodAreas}
          onToggleBaseFloodAreas={setShowBaseFloodAreas}
          onSelectHotspot={handleSelectHotspot}
          loading={loading}
          error={error}
          cellsRendered={visibleCellCount}
        />

        <Card className="overflow-hidden p-0">
          <div className="relative h-[60vh] min-h-[460px] lg:h-[calc(100vh-220px)]">
            <ForecastMap
              cells={cells}
              hotspots={hotspots}
              cellLatStep={cellLatStep}
              cellLngStep={cellLngStep}
              horizon={selectedHorizon}
              reports={reports}
              showBaseFloodAreas={showBaseFloodAreas}
              onSelectHotspot={handleSelectHotspot}
            />
            {loading && (
              <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-full bg-white/95 px-3 py-1 text-[11px] text-slate-500 shadow-sm ring-1 ring-slate-200">
                重新預測中…
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
