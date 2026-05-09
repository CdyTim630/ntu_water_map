import { NextRequest, NextResponse } from 'next/server';
import { computeForecast, type ForecastResult } from '@/lib/forecast';
import { dataApi } from '@/lib/supabase';
import {
  fetchWeather,
  synthesizeMockSeries,
  type RainIntensity,
  type WeatherSnapshot,
} from '@/lib/weather';

export const dynamic = 'force-dynamic';

type MockRain = 'none' | 'drizzle' | 'light' | 'moderate' | 'heavy';

/** 與 /api/route 同邏輯：mock 模式下允許 override 雨勢方便測試 */
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
  const next: WeatherSnapshot = {
    ...base,
    rainfall1h: pick.mm,
    isRaining: pick.mm > 0,
    rainIntensity: pick.intensity,
    pop3h: pick.pop3h,
    description: pick.desc,
    forecastSeries: synthesizeMockSeries({
      ...base,
      rainfall1h: pick.mm,
      isRaining: pick.mm > 0,
      rainIntensity: pick.intensity,
      pop3h: pick.pop3h,
      description: pick.desc,
    }),
  };
  return next;
}

function parseMockRain(v: string | null): MockRain | null {
  if (!v) return null;
  if (
    v === 'none' ||
    v === 'drizzle' ||
    v === 'light' ||
    v === 'moderate' ||
    v === 'heavy'
  ) {
    return v;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const mockRain = parseMockRain(req.nextUrl.searchParams.get('mockRain'));

    const [rawWeather, reports] = await Promise.all([
      fetchWeather(),
      dataApi.listReports().catch(() => []),
    ]);

    const weather =
      rawWeather.source === 'mock' && mockRain
        ? applyMockRain(rawWeather, mockRain)
        : rawWeather;

    const result = computeForecast({ weather, reports });

    return NextResponse.json(result satisfies ForecastResult);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export type ForecastApiResponse = ForecastResult;
