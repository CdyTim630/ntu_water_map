#!/usr/bin/env node
/**
 * 把 src/data/campus.geojson 內每個地標明確鎖定到一個特定 OSM 物件，
 * 然後從 Overpass 抓回真實座標寫回。
 *
 * 與 refresh-campus-osm.mjs 的差別：本腳本是「初次建立 osm reference」用，
 * 對於每個 campus_id 直接指定 (type, id)，避免名稱比對失誤；
 * refresh-campus-osm.mjs 是已經有 reference 後的定期同步。
 *
 * 用法：
 *   node scripts/discover-osm-landmarks.mjs           # 寫入 GeoJSON
 *   node scripts/discover-osm-landmarks.mjs --dry-run # 只列要更新什麼
 *
 * 註：每個 campus_id 的 OSM 對應由人工挑過（透過 ./scripts/discover-osm-landmarks-debug.mjs
 * 之類工具，或直接逛 https://www.openstreetmap.org），確認對到正確的建築/物件。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GEOJSON_PATH = path.join(ROOT, 'src', 'data', 'campus.geojson');
const OVERPASS = 'https://overpass-api.de/api/interpreter';

/**
 * 校園地標 → OSM 物件 (type, id)。null = 沒有合適 OSM ref，保留手動座標。
 *
 * 這份對照是經過人工從 OSM 抓回的 named features 中挑選後寫死的，
 * 對應的 OSM 物件名稱列在註解裡作為線索。
 */
const ANCHORS = {
  // 已經在 GeoJSON 裡有 osm ref 的不重覆寫
  // (liberal_arts/common_teach/second_student_center/lu_ming/new_gym/civil_eng/science/social_science)

  // 校門口 = 台大正門 (羅斯福路四段) — OSM relation 標 historic=monument, wikidata=Q10927210
  // 之前的手動座標偏東 200m，這次會修正到真實的校門位置
  main_gate: { type: 'relation', id: 2589022 },

  // 傅鐘
  fu_bell: { type: 'node', id: 472493077 },

  // 行政大樓：relation 的 building polygon，bbox center 約在建築中心
  admin: { type: 'relation', id: 2589021 },

  // 校史館：node 標記
  history_hall: { type: 'node', id: 1707866520 },

  // 普通教學館：building polygon way（之前手動座標偏 260m，這次會修正）
  general_teach: { type: 'way', id: 1303517415 },

  // 總圖書館
  main_library: { type: 'relation', id: 14045849 },

  // 第一學生活動中心
  student_center: { type: 'relation', id: 14045855 },

  // 舊體育館 = 臺大體育館 (sports_centre)
  old_gym: { type: 'way', id: 1052252308 },

  // 工綜館（南側）
  engineering: { type: 'node', id: 8256951659 },

  // 醉月湖
  drunk_moon_lake: { type: 'relation', id: 206483 },

  // 小椰林道
  small_palm: { type: 'way', id: 1320960190 },

  // 椰林大道
  palm_avenue_mid: { type: 'way', id: 1320961818 },

  // 辛亥路側門：OSM 上沒有具體 gate，最近的是辛亥地下停車場入口。保留手動。
  side_gate_xinhai: null,

  // 新生南路側門：OSM 沒有對應 named feature。保留手動。
  side_gate_xinsheng: null,
};

const DRY_RUN = process.argv.includes('--dry-run');

