import { NextRequest, NextResponse } from 'next/server';
import {
  planDenseRoute,
  type DensePlan,
  type DenseRouteOptions,
  type TravelMode,
} from '@/lib/denseGraph';
import { dataApi } from '@/lib/supabase';
import {
  fetchWeather,
  rainPenaltyFactor,
  type RainIntensity,
  type WeatherSnapshot,
} from '@/lib/weather';

export const dynamic = 'force-dynamic';

type MockRain = 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy';

interface ReqBody {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  mode: TravelMode;
  avoidWater?: boolean;
  /** mock 模式時 override 雨勢，方便使用者測試大雨情境 */
  mockRain?: MockRain | null;
}

/** 把 mockRain 套到原本 weather 上，產一個改寫過的 snapshot */
function applyMockRain(base: WeatherSnapshot, m: MockRain): WeatherSnapshot {
  const mapping: Record<
    MockRain,
    { mm: number; intensity: RainIntensity; pop3h: number; desc: string }
  > = {
    none: { mm: 0, intensity: 'none', pop3h: 0.05, desc: '☀️ 模擬：無雨' },
    drizzle: { mm: 0.3, intensity: 'drizzle', pop3h: 0.55, desc: '🌦 模擬：毛毛雨' },
    light: { mm: 1.5, intensity: 'light', pop3h: 0.8, desc: '🌧 模擬：小雨' },
    moderate: { mm: 6, intensity: 'moderate', pop3h: 0.9, desc: '⛈ 模擬：中雨' },
    heavy: { mm: 18, intensity: 'heavy', pop3h: 0.95, desc: '🌊 模擬：大雨' },
  };
  const pick = mapping[m];
  return {
    ...base,
    rainfall1h: pick.mm,
    isRaining: pick.mm > 0,
    rainIntensity: pick.intensity,
    pop3h: pick.pop3h,
    description: pick.desc,
  };
}

export async function POST(req: NextRequest) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (
    !body.start ||
    !body.end ||
    typeof body.start.lat !== 'number' ||
    typeof body.start.lng !== 'number' ||
    typeof body.end.lat !== 'number' ||
    typeof body.end.lng !== 'number'
  ) {
    return NextResponse.json(
      { error: 'start.lat / start.lng / end.lat / end.lng required' },
      { status: 400 },
    );
  }
  const mode: TravelMode = body.mode === 'bike' ? 'bike' : 'walk';
  const avoidWater = !!body.avoidWater;

  try {
    const [rawWeather, reports] = await Promise.all([
      fetchWeather(),
      dataApi.listReports().catch(() => []),
    ]);

    // mock 階段允許 override 雨勢；真實 CWA 來源會忽略 mockRain
    const weather =
      rawWeather.source === 'mock' && body.mockRain
        ? applyMockRain(rawWeather, body.mockRain)
        : rawWeather;

    const baseOpts: DenseRouteOptions = { mode, weather, reports, avoidWater };

    const recommended = planDenseRoute(
      body.start.lat,
      body.start.lng,
      body.end.lat,
      body.end.lng,
      baseOpts,
    );
    const shortest = planDenseRoute(
      body.start.lat,
      body.start.lng,
      body.end.lat,
      body.end.lng,
      { ...baseOpts, ignoreWeather: true },
    );

    // 對比指標：相對於最短路徑，推薦路徑「避開」了多少風險
    // 用集合差比 unique id：避免「最短路 5 unique floods、推薦路 5 unique floods」=> avoided=0 的假象，
    // 實際對比的是「兩條路各自會碰到的不同 report」
    const shortestIds = new Set(shortest?.passingFloodReportIds ?? []);
    const recIds = new Set(recommended?.passingFloodReportIds ?? []);
    let avoidedReports = 0;
    for (const id of shortestIds) if (!recIds.has(id)) avoidedReports++;
    const shortestLowMeters =
      (shortest?.lowLyingShare ?? 0) * (shortest?.totalDistance ?? 0);
    const recLowMeters =
      (recommended?.lowLyingShare ?? 0) * (recommended?.totalDistance ?? 0);
    const avoided = {
      floodReports: avoidedReports,
      lowLyingMeters: Math.max(0, shortestLowMeters - recLowMeters),
      detourMeters:
        (recommended?.totalDistance ?? 0) - (shortest?.totalDistance ?? 0),
      coverageGain:
        (recommended?.coverageScore ?? 0) - (shortest?.coverageScore ?? 0),
    };
    const rainFactor = rainPenaltyFactor(weather);

    return NextResponse.json({
      weather,
      rainFactor,
      avoidWater,
      recommended,
      shortest,
      avoided,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export type RouteApiResponse = {
  weather: Awaited<ReturnType<typeof fetchWeather>>;
  rainFactor: number;
  avoidWater: boolean;
  recommended: DensePlan | null;
  shortest: DensePlan | null;
  avoided: {
    floodReports: number;
    lowLyingMeters: number;
    detourMeters: number;
    coverageGain: number;
  };
};
