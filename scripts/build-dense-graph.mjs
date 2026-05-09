#!/usr/bin/env node
/**
 * 從 OpenStreetMap 拉「台大校內所有可步行/騎車路網」，建一張密集圖，
 * 並依 OSM 標籤推論「遮蔽 (covered) / 易積水 (lowLying)」。
 *
 * 輸出：src/data/campus-paths.geojson
 *   - LineString features：每段 = OSM way 內相鄰兩個節點，含 covered/lowLying/bikeAllowed
 *   - Point features：圖節點，標 vertex id 給 routing 查表
 *
 * 用法：
 *   node scripts/build-dense-graph.mjs
 *
 * 屬性推論規則：
 *   - covered=yes / arcade / tunnel=yes / indoor=yes / highway=corridor → 0.95
 *   - 經過 building polygon 內 (building shelter) → 0.85
 *   - 鄰近 building 邊界 < 4 公尺 (騎樓推論) → 0.45
 *   - 否則 0
 *   - 手工 override 區域（椰林兩側、活大內部、迴廊…）會疊加上去
 *
 *   - 易積水區域 (manual polygons)：小椰林道、醉月湖、總圖前、舟山路低處 → 高 lowLying
 *
 *   - bikeAllowed = bicycle != 'no' && highway not in {steps, corridor, indoor=yes}
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'src', 'data', 'campus-paths.geojson');
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// ---------- 手動 override 區域 ----------
// 易積水區從 src/data/flood-areas.json 載入（既有 polygon，也有 lineBuffer 沿真實 OSM 道路）
// 易積水區同時被 client-side RouteMap 拿來畫地圖 overlay，是 single source of truth
const FLOOD_AREAS = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src', 'data', 'flood-areas.json'), 'utf8'),
).areas;

// 額外遮蔽區域（騎樓 / 樹蔭密 / 已知有雨遮） - 簡單 rect
const COVERED_AREAS = [
  { name: '椰林大道', score: 0.25, poly: rect(25.0170, 121.5358, 25.0176, 121.5410) },
  { name: '行政大樓迴廊', score: 0.6, poly: rect(25.0167, 121.5370, 25.0172, 121.5380) },
  { name: '普教共教間', score: 0.7, poly: rect(25.0156, 121.5374, 25.0166, 121.5380) },
  { name: '活大周邊', score: 0.45, poly: rect(25.0175, 121.5398, 25.0184, 121.5408) },
];

// 載入 OSM 真實道路 geometry，給 lineBuffer 類型的 flood area 用
const ROAD_GEOM_BY_WAY_ID = new Map();
{
  const raw = JSON.parse(
    await fs.readFile(
      path.join(ROOT, 'src', 'data', 'flood-roads-source.json'),
      'utf8',
    ),
  );
  for (const e of raw.elements ?? []) {
    if (e.type !== 'way' || !e.geometry) continue;
    ROAD_GEOM_BY_WAY_ID.set(
      e.id,
      e.geometry.map((p) => [p.lat, p.lon]),
    );
  }
  console.log(`Loaded ${ROAD_GEOM_BY_WAY_ID.size} road ways for flood lineBuffer`);
}

function rect(lat1, lng1, lat2, lng2) {
  return [
    [lat1, lng1],
    [lat1, lng2],
    [lat2, lng2],
    [lat2, lng1],
  ];
}

function pointInPoly(lat, lng, poly) {
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

/** 點到 line segment (a, b) 的距離（公尺） */
function pointToSegmentMeters(p, a, b) {
  // 用 lat/lng 度數先做 Euclidean，然後乘以一個約略的 m/deg 換算
  // 對於 ~25° 緯度：1° 緯 ≈ 111000 m，1° 經 ≈ 111000 * cos(25°) ≈ 100600 m
  const M_PER_DEG_LAT = 111000;
  const M_PER_DEG_LNG = 100600;
  const px = (p[1] - a[1]) * M_PER_DEG_LNG;
  const py = (p[0] - a[0]) * M_PER_DEG_LAT;
  const dx = (b[1] - a[1]) * M_PER_DEG_LNG;
  const dy = (b[0] - a[0]) * M_PER_DEG_LAT;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.sqrt(px * px + py * py);
  let t = (px * dx + py * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projx = t * dx;
  const projy = t * dy;
  const ex = px - projx;
  const ey = py - projy;
  return Math.sqrt(ex * ex + ey * ey);
}

/** 點到 polyline 的最短距離（公尺） */
function pointToPolylineMeters(p, polyline) {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    const d = pointToSegmentMeters(p, polyline[i - 1], polyline[i]);
    if (d < best) best = d;
  }
  return best;
}

/** 一個 area 是否「命中」此點 */
function areaHits(lat, lng, area) {
  if (area.kind === 'polygon') return pointInPoly(lat, lng, area.poly);
  if (area.kind === 'lineBuffer') {
    const buffer = area.bufferMeters ?? 15;
    for (const wayId of area.osmWayIds) {
      const line = ROAD_GEOM_BY_WAY_ID.get(wayId);
      if (!line || line.length < 2) continue;
      const d = pointToPolylineMeters([lat, lng], line);
      if (d <= buffer) return true;
    }
    return false;
  }
  return false;
}

