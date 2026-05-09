/**
 * 飲水機 mock store + 公用 API。
 *
 * Seed 資料源：src/data/water-stations.json（OSM + 北水處 OpenData 雙源融合）。
 * 重新拉取真實資料：`npm run refresh-water-stations`。
 *
 * 真正上 Supabase 時：建 water_stations 表，dataApi 增 mock toggle 即可，UI 不變。
 */
import type {
  WaterStation,
  WaterStationKind,
  WaterStationReportType,
  WaterStationSource,
  WaterStationStatus,
} from './types';
import { uuid } from './utils';
import seedData from '@/data/water-stations.json';

interface SeedRow {
  id: string;
  name: string;
  location_hint: string | null;
  kind: string;
  latitude: number;
  longitude: number;
  source: WaterStationSource;
  status?: string;
  last_reported_at?: string | null;
  report_count?: number;
  bottles_saved?: number;
  external_url?: string | null;
  official_status?: string | null;
  official_status_at?: string | null;
  last_water_test_at?: string | null;
  photo_url?: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __NTU_WATER_STATION_STORE__: WaterStation[] | undefined;
}

function isKind(s: string): s is WaterStationKind {
  return ['fountain', 'refill', 'rest_water', 'hot_cold'].includes(s);
}

function isStatus(s: string): s is WaterStationStatus {
  return ['normal', 'broken', 'maintenance', 'filter_due'].includes(s);
}

function ensureStore(): WaterStation[] {
  if (!globalThis.__NTU_WATER_STATION_STORE__) {
    const now = new Date().toISOString();
    const seed = (seedData as { stations: SeedRow[] }).stations ?? [];
    globalThis.__NTU_WATER_STATION_STORE__ = seed.map((s) => ({
      id: s.id,
      name: s.name,
      location_hint: s.location_hint ?? null,
      kind: isKind(s.kind) ? s.kind : 'fountain',
      latitude: s.latitude,
      longitude: s.longitude,
      status: s.status && isStatus(s.status) ? s.status : 'normal',
      last_reported_at: s.last_reported_at ?? null,
      report_count: s.report_count ?? 0,
      bottles_saved: s.bottles_saved ?? 0,
      source: s.source,
      external_url: s.external_url ?? null,
      official_status: s.official_status ?? null,
      official_status_at: s.official_status_at ?? null,
      last_water_test_at: s.last_water_test_at ?? null,
      photo_url: s.photo_url ?? null,
      created_at: now,
      updated_at: now,
    }));
  }
  return globalThis.__NTU_WATER_STATION_STORE__;
}

export const waterStationStore = {
  list(): WaterStation[] {
    return [...ensureStore()];
  },

  get(id: string): WaterStation | null {
    return ensureStore().find((w) => w.id === id) ?? null;
  },

  create(input: {
    name: string;
    location_hint?: string | null;
    kind: WaterStationKind;
    latitude: number;
    longitude: number;
  }): WaterStation {
    const now = new Date().toISOString();
    const ws: WaterStation = {
      id: uuid(),
      name: input.name,
      location_hint: input.location_hint ?? null,
      kind: input.kind,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'normal',
      last_reported_at: null,
      report_count: 0,
      bottles_saved: 0,
      source: 'osm', // user-added → 視作社群來源
      external_url: null,
      official_status: null,
      official_status_at: null,
      last_water_test_at: null,
      photo_url: null,
      created_at: now,
      updated_at: now,
    };
    ensureStore().unshift(ws);
    return ws;
  },

  /**
   * 使用者回報：
   * - broken → status='broken'
   * - fixed  → status='normal'
   * - refill → bottles_saved + 1（不視為故障回報，不增 report_count）
   */
  applyReport(
    id: string,
    type: WaterStationReportType,
  ): WaterStation | null {
    const store = ensureStore();
    const idx = store.findIndex((w) => w.id === id);
    if (idx < 0) return null;
    const cur = store[idx];
    const now = new Date().toISOString();
    const nextStatus: WaterStationStatus =
      type === 'broken' ? 'broken' : type === 'fixed' ? 'normal' : cur.status;
    const nextBottles =
      type === 'refill' ? cur.bottles_saved + 1 : cur.bottles_saved;
    const isFaultReport = type === 'broken' || type === 'fixed';
    const next: WaterStation = {
      ...cur,
      status: nextStatus,
      bottles_saved: nextBottles,
      report_count: cur.report_count + (isFaultReport ? 1 : 0),
      last_reported_at: isFaultReport ? now : cur.last_reported_at,
      updated_at: now,
    };
    store[idx] = next;
    return next;
  },
};

export const waterStationApi = {
  async list(): Promise<WaterStation[]> {
    return waterStationStore.list();
  },
  async get(id: string): Promise<WaterStation | null> {
    return waterStationStore.get(id);
  },
  async applyReport(
    id: string,
    type: WaterStationReportType,
  ): Promise<WaterStation | null> {
    return waterStationStore.applyReport(id, type);
  },
};
