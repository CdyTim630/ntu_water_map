import type { Report, RiskRankingEntry } from './types';

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function computeRiskLevel(score: number): RiskRankingEntry['risk_level'] {
  if (score >= 9) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * 將 reports 依 location_name (沒有 location_name 則用座標 round 4 位) 分組，
 * 計算 risk_score = report_count*2 + high_severity_count*3 + recent_7_days_count*2
 */
export function buildRiskRanking(reports: Report[]): RiskRankingEntry[] {
  const now = Date.now();
  const groups = new Map<string, Report[]>();

  for (const r of reports) {
    const key =
      (r.location_name && r.location_name.trim()) ||
      `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const ranking: RiskRankingEntry[] = [];
  groups.forEach((items, key) => {
    const report_count = items.length;
    const high_severity_count = items.filter((r) => r.severity === 'high').length;
    const recent_7_days_count = items.filter(
      (r) => now - new Date(r.created_at).getTime() <= RECENT_WINDOW_MS,
    ).length;
    const risk_score =
      report_count * 2 + high_severity_count * 3 + recent_7_days_count * 2;
    const avgLat =
      items.reduce((s, r) => s + r.latitude, 0) / items.length;
    const avgLng =
      items.reduce((s, r) => s + r.longitude, 0) / items.length;
    ranking.push({
      location_name: key,
      latitude: avgLat,
      longitude: avgLng,
      report_count,
      high_severity_count,
      recent_7_days_count,
      risk_score,
      risk_level: computeRiskLevel(risk_score),
    });
  });

  ranking.sort((a, b) => b.risk_score - a.risk_score);
  return ranking;
}
