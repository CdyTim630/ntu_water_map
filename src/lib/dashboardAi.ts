import { buildRiskRanking } from './risk';
import type {
  DashboardAiAnomaly,
  DashboardAiCsvRow,
  DashboardAiInsights,
  DashboardAiPriority,
  Report,
  ReportCategory,
  RiskRankingEntry,
  WaterStation,
} from './types';
import { CATEGORY_LABEL } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MAINTENANCE_LABEL: Record<DashboardAiPriority['type'], string> = {
  risk_hotspot: '高風險熱點',
  water_station: '飲水設備',
  stale_case: '逾期案件',
};

function ageDays(iso: string, now: number) {
  return Math.max(0, (now - new Date(iso).getTime()) / MS_PER_DAY);
}

function isActive(report: Report) {
  return report.status === 'active' || report.status === 'reviewing';
}

function isPuddleLike(category: ReportCategory) {
  return (
    category === 'flooding' ||
    category === 'standing_water' ||
    category === 'poor_drainage'
  );
}

function pct(delta: number | null) {
  if (delta === null || !Number.isFinite(delta)) return '無前期基準';
  const sign = delta >= 0 ? '增加' : '下降';
  return `${sign} ${Math.abs(Math.round(delta * 100))}%`;
}

function topCategory(reports: Report[]) {
  const counts = new Map<ReportCategory, number>();
  for (const report of reports) {
    counts.set(report.category, (counts.get(report.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
}

function buildCsvRows(priorities: DashboardAiPriority[]): DashboardAiCsvRow[] {
  return priorities.map((item) => ({
    priority: item.priority,
    type: MAINTENANCE_LABEL[item.type],
    target: item.target,
    reason: item.reason,
    recommendedAction: item.action,
    ownerHint: item.ownerHint,
    slaHint: item.slaHint,
  }));
}

function priorityFromRisk(entry: RiskRankingEntry, rank: number): DashboardAiPriority {
  const severe =
    entry.risk_level === 'high' || entry.high_severity_count > 0 || entry.recent_7_days_count >= 2;
  return {
    rank,
    target: entry.location_name,
    type: 'risk_hotspot',
    priority: severe ? 'P0' : 'P1',
    reason: `risk_score ${entry.risk_score}，共 ${entry.report_count} 筆回報，近 7 日 ${entry.recent_7_days_count} 筆。`,
    action: severe
      ? '安排現場巡檢並優先確認排水口、低窪鋪面與行人改道需求。'
      : '列入本週巡檢清單，雨後追蹤是否重複積水。',
    ownerHint: '總務處事務組 / 駐衛或維修人員',
    slaHint: severe ? '24 小時內完成初查' : '3 個工作天內完成複查',
  };
}

function priorityFromStation(
  station: WaterStation,
  rank: number,
  now: number,
): DashboardAiPriority {
  const days = station.last_reported_at ? ageDays(station.last_reported_at, now) : null;
  const isBroken = station.status === 'broken';
  return {
    rank,
    target: station.location_hint ? `${station.name}（${station.location_hint}）` : station.name,
    type: 'water_station',
    priority: isBroken ? 'P1' : 'P2',
    reason:
      days === null
        ? `${isBroken ? '故障' : '濾心到期'}狀態尚未完成校方確認。`
        : `${isBroken ? '故障' : '濾心到期'}已回報約 ${Math.round(days)} 天。`,
    action: isBroken ? '派修或張貼暫停使用標示。' : '排入濾心更換與水質紀錄更新。',
    ownerHint: '飲水設備維護廠商 / 場館管理單位',
    slaHint: isBroken ? '2 個工作天內處理' : '7 天內完成更換',
  };
}

function priorityFromStale(report: Report, rank: number, now: number): DashboardAiPriority {
  const days = Math.round(ageDays(report.created_at, now));
  return {
    rank,
    target: report.location_name ?? report.title,
    type: 'stale_case',
    priority: report.severity === 'high' ? 'P1' : 'P2',
    reason: `${CATEGORY_LABEL[report.category]}案件已開啟 ${days} 天，狀態仍為 ${report.status}。`,
    action: '補上處理註記，確認是否已改善；若仍存在，合併到維修派工清單。',
    ownerHint: '案件管理者',
    slaHint: report.severity === 'high' ? '48 小時內回覆處理進度' : '本週內更新狀態',
  };
}

function buildAnomalies(params: {
  reports: Report[];
  ranking: RiskRankingEntry[];
  pastWeek: number;
  prevWeek: number;
  brokenStations: number;
  filterDueStations: number;
  healthyRate: number;
  now: number;
}): DashboardAiAnomaly[] {
  const {
    reports,
    ranking,
    pastWeek,
    prevWeek,
    brokenStations,
    filterDueStations,
    healthyRate,
    now,
  } = params;
  const anomalies: DashboardAiAnomaly[] = [];
  const activeReports = reports.filter(isActive);
  const highActive = activeReports.filter((r) => r.severity === 'high').length;
  const weekDelta = prevWeek > 0 ? (pastWeek - prevWeek) / prevWeek : null;
  const stale = activeReports.filter((r) => ageDays(r.created_at, now) >= 7);
  const staleByCategory = topCategory(stale);
  const topRisk = ranking[0];

  if (weekDelta !== null && weekDelta >= 0.75 && pastWeek >= 3) {
    anomalies.push({
      title: '本週回報量異常升高',
      severity: weekDelta >= 1.5 ? 'critical' : 'warning',
      evidence: `近 7 天 ${pastWeek} 筆，前 7 天 ${prevWeek} 筆，週比 ${pct(weekDelta)}。`,
      recommendation: '先比對降雨事件與重複地點，確認是否需要雨後臨時巡檢。',
    });
  }

  if (topRisk && topRisk.risk_score >= 9) {
    anomalies.push({
      title: '高風險熱點集中',
      severity: topRisk.recent_7_days_count >= 2 ? 'critical' : 'warning',
      evidence: `${topRisk.location_name} risk_score ${topRisk.risk_score}，近 7 日 ${topRisk.recent_7_days_count} 筆，高嚴重 ${topRisk.high_severity_count} 筆。`,
      recommendation: '將該點列為第一順位，雨前先清淤，雨後驗證是否退水。',
    });
  }

  if (staleByCategory && staleByCategory[1] >= 2) {
    anomalies.push({
      title: '同類案件長期未結',
      severity: 'warning',
      evidence: `${CATEGORY_LABEL[staleByCategory[0]]} 有 ${staleByCategory[1]} 筆案件超過 7 天仍未結案。`,
      recommendation: '補齊每筆案件處理狀態，避免 dashboard 高估仍在場風險。',
    });
  }

  if (brokenStations + filterDueStations > 0 && healthyRate < 0.95) {
    anomalies.push({
      title: '飲水設備健康度下降',
      severity: healthyRate < 0.85 ? 'critical' : 'warning',
      evidence: `正常率 ${Math.round(healthyRate * 100)}%，故障 ${brokenStations} 台，濾心到期 ${filterDueStations} 台。`,
      recommendation: '優先處理人流高的位置，並在現場標示替代飲水點。',
    });
  }

  if (activeReports.length > 0 && highActive / activeReports.length >= 0.35) {
    anomalies.push({
      title: '嚴重案件比例偏高',
      severity: 'warning',
      evidence: `待處理案件中有 ${highActive} 筆為嚴重，占 ${Math.round((highActive / activeReports.length) * 100)}%。`,
      recommendation: '將嚴重案件獨立排程，避免被一般低風險案件稀釋。',
    });
  }

  if (!anomalies.length) {
    anomalies.push({
      title: '目前未偵測到明顯異常',
      severity: 'info',
      evidence: '回報趨勢、熱點集中度與飲水設備健康度都在可控範圍。',
      recommendation: '維持例行巡檢，雨後再重新產生分析。',
    });
  }

  return anomalies.slice(0, 5);
}

export function buildLocalDashboardAiInsights(params: {
  reports: Report[];
  stations: WaterStation[];
  generatedAt?: string;
}): DashboardAiInsights {
  const { reports, stations } = params;
  const now = Date.now();
  const generatedAt = params.generatedAt ?? new Date(now).toISOString();
  const ranking = buildRiskRanking(reports).slice(0, 10);
  const activeReports = reports.filter(isActive);
  const resolvedReports = reports.filter((r) => r.status === 'resolved');
  const puddleReports = reports.filter((r) => isPuddleLike(r.category));
  const pastWeek = reports.filter((r) => ageDays(r.created_at, now) <= 7).length;
  const prevWeek = reports.filter((r) => {
    const age = ageDays(r.created_at, now);
    return age > 7 && age <= 14;
  }).length;
  const weekDelta = prevWeek > 0 ? (pastWeek - prevWeek) / prevWeek : null;
  const topRisk = ranking[0] ?? null;
  const mainCategory = topCategory(reports);
  const brokenStations = stations.filter((s) => s.status === 'broken').length;
  const filterDueStations = stations.filter((s) => s.status === 'filter_due').length;
  const healthyRate =
    stations.length > 0
      ? stations.filter((s) => s.status === 'normal').length / stations.length
      : 1;
  const anomalies = buildAnomalies({
    reports,
    ranking,
    pastWeek,
    prevWeek,
    brokenStations,
    filterDueStations,
    healthyRate,
    now,
  });

  const stationPriorities = stations
    .filter((s) => s.status === 'broken' || s.status === 'filter_due')
    .sort((a, b) => {
      const ap = a.status === 'broken' ? 0 : 1;
      const bp = b.status === 'broken' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = a.last_reported_at ? new Date(a.last_reported_at).getTime() : 0;
      const bt = b.last_reported_at ? new Date(b.last_reported_at).getTime() : 0;
      return at - bt;
    });
  const staleReports = activeReports
    .filter((r) => ageDays(r.created_at, now) >= 7)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const priorities: DashboardAiPriority[] = [
    ...ranking.slice(0, 3).map((entry, i) => priorityFromRisk(entry, i + 1)),
    ...stationPriorities.slice(0, 2).map((s, i) => priorityFromStation(s, ranking.length + i + 1, now)),
    ...staleReports.slice(0, 2).map((r, i) => priorityFromStale(r, ranking.length + stationPriorities.length + i + 1, now)),
  ]
    .sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2 };
      return order[a.priority] - order[b.priority] || a.rank - b.rank;
    })
    .slice(0, 6)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const anomalyScore = Math.min(
    100,
    Math.round(
      anomalies.reduce((sum, item) => {
        if (item.severity === 'critical') return sum + 28;
        if (item.severity === 'warning') return sum + 16;
        return sum + 6;
      }, 0) + activeReports.length * 1.5,
    ),
  );
  const hotspotText = topRisk ? `，最高風險集中在 ${topRisk.location_name}` : '';
  const categoryText = mainCategory
    ? `，主要類型為 ${CATEGORY_LABEL[mainCategory[0]]}`
    : '';
  const headline = `近 7 天回報 ${pastWeek} 筆，較前期${pct(weekDelta)}${hotspotText}`;
  const executiveSummary =
    `目前共有 ${reports.length} 筆校園水資源回報，待處理 ${activeReports.length} 筆，已解決 ${resolvedReports.length} 筆。` +
    `近 7 天回報${pct(weekDelta)}${categoryText}；積水相關案件占 ${reports.length > 0 ? Math.round((puddleReports.length / reports.length) * 100) : 0}%。` +
    `飲水機正常率 ${Math.round(healthyRate * 100)}%，其中故障 ${brokenStations} 台、濾心到期 ${filterDueStations} 台。`;

  const monthlyNarrative = {
    title: '本月管理解讀',
    body:
      `${headline}。建議校方將高風險路段、逾期案件與飲水設備故障拆成三條派工線處理。` +
      `第一線先處理會影響通行安全的積水熱點；第二線補齊逾期案件狀態，避免重複回報造成統計偏差；第三線安排飲水機維修與濾心更換，維持校園補水可及性。`,
  };

  return {
    source: 'local',
    model: null,
    generatedAt,
    headline,
    executiveSummary,
    anomalyScore,
    anomalies,
    priorities,
    monthlyNarrative,
    csvRows: buildCsvRows(priorities),
  };
}

export function mergeGeminiInsights(
  fallback: DashboardAiInsights,
  candidate: Partial<DashboardAiInsights>,
  model: string,
): DashboardAiInsights {
  return {
    ...fallback,
    ...candidate,
    source: 'gemini',
    model,
    generatedAt: fallback.generatedAt,
    anomalyScore:
      typeof candidate.anomalyScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(candidate.anomalyScore)))
        : fallback.anomalyScore,
    anomalies: Array.isArray(candidate.anomalies) && candidate.anomalies.length > 0
      ? candidate.anomalies.slice(0, 5)
      : fallback.anomalies,
    priorities:
      Array.isArray(candidate.priorities) && candidate.priorities.length > 0
        ? candidate.priorities.slice(0, 6).map((item, i) => ({
            ...item,
            rank: i + 1,
          }))
        : fallback.priorities,
    monthlyNarrative: candidate.monthlyNarrative?.body
      ? candidate.monthlyNarrative
      : fallback.monthlyNarrative,
    csvRows:
      Array.isArray(candidate.csvRows) && candidate.csvRows.length > 0
        ? candidate.csvRows.slice(0, 8)
        : fallback.csvRows,
    aiError: undefined,
  };
}
