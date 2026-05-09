'use client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RAIN_INTENSITY_LABEL, type WeatherSnapshot } from '@/lib/weather';
import { formatRelative } from '@/lib/utils';

const intensityTone: Record<WeatherSnapshot['rainIntensity'], 'gray' | 'blue' | 'orange' | 'red'> = {
  none: 'gray',
  drizzle: 'blue',
  light: 'blue',
  moderate: 'orange',
  heavy: 'red',
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
      <Card className="flex items-center gap-3 p-3 text-sm text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
        正在取得最新氣象…
      </Card>
    );
  }
  if (!weather) {
    return (
      <Card className="p-3 text-sm text-red-600">
        無法取得氣象資料。
      </Card>
    );
  }
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">
          {weather.rainIntensity === 'none' ? '☀️' : weather.rainIntensity === 'heavy' ? '⛈️' : '🌧️'}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">
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
      <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
        {weather.temperature !== null && (
          <span>🌡️ {weather.temperature.toFixed(0)}°C</span>
        )}
        {weather.humidity !== null && (
          <span>💧 {weather.humidity.toFixed(0)}%</span>
        )}
        {weather.rainfall1h !== null && weather.rainfall1h > 0 && (
          <span>☔ {weather.rainfall1h.toFixed(1)} mm/h</span>
        )}
        <span>近 3 小時降雨機率 {(weather.pop3h * 100).toFixed(0)}%</span>
      </div>
    </Card>
  );
}
