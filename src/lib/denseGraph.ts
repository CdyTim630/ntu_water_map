/**
 * 伺服器端：載入由 OSM 抓回的密集路網 (src/data/campus-paths.geojson)，
 * 提供「Snap-to-nearest + 氣象/積水加權 Dijkstra」的路徑規劃。
 *
 * 這個模組「只能在 server 端使用」（API route）。campus-paths.geojson 約 3MB，
 * 不適合送進 client bundle。
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Report } from './types';
import type { WeatherSnapshot } from './weather';
import { rainPenaltyFactor } from './weather';

export type TravelMode = 'walk' | 'bike';

interface DenseVertex {
  id: string;
  lat: number;
  lng: number;
}

interface DenseEdge {
  to: string;
  /** [a -> b] 邊在 GeoJSON 內的 LineString [lng,lat]；若 b->a 取反 */
  geom: [number, number][];
  covered: number;
  lowLying: number;
  bikeAllowed: boolean;
  distance: number;
}

interface DenseGraph {
  vertices: Map<string, DenseVertex>;
  adjacency: Map<string, DenseEdge[]>;
}

let _graph: DenseGraph | null = null;

function loadGraph(): DenseGraph {
  if (_graph) return _graph;
  const p = path.join(process.cwd(), 'src', 'data', 'campus-paths.geojson');
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw) as {
    features: {
      properties: Record<string, unknown>;
      geometry:
        | { type: 'Point'; coordinates: [number, number] }
        | { type: 'LineString'; coordinates: [number, number][] };
    }[];
  };

  const vertices = new Map<string, DenseVertex>();
  const adjacency = new Map<string, DenseEdge[]>();

  for (const f of data.features) {
    const kind = f.properties.kind;
    if (kind === 'vertex' && f.geometry.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      const id = String(f.properties.id);
      vertices.set(id, { id, lat, lng });
    }
  }

  for (const f of data.features) {
    if (f.properties.kind !== 'edge' || f.geometry.type !== 'LineString') continue;
    const a = String(f.properties.a);
    const b = String(f.properties.b);
    const covered = Number(f.properties.covered ?? 0);
    const lowLying = Number(f.properties.lowLying ?? 0);
    const bikeAllowed = Boolean(f.properties.bikeAllowed ?? true);
    const distance = Number(f.properties.distance ?? 0);
    const geom = f.geometry.coordinates as [number, number][];

    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push({
      to: b,
      geom,
      covered,
      lowLying,
      bikeAllowed,
      distance,
    });
    adjacency.get(b)!.push({
      to: a,
      geom: [...geom].reverse(),
      covered,
      lowLying,
      bikeAllowed,
      distance,
    });
  }

  _graph = { vertices, adjacency };
  return _graph;
}

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

export function nearestVertex(
  lat: number,
  lng: number,
  options: { walkable?: boolean } = {},
): DenseVertex {
  const { vertices, adjacency } = loadGraph();
  let best: DenseVertex | null = null;
  let bestD = Infinity;
  for (const v of vertices.values()) {
    if (options.walkable && !adjacency.has(v.id)) continue;
    const d = haversine({ lat, lng }, v);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best) throw new Error('graph is empty');
  return best;
}

// ---------------- Dijkstra with binary heap ----------------

class MinHeap<T> {
  private data: { key: number; value: T }[] = [];
  size() {
    return this.data.length;
  }
  push(key: number, value: T) {
    this.data.push({ key, value });
    this.bubbleUp(this.data.length - 1);
  }
  pop(): { key: number; value: T } | undefined {
    if (!this.data.length) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  private bubbleUp(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].key <= this.data[i].key) return;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  private sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let s = i;
      if (l < n && this.data[l].key < this.data[s].key) s = l;
      if (r < n && this.data[r].key < this.data[s].key) s = r;
      if (s === i) return;
      [this.data[s], this.data[i]] = [this.data[i], this.data[s]];
      i = s;
    }
  }
}

export interface DenseRouteOptions {
  mode: TravelMode;
  weather: WeatherSnapshot;
  reports?: Report[];
  /** 純距離模式：忽略雨勢 / 遮蔽 / 積水加權 */
  ignoreWeather?: boolean;
  /** active 積水回報的影響半徑，公尺 (預設 60) */
  reportInfluenceMeters?: number;
  /** 避水模式：強制把 rainFactor 拉到 ≥ 0.85，即使大晴天也走有遮蔽的路 */
  avoidWater?: boolean;
}

/** 一條規劃路徑的單段資訊（給地圖染色 / 風險可視化用） */
export interface PlanSegment {
  /** 該段的折線（[lat, lng] 多點，可直接畫 Polyline） */
  coords: [number, number][];
  distance: number;
  covered: number;
  lowLying: number;
  /** 此段附近有多少 active 積水回報（已含 severity 加權） */
  floodReports: number;
  /** 為了人眼可讀的風險分類：dry / partial / open / lowLying / floodReport */
  risk: 'dry' | 'partial' | 'open' | 'lowLying' | 'floodReport';
}

