/**
 * 預測式水災熱圖 — 統計法（無 ML）
 *
 * 三個資料源：
 * 1. 歷史回報密度（過去 90 天 flooding/standing_water/poor_drainage 在點周圍 80m 加權密度）
 * 2. OSM 路網低窪標記（沿用 flood-areas.json，與 dense graph 同源）
 * 3. 當下 active 回報（status=active|reviewing 的淹水/積水，50m 範圍）
 *
 * 三層 × 雨勢係數疊加，產出每個 50m 網格 cell 在 1h / 3h / 6h 時段的 0..1 風險分數。
 *
 * 只在 server 端使用（讀 flood-areas.json、flood-roads-source.json，client bundle 不需要）。
 */
import floodAreasJson from '@/data/flood-areas.json';
import floodRoadsJson from '@/data/flood-roads-source.json';
import { CAMPUS_NODES } from './campus';
import type { Report } from './types';
import {
  type ForecastSlot,
  type RainIntensity,
  type WeatherSnapshot,
  intensityScore,
} from './weather';

// ────────────────────────────────────────────────────────
// 常數 & 型別
// ────────────────────────────────────────────────────────

/** NTU 主校區 bounding box（涵蓋校門口到醉月湖、舟山路） */
const BBOX = {
  minLat: 25.0140,
  maxLat: 25.0220,
  minLng: 121.5325,
  maxLng: 121.5420,
} as const;

/** 網格邊長（公尺）— 50m 是「行政 / 規劃」尺度，不會太碎也夠細看出熱點 */
const CELL_SIZE_M = 50;

/** 歷史回報採樣半徑（公尺） */
const HIST_RADIUS_M = 80;
/** 歷史回報採樣天數 */
const HIST_DAYS = 90;

/** Active 回報影響半徑（公尺） */
const ACTIVE_RADIUS_M = 50;

export type Horizon = '1h' | '3h' | '6h';
export const HORIZONS: Horizon[] = ['1h', '3h', '6h'];

export const HORIZON_LABEL: Record<Horizon, string> = {
  '1h': '未來 1 小時',
  '3h': '未來 3 小時',
  '6h': '未來 6 小時',
};

export interface HorizonForecast {
  horizon: Horizon;
  /** 該時段的雨勢係數（0..1），給 cell 計算用 */
  rainFactor: number;
  /** 該時段預估雨勢分類 */
  estIntensity: RainIntensity;
  /** 該時段降雨機率 */
  pop: number;
  /** 來源：'series' = 取自 CWA / mock 真實 forecast slots；'derived' = fallback 推估 */
  source: 'series' | 'derived';
  /** 來源 slot 描述（取自 Wx，串接後給 panel 顯示，如「短暫陣雨」） */
  wx: string | null;
}

export interface ForecastBreakdown {
  /** 各分量對 score 的「貢獻值」（已乘權重，可加總 ≈ score） */
  baseline: number;
  history: number;
  lowLying: number;
  active: number;
  /** 主要原因（人類可讀） */
  topReason: string;
}

export interface ForecastCell {
  /** cell 中心經緯度 */
  lat: number;
  lng: number;
  /** cell 中心 → 網格 grid index */
  row: number;
  col: number;
  /** 三個 horizon 的 score（0..1） */
  scores: Record<Horizon, number>;
  /** 預測時段對應的分量拆解（取 max horizon） */
  breakdown: ForecastBreakdown;
}

export interface ForecastHotspot {
  lat: number;
  lng: number;
  /** 用 flood-areas / 校園地標推得的名稱 */
  name: string;
  /** 在哪個 horizon 達到峰值 */
  peakHorizon: Horizon;
  /** 峰值分數 */
  peakScore: number;
  /** 三段分數，方便 UI 顯示 */
  scores: Record<Horizon, number>;
  /** 主要驅動原因列表 */
  reasons: string[];
  /** 給使用者的建議文字 */
  advice: string;
}

