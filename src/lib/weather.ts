/**
 * 中央氣象署 OpenData 串接
 * 申請金鑰：https://opendata.cwa.gov.tw/userLogin
 *
 * 主要使用兩支 API：
 * - F-D0047-061：臺北市鄉鎮天氣預報（包含逐 3 小時 PoP6h、Wx、T、RH）
 * - O-A0003-001：自動氣象站-現在天氣觀測（中央大學站 466920 / 觀測 466921 等）
 *
 * 沒有 CWA_API_KEY 時自動走 mock，介面與資料結構一致。
 */

export type RainIntensity =
  | 'none' // 0 - 不下雨
  | 'drizzle' // 1 - 毛毛雨
  | 'light' // 2 - 小雨
  | 'moderate' // 3 - 中雨
  | 'heavy'; // 4 - 大雨以上

export interface WeatherSnapshot {
  source: 'cwa' | 'mock';
  /** 觀測或預報時間 */
  observedAt: string;
  /** 即時氣溫（攝氏） */
  temperature: number | null;
  /** 即時相對溼度 (%) */
  humidity: number | null;
  /** 即時 1 小時雨量 (mm) */
  rainfall1h: number | null;
  /** 0~1，當前是否下雨 */
  isRaining: boolean;
  /** 0~4，目前雨勢強度 */
  rainIntensity: RainIntensity;
  /** 0~1，未來 3 小時降雨機率（% / 100） */
  pop3h: number;
  /** 文字描述（晴、多雲、短暫雨…） */
  description: string;
}

const TAIPEI_CITY = '臺北市';
// 大安區覆蓋台大主校區
const TAIPEI_TOWN = '大安區';

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';

function classifyIntensity(mm1h: number | null): RainIntensity {
  if (mm1h === null || mm1h <= 0) return 'none';
  if (mm1h < 0.5) return 'drizzle';
  if (mm1h < 2) return 'light';
  if (mm1h < 10) return 'moderate';
  return 'heavy';
}

export function intensityScore(i: RainIntensity): number {
  switch (i) {
    case 'none':
      return 0;
    case 'drizzle':
      return 0.2;
    case 'light':
      return 0.45;
    case 'moderate':
      return 0.75;
    case 'heavy':
      return 1.0;
  }
}

export const RAIN_INTENSITY_LABEL: Record<RainIntensity, string> = {
  none: '無雨',
  drizzle: '毛毛雨',
  light: '小雨',
  moderate: '中雨',
  heavy: '大雨',
};

function mockWeather(): WeatherSnapshot {
  // 用日期決定當日天氣（避免每次重整都不同），但仍有合理變化。
  const day = new Date();
  const seed = day.getDate() + day.getMonth();
  const cycle = seed % 5;
  const mocks: WeatherSnapshot[] = [
    {
      source: 'mock',
      observedAt: day.toISOString(),
      temperature: 28,
      humidity: 65,
      rainfall1h: 0,
      isRaining: false,
      rainIntensity: 'none',
      pop3h: 0.1,
      description: '晴時多雲',
    },
    {
      source: 'mock',
      observedAt: day.toISOString(),
      temperature: 25,
      humidity: 82,
      rainfall1h: 0.3,
      isRaining: true,
      rainIntensity: 'drizzle',
      pop3h: 0.6,
      description: '陰短暫雨',
    },
    {
      source: 'mock',
      observedAt: day.toISOString(),
      temperature: 24,
      humidity: 88,
      rainfall1h: 1.5,
      isRaining: true,
      rainIntensity: 'light',
      pop3h: 0.8,
      description: '小雨',
    },
    {
      source: 'mock',
      observedAt: day.toISOString(),
      temperature: 23,
      humidity: 90,
      rainfall1h: 6,
      isRaining: true,
      rainIntensity: 'moderate',
      pop3h: 0.9,
      description: '雨勢加大',
    },
    {
      source: 'mock',
      observedAt: day.toISOString(),
      temperature: 22,
      humidity: 95,
      rainfall1h: 18,
      isRaining: true,
      rainIntensity: 'heavy',
      pop3h: 0.95,
      description: '大雨特報',
    },
  ];
  return mocks[cycle];
}