async function fetchOverpass(query, attempt = 1) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ntu-water-map/0.1 (discover-osm-landmarks)',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if ((res.status === 429 || res.status === 504) && attempt < 4) {
    const wait = attempt * 5000;
    console.log(`  Overpass ${res.status}, retry in ${wait / 1000}s...`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchOverpass(query, attempt + 1);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Overpass HTTP ${res.status}: ${t.slice(0, 160)}`);
  }
  return res.json();
}

async function main() {
  const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  const nodes = data.features.filter((f) => f.properties.kind === 'node');
  const targetIds = Object.entries(ANCHORS).filter(([, v]) => v !== null);
  console.log(`# Configured anchors: ${Object.keys(ANCHORS).length}, will fetch: ${targetIds.length}`);

  // Build batch query
  const wayIds = targetIds.filter(([, v]) => v.type === 'way').map(([, v]) => v.id);
  const nodeIds = targetIds.filter(([, v]) => v.type === 'node').map(([, v]) => v.id);
  const relIds = targetIds.filter(([, v]) => v.type === 'relation').map(([, v]) => v.id);
  const parts = [];
  if (wayIds.length) parts.push(`way(id:${wayIds.join(',')});`);
  if (nodeIds.length) parts.push(`node(id:${nodeIds.join(',')});`);
  if (relIds.length) parts.push(`relation(id:${relIds.join(',')});`);
  const query = `[out:json][timeout:60];\n(${parts.join('\n  ')});\nout center tags;`;

  console.log('Querying Overpass...');
  const resp = await fetchOverpass(query);
  const elements = resp.elements ?? [];
  const byKey = new Map();
  for (const e of elements) {
    let lat, lng;
    if (e.type === 'node') {
      lat = e.lat;
      lng = e.lon;
    } else if (e.center) {
      lat = e.center.lat;
      lng = e.center.lon;
    }
    if (lat == null) continue;
    byKey.set(`${e.type}/${e.id}`, { lat, lng, tags: e.tags || {} });
  }
  console.log(`got ${byKey.size}/${targetIds.length} elements back.`);

  let updated = 0;
  let skipped = 0;
  for (const n of nodes) {
    const id = n.properties.id;
    const anchor = ANCHORS[id];
    if (anchor === undefined) {
      // No rule — leave as-is (e.g., already-resolved nodes)
      continue;
    }
    if (anchor === null) {
      console.log(`  · ${id.padEnd(20)} → keep manual (no OSM anchor)`);
      skipped++;
      continue;
    }
    const key = `${anchor.type}/${anchor.id}`;
    const entry = byKey.get(key);
    if (!entry) {
      console.log(`  ⚠ ${id.padEnd(20)} → ${key} not returned by Overpass`);
      continue;
    }
    const [oldLng, oldLat] = n.geometry.coordinates;
    const before = `(${oldLat.toFixed(5)}, ${oldLng.toFixed(5)})`;
    const after = `(${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)})`;
    const dx = haversine({ lat: oldLat, lng: oldLng }, entry);
    console.log(
      `  ✓ ${id.padEnd(20)} → ${key.padEnd(18)} ${before} → ${after}  Δ${dx.toFixed(0)}m  "${entry.tags?.name ?? ''}"`,
    );
    if (!DRY_RUN) {
      n.properties.osm = { type: anchor.type, id: anchor.id };
      n.properties.osmName = entry.tags?.name ?? n.properties.osmName;
      n.geometry.coordinates = [
        Math.round(entry.lng * 1e7) / 1e7,
        Math.round(entry.lat * 1e7) / 1e7,
      ];
      updated++;
    }
  }

  if (!DRY_RUN && updated > 0) {
    // 同步邊：每條邊 LineString 端點換成新節點座標
    const idToLatLng = new Map();
    for (const n of nodes) {
      const [lng, lat] = n.geometry.coordinates;
      idToLatLng.set(n.properties.id, { lat, lng });
    }
    for (const f of data.features) {
      if (f.properties.kind !== 'edge' || f.geometry.type !== 'LineString')
        continue;
      const a = idToLatLng.get(f.properties.a);
      const b = idToLatLng.get(f.properties.b);
      if (!a || !b) continue;
      f.geometry.coordinates = [
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
    console.log(`Updated ${updated} nodes; ${skipped} kept manual.`);
  } else if (DRY_RUN) {
    console.log(`\n[dry-run] would update ${updated}; keep manual ${skipped}.`);
  } else {
    console.log(`\nNothing changed.`);
  }
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exitCode = 1;
});
