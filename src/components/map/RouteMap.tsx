'use client';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L, { type LatLngBounds, type LatLngExpression } from 'leaflet';
import { CAMPUS_NODES } from '@/lib/campus';
import { loadFloodAreas, type FloodShape } from '@/lib/floodAreas';
import type { ResolvedEndpoint } from '@/app/route/page';
import type { Report } from '@/lib/types';
import type { PlanSegment } from '@/lib/denseGraph';
import { getSeverityIcon } from './ReportMarker';

const NTU_CENTER: LatLngExpression = [25.0173, 121.5397];

function endpointIcon(label: '起' | '終', kind: 'landmark' | 'pin') {
  const color = label === '起' ? '#10b981' : '#ef4444';
  const ring = kind === 'pin' ? '4px solid #fde68a' : '3px solid white';
  return L.divIcon({
    className: 'ntu-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="
        width:32px;height:32px;border-radius:999px;
        background:${color};color:white;
        display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:700;
        box-shadow:0 2px 8px rgba(15,23,42,0.35);
        border:${ring};
      ">${label}</div>`,
  });
}

function FitToCoords({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!coords?.length) return;
    const bounds = L.latLngBounds(coords) as LatLngBounds;
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [coords, map]);
  return null;
}

function MapClickHandler({
  pickMode,
  onPick,
}: {
  pickMode: null | 'start' | 'end';
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!pickMode) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface PlanLike {
  coords: [number, number][];
  segments?: PlanSegment[];
  startVertex?: { lat: number; lng: number };
  endVertex?: { lat: number; lng: number };
}

interface Props {
  recommended: PlanLike | null;
  shortest: PlanLike | null;
  reports: Report[];
  startResolved: ResolvedEndpoint | null;
  endResolved: ResolvedEndpoint | null;
  pickMode: null | 'start' | 'end';
  rainFactor: number;
  showFloodOverlay: boolean;
  onMapPick: (lat: number, lng: number) => void;
}

const FLOOD_AREAS = loadFloodAreas();

/** lineBuffer 類型 → 用 Leaflet polyline，weight 大致對應 buffer 直徑（pixel @ zoom 16） */
function bufferWeightAtZoom16(meters: number) {
  // NTU 校園 zoom 16 約 1 m ≈ 0.7 px。直徑 = 2 * buffer
  return Math.max(8, Math.round(2 * meters * 0.7));
}

function FloodOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {FLOOD_AREAS.map((area: FloodShape) => {
        const intensity = area.score; // 0..1
        // 顏色從淡黃到深橘紅，越易積水越紅
        const fill =
          intensity >= 0.8
            ? '#dc2626'
            : intensity >= 0.55
              ? '#ea580c'
              : '#f59e0b';
        if (area.kind === 'polygon') {
          return (
            <Polygon
              key={area.id}
              positions={area.coords}
              pathOptions={{
                color: fill,
                fillColor: fill,
                fillOpacity: 0.18,
                weight: 1.5,
                opacity: 0.5,
                dashArray: '4 4',
              }}
            >
              <Tooltip sticky>
                <FloodTooltip name={area.name} score={area.score} />
              </Tooltip>
            </Polygon>
          );
        }
        // line buffer 用 polyline + 粗 weight 模擬 buffer 寬度
        return area.lines.map((line, i) => (
          <Polyline
            key={`${area.id}-${i}`}
            positions={line}
            pathOptions={{
              color: fill,
              opacity: 0.32,
              weight: bufferWeightAtZoom16(area.bufferMeters),
              lineCap: 'round',
            }}
          >
            <Tooltip sticky>
              <FloodTooltip name={area.name} score={area.score} />
            </Tooltip>
          </Polyline>
        ));
      })}
    </>
  );
}

function FloodTooltip({ name, score }: { name: string; score: number }) {
  const level =
    score >= 0.8 ? '極易積水' : score >= 0.55 ? '易積水' : '中度易積水';
  return (
    <div className="text-xs leading-tight">
      <div className="font-medium text-slate-900">{name}</div>
      <div className="text-slate-500">{level}（風險 {(score * 100).toFixed(0)}%）</div>
    </div>
  );
}

const RISK_STYLE: Record<
  PlanSegment['risk'],
  { color: string; weight: number; halo: number }
> = {
  dry: { color: '#0f766e', weight: 7, halo: 11 }, // 完全遮蔽 — 深綠
  partial: { color: '#10b981', weight: 6, halo: 10 }, // 部分遮蔽
  open: { color: '#34d399', weight: 6, halo: 10 }, // 露天
  lowLying: { color: '#f59e0b', weight: 7, halo: 11 }, // 易積水（亮黃）
  floodReport: { color: '#dc2626', weight: 7, halo: 11 }, // 有 active 積水回報
};

