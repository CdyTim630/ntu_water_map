'use client';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  TileLayer,
  Tooltip,
} from 'react-leaflet';
import { useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { CAMPUS_NODES } from '@/lib/campus';
import { loadFloodAreas, type FloodShape } from '@/lib/floodAreas';
import { HORIZON_LABEL, type ForecastHotspot, type Horizon } from '@/lib/forecast';
import type { Report } from '@/lib/types';
import { getSeverityIcon } from './ReportMarker';

const NTU_CENTER: LatLngExpression = [25.0173, 121.5397];
const FLOOD_AREAS = loadFloodAreas();

interface ForecastCellLite {
  lat: number;
  lng: number;
  scores: Record<Horizon, number>;
  breakdown: {
    baseline: number;
    history: number;
    lowLying: number;
    active: number;
    topReason: string;
  };
}

interface Props {
  cells: ForecastCellLite[];
  hotspots: ForecastHotspot[];
  cellLatStep: number;
  cellLngStep: number;
  horizon: Horizon;
  reports: Report[];
  showBaseFloodAreas: boolean;
  onSelectHotspot?: (h: ForecastHotspot) => void;
}

/** 分數→顏色映射（5 級） */
function scoreToStyle(score: number): {
  color: string;
  fillOpacity: number;
  weight: number;
} | null {
  if (score < 0.15) return null;
  if (score < 0.30) return { color: '#fde68a', fillOpacity: 0.30, weight: 0 };
  if (score < 0.50) return { color: '#fbbf24', fillOpacity: 0.42, weight: 0 };
  if (score < 0.70) return { color: '#f97316', fillOpacity: 0.52, weight: 0 };
  if (score < 0.85) return { color: '#ef4444', fillOpacity: 0.60, weight: 0 };
  return { color: '#b91c1c', fillOpacity: 0.70, weight: 1 };
}

function hotspotIcon(score: number): L.DivIcon {
  const ring =
    score >= 0.75 ? '#b91c1c' : score >= 0.5 ? '#dc2626' : '#f59e0b';
  return L.divIcon({
    className: 'ntu-hotspot',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div style="
        width:34px;height:34px;border-radius:999px;
        background:${ring};color:white;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;font-weight:700;
        box-shadow:0 2px 10px rgba(127,29,29,0.45);
        border:3px solid white;
      ">⚠</div>`,
  });
}

function bufferWeightAtZoom16(meters: number) {
  return Math.max(8, Math.round(2 * meters * 0.7));
}

function BaseFloodOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {FLOOD_AREAS.map((area: FloodShape) => {
        const baseColor = '#94a3b8'; // 既有 lowLying 用灰一點，避免跟熱圖搶顏色
        if (area.kind === 'polygon') {
          return (
            <Polygon
              key={area.id}
              positions={area.coords}
              pathOptions={{
                color: baseColor,
                fillColor: baseColor,
                fillOpacity: 0.06,
                weight: 1,
                opacity: 0.4,
                dashArray: '4 6',
              }}
            >
              <Tooltip sticky>
                <span className="text-xs text-slate-700">
                  低窪基準：{area.name}
                </span>
              </Tooltip>
            </Polygon>
          );
        }
        return area.lines.map((line, i) => (
          <Polyline
            key={`${area.id}-${i}`}
            positions={line}
            pathOptions={{
              color: baseColor,
              opacity: 0.18,
              weight: bufferWeightAtZoom16(area.bufferMeters),
              lineCap: 'round',
            }}
          >
            <Tooltip sticky>
              <span className="text-xs text-slate-700">
                低窪基準：{area.name}
              </span>
            </Tooltip>
          </Polyline>
        ));
      })}
    </>
  );
}