export interface ForecastResult {
  weather: WeatherSnapshot;
  generatedAt: string;
  horizons: HorizonForecast[];
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  cellSizeMeters: number;
  cellLatStep: number;
  cellLngStep: number;
  cols: number;
  rows: number;
  cells: ForecastCell[];
  hotspots: ForecastHotspot[];
}

// ────────────────────────────────────────────────────────
// 幾何 helpers
// ────────────────────────────────────────────────────────

function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

/** point-in-polygon (ray casting)，poly = [[lat,lng], ...] */
function pointInPolygon(lat: number, lng: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 點到「折線」最近距離（公尺）— 對線段做投影 */
function pointToLineDistanceMeters(
  lat: number,
  lng: number,
  line: [number, number][],
): number {
  if (line.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [aLat, aLng] = line[i - 1];
    const [bLat, bLng] = line[i];
    // 把段近似為平面線段（距離很短，誤差可忽略）
    const ax = aLng;
    const ay = aLat;
    const bx = bLng;
    const by = bLat;
    const px = lng;
    const py = lat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projLat = ay + t * dy;
    const projLng = ax + t * dx;
    const d = haversine({ lat, lng }, { lat: projLat, lng: projLng });
    if (d < best) best = d;
  }
  return best;
}

// ────────────────────────────────────────────────────────
// 低窪資料（與 dense graph 同源）
// ────────────────────────────────────────────────────────

interface RawArea {
  id: string;
  name: string;
  score: number;
  kind: 'polygon' | 'lineBuffer';
  poly?: [number, number][];
  bufferMeters?: number;
  osmWayIds?: number[];
}

interface OsmElement {
  id: number;
  type: string;
  geometry?: { lat: number; lon: number }[];
}

const ROAD_BY_ID = new Map<number, [number, number][]>();
{
  const els = (floodRoadsJson as { elements: OsmElement[] }).elements ?? [];
  for (const e of els) {
    if (e.type !== 'way' || !e.geometry) continue;
    ROAD_BY_ID.set(
      e.id,
      e.geometry.map((p) => [p.lat, p.lon] as [number, number]),
    );
  }
}

const FLOOD_AREAS: RawArea[] =
  (floodAreasJson as { areas: RawArea[] }).areas ?? [];

/**
 * 給定 (lat,lng)，回傳該點落在哪個易積水區（最高 score 的那個）+ 區域名稱。
 * 沒命中則 score=0、name=null。
 */
function lowLyingHit(
  lat: number,
  lng: number,
): { score: number; areaName: string | null } {
  let best = 0;
  let name: string | null = null;
  for (const a of FLOOD_AREAS) {
    if (a.kind === 'polygon' && a.poly?.length) {
      if (pointInPolygon(lat, lng, a.poly)) {
        if (a.score > best) {
          best = a.score;
          name = a.name;
        }
      }
    } else if (a.kind === 'lineBuffer' && a.osmWayIds?.length) {
      const buf = a.bufferMeters ?? 15;
      let minD = Infinity;
      for (const wayId of a.osmWayIds) {
        const line = ROAD_BY_ID.get(wayId);
        if (!line) continue;
        const d = pointToLineDistanceMeters(lat, lng, line);
        if (d < minD) minD = d;
      }
      if (minD <= buf) {
        // 距離越遠分數略衰（中心 100%，邊緣 60%）
        const factor = 1 - (minD / buf) * 0.4;
        const s = a.score * factor;
        if (s > best) {
          best = s;
          name = a.name;
        }
      }
    }
  }
  return { score: best, areaName: name };
}

// ────────────────────────────────────────────────────────
// 歷史回報密度
// ────────────────────────────────────────────────────────

function severityWeight(sev: Report['severity']): number {
  if (sev === 'high') return 1.5;
  if (sev === 'medium') return 1;
  return 0.7;
}

function timeDecayWeight(ageDays: number): number {
  if (ageDays <= 7) return 2;
  if (ageDays <= 30) return 1.5;
  if (ageDays <= HIST_DAYS) return 1;
  return 0;
}

interface HistResult {
  density: number;
  count: number;
}

function historicalDensity(
  lat: number,
  lng: number,
  reports: Report[],
  now: number,
): HistResult {
  let weight = 0;
  let count = 0;
  for (const r of reports) {
    if (
      r.category !== 'flooding' &&
      r.category !== 'standing_water' &&
      r.category !== 'poor_drainage'
    )
      continue;
    const ageDays =
      (now - new Date(r.created_at).getTime()) / (24 * 3600 * 1000);
    const tw = timeDecayWeight(ageDays);
    if (tw === 0) continue;
    const d = haversine({ lat, lng }, { lat: r.latitude, lng: r.longitude });
    if (d > HIST_RADIUS_M) continue;
    const distFactor = 1 - d / HIST_RADIUS_M; // 中心 1, 邊緣 0
    weight += tw * severityWeight(r.severity) * distFactor;
    count += 1;
  }
  // 5 個重型回報疊加 ≈ 1.0；少於就比例給分
  return { density: Math.min(1, weight / 5), count };
}

// ────────────────────────────────────────────────────────
// Active 回報
// ────────────────────────────────────────────────────────

interface ActiveResult {
  intensity: number;
  count: number;
}

function activeReportsAt(
  lat: number,
  lng: number,
  reports: Report[],
): ActiveResult {
  let s = 0;
  let count = 0;
  for (const r of reports) {
    if (r.status !== 'active' && r.status !== 'reviewing') continue;
    if (r.category !== 'flooding' && r.category !== 'standing_water') continue;
    const d = haversine({ lat, lng }, { lat: r.latitude, lng: r.longitude });
    if (d > ACTIVE_RADIUS_M) continue;
    const sev = r.severity === 'high' ? 1 : r.severity === 'medium' ? 0.65 : 0.4;
    s += sev * (1 - d / ACTIVE_RADIUS_M);
    count += 1;
  }
  return { intensity: Math.min(1, s), count };
}

// ────────────────────────────────────────────────────────
// 雨勢 → 三段 horizon
// ────────────────────────────────────────────────────────

function intensityFromFactor(f: number): RainIntensity {
  if (f >= 0.8) return 'heavy';
  if (f >= 0.55) return 'moderate';
  if (f >= 0.3) return 'light';
  if (f >= 0.1) return 'drizzle';
  return 'none';
}

const HORIZON_HOURS: Record<Horizon, number> = { '1h': 1, '3h': 3, '6h': 6 };

/**
 * 找出在 [now, now + horizonHours] 區間內、與該區間有重疊的 forecast slots，
 * 並回傳這些 slot 在區間內的有效時長（毫秒）— 用於後續加權平均。
 */
function slotsOverlapping(
  series: ForecastSlot[],
  nowMs: number,
  horizonHours: number,
): { slot: ForecastSlot; overlapMs: number }[] {
  const endMs = nowMs + horizonHours * 3600 * 1000;
  const out: { slot: ForecastSlot; overlapMs: number }[] = [];
  for (const s of series) {
    const sStart = new Date(s.startTime).getTime();
    const sEnd = new Date(s.endTime).getTime();
    if (!Number.isFinite(sStart) || !Number.isFinite(sEnd)) continue;
    const overlap = Math.max(0, Math.min(sEnd, endMs) - Math.max(sStart, nowMs));
    if (overlap > 0) out.push({ slot: s, overlapMs: overlap });
  }
  return out;
}

/** 雨勢強度的數值化（給加權平均用），等同於 intensityScore */
function intensityToFactor(i: RainIntensity): number {
  return intensityScore(i);
}

/**
 * 從真實 forecast series 抽 horizon 預報。
 * 沒重疊時回 null，讓上層 fallback 到推估法。
 */
function buildFromSeries(
  horizon: Horizon,
  series: ForecastSlot[],
  nowI: number,
  nowMs: number,
): HorizonForecast | null {
  const overlaps = slotsOverlapping(series, nowMs, HORIZON_HOURS[horizon]);
  if (!overlaps.length) return null;

  const totalMs = overlaps.reduce((s, o) => s + o.overlapMs, 0);
  // 加權平均 pop
  const weightedPop =
    overlaps.reduce((s, o) => s + o.slot.pop * o.overlapMs, 0) / totalMs;
  // 取重疊期內最強雨勢（不是平均，是 worst case — 跑路徑規劃要用最壞情境）
  let worstIntensity: RainIntensity = 'none';
  let worstFactor = 0;
  let wxAccum = '';
  for (const o of overlaps) {
    const f = intensityToFactor(o.slot.intensityHint);
    if (f > worstFactor) {
      worstFactor = f;
      worstIntensity = o.slot.intensityHint;
    }
    if (o.slot.wx && !wxAccum.includes(o.slot.wx)) {
      wxAccum = wxAccum ? `${wxAccum} → ${o.slot.wx}` : o.slot.wx;
    }
  }

  // 即時觀測 nowI 與 forecast 強度的混合：
  // - 1h horizon：當下觀測權重高（已經在下雨就持續）
  // - 3h horizon：對半
  // - 6h horizon：以預報為主
  const blend =
    horizon === '1h' ? 0.7 : horizon === '3h' ? 0.45 : 0.2;
  const factor = Math.min(
    1,
    nowI * blend + worstFactor * (1 - blend) + weightedPop * 0.1,
  );

  // 1h 內若當下已在下，估計強度沿用當下；其他取 worst
  const estIntensity =
    horizon === '1h' && nowI > 0 ? intensityFromFactor(factor) : worstIntensity;

  return {
    horizon,
    rainFactor: factor,
    estIntensity,
    pop: weightedPop,
    source: 'series',
    wx: wxAccum || null,
  };
}

/** 沒 series 時的 fallback，沿用舊推估邏輯 */
function buildDerived(horizon: Horizon, w: WeatherSnapshot): HorizonForecast {
  const nowI = intensityScore(w.rainIntensity);
  const pop = w.pop3h;
  let factor: number;
  let pop_: number;
  if (horizon === '1h') {
    factor = Math.min(1, nowI * 0.85 + pop * 0.15);
    pop_ = Math.min(1, nowI > 0 ? 0.9 : pop);
  } else if (horizon === '3h') {
    factor = Math.min(1, nowI * 0.4 + pop * 0.6);
    pop_ = pop;
  } else {
    factor = Math.min(1, nowI * 0.2 + pop * 0.7 + 0.05);
    pop_ = Math.min(1, pop * 0.95 + 0.05);
  }
  return {
    horizon,
    rainFactor: factor,
    estIntensity:
      horizon === '1h' && nowI > 0 ? w.rainIntensity : intensityFromFactor(factor),
    pop: pop_,
    source: 'derived',
    wx: w.description || null,
  };
}

export function buildHorizonForecasts(w: WeatherSnapshot): HorizonForecast[] {
  const nowI = intensityScore(w.rainIntensity);
  const nowMs = Date.now();
  const series = w.forecastSeries ?? [];

  return HORIZONS.map(
    (h) => buildFromSeries(h, series, nowI, nowMs) ?? buildDerived(h, w),
  );
}

// ────────────────────────────────────────────────────────
// 單點 score 計算
// ────────────────────────────────────────────────────────

interface CellInputs {
  lat: number;
  lng: number;
  hist: HistResult;
  ll: { score: number; areaName: string | null };
  active: ActiveResult;
}

function scoreForRain(
  inputs: CellInputs,
  rainFactor: number,
): { score: number; breakdown: ForecastBreakdown } {
  const baseline = 0.10 * rainFactor * 0.6; // 全圖底色：大雨時人見人怕
  const histTerm = 0.35 * inputs.hist.density * (0.4 + 1.0 * rainFactor);
  const llTerm = 0.45 * inputs.ll.score * (0.25 + 1.5 * rainFactor);
  const activeTerm = 0.30 * inputs.active.intensity * (0.5 + 0.7 * rainFactor);

  const score = Math.min(1, baseline + histTerm + llTerm + activeTerm);

  // 主要原因
  const parts: { label: string; value: number }[] = [
    { label: '低窪地形', value: llTerm },
    { label: '歷史熱點', value: histTerm },
    { label: '當前回報', value: activeTerm },
  ];
  parts.sort((a, b) => b.value - a.value);
  const topReason = parts[0].value < 0.05 ? '基本雨勢影響' : parts[0].label;

  return {
    score,
    breakdown: {
      baseline,
      history: histTerm,
      lowLying: llTerm,
      active: activeTerm,
      topReason,
    },
  };
}

// ────────────────────────────────────────────────────────
// 網格生成
// ────────────────────────────────────────────────────────

/** 把 50m 換算成 lat/lng degree 步幅（在 NTU 緯度約 25°） */
function metersToLatLngSteps(meters: number, atLat: number) {
  const latStep = meters / 111_000; // 1° lat ≈ 111km
  const lngStep = meters / (111_000 * Math.cos((atLat * Math.PI) / 180));
  return { latStep, lngStep };
}

// ────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────

export interface ComputeOptions {
  /** 已套用過 mockRain override 的 weather snapshot */
  weather: WeatherSnapshot;
  /** 全部 reports（含 resolved），用於歷史密度與 active 兩用 */
  reports: Report[];
}

export function computeForecast(opts: ComputeOptions): ForecastResult {
  const { weather, reports } = opts;
  const horizons = buildHorizonForecasts(weather);
  const horizonByName = new Map(horizons.map((h) => [h.horizon, h]));
  const now = Date.now();

  const midLat = (BBOX.minLat + BBOX.maxLat) / 2;
  const { latStep, lngStep } = metersToLatLngSteps(CELL_SIZE_M, midLat);
  const rows = Math.ceil((BBOX.maxLat - BBOX.minLat) / latStep);
  const cols = Math.ceil((BBOX.maxLng - BBOX.minLng) / lngStep);

  const cells: ForecastCell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = BBOX.minLat + (r + 0.5) * latStep;
      const lng = BBOX.minLng + (c + 0.5) * lngStep;

      const ll = lowLyingHit(lat, lng);
      const hist = historicalDensity(lat, lng, reports, now);
      const active = activeReportsAt(lat, lng, reports);

      // 三個 horizon 算分
      const inputs: CellInputs = { lat, lng, hist, ll, active };
      const scoreMap: Record<Horizon, number> = { '1h': 0, '3h': 0, '6h': 0 };
      let peakBreakdown: ForecastBreakdown | null = null;
      let peakScore = -1;

      for (const h of HORIZONS) {
        const hf = horizonByName.get(h)!;
        const { score, breakdown } = scoreForRain(inputs, hf.rainFactor);
        scoreMap[h] = score;
        if (score > peakScore) {
          peakScore = score;
          peakBreakdown = breakdown;
        }
      }

      // 過濾：score 都 < 0.05 的 cell 不傳給 client（省 bytes）
      const maxS = Math.max(scoreMap['1h'], scoreMap['3h'], scoreMap['6h']);
      if (maxS < 0.05) continue;

      cells.push({
        lat,
        lng,
        row: r,
        col: c,
        scores: scoreMap,
        breakdown: peakBreakdown!,
      });
    }
  }

  const hotspots = buildHotspots(cells, reports, now);

  return {
    weather,
    generatedAt: new Date().toISOString(),
    horizons,
    bbox: BBOX,
    cellSizeMeters: CELL_SIZE_M,
    cellLatStep: latStep,
    cellLngStep: lngStep,
    cols,
    rows,
    cells,
    hotspots,
  };
}

