/**
 * 客戶端載入易積水區（給 Map 視覺化用）。
 *
 * 資料源是 src/data/flood-areas.json（同時被 build-dense-graph.mjs 套到 dense graph）。
 * 對於 kind='lineBuffer' 類型，會從 src/data/flood-roads-source.json 撈對應的 OSM way 幾何。
 *
 * 兩個 JSON 都靜態 import，bundle 後約 22KB（僅 client 顯示用，可接受）。
 */

import floodAreasJson from '@/data/flood-areas.json';
import floodRoadsJson from '@/data/flood-roads-source.json';

interface RawArea {
  id: string;
  name: string;
  score: number;
  kind: 'polygon' | 'lineBuffer';
  poly?: [number, number][]; // [lat, lng]
  bufferMeters?: number;
  osmWayIds?: number[];
  note?: string;
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

export type FloodShape =
  | {
      kind: 'polygon';
      id: string;
      name: string;
      score: number;
      coords: [number, number][];
    }
  | {
      kind: 'line';
      id: string;
      name: string;
      score: number;
      bufferMeters: number;
      lines: [number, number][][];
    };

export function loadFloodAreas(): FloodShape[] {
  const out: FloodShape[] = [];
  const areas = (floodAreasJson as { areas: RawArea[] }).areas;
  for (const a of areas) {
    if (a.kind === 'polygon' && a.poly?.length) {
      out.push({
        kind: 'polygon',
        id: a.id,
        name: a.name,
        score: a.score,
        coords: a.poly,
      });
    } else if (a.kind === 'lineBuffer' && a.osmWayIds?.length) {
      const lines: [number, number][][] = [];
      for (const wayId of a.osmWayIds) {
        const line = ROAD_BY_ID.get(wayId);
        if (line) lines.push(line);
      }
      if (lines.length) {
        out.push({
          kind: 'line',
          id: a.id,
          name: a.name,
          score: a.score,
          bufferMeters: a.bufferMeters ?? 15,
          lines,
        });
      }
    }
  }
  return out;
}
