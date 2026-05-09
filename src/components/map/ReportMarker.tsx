'use client';
import L from 'leaflet';
import type { ReportSeverity } from '@/lib/types';
import { SEVERITY_COLOR } from '@/lib/types';

/**
 * 依 severity 回傳一個彩色 SVG divIcon。Leaflet 的預設 marker 圖片在 Next.js 打包時容易壞掉，
 * 改用 divIcon 既乾淨又支援著色。
 */
export function getSeverityIcon(severity: ReportSeverity, highlight = false) {
  const color = SEVERITY_COLOR[severity];
  const ring = highlight ? '#0f172a' : '#ffffff';
  const html = `
    <div style="
      width:28px;height:36px;
      filter: drop-shadow(0 2px 3px rgba(15,23,42,.35));
    ">
      <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0c7.732 0 14 6.045 14 13.5 0 9.5-14 22.5-14 22.5S0 23 0 13.5C0 6.045 6.268 0 14 0z"
          fill="${color}" stroke="${ring}" stroke-width="2"/>
        <circle cx="14" cy="13" r="5" fill="#ffffff"/>
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: 'ntu-marker',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  });
}
