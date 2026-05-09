/**
 * 透過 OSRM Public API 將我們選好的節點序列轉成「沿真實道路」的折線幾何。
 *
 * 公開 OSRM demo:  https://router.project-osrm.org
 * Profile 對應：walk → foot, bike → bike
 */

export type OsrmProfile = 'foot' | 'bike';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

export interface OsrmRouteResult {
  /** [lat, lng] 順序，給 Leaflet 直接畫線 */
  coordinates: [number, number][];
  /** OSRM 估算的距離（公尺） */
  distance: number;
  /** OSRM 估算的時間（秒） */
  duration: number;
  source: 'osrm';
}

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }[];
  message?: string;
}

/**
 * @param coords  以 [lat, lng] 表達的節點序列
 * @param profile 'foot' | 'bike'
 */
export async function fetchOsrmRoute(
  coords: [number, number][],
  profile: OsrmProfile,
): Promise<OsrmRouteResult | null> {
  if (coords.length < 2) return null;
  // OSRM 需要 lng,lat 順序，多點以 ; 串接
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${OSRM_BASE}/${profile}/${path}?overview=full&geometries=geojson&continue_straight=false`;
  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 }, // 校園動線變動少，cache 一天
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmResponse;
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  const route = data.routes[0];
  // OSRM 回傳 [lng, lat]；轉成 [lat, lng]
  const coordinates = route.geometry.coordinates.map(
    ([lng, lat]) => [lat, lng] as [number, number],
  );
  return {
    coordinates,
    distance: route.distance,
    duration: route.duration,
    source: 'osrm',
  };
}
