'use client';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Landmark,
  FlaskConical,
  ExternalLink,
  Image as ImageIcon,
  Recycle,
  Check,
  X,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import {
  WATER_STATION_KIND_LABEL,
  WATER_STATION_STATUS_LABEL,
  type WaterStation,
  type WaterStationReportType,
} from '@/lib/types';

interface Props {
  stations: WaterStation[];
  onReport?: (id: string, type: WaterStationReportType) => void;
  busy?: boolean;
}

/**
 * 飲水機 marker — 純 SVG inline，狀態色 + 圖形組合：
 *   broken     紅 / X
 *   maintenance 棕 / 扳手
 *   filter_due 橘 / !
 *   refill     深青 / 環
 *   normal     藍 / 水滴
 * 官方資料 outer ring 金色。
 */
function stationIcon(s: WaterStation): L.DivIcon {
  let bg = '#0ea5e9';
  let svg = `<path d="M12 3c-1 1.5-5 6.5-5 10a5 5 0 0 0 10 0c0-3.5-4-8.5-5-10z" fill="white"/>`; // droplet
  if (s.status === 'broken') {
    bg = '#dc2626';
    svg = `<path d="M7 7l10 10M17 7L7 17" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`;
  } else if (s.status === 'maintenance') {
    bg = '#a16207';
    svg = `<path d="M14 7a3 3 0 1 1-3 3 3 3 0 0 0-4 4l-3 3 2 2 3-3a3 3 0 0 0 4-4 3 3 0 0 1 3-3" stroke="white" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`;
  } else if (s.status === 'filter_due') {
    bg = '#ea580c';
    svg = `<path d="M12 6v7M12 16v1.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`;
  } else if (s.kind === 'refill') {
    bg = '#0891b2';
    svg = `<path d="M14 5l3 3M9 19l-3-3M17 8a4 4 0 0 1-3 7l-1 0M7 16a4 4 0 0 1 3-7l1 0" stroke="white" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  } else if (s.kind === 'hot_cold') {
    bg = '#0284c7';
  }
  const ring =
    s.source === 'official' || s.source === 'merged'
      ? '3px solid #fbbf24'
      : '2px solid white';
  return L.divIcon({
    className: 'ntu-water-station',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `
      <div style="
        width:26px;height:26px;border-radius:999px;
        background:${bg};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 1px 6px rgba(15,23,42,0.35);
        border:${ring};
      "><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">${svg}</svg></div>`,
  });
}

function ageLabel(iso: string | null): string {
  if (!iso) return '從未回報';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小時前`;
  return `${Math.round(h / 24)} 天前`;
}

/** 北水處時間格式 YYYYMMDDTHHMMSS → "YYYY-MM-DD" */
function formatBwaterDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s;
}

const SOURCE_BADGE: Record<
  WaterStation['source'],
  { label: string; bg: string; text: string }
> = {
  osm: { label: 'OSM 社群', bg: 'bg-slate-100', text: 'text-slate-700' },
  official: { label: '北水處官方', bg: 'bg-amber-100', text: 'text-amber-800' },
  merged: { label: '雙源', bg: 'bg-emerald-100', text: 'text-emerald-800' },
};

export function WaterStationLayer({ stations, onReport, busy }: Props) {
  return (
    <>
      {stations.map((s) => {
        const sb = SOURCE_BADGE[s.source];
        const lastTest = formatBwaterDate(s.last_water_test_at);
        return (
          <Marker
            key={s.id}
            position={[s.latitude, s.longitude]}
            icon={stationIcon(s)}
          >
            <Popup>
              <div className="w-64 text-xs leading-tight">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                    {WATER_STATION_KIND_LABEL[s.kind]}
                  </div>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sb.bg} ${sb.text}`}
                  >
                    {sb.label}
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">
                  {s.name}
                </div>
                {s.location_hint && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 flex-none" strokeWidth={2.2} />
                    <span>{s.location_hint}</span>
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-semibold ${
                      s.status === 'normal'
                        ? 'bg-emerald-100 text-emerald-700'
                        : s.status === 'broken'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {WATER_STATION_STATUS_LABEL[s.status]}
                  </span>
                  {s.last_reported_at && (
                    <span className="text-[10px] text-slate-400">
                      回報 {ageLabel(s.last_reported_at)}
                    </span>
                  )}
                </div>

                {/* 北水處官方資料區塊 */}
                {(s.source === 'official' || s.source === 'merged') && (
                  <div className="mt-1.5 space-y-0.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10.5px] text-amber-900">
                    {s.official_status && (
                      <div className="inline-flex items-center gap-1">
                        <Landmark className="h-3 w-3" strokeWidth={2.2} />
                        官方狀態：
                        <span className="font-medium">{s.official_status}</span>
                      </div>
                    )}
                    {lastTest && (
                      <div className="inline-flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" strokeWidth={2.2} />
                        最近水質採樣：{lastTest}
                      </div>
                    )}
                    {s.external_url && (
                      <a
                        href={s.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-0.5 font-medium text-amber-800 hover:underline"
                      >
                        水質詳情
                        <ExternalLink className="h-3 w-3" strokeWidth={2.2} />
                      </a>
                    )}
                  </div>
                )}

                {s.photo_url && (
                  <a
                    href={s.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    <ImageIcon className="h-3 w-3" strokeWidth={2.2} />
                    看官方照片
                  </a>
                )}

                <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10.5px] text-emerald-800">
                  <Recycle className="h-3 w-3 flex-none" strokeWidth={2.2} />
                  累積省下 {s.bottles_saved} 瓶 600ml ＝ ~
                  {(s.bottles_saved * 0.014).toFixed(1)} kg CO₂
                </div>

                {onReport && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {s.status === 'broken' ? (
                      <button
                        disabled={busy}
                        onClick={() => onReport(s.id, 'fixed')}
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" strokeWidth={2.4} />
                        已修好
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => onReport(s.id, 'broken')}
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        <Wrench className="h-3 w-3" strokeWidth={2.2} />
                        壞了
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => onReport(s.id, 'refill')}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      title="我用它裝了水（+1 寶特瓶減量）"
                    >
                      <Recycle className="h-3 w-3" strokeWidth={2.2} />
                      裝水了 +1
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