export default function RouteMap({
  recommended,
  shortest,
  reports,
  startResolved,
  endResolved,
  pickMode,
  rainFactor,
  showFloodOverlay,
  onMapPick,
}: Props) {
  const recCoords = recommended?.coords ?? [];
  const shortCoords = shortest?.coords ?? [];

  // 從 segments 抽出「途中要警示」的高風險段（有積水回報的）
  const warningPoints = useMemo(() => {
    if (!recommended?.segments) return [];
    const pts: { lat: number; lng: number; risk: PlanSegment['risk'] }[] = [];
    for (const seg of recommended.segments) {
      if (seg.risk === 'floodReport' || seg.risk === 'lowLying') {
        const mid = seg.coords[Math.floor(seg.coords.length / 2)];
        if (mid) pts.push({ lat: mid[0], lng: mid[1], risk: seg.risk });
      }
    }
    return pts;
  }, [recommended]);

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

      <MapClickHandler pickMode={pickMode} onPick={onMapPick} />

      {/* 易積水區 overlay（可由 panel 切換顯示） */}
      <FloodOverlay visible={showFloodOverlay} />

      {/* 地標小圓點：點擊也能設為起 / 終點 */}
      {CAMPUS_NODES.map((n) => (
        <CircleMarker
          key={n.id}
          center={[n.lat, n.lng]}
          radius={n.primary ? 4 : 2}
          pathOptions={{
            color: '#475569',
            fillColor: n.primary ? '#1d54d3' : '#94a3b8',
            fillOpacity: 0.6,
            weight: 1,
          }}
          eventHandlers={{
            click: () => {
              if (pickMode) onMapPick(n.lat, n.lng);
            },
          }}
        >
          <Tooltip>{n.name}</Tooltip>
        </CircleMarker>
      ))}

      {/* 最短路徑：灰色虛線（沿真實 OSM 道路） */}
      {shortCoords.length > 1 && (
        <Polyline
          positions={shortCoords}
          pathOptions={{
            color: '#475569',
            weight: 4,
            opacity: 0.55,
            dashArray: '6 8',
          }}
        />
      )}

      {/* 防雨建議：先畫白色 halo 一條完整線，再以 segment 風險著色疊上去 */}
      {recommended?.segments?.length ? (
        <>
          {/* 白色 halo（連續一條，給整體外框） */}
          <Polyline
            positions={recCoords}
            pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.9 }}
          />
          {/* 段級著色：每段一條 Polyline，顏色取自 RISK_STYLE */}
          {recommended.segments.map((seg, i) => {
            const style = RISK_STYLE[seg.risk];
            return (
              <Polyline
                key={i}
                positions={seg.coords}
                pathOptions={{
                  color: style.color,
                  weight: style.weight,
                  opacity: 0.95,
                }}
              >
                <Tooltip sticky>
                  <SegmentTooltip seg={seg} />
                </Tooltip>
              </Polyline>
            );
          })}
        </>
      ) : (
        // Fallback：沒有 segment 元資料時用單色綠線
        recCoords.length > 1 && (
          <Polyline
            positions={recCoords}
            pathOptions={{ color: '#10b981', weight: 6, opacity: 0.95 }}
          />
        )
      )}

      {/* 段級警示標 — 大雨 (rainFactor > 0.4) 時才顯示，避免無雨時雜訊 */}
      {rainFactor > 0.4 &&
        warningPoints.map((p, i) => (
          <CircleMarker
            key={`warn-${i}`}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              color: p.risk === 'floodReport' ? '#dc2626' : '#f59e0b',
              fillColor: p.risk === 'floodReport' ? '#fca5a5' : '#fde68a',
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip>
              {p.risk === 'floodReport' ? '⚠ 此段附近有積水回報' : '🌧 易積水路段'}
            </Tooltip>
          </CircleMarker>
        ))}

      {/* 起 / 終點 marker */}
      {startResolved && (
        <Marker
          position={[startResolved.lat, startResolved.lng]}
          icon={endpointIcon('起', startResolved.kind)}
        >
          <Popup>{startResolved.label}</Popup>
        </Marker>
      )}
      {endResolved && (
        <Marker
          position={[endResolved.lat, endResolved.lng]}
          icon={endpointIcon('終', endResolved.kind)}
        >
          <Popup>{endResolved.label}</Popup>
        </Marker>
      )}
      {recommended?.startVertex && startResolved && (
        <Polyline
          positions={[
            [startResolved.lat, startResolved.lng],
            [recommended.startVertex.lat, recommended.startVertex.lng],
          ]}
          pathOptions={{ color: '#10b981', weight: 2, opacity: 0.6, dashArray: '2 4' }}
        />
      )}
      {recommended?.endVertex && endResolved && (
        <Polyline
          positions={[
            [recommended.endVertex.lat, recommended.endVertex.lng],
            [endResolved.lat, endResolved.lng],
          ]}
          pathOptions={{ color: '#10b981', weight: 2, opacity: 0.6, dashArray: '2 4' }}
        />
      )}

      {/* 校園水資源回報（active / reviewing） */}
      {reports
        .filter((r) => r.status === 'active' || r.status === 'reviewing')
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

      <FitToCoords coords={recCoords.length ? recCoords : shortCoords} />
    </MapContainer>
  );
}

function SegmentTooltip({ seg }: { seg: PlanSegment }) {
  const label =
    seg.risk === 'dry'
      ? '✅ 完全遮蔽（室內/騎樓/迴廊）'
      : seg.risk === 'partial'
        ? '🌳 部分遮蔽'
        : seg.risk === 'open'
          ? '🚶 露天路段'
          : seg.risk === 'lowLying'
            ? '🌧 易積水路段'
            : '⚠️ 附近有積水回報';
  return (
    <div className="text-xs leading-tight">
      <div className="font-medium">{label}</div>
      <div className="text-slate-500">
        {seg.distance.toFixed(0)} m · 遮蔽 {(seg.covered * 100).toFixed(0)}% · 積水度 {(seg.lowLying * 100).toFixed(0)}%
        {seg.floodReports > 0 && ` · 回報×${seg.floodReports}`}
      </div>
    </div>
  );
}