export default function ForecastMap({
  cells,
  hotspots,
  cellLatStep,
  cellLngStep,
  horizon,
  reports,
  showBaseFloodAreas,
  onSelectHotspot,
}: Props) {
  const halfLat = cellLatStep / 2;
  const halfLng = cellLngStep / 2;

  // 為了畫面流暢，預先把 cells 轉成 leaflet bounds + 樣式
  const renderCells = useMemo(() => {
    const out: {
      key: string;
      bounds: LatLngBoundsExpression;
      style: NonNullable<ReturnType<typeof scoreToStyle>>;
      score: number;
      breakdown: ForecastCellLite['breakdown'];
    }[] = [];
    for (const c of cells) {
      const s = c.scores[horizon] ?? 0;
      const style = scoreToStyle(s);
      if (!style) continue;
      out.push({
        key: `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
        bounds: [
          [c.lat - halfLat, c.lng - halfLng],
          [c.lat + halfLat, c.lng + halfLng],
        ],
        style,
        score: s,
        breakdown: c.breakdown,
      });
    }
    return out;
  }, [cells, horizon, halfLat, halfLng]);

  return (
    <MapContainer
      center={NTU_CENTER}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BaseFloodOverlay visible={showBaseFloodAreas} />

      {/* 預測熱圖 — 50m grid Rectangle */}
      {renderCells.map((cell) => (
        <Rectangle
          key={cell.key}
          bounds={cell.bounds}
          pathOptions={{
            color: cell.style.color,
            fillColor: cell.style.color,
            fillOpacity: cell.style.fillOpacity,
            weight: cell.style.weight,
            opacity: cell.style.weight > 0 ? 0.6 : 0,
            stroke: cell.style.weight > 0,
          }}
        >
          <Tooltip sticky>
            <CellTooltip
              score={cell.score}
              horizon={horizon}
              breakdown={cell.breakdown}
            />
          </Tooltip>
        </Rectangle>
      ))}

      {/* 校園主要地標小圓點（淡，作為地理參考） */}
      {CAMPUS_NODES.filter((n) => n.primary).map((n) => (
        <CircleMarker
          key={n.id}
          center={[n.lat, n.lng]}
          radius={3}
          pathOptions={{
            color: '#475569',
            fillColor: '#1d54d3',
            fillOpacity: 0.55,
            weight: 1,
          }}
        >
          <Tooltip>{n.name}</Tooltip>
        </CircleMarker>
      ))}

      {/* 熱點 marker */}
      {hotspots.map((h, i) => (
        <Marker
          key={`hotspot-${i}`}
          position={[h.lat, h.lng]}
          icon={hotspotIcon(h.peakScore)}
          eventHandlers={{
            click: () => onSelectHotspot?.(h),
          }}
        >
          <Popup>
            <div className="w-56 text-xs leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                {HORIZON_LABEL[h.peakHorizon]}峰值風險
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">
                {h.name}
              </div>
              <div className="mt-1 text-slate-600">
                風險 {(h.peakScore * 100).toFixed(0)}% · 1h/3h/6h{' '}
                {[h.scores['1h'], h.scores['3h'], h.scores['6h']]
                  .map((s) => `${(s * 100).toFixed(0)}%`)
                  .join(' / ')}
              </div>
              <ul className="mt-1 list-inside list-disc text-slate-500">
                {h.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-1 text-slate-700">{h.advice}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* 校園 active/reviewing 回報（小圖示，給使用者交叉對照） */}
      {reports
        .filter(
          (r) =>
            (r.status === 'active' || r.status === 'reviewing') &&
            (r.category === 'flooding' || r.category === 'standing_water'),
        )
        .map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={getSeverityIcon(r.severity)}
          >
            <Popup>
              <div className="w-52 text-xs">
                <p className="font-medium text-slate-900">{r.title}</p>
                {r.location_name && (
                  <p className="text-slate-500">📍 {r.location_name}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}

function CellTooltip({
  score,
  horizon,
  breakdown,
}: {
  score: number;
  horizon: Horizon;
  breakdown: ForecastCellLite['breakdown'];
}) {
  return (
    <div className="text-xs leading-tight">
      <div className="font-medium text-slate-900">
        {HORIZON_LABEL[horizon]}積水機率 {(score * 100).toFixed(0)}%
      </div>
      <div className="mt-0.5 text-slate-500">
        主因：{breakdown.topReason}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">
        低窪 {(breakdown.lowLying * 100).toFixed(0)} ·
        歷史 {(breakdown.history * 100).toFixed(0)} ·
        現場 {(breakdown.active * 100).toFixed(0)} ·
        基底 {(breakdown.baseline * 100).toFixed(0)}
      </div>
    </div>
  );
}