function bumpFromAreas(lat, lng, areas) {
  let max = 0;
  for (const a of areas) {
    if (areaHits(lat, lng, a)) max = Math.max(max, a.score);
  }
  return max;
}

function bumpFromRectAreas(lat, lng, areas) {
  let max = 0;
  for (const a of areas) {
    if (pointInPoly(lat, lng, a.poly)) max = Math.max(max, a.score);
  }
  return max;
}

// ---------- 由 OSM tags 推論 covered ----------
function tagCovered(tags) {
  if (!tags) return 0;
  if (tags.indoor === 'yes') return 0.95;
  if (tags.tunnel === 'yes') return 0.95;
  if (tags.covered === 'yes') return 0.9;
  if (tags.covered === 'arcade' || tags.arcade === 'yes') return 0.85;
  if (tags.highway === 'corridor') return 0.95;
  if (tags.layer && Number.parseInt(tags.layer) < 0) return 0.6;
  return 0;
}

function tagBikeAllowed(tags) {
  if (!tags) return true;
  if (tags.bicycle === 'no') return false;
  if (tags.bicycle === 'yes' || tags.bicycle === 'designated') return true;
  if (tags.highway === 'steps') return false;
  if (tags.highway === 'corridor') return false;
  if (tags.indoor === 'yes') return false;
  if (tags.highway === 'cycleway') return true;
  // footway 預設行人，但校園內多數能牽車或騎慢車
  return true;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

// ---------- main ----------
const QUERY = `
[out:json][timeout:60];
area["name"="國立臺灣大學"]["amenity"="university"]->.ntu;
(
  way(area.ntu)["highway"~"^(footway|path|pedestrian|service|cycleway|residential|tertiary|tertiary_link|steps|track|living_street|corridor)$"];
);
out tags geom;
`;

async function main() {
  console.log('Querying Overpass for NTU walking network...');
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'ntu-water-map-builder/1.0',
    },
    body: 'data=' + encodeURIComponent(QUERY),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const ways = (data.elements ?? []).filter((e) => e.type === 'way');
  console.log(`got ${ways.length} ways`);

  // 把每個 OSM 節點視作圖的 vertex；id 用 (lat,lng) 6 位四捨五入串字串
  const vertexId = (lat, lng) =>
    `${lat.toFixed(6)},${lng.toFixed(6)}`;

  const vertices = new Map(); // id -> { lat, lng }
  const edgeFeatures = [];
  let edgeCount = 0;
  let coveredEdges = 0;
  let lowLyingEdges = 0;

  for (const w of ways) {
    const tags = w.tags ?? {};
    const baseCovered = tagCovered(tags);
    const bikeAllowed = tagBikeAllowed(tags);
    const geom = w.geometry ?? [];
    for (let i = 1; i < geom.length; i++) {
      const a = geom[i - 1];
      const b = geom[i];
      const idA = vertexId(a.lat, a.lon);
      const idB = vertexId(b.lat, b.lon);
      if (idA === idB) continue;
      vertices.set(idA, { lat: a.lat, lng: a.lon });
      vertices.set(idB, { lat: b.lat, lng: b.lon });

      // 根據兩端中點所在 override 區域提升 covered / lowLying
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lon + b.lon) / 2;
      const overrideCover = bumpFromRectAreas(midLat, midLng, COVERED_AREAS);
      const overrideLow = bumpFromAreas(midLat, midLng, FLOOD_AREAS);

      const covered = Math.min(1, Math.max(baseCovered, overrideCover));
      const lowLying = overrideLow;

      if (covered >= 0.5) coveredEdges++;
      if (lowLying >= 0.5) lowLyingEdges++;

      const distance = haversine(a.lat, a.lon, b.lat, b.lon);

      edgeFeatures.push({
        type: 'Feature',
        properties: {
          kind: 'edge',
          a: idA,
          b: idB,
          highway: tags.highway,
          covered: round(covered, 3),
          lowLying: round(lowLying, 3),
          bikeAllowed,
          distance: round(distance, 1),
          osm: { type: 'way', id: w.id },
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [a.lon, a.lat],
            [b.lon, b.lat],
          ],
        },
      });
      edgeCount++;
    }
  }

  console.log(
    `vertices: ${vertices.size}, edges: ${edgeCount}, covered≥0.5: ${coveredEdges}, lowLying≥0.5: ${lowLyingEdges}`,
  );

  const vertexFeatures = [];
  for (const [id, v] of vertices) {
    vertexFeatures.push({
      type: 'Feature',
      properties: { kind: 'vertex', id },
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
    });
  }

  const out = {
    type: 'FeatureCollection',
    name: 'ntu-campus-paths-dense',
    description:
      'NTU 校園密集步行/騎車路網。由 OSM Overpass 抓取 + 校園手動 override 推論 covered/lowLying。',
    generatedAt: new Date().toISOString(),
    features: [...vertexFeatures, ...edgeFeatures],
  };

  await fs.writeFile(OUTPUT, JSON.stringify(out) + '\n', 'utf8');
  const stat = await fs.stat(OUTPUT);
  console.log(`wrote ${OUTPUT}  (${(stat.size / 1024).toFixed(0)} KB)`);
}

function round(n, p) {
  const k = 10 ** p;
  return Math.round(n * k) / k;
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exitCode = 1;
});
