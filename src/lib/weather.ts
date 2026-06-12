/**
 * 中央氣象署 OpenData 串接
 * 申請金鑰：https://opendata.cwa.gov.tw/userLogin
 *
 * 主要使用兩支 API：
 * - F-D0047-061：臺北市鄉鎮天氣預報（包含逐 3 小時 Wx、PoP、T、RH）
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
  /** 多時段預報序列（CWA F-D0047-061 PoP × Wx 合成；mock 也會產一份簡化版） */
  forecastSeries: ForecastSlot[];
}

/** 一段時間視窗的預報，給 forecast.ts 做 1h/3h/6h horizon 對齊 */
export interface ForecastSlot {
  /** ISO8601 — slot 開始時間 */
  startTime: string;
  /** ISO8601 — slot 結束時間 */
  endTime: string;
  /** 0~1 降雨機率（PoP）；CWA 優先使用 3 小時降雨機率 */
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
    Station?: (CWAStationMeta & {
      WeatherElement?: {
        Now?: { Precipitation?: number | string };
        AirTemperature?: number | string;
        RelativeHumidity?: number | string;
        Weather?: string;
      };
    })[];
  };
}

interface CWARainfallResponse {
  records?: {
    Station?: (CWAStationMeta & {
      RainfallElement?: {
        Now?: { Precipitation?: number | string };
        Past10Min?: { Precipitation?: number | string };
        Past1hr?: { Precipitation?: number | string };
        Past3hr?: { Precipitation?: number | string };
      };
    })[];
  };
}

const NTU_COORD = { lat: 25.01734, lng: 121.53975 };
const PREFERRED_OBSERVATION_STATIONS = [
  '臺灣大學',
  '大安森林',
  '臺北',
  '文山',
];

interface CWAStationMeta {
  StationName?: string;
  ObsTime?: { DateTime?: string };
  GeoInfo?: {
    CountyName?: string;
    TownName?: string;
    Coordinates?: {
      CoordinateName?: string;
      StationLatitude?: number | string;
      StationLongitude?: number | string;
    }[];
  };
}

function parseCwaNumber(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > -90 ? v : null;
  }
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed === '-' || trimmed === '--' || trimmed === 'T') {
    return 0;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n > -90 ? n : null;
}

function parseCwaText(v: unknown): string {
  if (v === null || v === undefined) return '';
  const text = String(v).trim();
  if (!text || text === '-' || text === '--') return '';
  const n = Number.parseFloat(text);
  return Number.isFinite(n) && n <= -90 ? '' : text;
}

