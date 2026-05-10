'use client';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, X, Recycle, Landmark } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  WATER_STATION_STATUS_LABEL,
  type WaterStation,
} from '@/lib/types';

interface Props {
  stations: WaterStation[];
  /** 點擊「在地圖上看」時 */
  onLocate?: (s: WaterStation) => void;
  /** 點擊「+1 我用它裝水」時 */
  onRefill?: (s: WaterStation) => void;
}

function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

const NTU_DEFAULT = { lat: 25.0173, lng: 121.5397 };

export function NearbyFountainsCard({ stations, onLocate, onRefill }: Props) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  >('idle');

  const requestGeo = () => {
    if (!('geolocation' in navigator)) {
      setGeoState('unsupported');
      return;
    }
    setGeoState('requesting');
    navigator.geolocation.getCurrentPosition(
      (g) => {
        setPos({ lat: g.coords.latitude, lng: g.coords.longitude });
        setGeoState('granted');
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // 自動嘗試（user gesture 不一定需要，但 chrome 會 prompt）
  useEffect(() => {
    requestGeo();
  }, []);

  const origin = pos ?? NTU_DEFAULT;

  const ranking = useMemo(() => {
    const withDist = stations
      .map((s) => ({
        s,
        distance: haversine(origin, { lat: s.latitude, lng: s.longitude }),
      }))
      // 故障的列在後面（同距離下優先用正常的）
      .sort((a, b) => {
        const ap = a.s.status === 'broken' ? 1 : 0;
        const bp = b.s.status === 'broken' ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return a.distance - b.distance;
      });
    return withDist.slice(0, 5);
  }, [stations, origin]);

  return (
    <Card>
      <CardHeader
        title="附近飲水機"
        description={
          geoState === 'granted'
            ? `依你目前位置排序（top 5）`
            : geoState === 'denied'
              ? '未授權定位 — 改以校園中心點排序'
              : geoState === 'unsupported'
                ? '此瀏覽器不支援定位 — 用校園中心點排序'
                : geoState === 'requesting'
                  ? '取得位置中…'
                  : '尚未取得位置 — 用校園中心點排序'
        }
        action={
          geoState !== 'granted' && (
            <button
              onClick={requestGeo}
              className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-brand-100 transition-colors hover:bg-brand-100"
            >
              <MapPin className="h-3 w-3" strokeWidth={2.4} />
              開啟定位
            </button>
          )
        }
      />
      {ranking.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          尚無飲水機資料。
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {ranking.map((r, i) => {
            const broken = r.s.status === 'broken';
            return (
              <li
                key={r.s.id}
                onClick={() => onLocate?.(r.s)}
                className={`group cursor-pointer rounded-xl border p-2 transition-colors ${
                  broken
                    ? 'border-rose-100 bg-rose-50/30 hover:bg-rose-50/60'
                    : 'border-slate-100 bg-white hover:border-sky-200 hover:bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`grid h-6 w-6 flex-none place-items-center rounded-md text-[11px] font-semibold ${
                      broken
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {broken ? <X className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {r.s.name}
                      </span>
                      <span className="ml-auto whitespace-nowrap text-[11px] text-slate-500">
                        {Math.round(r.distance)} m
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                      <span
                        className={`${
                          broken
                            ? 'text-rose-700'
                            : r.s.status === 'filter_due'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {WATER_STATION_STATUS_LABEL[r.s.status]}
                      </span>
                      {(r.s.source === 'official' || r.s.source === 'merged') && (
                        <span className="inline-flex items-center gap-0.5 text-amber-700">
                          <Landmark className="h-3 w-3" strokeWidth={2.4} />
                          官方
                        </span>
                      )}
                      {r.s.bottles_saved > 0 && (
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-emerald-600 tabular">
                          <Recycle className="h-3 w-3" strokeWidth={2.4} />
                          {r.s.bottles_saved}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!broken && onRefill && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefill(r.s);
                    }}
                    className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-brand-700"
                  >
                    <Recycle className="h-3 w-3" strokeWidth={2.4} />
                    我用它裝了水 (+1 減塑)
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
