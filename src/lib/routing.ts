import {
  CAMPUS_EDGES,
  CAMPUS_NODES,
  CampusEdge,
  CampusNode,
  getEdgeDistance,
  getNode,
  haversine,
} from './campus';
import type { Report } from './types';
import { rainPenaltyFactor, type WeatherSnapshot } from './weather';

export type TravelMode = 'walk' | 'bike';

export interface RouteOptions {
  mode: TravelMode;
  weather: WeatherSnapshot;
  reports?: Report[];
  /** 將積水回報納入計算的最大距離（公尺）。預設 60 公尺。 */
  reportInfluenceMeters?: number;
  /**
   * 純距離模式：如果只想看「最短路」就傳 true，會忽略所有遮蔽 / 積水 / 雨勢權重。
   */
  ignoreWeather?: boolean;
}

export interface RouteSegment {
  edge: CampusEdge;
  from: CampusNode;
  to: CampusNode;
  distance: number;
  /** 該段加權後的成本（用於排序解釋） */
  cost: number;
  /** 該段是否有「主要保護」(covered >= 0.5) */
  isCovered: boolean;
  /** 是否包含易積水段 */
  isLowLying: boolean;
  /** 附近 active flooding 回報數 */
  nearbyFloodReports: number;
}

export interface RoutePlan {
  nodes: CampusNode[];
  segments: RouteSegment[];
  totalDistance: number;
  totalCost: number;
  /** 路徑覆蓋率：covered 加權平均 */
  coverageScore: number;
  /** 易積水路段比例 */
  lowLyingShare: number;
  /** 經過 active 積水回報的路段數 */
  passingFloodReports: number;
}

interface Adj {
  edge: CampusEdge;
  from: string;
  to: string;
}

const adjacency = new Map<string, Adj[]>();
for (const edge of CAMPUS_EDGES) {
  if (!adjacency.has(edge.a)) adjacency.set(edge.a, []);
  if (!adjacency.has(edge.b)) adjacency.set(edge.b, []);
  adjacency.get(edge.a)!.push({ edge, from: edge.a, to: edge.b });
  adjacency.get(edge.b)!.push({ edge, from: edge.b, to: edge.a });
}

function countNearbyFloodReports(
  edge: CampusEdge,
  reports: Report[] | undefined,
  influenceM: number,
): number {
  if (!reports?.length) return 0;
  const A = getNode(edge.a)!;
  const B = getNode(edge.b)!;
  const mid = { lat: (A.lat + B.lat) / 2, lng: (A.lng + B.lng) / 2 };
  let n = 0;
  for (const r of reports) {
    if (r.status === 'resolved' || r.status === 'rejected') continue;
    if (r.category !== 'flooding' && r.category !== 'standing_water') continue;
    if (haversine(mid, { lat: r.latitude, lng: r.longitude }) <= influenceM) {
      n += r.severity === 'high' ? 2 : 1;
    }
  }
  return n;
}

/**
 * 邊權公式：
 *   cost = distance * (1 + rainFactor * (
 *            exposureWeight * (1 - covered)
 *          + lowLyingWeight * lowLying
 *          + reportWeight   * floodReports
 *          ))
 * 不下雨時 cost ≒ distance（仍會輕微受 PoP 影響）。
 */
function edgeCost(
  edge: CampusEdge,
  options: RouteOptions,
): { cost: number; floodReports: number } {
  const dist = getEdgeDistance(edge);
  if (options.mode === 'bike' && !edge.bikeAllowed) {
    return { cost: Number.POSITIVE_INFINITY, floodReports: 0 };
  }
  if (options.ignoreWeather) {
    return { cost: dist, floodReports: 0 };
  }

  const rainFactor = rainPenaltyFactor(options.weather);
  const floodReports = countNearbyFloodReports(
    edge,
    options.reports,
    options.reportInfluenceMeters ?? 60,
  );

  // 權重經驗值：在大雨時暴露段最多增加 ~2x、嚴重低窪段增加 ~1.5x
  const exposureMultiplier = 2.0;
  const lowLyingMultiplier = 1.8;
  const reportMultiplier = 0.6;

  const penalty =
    rainFactor *
    (exposureMultiplier * (1 - edge.covered) +
      lowLyingMultiplier * edge.lowLying +
      reportMultiplier * floodReports);

  // 即使雨小，遇到 active 積水回報也應加成
  const reportFloor = floodReports > 0 ? 0.4 * floodReports : 0;

  return {
    cost: dist * (1 + penalty + reportFloor),
    floodReports,
  };
}

export function planRoute(
  startNodeId: string,
  endNodeId: string,
  options: RouteOptions,
): RoutePlan | null {
  if (startNodeId === endNodeId) return null;
  const start = getNode(startNodeId);
  const end = getNode(endNodeId);
  if (!start || !end) return null;

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<
    string,
    { node: string; edge: CampusEdge; floodReports: number }
  >();

  for (const n of CAMPUS_NODES) dist.set(n.id, Number.POSITIVE_INFINITY);
  dist.set(start.id, 0);

  const visited = new Set<string>();
  // 簡單 priority queue：節點少（< 30），用線性掃描即可
  while (visited.size < CAMPUS_NODES.length) {
    let u: string | null = null;
    let uDist = Number.POSITIVE_INFINITY;
    for (const [k, v] of dist) {
      if (!visited.has(k) && v < uDist) {
        u = k;
        uDist = v;
      }
    }
    if (u === null || uDist === Number.POSITIVE_INFINITY) break;
    if (u === end.id) break;
    visited.add(u);

    const neighbors = adjacency.get(u) ?? [];
    for (const { edge, to } of neighbors) {
      if (visited.has(to)) continue;
      const { cost, floodReports } = edgeCost(edge, options);
      if (!Number.isFinite(cost)) continue;
      const alt = uDist + cost;
      if (alt < (dist.get(to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(to, alt);
        prev.set(to, { node: u, edge, floodReports });
      }
    }
  }

  if (!prev.has(end.id) && start.id !== end.id) return null;

  // 還原路徑
  const nodes: CampusNode[] = [];
  const segments: RouteSegment[] = [];
  let cursor: string | null = end.id;
  while (cursor) {
    const node = getNode(cursor);
    if (node) nodes.unshift(node);
    const back = prev.get(cursor);
    if (!back) break;
    const fromNode = getNode(back.node)!;
    const toNode = getNode(cursor)!;
    const distance = getEdgeDistance(back.edge);
    const { cost } = edgeCost(back.edge, options);
    segments.unshift({
      edge: back.edge,
      from: fromNode,
      to: toNode,
      distance,
      cost,
      isCovered: back.edge.covered >= 0.5,
      isLowLying: back.edge.lowLying >= 0.5,
      nearbyFloodReports: back.floodReports,
    });
    cursor = back.node;
  }

  if (!nodes.length) return null;

  const totalDistance = segments.reduce((s, x) => s + x.distance, 0);
  const totalCost = segments.reduce((s, x) => s + x.cost, 0);
  const coverageScore =
    totalDistance > 0
      ? segments.reduce((s, x) => s + x.distance * x.edge.covered, 0) /
        totalDistance
      : 0;
  const lowLyingShare =
    totalDistance > 0
      ? segments
          .filter((s) => s.isLowLying)
          .reduce((s, x) => s + x.distance, 0) / totalDistance
      : 0;
  const passingFloodReports = segments.reduce(
    (s, x) => s + x.nearbyFloodReports,
    0,
  );

  return {
    nodes,
    segments,
    totalDistance,
    totalCost,
    coverageScore,
    lowLyingShare,
    passingFloodReports,
  };
}