function stationCoordinate(station: {
  GeoInfo?: {
    Coordinates?: {
      CoordinateName?: string;
      StationLatitude?: number | string;
      StationLongitude?: number | string;
    }[];
  };
}): { lat: number; lng: number } | null {
  const coords = station.GeoInfo?.Coordinates ?? [];
  const coord =
    coords.find((c) => c.CoordinateName === 'WGS84') ?? coords[0];
  const lat = parseCwaNumber(coord?.StationLatitude);
  const lng = parseCwaNumber(coord?.StationLongitude);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function distanceSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function chooseNearestStation<T extends CWAStationMeta>(stations: T[] | undefined): T | undefined {
  const usable = stations ?? [];
  for (const name of PREFERRED_OBSERVATION_STATIONS) {
    const hit = usable.find((s) => s.StationName === name);
    if (hit) return hit;
  }

  return usable
    .map((station) => ({ station, coord: stationCoordinate(station) }))
    .filter((x): x is { station: (typeof usable)[number]; coord: { lat: number; lng: number } } =>
      Boolean(x.coord),
    )
    .sort((a, b) => distanceSq(a.coord, NTU_COORD) - distanceSq(b.coord, NTU_COORD))[0]
    ?.station;
}

async function fetchCWAObservation(
  apiKey: string,
): Promise<Partial<WeatherSnapshot>> {
  const url = new URL(`${CWA_BASE}/O-A0003-001`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('format', 'JSON');
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CWA observation HTTP ${res.status}`);
  const data = (await res.json()) as CWAObservationResponse;
  const station = chooseNearestStation(data.records?.Station);
  if (!station) return {};
  const we = station.WeatherElement ?? {};
  const temperature = parseCwaNumber(we.AirTemperature);
  const humidity = parseCwaNumber(we.RelativeHumidity);
  const precipitation = parseCwaNumber(we.Now?.Precipitation);
  return {
    observedAt: station.ObsTime?.DateTime ?? new Date().toISOString(),
    temperature: temperature !== null && temperature > -90 ? temperature : null,
    humidity: humidity !== null && humidity >= 0 ? humidity : null,
    rainfall1h: precipitation !== null && precipitation >= 0 ? precipitation : null,
    description: parseCwaText(we.Weather),
  };
}

async function fetchCWARainfall(
  apiKey: string,
): Promise<Partial<Pick<WeatherSnapshot, 'observedAt' | 'rainfall1h'>>> {
  const url = new URL(`${CWA_BASE}/O-A0002-001`);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('format', 'JSON');
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CWA rainfall HTTP ${res.status}`);
  const data = (await res.json()) as CWARainfallResponse;
  const station = chooseNearestStation(data.records?.Station);
  if (!station) return {};

  const rain = station.RainfallElement;
  const past1h = parseCwaNumber(rain?.Past1hr?.Precipitation);
  const now = parseCwaNumber(rain?.Now?.Precipitation);
  const past10 = parseCwaNumber(rain?.Past10Min?.Precipitation);
  const value = past1h ?? now ?? past10;
  return {
    observedAt: station.ObsTime?.DateTime,
    rainfall1h: value !== null && value >= 0 ? value : null,
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

function probabilityFloorForIntensity(i: RainIntensity): number {
  switch (i) {
    case 'heavy':
      return 0.9;
    case 'moderate':
      return 0.75;
    case 'light':
      return 0.55;
    case 'drizzle':
      return 0.35;
    case 'none':
      return 0;
  }
}

interface CWATimeEntry {
  StartTime?: string;
  EndTime?: string;
  DataTime?: string;
  startTime?: string;
  endTime?: string;
  /** 部分 element 用 dataTime（瞬間時刻），但 PoP6h / Wx 都是 startTime/endTime */
  dataTime?: string;
  ElementValue?: Record<string, string | number | undefined>[];
  elementValue?: Record<string, string | number | undefined>[];
}

interface CWAWeatherElement {
  ElementName?: string;
  Time?: CWATimeEntry[];
  elementName?: string;
  time?: CWATimeEntry[];
}

interface CWALocationFull {
  LocationName?: string;
  WeatherElement?: CWAWeatherElement[];
  locationName?: string;
  weatherElement?: CWAWeatherElement[];
}

function getLocationName(location: CWALocationFull): string | undefined {
  return location.LocationName ?? location.locationName;
}

function getWeatherElements(location: CWALocationFull): CWAWeatherElement[] {
  return location.WeatherElement ?? location.weatherElement ?? [];
}

function getElementName(element: CWAWeatherElement): string | undefined {
  return element.ElementName ?? element.elementName;
}

function getTimes(element: CWAWeatherElement): CWATimeEntry[] {
  return element.Time ?? element.time ?? [];
}

function getStartTime(time: CWATimeEntry): string | undefined {
  return time.StartTime ?? time.startTime ?? time.DataTime ?? time.dataTime;
}

function getEndTime(time: CWATimeEntry): string | undefined {
  return time.EndTime ?? time.endTime ?? time.StartTime ?? time.startTime;
}

function getElementValue(time: CWATimeEntry): string | null {
  const first = (time.ElementValue ?? time.elementValue ?? [])[0];
  if (!first) return null;
  const direct = first.value ?? first.Value;
  if (direct !== undefined) return String(direct);
  const value = Object.values(first).find((v) => v !== undefined && v !== null);
  return value === undefined ? null : String(value);
}

/**
 * 抓 CWA F-D0047-061 完整序列：PoP（優先 3h，fallback 6h/12h）× Wx，merge 成多段。
 *
 * Returns: 0~24h 內、每 3h 一段的 ForecastSlot[]，依時間排序。
 * pop 值由 PoP 時間窗對應到該 Wx slot；3h PoP 可精準對齊，6h/12h 則用重疊時間 fallback。
 */
async function fetchCWAForecastSeries(apiKey: string): Promise<ForecastSlot[]> {
  const url = new URL(`${CWA_BASE}/F-D0047-061`);
  url.searchParams.set('Authorization', apiKey);
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
    locs.find((l) => getLocationName(l) === TAIPEI_TOWN) ?? locs[0];
  if (!target) return [];
  const els = getWeatherElements(target);

  const wxEl = els.find(
    (e) => getElementName(e) === 'Wx' || getElementName(e) === '天氣現象',
  );
  const pop3El = els.find(
    (e) =>
      getElementName(e) === 'PoP' ||
      getElementName(e) === 'PoP3h' ||
      getElementName(e) === '3小時降雨機率',
  );
  const pop6El = els.find(
    (e) => getElementName(e) === 'PoP6h' || getElementName(e) === '6小時降雨機率',
  );
  const pop12El = els.find(
    (e) => getElementName(e) === 'PoP12h' || getElementName(e) === '12小時降雨機率',
  );

  const wxSlots = (wxEl ? getTimes(wxEl) : []).filter(
    (t): t is Required<Pick<CWATimeEntry, 'startTime' | 'endTime'>> & CWATimeEntry =>
      Boolean(getStartTime(t) && getEndTime(t)),
  );
  if (!wxSlots.length) return [];

  // 把 PoP 的時間區間做成 [start..end, percent] 列表；優先 3h，無資料才退到 6h/12h。
  type PopWindow = { start: number; end: number; pop: number };
  const popWindows: PopWindow[] = [];
  const addPopWindows = (el?: CWAWeatherElement) => {
    if (!el) return;
    for (const t of getTimes(el)) {
      const start = getStartTime(t);
      const end = getEndTime(t);
      if (!start || !end) continue;
      const pct = parseCwaNumber(getElementValue(t));
      if (!Number.isFinite(pct)) continue;
      popWindows.push({
        start: new Date(start).getTime(),
        end: new Date(end).getTime(),
        pop: Math.max(0, Math.min(1, (pct ?? 0) / 100)),
      });
    }
  };
  addPopWindows(pop3El);
  if (!popWindows.length) addPopWindows(pop6El);
  if (!popWindows.length) addPopWindows(pop12El); // 沒 3h/6h 才退而求其次

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
      const wx = parseCwaText(getElementValue(t)) || null;
      const startTime = getStartTime(t)!;
      const endTime = getEndTime(t)!;
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      return {
        startTime,
        endTime,
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

function currentOrNextForecastSlot(
  series: ForecastSlot[],
  nowMs = Date.now(),
): ForecastSlot | null {
  const slots = series
    .map((slot) => ({
      slot,
      start: new Date(slot.startTime).getTime(),
      end: new Date(slot.endTime).getTime(),
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end))
    .sort((a, b) => a.start - b.start);

  return (
    slots.find(({ start, end }) => start <= nowMs && nowMs < end)?.slot ??
    slots.find(({ start }) => start > nowMs)?.slot ??
    null
  );
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) {
    return mockWeather();
  }
  try {
    const [obs, rainObs, series] = await Promise.all([
      fetchCWAObservation(apiKey).catch(() => ({} as Partial<WeatherSnapshot>)),
      fetchCWARainfall(apiKey).catch(() => ({} as Partial<Pick<WeatherSnapshot, 'observedAt' | 'rainfall1h'>>)),
      fetchCWAForecastSeries(apiKey).catch(() => [] as ForecastSlot[]),
    ]);
    const rainfall1h = rainObs.rainfall1h ?? obs.rainfall1h ?? null;
    const intensity = classifyIntensity(rainfall1h);
    // pop3h 取目前覆蓋中的預報 slot；如果剛好沒有，退到下一段。
    const currentSlot = currentOrNextForecastSlot(series);
    const pop3h = Math.max(
      currentSlot?.pop ?? 0,
      probabilityFloorForIntensity(intensity),
    );
    // description 優先用即時觀測 → 當前 forecast Wx
    const description =
      parseCwaText(obs.description) || parseCwaText(currentSlot?.wx);
    return {
      source: 'cwa',
      observedAt: rainObs.observedAt ?? obs.observedAt ?? new Date().toISOString(),
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