// ────────────────────────────────────────────────────────
// Hotspot 抽取（cluster + 命名）
// ────────────────────────────────────────────────────────

/** 取 score >= threshold 的 cell，做 greedy clustering（150m 內合併） */
function buildHotspots(
  cells: ForecastCell[],
  reports: Report[],
  now: number,
): ForecastHotspot[] {
  // 用每個 cell 的「峰值 horizon」當作排序依據
  const scored = cells.map((c) => {
    let peak: Horizon = '1h';
    let v = c.scores['1h'];
    for (const h of HORIZONS) {
      if (c.scores[h] > v) {
        v = c.scores[h];
        peak = h;
      }
    }
    return { cell: c, peakHorizon: peak, peakScore: v };
  });

  // 風險 ≥ 0.35 才視為熱點
  const candidates = scored
    .filter((s) => s.peakScore >= 0.35)
    .sort((a, b) => b.peakScore - a.peakScore);

  const merged: typeof candidates = [];
  for (const s of candidates) {
    const tooClose = merged.some(
      (m) => haversine(m.cell, s.cell) < 150, // 150m 內視為同一熱點
    );
    if (!tooClose) merged.push(s);
    if (merged.length >= 8) break; // 最多 8 個
  }

  return merged.map((m) => buildHotspotEntry(m.cell, m.peakHorizon, m.peakScore, reports, now));
}

