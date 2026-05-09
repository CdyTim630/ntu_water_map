'use client';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import type { Report } from '@/lib/types';
import { getSeverityIcon } from './ReportMarker';
import { ReportPopupContent } from './ReportPopup';

const NTU_CENTER: LatLngExpression = [25.0173, 121.5397];
const DEFAULT_ZOOM = 16;

interface Props {
  reports: Report[];
  focusReportId?: string | null;
  onConfirm: (id: string, type: 'still_exists' | 'resolved') => void;
  onOpenDetails: (report: Report) => void;
  busy?: boolean;
}

function FocusController({
  reports,
  focusReportId,
}: {
  reports: Report[];
  focusReportId?: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!focusReportId) return;
    const r = reports.find((x) => x.id === focusReportId);
    if (r) map.flyTo([r.latitude, r.longitude], 18, { duration: 0.6 });
  }, [focusReportId, reports, map]);
  return null;
}

export default function CampusMap({
  reports,
  focusReportId,
  onConfirm,
  onOpenDetails,
  busy,
}: Props) {
  const items = useMemo(
    () =>
      reports.map((r) => ({
        report: r,
        icon: getSeverityIcon(r.severity, focusReportId === r.id),
      })),
    [reports, focusReportId],
  );

  return (
    <MapContainer
      center={NTU_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusController reports={reports} focusReportId={focusReportId} />
      {items.map(({ report, icon }) => (
        <Marker
          key={report.id}
          position={[report.latitude, report.longitude]}
          icon={icon}
        >
          <Popup>
            <ReportPopupContent
              report={report}
              onConfirm={onConfirm}
              onOpenDetails={onOpenDetails}
              busy={busy}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