interface CWAObservationResponse {
  records?: {
    Station?: {
      StationName?: string;
      ObsTime?: { DateTime?: string };
      WeatherElement?: {
        Now?: { Precipitation?: number };
        AirTemperature?: number;
        RelativeHumidity?: number;
        Weather?: string;
      };
    }[];
  };
}

interface CWAForecastResponse {
  records?: {
    locations?: {
      location?: {
        locationName?: string;
        weatherElement?: {
          elementName?: string;
          time?: {
            startTime?: string;
            endTime?: string;
            elementValue?: { value?: string }[];
          }[];
        }[];
      }[];
    }[];
  };
}

async function fetchCWAObservation(
  apiKey: string,
): Promise<Partial<WeatherSnapshot>> {
  const url = new URL(`${CWA_BASE}/O-A0003-001`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('StationName', '臺北');
  url.searchParams.set('format', 'JSON');
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CWA observation HTTP ${res.status}`);
  const data = (await res.json()) as CWAObservationResponse;
  const station = data.records?.Station?.[0];
  if (!station) return {};
  const we = station.WeatherElement ?? {};
  return {
    observedAt: station.ObsTime?.DateTime ?? new Date().toISOString(),
    temperature:
      typeof we.AirTemperature === 'number' && we.AirTemperature > -90
        ? we.AirTemperature
        : null,
    humidity:
      typeof we.RelativeHumidity === 'number' && we.RelativeHumidity >= 0
        ? we.RelativeHumidity
        : null,
    rainfall1h:
      typeof we.Now?.Precipitation === 'number' && we.Now.Precipitation >= 0
        ? we.Now.Precipitation
        : 0,
    description: we.Weather ?? '',
  };
}

async function fetchCWAForecast(apiKey: string): Promise<Partial<WeatherSnapshot>> {
  const url = new URL(`${CWA_BASE}/F-D0047-061`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('LocationName', TAIPEI_TOWN);
  url.searchParams.set('format', 'JSON');
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`CWA forecast HTTP ${res.status}`);
  const data = (await res.json()) as CWAForecastResponse;
  const locs = data.records?.locations?.[0]?.location ?? [];
  const target = locs.find((l) => l.locationName === TAIPEI_TOWN) ?? locs[0];
  if (!target) return {};
  const els = target.weatherElement ?? [];
  const pop = els.find((e) => e.elementName === 'PoP6h' || e.elementName === 'PoP12h');
  const wx = els.find((e) => e.elementName === 'Wx');
  const popValueRaw = pop?.time?.[0]?.elementValue?.[0]?.value ?? '0';
  const popPercent = Number.parseFloat(popValueRaw);
  return {
    pop3h: Number.isFinite(popPercent) ? popPercent / 100 : 0,
    description: wx?.time?.[0]?.elementValue?.[0]?.value ?? undefined,
  };
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) {
    return mockWeather();
  }
  try {
    const [obs, fc] = await Promise.all([
      fetchCWAObservation(apiKey).catch(() => ({})),
      fetchCWAForecast(apiKey).catch(() => ({})),
    ]);
    const rainfall1h = obs.rainfall1h ?? null;
    const intensity = classifyIntensity(rainfall1h);
    return {
      source: 'cwa',
      observedAt: obs.observedAt ?? new Date().toISOString(),
      temperature: obs.temperature ?? null,
      humidity: obs.humidity ?? null,
      rainfall1h,
      isRaining: rainfall1h !== null && rainfall1h > 0,
      rainIntensity: intensity,
      pop3h: fc.pop3h ?? 0,
      description: fc.description ?? obs.description ?? '',
    };
  } catch {
    return mockWeather();
  }
}

/**
 * 給路徑規劃用的「雨勢係數」。會結合即時雨量 + 短期降雨機率，
 * 產生 0..1 的數值；下大雨時接近 1，晴天接近 0。
 */
export function rainPenaltyFactor(w: WeatherSnapshot): number {
  const intensity = intensityScore(w.rainIntensity);
  // 即使現在沒下雨，但 PoP 高仍要稍微偏好遮蔽路徑
  const popInfluence = w.pop3h * 0.5;
  return Math.min(1, intensity + (intensity === 0 ? popInfluence : 0));
}

export { TAIPEI_CITY, TAIPEI_TOWN };