export interface DensePlan {
  /** [lat, lng]，可直接給 Leaflet 畫線 */
  coords: [number, number][];
  /** 段級資料：段 = 兩個 dense graph vertex 之間的一條 OSM way 切片 */
  segments: PlanSegment[];
  totalDistance: number;
  totalCost: number;
  coverageScore: number;
  lowLyingShare: number;
  /** 沿途碰到的 unique 積水回報數（多段同一回報只算一次） */
  passingFloodReports: number;
  /** 對應的 unique 回報 id 列表，可用於跟 shortest 做集合差比較 */
  passingFloodReportIds: string[];
  /** 起 / 終點實際 snap 到的 vertex（座標可能跟使用者選的點不同） */
  startVertex: { lat: number; lng: number };
  endVertex: { lat: number; lng: number };
}

function midpoint(geom: [number, number][]): { lat: number; lng: number } {
  if (geom.length < 2) return { lat: 0, lng: 0 };
  const total = geom.reduce(
    (acc, [lng, lat], i) => {
      if (i === 0) return acc;
      const [plng, plat] = geom[i - 1];
      const dx = lng - plng;
      const dy = lat - plat;
      const d = Math.sqrt(dx * dx + dy * dy);
      return {
        lat: acc.lat + ((plat + lat) / 2) * d,
        lng: acc.lng + ((plng + lng) / 2) * d,
        len: acc.len + d,
      };
    },
    { lat: 0, lng: 0, len: 0 },
  );
  if (!total.len) {
    const [lng, lat] = geom[0];
    return { lat, lng };
  }
  return { lat: total.lat / total.len, lng: total.lng / total.len };
}

/**
 * 該邊的 midpoint 60m 內哪些 active 積水回報？
 * 回傳 { weight: 給 cost 計算用（含 severity 加權）, ids: 給 UI 算 unique 用 }
 */
function nearbyFloodReports(
  edge: DenseEdge,
  reports: Report[] | undefined,
  influenceM: number,
): { weight: number; ids: string[] } {
  if (!reports?.length) return { weight: 0, ids: [] };
  const m = midpoint(edge.geom);
  let weight = 0;
  const ids: string[] = [];
  for (const r of reports) {
    if (r.status === 'resolved' || r.status === 'rejected') continue;
    if (r.category !== 'flooding' && r.category !== 'standing_water') continue;
    if (haversine(m, { lat: r.latitude, lng: r.longitude }) <= influenceM) {
      ids.push(r.id);
      weight += r.severity === 'high' ? 2 : 1;
    }
  }
  return { weight, ids };
}

function edgeCost(
  edge: DenseEdge,
  options: DenseRouteOptions,
): { cost: number; floodReports: number; floodReportIds: string[] } {
  const dist = edge.distance > 0 ? edge.distance : 1;
  if (options.mode === 'bike' && !edge.bikeAllowed) {
    return { cost: Number.POSITIVE_INFINITY, floodReports: 0, floodReportIds: [] };
  }

  // floodReports 永遠計算（用於 UI 統計 / avoided 比較）；
  // 是否「在 cost 裡懲罰」才由 ignoreWeather 決定
  const { weight: floodReports, ids: floodReportIds } = nearbyFloodReports(
    edge,
    options.reports,
    options.reportInfluenceMeters ?? 60,
  );

  if (options.ignoreWeather) {
    return { cost: dist, floodReports, floodReportIds };
  }

  const rawRain = rainPenaltyFactor(options.weather);
  // 「避水模式」：把雨勢底線拉到 0.85，即使無雨也偏好遮蔽 + 強烈避開積水點
  const r = options.avoidWater ? Math.max(rawRain, 0.85) : rawRain;

  // ── 1. 露天暴露懲罰（非線性）──
  // (1 - covered)^1.4 讓「半遮蔽」與「全暴露」拉開差距，
  // r=0 → 0；r=0.5 → 3.5；r=1 → 6.0
  const exposurePenalty =
    Math.pow(1 - edge.covered, 1.4) * (1.0 + 5.0 * r);

  // ── 2. 易積水段懲罰 ──
  // 即使無雨也輕微繞（地面可能還濕）；雨大時懲罰激增
  // r=0 → 0.3；r=0.5 → 3.6；r=1 → 6.8 倍
  const lowLyingPenalty = edge.lowLying * (0.3 + 6.5 * r);

  // ── 3. 積水回報懲罰（雨天 = 接近不可通行）──
  // floodReports 已含 severity 權重（high=2，其餘=1）
  // 1 份回報：r=0 → 1.0×；r=0.5 → 5.5×；r=1 → 10×
  // 2 份高嚴重度回報在大雨：penalty 20+ → 算法強制 200m 內繞行
  const floodPenalty = floodReports * (1.0 + 9.0 * r);

  // 多份回報疊加：3 份以上在中度以上雨勢視為「最差等級」，再加大乘數
  // 這保證大雨時 algorithm 不會「為了少走 50m 而衝過 3 個積水點」
  const surchargeForCluster =
    floodReports >= 3 && r > 0.4 ? floodReports * 4.0 * r : 0;

  const penalty =
    exposurePenalty + lowLyingPenalty + floodPenalty + surchargeForCluster;

  return {
    cost: dist * (1 + penalty),
    floodReports,
    floodReportIds,
  };
}

