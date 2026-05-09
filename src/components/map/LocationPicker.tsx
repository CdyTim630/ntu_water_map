'use client';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import type { LatLngExpression } from 'leaflet';
import { getSeverityIcon } from './ReportMarker';

const NTU_CENTER: LatLngExpression = [25.0173, 121.5397];

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number }) => void;
  initial?: { lat: number; lng: number };
}

function ClickCapture({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ value, onChange, initial }: Props) {
  const [icon, setIcon] = useState(() => getSeverityIcon('medium', true));

  useEffect(() => {
    setIcon(getSeverityIcon('medium', true));
  }, []);

  const center: LatLngExpression = initial
    ? [initial.lat, initial.lng]
    : value
      ? [value.lat, value.lng]
      : NTU_CENTER;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: 280, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onClick={(lat, lng) => onChange({ lat, lng })} />
        {value && (
          <Marker position={[value.lat, value.lng]} icon={icon} />
        )}
      </MapContainer>
      <p className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
        點擊地圖以選擇位置 ·{' '}
        {value
          ? `已選 ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : '尚未選擇'}
      </p>
    </div>
  );
}
