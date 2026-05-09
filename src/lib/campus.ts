/**
 * 台大校園「防雨步行/腳踏車」路網。
 *
 * 資料源：src/data/campus.geojson（標準 GeoJSON FeatureCollection）
 *
 * - Point feature 為節點，properties: { kind: 'node', id, name, primary? }
 * - LineString feature 為邊，properties: { kind: 'edge', a, b, covered, lowLying, bikeAllowed, via? }
 *   geometry.coordinates 為「沿實際道路的折線座標」，可用作地圖繪製的 fallback。
 *
 * 想新增/修改路徑只要編輯該 .geojson 檔即可，介面層無需改動。
 */

import campusGeoJSON from '@/data/campus.geojson';

export interface CampusNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  primary?: boolean;
}

export interface CampusEdge {
  a: string;
  b: string;
  /** 公尺；若不填會自動以兩端座標計算 */
  distance?: number;
  /** 0~1，越大代表越能遮蔽雨水 */
  covered: number;
  /** 0~1，越大代表越容易積水/淹水 */
  lowLying: number;
  bikeAllowed: boolean;
  via?: string;
  /** GeoJSON LineString 的 [lng, lat] 折線；用於地圖繪製 fallback。 */
  geometry?: [number, number][];
}

interface NodeProps {
  kind: 'node';
  id: string;
  name: string;
  primary?: boolean;
}

interface EdgeProps {
  kind: 'edge';
  a: string;
  b: string;
  covered: number;
  lowLying: number;
  bikeAllowed: boolean;
  via?: string;
  distance?: number;
}

function parseGeoJSON() {
  const nodes: CampusNode[] = [];
  const edges: CampusEdge[] = [];
  for (const f of campusGeoJSON.features) {
    // 先過 unknown 才能轉成不重疊的 union type — 否則 TS2352 在 prod build 會炸
    const props = f.properties as unknown as NodeProps | EdgeProps;
    if (props.kind === 'node' && f.geometry.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates;
      nodes.push({
        id: props.id,
        name: props.name,
        lat,
        lng,
        primary: props.primary,
      });
    } else if (props.kind === 'edge' && f.geometry.type === 'LineString') {
      edges.push({
        a: props.a,
        b: props.b,
        covered: props.covered,
        lowLying: props.lowLying,
        bikeAllowed: props.bikeAllowed,
        via: props.via,
        distance: props.distance,
        geometry: f.geometry.coordinates as [number, number][],
      });
    }
  }
  return { nodes, edges };
}

const parsed = parseGeoJSON();

export const CAMPUS_NODES: CampusNode[] = parsed.nodes;
export const CAMPUS_EDGES: CampusEdge[] = parsed.edges;

const NODE_MAP = new Map(CAMPUS_NODES.map((n) => [n.id, n]));

export function getNode(id: string): CampusNode | undefined {
  return NODE_MAP.get(id);
}

/** Haversine 距離（公尺） */
export function haversine(
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

/**
 * 取得邊的距離：
 * 1. properties 已指定 → 採用
 * 2. 有 LineString geometry → 沿折線累加
 * 3. fallback → 兩端 haversine
 */
export function getEdgeDistance(e: CampusEdge): number {
  if (typeof e.distance === 'number') return e.distance;
  if (e.geometry && e.geometry.length >= 2) {
    let sum = 0;
    for (let i = 1; i < e.geometry.length; i++) {
      const [lng1, lat1] = e.geometry[i - 1];
      const [lng2, lat2] = e.geometry[i];
      sum += haversine({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
    }
    return sum;
  }
  const A = getNode(e.a);
  const B = getNode(e.b);
  if (!A || !B) return Number.POSITIVE_INFINITY;
  return haversine(A, B);
}

/** 找最接近的節點（給點選地圖選起終點時使用） */
export function nearestNode(lat: number, lng: number): CampusNode {
  let best = CAMPUS_NODES[0];
  let bestD = haversine(best, { lat, lng });
  for (const n of CAMPUS_NODES) {
    const d = haversine(n, { lat, lng });
    if (d < bestD) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/**
 * 取得邊的 fallback 折線（GeoJSON 內預存的 LineString，[lng, lat] 順序）。
 * 用於 OSRM 失敗時的地圖繪製。
 */
export function edgeFallbackGeometry(e: CampusEdge): [number, number][] {
  if (e.geometry && e.geometry.length >= 2) return e.geometry;
  const A = getNode(e.a);
  const B = getNode(e.b);
  if (!A || !B) return [];
  return [
    [A.lng, A.lat],
    [B.lng, B.lat],
  ];
}
