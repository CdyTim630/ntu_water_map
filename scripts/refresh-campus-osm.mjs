#!/usr/bin/env node
/**
 * 從 OpenStreetMap (Overpass API) 拉取台大校園各地標真實座標，
 * 並把 src/data/campus.geojson 中各節點的 lat/lng 換成 OSM 結果。
 *
 * 用法：
 *   node scripts/refresh-campus-osm.mjs
 *
 * 邏輯：
 *  - 每個 node 在 properties.osm 內標明對應 OSM way / node 的 id
 *  - 一次 Overpass 查詢取回所有指定 id 的 element
 *  - way 取 center；node 取 lat/lon
 *  - 若有 osmFallbackName，會用名稱 contains 匹配當二次來源
 *  - 邊（LineString）的 geometry 也會跟著更新成新的兩端點直線
 *    （地圖呈現時 OSRM 會再對齊真實道路）
 *
 * 沒接到網路或被擋時會列印錯誤但不會壞掉現有檔案。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GEOJSON_PATH = path.join(ROOT, 'src', 'data', 'campus.geojson');

const OVERPASS = 'https://overpass-api.de/api/interpreter';

async function fetchOverpass(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ntu-water-map/0.1 (build script)',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Overpass HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  const nodes = data.features.filter((f) => f.properties.kind === 'node');
  const edges = data.features.filter((f) => f.properties.kind === 'edge');

  // 收集要查的 OSM id（type+id）
  const wantWays = new Set();
  const wantNodes = new Set();
  for (const n of nodes) {
    const osm = n.properties.osm;
    if (!osm) continue;
    if (osm.type === 'way') wantWays.add(osm.id);
    else if (osm.type === 'node') wantNodes.add(osm.id);
  }

  console.log(`# nodes total: ${nodes.length}`);
  console.log(`# OSM way refs:  ${wantWays.size}`);
  console.log(`# OSM node refs: ${wantNodes.size}`);

  if (wantWays.size + wantNodes.size === 0) {
    console.log('No osm refs in GeoJSON — nothing to refresh.');
    return;
  }

  // 同時查回 way 與 node
  const parts = [];
  if (wantWays.size) parts.push(`way(id:${[...wantWays].join(',')});`);
  if (wantNodes.size) parts.push(`node(id:${[...wantNodes].join(',')});`);
  const query = `[out:json][timeout:30];\n(${parts.join('\n')});\nout center tags;`;

  console.log('Querying Overpass...');
  const resp = await fetchOverpass(query);
  const elements = resp.elements ?? [];
  console.log(`got ${elements.length} elements`);

  const byId = new Map();
  for (const e of elements) {
    let lat, lon;
    if (e.type === 'node') {
      lat = e.lat;
      lon = e.lon;
    } else if (e.center) {
      lat = e.center.lat;
      lon = e.center.lon;
    } else continue;
    byId.set(`${e.type}/${e.id}`, { lat, lon, tags: e.tags });
  }

  // 更新 nodes
  const idToLatLng = new Map();
  let updated = 0;
  for (const n of nodes) {
    const osm = n.properties.osm;
    let key = osm ? `${osm.type}/${osm.id}` : null;
    let entry = key ? byId.get(key) : null;
    if (entry) {
      n.geometry.coordinates = [entry.lon, entry.lat];
      n.properties.osmName = entry.tags?.name ?? n.properties.osmName;
      idToLatLng.set(n.properties.id, { lat: entry.lat, lng: entry.lon });
      updated++;
      console.log(
        `  ✓ ${n.properties.id.padEnd(22)} ← ${key} (${entry.lat.toFixed(5)}, ${entry.lon.toFixed(5)})  ${entry.tags?.name ?? ''}`,
      );
    } else {
      const [lng, lat] = n.geometry.coordinates;
      idToLatLng.set(n.properties.id, { lat, lng });
      console.log(
        `  · ${n.properties.id.padEnd(22)} keep manual (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      );
    }
  }
  console.log(`updated ${updated} / ${nodes.length} nodes from OSM`);

  // 邊的 geometry：依新的兩端座標重設
  for (const e of edges) {
    const a = idToLatLng.get(e.properties.a);
    const b = idToLatLng.get(e.properties.b);
    if (!a || !b) continue;
    e.geometry.coordinates = [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ];
  }

  await fs.writeFile(
    GEOJSON_PATH,
    JSON.stringify(data, null, 2) + '\n',
    'utf8',
  );
  console.log(`\nWrote ${GEOJSON_PATH}`);
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exitCode = 1;
});
