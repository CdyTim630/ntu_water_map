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
  /** 多時段預報序列（CWA F-D0047-061 PoP6h × Wx 合成；mock 也會產一份簡化版） */
  forecastSeries: ForecastSlot[];
}

/** 一段時間視窗的預報，給 forecast.ts 做 1h/3h/6h horizon 對齊 */
export interface ForecastSlot {
  /** ISO8601 — slot 開始時間 */
  startTime: string;
  /** ISO8601 — slot 結束時間 */
  endTime: string;
  /** 0~1 降雨機率（PoP）；CWA PoP6h 套用整個 6 小時視窗 */
  pop: number;
  /** Wx 文字（如「陰短暫陣雨」），mock 模式也會給一個 */
  wx: string | null;
  /** 由 Wx 推得的雨勢強度提示，給 horizon 計算用 */
  intensityHint: RainIntensity;
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
  const baseList: Omit<WeatherSnapshot, 'forecastSeries'>[] = [
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
  const base = baseList[cycle];
  return { ...base, forecastSeries: synthesizeMockSeries(base) };
}

/**
 * Mock 模式生成簡化版 forecast series：
 * 取當下 weather 為 0–3h，3–6h 機率略衰減（模擬「不確定性增加」），
 * 6–9h 進一步衰減；雨勢分類維持當下推估。
 *
 * 真實 CWA 路徑會 override 這個（fetchCWAForecastSeries 回傳完整 24h 序列）。
 *
 * Exported 給 applyMockRain 用：mockRain override 時要同步重生 series，
 * 否則 forecast.ts 會吃到舊 weather 對應的 series，跟新雨勢不一致。
 */
export function synthesizeMockSeries(
  base: Omit<WeatherSnapshot, 'forecastSeries'>,
): ForecastSlot[] {
  const start = new Date();
  const isoOff = (h: number) =>
    new Date(start.getTime() + h * 3600 * 1000).toISOString();
  return [
    {
      startTime: isoOff(0),
      endTime: isoOff(3),
      pop: base.pop3h,
      wx: base.description || null,
      intensityHint: base.rainIntensity,
    },
    {
      startTime: isoOff(3),
      endTime: isoOff(6),
      pop: Math.max(0, base.pop3h * 0.85),
      wx: base.description || null,
      intensityHint: base.rainIntensity,
    },
    {
      startTime: isoOff(6),
      endTime: isoOff(9),
      pop: Math.max(0, base.pop3h * 0.7 + 0.05),
      wx: base.description || null,
      intensityHint: base.rainIntensity,
    },
  ];
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

/**
 * 把 CWA Wx 文字（如「陰短暫陣雨」「午後短暫雷陣雨」「大雨」）粗略對應到 RainIntensity。
 * 順序：先嚴重 → 後輕；只要碰到關鍵字就回傳。
 */
function wxToIntensity(wx: string | null | undefined): RainIntensity {
  if (!wx) return 'none';
  if (wx.includes('豪雨')) return 'heavy'; // 豪雨 / 大豪雨 / 超大豪雨
  if (wx.includes('大雨')) return 'heavy'; // CWA 定義 80mm/24h
  if (wx.includes('雷')) return 'moderate'; // 雷雨 / 雷陣雨
  if (wx.includes('陣雨')) return 'moderate';
  if (wx.includes('毛毛雨')) return 'drizzle';
  if (wx.includes('短暫雨')) return 'light';
  if (wx.includes('雨')) return 'light'; // 兜底
  return 'none';
}

interface CWATimeEntry {
  startTime?: string;
  endTime?: string;
  /** 部分 element 用 dataTime（瞬間時刻），但 PoP6h / Wx 都是 startTime/endTime */
  dataTime?: string;
  elementValue?: { value?: string }[];
}

interface CWAWeatherElement {
  elementName?: string;
  time?: CWATimeEntry[];
}

interface CWALocationFull {
  locationName?: string;
  weatherElement?: CWAWeatherElement[];
}

/**
 * 抓 CWA F-D0047-061 完整序列：PoP6h（4 個 6h slot）× Wx（8 個 3h slot），merge 成 8 段。
 *
 * Returns: 0~24h 內、每 3h 一段的 ForecastSlot[]，依時間排序。
 * pop 值由 PoP6h 對應到該 3h slot 的母窗（同一個 6h 母窗的兩段 3h 子窗共用同一個 pop）。
 */
async function fetchCWAForecastSeries(apiKey: string): Promise<ForecastSlot[]> {
  const url = new URL(`${CWA_BASE}/F-D0047-061`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('LocationName', TAIPEI_TOWN);
  url.searchParams.set(
    'ElementName',
    ['天氣現象', '6小時降雨機率', '12小時降雨機率'].join(','),
  );
  url.searchParams.set('format', 'JSON');
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`CWA forecast HTTP ${res.status}`);
  const data = (await res.json()) as {
    records?: { Locations?: { Location?: CWALocationFull[] }[]; locations?: { location?: CWALocationFull[] }[] };
  };
  // CWA 在 2024 把 records 改用首字大寫（Locations / Location），但部分 dataset 仍混用，雙路徑並讀
  const locs =
    data.records?.Locations?.[0]?.Location ??
    data.records?.locations?.[0]?.location ??
    [];
  const target =
    locs.find((l) => l.locationName === TAIPEI_TOWN) ?? locs[0];
  if (!target) return [];
  const els = target.weatherElement ?? [];

  const wxEl = els.find(
    (e) => e.elementName === 'Wx' || e.elementName === '天氣現象',
  );
  const pop6El = els.find(
    (e) => e.elementName === 'PoP6h' || e.elementName === '6小時降雨機率',
  );
  const pop12El = els.find(
    (e) => e.elementName === 'PoP12h' || e.elementName === '12小時降雨機率',
  );

  const wxSlots = (wxEl?.time ?? []).filter(
    (t): t is Required<Pick<CWATimeEntry, 'startTime' | 'endTime'>> & CWATimeEntry =>
      Boolean(t.startTime && t.endTime),
  );
  if (!wxSlots.length) return [];

  // 把 PoP6h（或 12h fallback）的時間區間做成 [start..end, percent] 列表
  type PopWindow = { start: number; end: number; pop: number };
  const popWindows: PopWindow[] = [];
  const addPopWindows = (el?: CWAWeatherElement) => {
    if (!el?.time) return;
    for (const t of el.time) {
      if (!t.startTime || !t.endTime) continue;
      const raw = t.elementValue?.[0]?.value;
      const pct = raw ? Number.parseFloat(raw) : NaN;
      if (!Number.isFinite(pct)) continue;
      popWindows.push({
        start: new Date(t.startTime).getTime(),
        end: new Date(t.endTime).getTime(),
        pop: Math.max(0, Math.min(1, pct / 100)),
      });
    }
  };
  addPopWindows(pop6El);
  if (!popWindows.length) addPopWindows(pop12El); // 沒 6h 才退而求其次

  function findPopForSlot(s: number, e: number): number {
    // 該 slot 落在哪個 PoP 窗：取重疊時間最長的那個
    let best: PopWindow | null = null;
    let bestOverlap = 0;
    for (const w of popWindows) {
      const overlap = Math.max(0, Math.min(w.end, e) - Math.max(w.start, s));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = w;
      }
    }
    return best?.pop ?? 0;
  }

  return wxSlots
    .map((t) => {
      const wx = t.elementValue?.[0]?.value ?? null;
      const startMs = new Date(t.startTime).getTime();
      const endMs = new Date(t.endTime).getTime();
      return {
        startTime: t.startTime,
        endTime: t.endTime,
        pop: findPopForSlot(startMs, endMs),
        wx,
        intensityHint: wxToIntensity(wx),
      } satisfies ForecastSlot;
    })
    // 排序時間升冪
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) {
    return mockWeather();
  }
  try {
    const [obs, series] = await Promise.all([
      fetchCWAObservation(apiKey).catch(() => ({} as Partial<WeatherSnapshot>)),
      fetchCWAForecastSeries(apiKey).catch(() => [] as ForecastSlot[]),
    ]);
    const rainfall1h = obs.rainfall1h ?? null;
    const intensity = classifyIntensity(rainfall1h);
    // pop3h 取 series 第一段（0–3h）的 pop；沒 series 退到 0
    const firstSlot = series[0];
    const pop3h = firstSlot ? firstSlot.pop : 0;
    // description 優先用即時觀測 → 第一段 forecast Wx
    const description = obs.description || firstSlot?.wx || '';
    return {
      source: 'cwa',
      observedAt: obs.observedAt ?? new Date().toISOString(),
      temperature: obs.temperature ?? null,
      humidity: obs.humidity ?? null,
      rainfall1h,
      isRaining: rainfall1h !== null && rainfall1h > 0,
      rainIntensity: intensity,
      pop3h,
      description,
      forecastSeries: series,
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
