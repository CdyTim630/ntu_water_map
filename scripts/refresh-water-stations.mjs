#!/usr/bin/env node
/**
 * NTU 校區飲水機資料 — 雙來源融合：
 *   ① OSM Overpass `amenity=drinking_water`（社群貢獻、最完整）
 *   ② 北水處 OpenData「臺北市所屬直飲臺」（官方、有水質採樣 + 即時狀態 + 照片）
 *
 * 校內多數飲水機是各系館自管，沒有完整官方公開資料。OSM 目前 ~25 筆最齊全；
 * 北水處 OpenData 在 NTU 校區只覆蓋少數對外開放的公共直飲台，但帶官方欄位有強化價值。
 *
 * 用法：
 *   node scripts/refresh-water-stations.mjs            # 寫入 src/data/water-stations.json
 *   node scripts/refresh-water-stations.mjs --dry-run  # 只列要寫什麼
 *
 * 過濾規則：
 *   - bbox: 25.0150–25.0220 lat × 121.5350–121.5420 lng（NTU 主校區核心）
 *   - description 含黑名單（公館站 / 真理堂 / 文盛公園 / 北水處 / 首爾之星 / 大學公園）→ 排除
 *   - 雙來源 dedup：距離 < 30 m 視為同一台 → merge（official 優先 status，OSM 補 indoor/level）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src', 'data', 'water-stations.json');
const CAMPUS_GEOJSON_PATH = path.join(ROOT, 'src', 'data', 'campus.geojson');

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BWATER_CSV =
  'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=181097e0-c171-4bcd-ad41-c7b55dbc616e';

const BBOX = { minLat: 25.015, maxLat: 25.022, minLng: 121.535, maxLng: 121.542 };
const DESCRIPTION_BLACKLIST =
  /(公館站|真理堂|文盛公園|北水處|首爾之星|大學公園|捷運|subway|MRT|羅斯福路三段|羅斯福路四段92號)/i;
const DEDUP_RADIUS_METERS = 30;

const DRY_RUN = process.argv.includes('--dry-run');

// ────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────

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

async function fetchOverpass(query, attempt = 1) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ntu-water-map/0.1 (refresh-water-stations)',
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

async function fetchBwaterCsv() {
  const res = await fetch(BWATER_CSV, {
    headers: {
      'User-Agent': 'ntu-water-map/0.1 (refresh-water-stations)',
    },
  });
  if (!res.ok) throw new Error(`BWater CSV HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 北水處 CSV 是 Big5 編碼
  return new TextDecoder('big5').decode(buf);
}

async function loadCampusLandmarks() {
  const raw = await fs.readFile(CAMPUS_GEOJSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  const landmarks = [];
  for (const f of data.features) {
    if (f.properties.kind !== 'node') continue;
    if (f.properties.id?.startsWith('gongguan_')) continue;
    const [lng, lat] = f.geometry.coordinates;
    landmarks.push({ id: f.properties.id, name: f.properties.name, lat, lng });
  }
  return landmarks;
}

function nearestLandmark(lat, lng, landmarks) {
  let best = null;
  let bestD = Infinity;
  for (const lm of landmarks) {
    const d = haversine({ lat, lng }, lm);
    if (d < bestD) {
      bestD = d;
      best = lm;
    }
  }
  return { landmark: best, distance: bestD };
}

function classifyKind(tags = {}) {
  if (tags.bottle === 'yes' || tags.fountain === 'bottle_refill') return 'refill';
  if (tags.hot_water === 'yes' || tags.cold_water === 'yes') return 'hot_cold';
  return 'fountain';
}

// ────────────────────────────────────────────────────────
// 來源 1：OSM
// ────────────────────────────────────────────────────────

async function fetchOsmStations(landmarks) {
  const query = `[out:json][timeout:30];
(
  node["amenity"="drinking_water"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
  node["drinking_water"="yes"](${BBOX.minLat},${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng});
);
out;`;
  const resp = await fetchOverpass(query);
  const nodes = resp.elements ?? [];
  const out = [];
  let blacklisted = 0;
  for (const e of nodes) {
    if (e.type !== 'node' || typeof e.lat !== 'number') continue;
    const tags = e.tags ?? {};
    if (tags.description && DESCRIPTION_BLACKLIST.test(tags.description)) {
      blacklisted++;
      continue;
    }
    const { landmark, distance } = nearestLandmark(e.lat, e.lon, landmarks);
    const level = tags.level ?? null;
    out.push({
      id: `osm-${e.id}`,
      source: 'osm',
      latitude: Math.round(e.lat * 1e7) / 1e7,
      longitude: Math.round(e.lon * 1e7) / 1e7,
      kind: classifyKind(tags),
      // 命名：description > 鄰近地標
      name: tags.description
        ? tags.description.split(/[,，]/)[0].trim().slice(0, 30) +
          (level ? ` ${level}F` : '')
        : landmark && distance < 80
          ? `${landmark.name}${level ? ` ${level}F` : ''} 飲水機`
          : level ? `校園飲水機 ${level}F` : '校園飲水機',
      location_hint: (() => {
        const parts = [];
        if (tags.description) parts.push(tags.description.slice(0, 60));
        else if (landmark) parts.push(`${landmark.name} 附近 (${distance.toFixed(0)} m)`);
        if (level) parts.push(`${level}F`);
        if (tags.indoor === 'no') parts.push('戶外');
        else if (tags.indoor === 'yes') parts.push('室內');
        return parts.join(' · ') || null;
      })(),
      external_url: null,
      official_status: null,
      official_status_at: null,
      last_water_test_at: null,
      photo_url: null,
      _osm: {
        node_id: e.id,
        tags: {
          level: tags.level,
          indoor: tags.indoor,
          bottle: tags.bottle,
          hot_water: tags.hot_water,
          cold_water: tags.cold_water,
          brand: tags.brand,
          operator: tags.operator,
          description: tags.description,
        },
      },
    });
  }
  return { stations: out, blacklisted, raw: nodes.length };
}

// ────────────────────────────────────────────────────────
// 來源 2：北水處 OpenData（臺北市所屬直飲臺）
// ────────────────────────────────────────────────────────

const BWATER_NAME_BLACKLIST = /(公館站|捷運|台大醫院|台大公衛)/;

async function fetchOfficialStations(landmarks) {
  const text = await fetchBwaterCsv();
  const lines = text.split(/\r?\n/);
  // header 欄位（CSV 0-indexed）：
  //   0 每月對照使用 / 1 直飲臺編號 / 7 場所名稱 / 8 地址 / 13 設置地點
  //   14 經度 / 15 緯度 / 16 狀態 / 17 狀態異動日期時間 / 18 最近採樣日期時間
  //   19 大腸桿菌數 / 20 水質網址 / 21 照片網址
  const out = [];
  let inBboxFiltered = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 22) continue;
    const id = cols[1];
    const venueName = cols[7] || '';
    const address = cols[8] || '';
    const detail = cols[13] || '';
    const lng = parseFloat(cols[14]);
    const lat = parseFloat(cols[15]);
    const status = cols[16];
    const statusAt = cols[17];
    const sampleAt = cols[18];
    const infoUrl = cols[20];
    const photoUrl = cols[21];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // 名字含 NTU 校區關鍵字 OR 在 NTU bbox 內 → 收
    const blob = venueName + address + detail;
    const isNtuByName = /(臺灣大學|台灣大學|臺大|台大)/.test(blob);
    const isInBbox =
      lat >= BBOX.minLat &&
      lat <= BBOX.maxLat &&
      lng >= BBOX.minLng &&
      lng <= BBOX.maxLng;
    if (!isNtuByName && !isInBbox) continue;
    if (BWATER_NAME_BLACKLIST.test(blob)) {
      inBboxFiltered++;
      continue;
    }

    const { landmark, distance } = nearestLandmark(lat, lng, landmarks);
    out.push({
      id: `bwater-${id}`,
      source: 'official',
      latitude: Math.round(lat * 1e7) / 1e7,
      longitude: Math.round(lng * 1e7) / 1e7,
      kind: 'fountain',
      name: venueName,
      location_hint:
        [detail, address].filter(Boolean).join(' · ').slice(0, 80) ||
        (landmark ? `${landmark.name} 附近` : null),
      external_url: infoUrl || null,
      official_status: status || null,
      official_status_at: statusAt || null,
      last_water_test_at: sampleAt || null,
      photo_url: photoUrl || null,
      _bwater: {
        venue_id: id,
        coliform: cols[19] || null,
      },
    });
  }
  return { stations: out, filtered: inBboxFiltered };
}

// ────────────────────────────────────────────────────────
// dedup：兩來源距離 < 30m → 合併
// ────────────────────────────────────────────────────────

function mergeSources(osmList, officialList) {
  const merged = [...osmList];
  let mergedCount = 0;
  let appendedCount = 0;
  for (const off of officialList) {
    let target = null;
    let bestD = Infinity;
    for (const o of merged) {
      const d = haversine(
        { lat: o.latitude, lng: o.longitude },
        { lat: off.latitude, lng: off.longitude },
      );
      if (d < bestD) {
        bestD = d;
        target = o;
      }
    }
    if (target && bestD < DEDUP_RADIUS_METERS) {
      // OSM 的 id / 座標保留為主鍵；官方的狀態 / 照片 / 連結合進來
      target.source = 'merged';
      target.external_url = off.external_url || target.external_url;
      target.official_status = off.official_status;
      target.official_status_at = off.official_status_at;
      target.last_water_test_at = off.last_water_test_at;
      target.photo_url = off.photo_url || target.photo_url;
      target.name = off.name || target.name;
      target.location_hint = off.location_hint || target.location_hint;
      mergedCount++;
    } else {
      merged.push(off);
      appendedCount++;
    }
  }
  return { merged, mergedCount, appendedCount };
}

// ────────────────────────────────────────────────────────
// main
// ────────────────────────────────────────────────────────

async function main() {
  const landmarks = await loadCampusLandmarks();
  console.log(`# loaded ${landmarks.length} campus landmarks for naming.\n`);

  console.log('① Fetching OSM Overpass...');
  const osm = await fetchOsmStations(landmarks);
  console.log(`   raw ${osm.raw} → blacklisted ${osm.blacklisted} → kept ${osm.stations.length}\n`);

  console.log('② Fetching 北水處 OpenData (Big5 CSV)...');
  let official = { stations: [], filtered: 0 };
  try {
    official = await fetchOfficialStations(landmarks);
    console.log(`   matched NTU ${official.stations.length} (${official.filtered} blacklisted)\n`);
  } catch (e) {
    console.log(`   ⚠ failed: ${e.message} — continuing with OSM only\n`);
  }

  console.log('③ Merging (dedup radius = 30 m)...');
  const { merged, mergedCount, appendedCount } = mergeSources(
    osm.stations,
    official.stations,
  );
  console.log(
    `   ${mergedCount} pairs merged · ${appendedCount} official-only appended → total ${merged.length}\n`,
  );

  // 為每筆補上 mock store 需要的初始狀態欄位
  for (const s of merged) {
    s.status = 'normal';
    s.busy_score = 0; // legacy 欄位，UI 不再使用
    s.last_reported_at = null;
    s.report_count = 0;
    s.bottles_saved = 0;
  }

  // 排序：北 → 南，西 → 東
  merged.sort((a, b) =>
    b.latitude !== a.latitude
      ? b.latitude - a.latitude
      : a.longitude - b.longitude,
  );

  console.log('=== sample (first 5) ===');
  for (const w of merged.slice(0, 5)) {
    console.log(
      `  [${w.source.padEnd(8)}] ${w.id.padEnd(20)} ${w.latitude.toFixed(5)},${w.longitude.toFixed(5)} | ${w.name}`,
    );
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] not writing ${OUT_PATH}.`);
    return;
  }

  await fs.writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        comment: `NTU 校區飲水機 seed — OSM (amenity=drinking_water) + 北水處 OpenData (臺北市所屬直飲臺) 雙源融合。重跑：npm run refresh-water-stations`,
        generatedAt: new Date().toISOString(),
        bbox: BBOX,
        sources: {
          osm: 'https://overpass-api.de/api/interpreter (amenity=drinking_water)',
          official: 'data.taipei dataset 155999f2-3c5d-486b-af58-d7f4c0b0a4c9',
        },
        counts: {
          osmKept: osm.stations.length,
          officialKept: official.stations.length,
          mergedPairs: mergedCount,
          total: merged.length,
        },
        stations: merged,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`\nWrote ${OUT_PATH} (${merged.length} stations).`);
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exitCode = 1;
});