function buildHotspotEntry(
  cell: ForecastCell,
  peakHorizon: Horizon,
  peakScore: number,
  reports: Report[],
  now: number,
): ForecastHotspot {
  const ll = lowLyingHit(cell.lat, cell.lng);
  const hist = historicalDensity(cell.lat, cell.lng, reports, now);
  const active = activeReportsAt(cell.lat, cell.lng, reports);

  const reasons: string[] = [];
  if (ll.score >= 0.5) reasons.push(`低窪地形 (${(ll.score * 100).toFixed(0)}%)`);
  if (hist.count >= 2) reasons.push(`歷史 ${hist.count} 筆回報`);
  if (active.count >= 1)
    reasons.push(`現場 ${active.count} 筆未處理回報`);
  if (reasons.length === 0) reasons.push('預估雨勢偏大');

  // 命名優先：flood-area 名稱 > 最近 active report 的 location_name > 最近 campus node
  let name = ll.areaName;
  if (!name) {
    let bestR: Report | null = null;
    let bestD = Infinity;
    for (const r of reports) {
      if (!r.location_name) continue;
      const d = haversine(cell, { lat: r.latitude, lng: r.longitude });
      if (d < 80 && d < bestD) {
        bestD = d;
        bestR = r;
      }
    }
    if (bestR) name = bestR.location_name;
  }
  if (!name) {
    let bestN = CAMPUS_NODES[0];
    let bestD = haversine(cell, bestN);
    for (const n of CAMPUS_NODES) {
      const d = haversine(cell, n);
      if (d < bestD) {
        bestD = d;
        bestN = n;
      }
    }
    name = bestN ? `${bestN.name}附近` : '校園內';
  }

  // 建議文案
  const horizonLabel = HORIZON_LABEL[peakHorizon];
  let advice: string;
  if (peakScore >= 0.75) {
    advice = `${horizonLabel}高機率積水；建議避開或改走有遮蔽路徑。`;
  } else if (peakScore >= 0.5) {
    advice = `${horizonLabel}有明顯積水風險，雨具與避水路線備好。`;
  } else {
    advice = `${horizonLabel}輕度風險，路面可能濕滑。`;
  }

  return {
    lat: cell.lat,
    lng: cell.lng,
    name,
    peakHorizon,
    peakScore,
    scores: cell.scores,
    reasons,
    advice,
  };
}
