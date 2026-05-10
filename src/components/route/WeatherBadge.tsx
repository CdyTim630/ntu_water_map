'use client';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Thermometer,
  Droplet,
  CloudDrizzle,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RAIN_INTENSITY_LABEL, type WeatherSnapshot } from '@/lib/weather';
import { formatRelative } from '@/lib/utils';

const intensityTone: Record<
  WeatherSnapshot['rainIntensity'],
  'gray' | 'blue' | 'orange' | 'red'
> = {
  none: 'gray',
  drizzle: 'blue',
  light: 'blue',
  moderate: 'orange',
  heavy: 'red',
};

const intensityIcon: Record<WeatherSnapshot['rainIntensity'], LucideIcon> = {
  none: Sun,
  drizzle: CloudDrizzle,
  light: CloudRain,
  moderate: CloudRain,
  heavy: CloudLightning,
};

const intensityIconTone: Record<WeatherSnapshot['rainIntensity'], string> = {
  none: 'text-amber-500',
  drizzle: 'text-sky-500',
  light: 'text-sky-600',
  moderate: 'text-indigo-500',
  heavy: 'text-rose-500',
};

export function WeatherBadge({
  weather,
  loading,
}: {
  weather: WeatherSnapshot | null;
  loading: boolean;
}) {
  if (loading && !weather) {
    return (
      <Card className="flex items-center gap-3 p-3 text-[13px] text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
        正在取得最新氣象…
      </Card>
    );
  }
  if (!weather) {
    return (
      <Card className="border-rose-100 bg-rose-50/40 p-3 text-[13px] text-rose-600">
        無法取得氣象資料
      </Card>
    );
  }

  const Icon = intensityIcon[weather.rainIntensity];
  const iconTone = intensityIconTone[weather.rainIntensity];

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-100 ${iconTone}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-tight text-slate-900">
            {weather.description || (weather.isRaining ? '降雨中' : '無雨')}
          </div>
          <div className="text-[11px] text-slate-500">
            {weather.source === 'cwa' ? 'CWA 即時' : 'Mock 模擬'} ·{' '}
            {formatRelative(weather.observedAt)}
          </div>
        </div>
      </div>
      <Badge tone={intensityTone[weather.rainIntensity]}>
        {RAIN_INTENSITY_LABEL[weather.rainIntensity]}
      </Badge>
      <div className="ml-auto flex items-center gap-3 text-[12px] text-slate-600">
        {weather.temperature !== null && (
          <span className="inline-flex items-center gap-1 tabular">
            <Thermometer className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            {weather.temperature.toFixed(0)}°C
          </span>
        )}
        {weather.humidity !== null && (
          <span className="inline-flex items-center gap-1 tabular">
            <Droplet className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            {weather.humidity.toFixed(0)}%
          </span>
        )}
        {weather.rainfall1h !== null && weather.rainfall1h > 0 && (
          <span className="inline-flex items-center gap-1 tabular">
            <CloudRain className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            {weather.rainfall1h.toFixed(1)} mm/h
          </span>
        )}
        <span className="hidden sm:inline tabular">
          3h 降雨機率 {(weather.pop3h * 100).toFixed(0)}%
        </span>
      </div>
    </Card>
  );
}