function classifyRisk(seg: {
  covered: number;
  lowLying: number;
  floodReports: number;
}): PlanSegment['risk'] {
  if (seg.floodReports > 0) return 'floodReport';
  if (seg.lowLying >= 0.5) return 'lowLying';
  if (seg.covered >= 0.7) return 'dry';
  if (seg.covered >= 0.3) return 'partial';
  return 'open';
}

interface PrevRecord {
  from: string;
  edge: DenseEdge;
  floodReports: number;
  floodReportIds: string[];
}

export function planDenseRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  options: DenseRouteOptions,
): DensePlan | null {
  const { vertices, adjacency } = loadGraph();
  const start = nearestVertex(startLat, startLng);
  const end = nearestVertex(endLat, endLng);
  if (start.id === end.id) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, PrevRecord>();
  dist.set(start.id, 0);

  const heap = new MinHeap<string>();
  heap.push(0, start.id);
  const visited = new Set<string>();

  while (heap.size()) {
    const popped = heap.pop()!;
    const u = popped.value;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === end.id) break;
    const cur = dist.get(u) ?? Infinity;
    const neighbors = adjacency.get(u) ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;
      const { cost, floodReports, floodReportIds } = edgeCost(edge, options);
      if (!Number.isFinite(cost)) continue;
      const alt = cur + cost;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, { from: u, edge, floodReports, floodReportIds });
        heap.push(alt, edge.to);
      }
    }
  }

  if (!prev.has(end.id)) return null;

  // 還原路徑（積累 segment + coords）
  type Seg = {
    from: string;
    to: string;
    edge: DenseEdge;
    floodReports: number;
    floodReportIds: string[];
  };
  const segs: Seg[] = [];
  let cur: string = end.id;
  while (prev.has(cur)) {
    const back = prev.get(cur)!;
    segs.unshift({
      from: back.from,
      to: cur,
      edge: back.edge,
      floodReports: back.floodReports,
      floodReportIds: back.floodReportIds,
    });
    cur = back.from;
  }

  // coord 串起來：每段邊的 geom 可能正向或反向；同時保存每段獨立 coords 供地圖染色
  const coords: [number, number][] = [];
  const segments: PlanSegment[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const fromV = vertices.get(s.from)!;
    let line: [number, number][] = s.edge.geom.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    if (line.length >= 2) {
      const d0 = haversine({ lat: line[0][0], lng: line[0][1] }, fromV);
      const dN = haversine(
        { lat: line[line.length - 1][0], lng: line[line.length - 1][1] },
        fromV,
      );
      if (dN < d0) line = line.slice().reverse();
    }
    if (i === 0) coords.push(...line);
    else coords.push(...line.slice(1));

    segments.push({
      coords: line,
      distance: s.edge.distance,
      covered: s.edge.covered,
      lowLying: s.edge.lowLying,
      floodReports: s.floodReports,
      risk: classifyRisk({
        covered: s.edge.covered,
        lowLying: s.edge.lowLying,
        floodReports: s.floodReports,
      }),
    });
  }

  const totalDistance = segs.reduce((s, x) => s + x.edge.distance, 0);
  const totalCost = segs.reduce((s, x) => {
    const { cost } = edgeCost(x.edge, options);
    return s + cost;
  }, 0);
  const coverageScore =
    totalDistance > 0
      ? segs.reduce((s, x) => s + x.edge.distance * x.edge.covered, 0) /
        totalDistance
      : 0;
  const lowLyingShare =
    totalDistance > 0
      ? segs
          .filter((s) => s.edge.lowLying >= 0.5)
          .reduce((s, x) => s + x.edge.distance, 0) / totalDistance
      : 0;
  // 收集所有沿途接觸到的 unique flood report id（避免「同一個 report 在 5 段內被算 5 次」）
  const uniqueIds = new Set<string>();
  for (const s of segs) {
    for (const id of s.floodReportIds) uniqueIds.add(id);
  }
  const passingFloodReports = uniqueIds.size;

  return {
    coords,
    segments,
    totalDistance,
    totalCost,
    coverageScore,
    lowLyingShare,
    passingFloodReports,
    passingFloodReportIds: Array.from(uniqueIds),
    startVertex: { lat: start.lat, lng: start.lng },
    endVertex: { lat: end.lat, lng: end.lng },
  };
}
