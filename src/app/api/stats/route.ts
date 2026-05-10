import { NextResponse } from 'next/server';
import { dataApi } from '@/lib/supabase';
import { waterStationApi } from '@/lib/waterStations';
import { buildRiskRanking } from '@/lib/risk';
import type {
  DashboardStats,
  ReportCategory,
  ReportSeverity,
  ReportStatus,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORIES: ReportCategory[] = [
  'flooding',
  'standing_water',
  'facility_leak',
  'poor_drainage',
  'other',
];
const STATUSES: ReportStatus[] = ['active', 'reviewing', 'resolved', 'rejected'];
const SEVERITIES: ReportSeverity[] = ['high', 'medium', 'low'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const [reports, stations] = await Promise.all([
      dataApi.listReports(),
      waterStationApi.list(),
    ]);

    const totalReports = reports.length;
    const activeReports = reports.filter(
      (r) => r.status === 'active' || r.status === 'reviewing',
    ).length;
    const resolvedReports = reports.filter((r) => r.status === 'resolved').length;
    const highSeverityReports = reports.filter((r) => r.severity === 'high').length;

    // ── 近 7 天 vs 前 7 天 ──
    const now = Date.now();
    const pastWeekReports = reports.filter(
      (r) => now - new Date(r.created_at).getTime() <= 7 * MS_PER_DAY,
    ).length;
    const prevWeekReports = reports.filter((r) => {
      const t = new Date(r.created_at).getTime();
      const age = now - t;
      return age > 7 * MS_PER_DAY && age <= 14 * MS_PER_DAY;
    }).length;

    // ── 平均處理時間（resolved 報告，updated - created） ──
    const resolved = reports.filter((r) => r.status === 'resolved');
    const avgResolveDays =
      resolved.length > 0
        ? resolved.reduce((sum, r) => {
            const days =
              (new Date(r.updated_at).getTime() -
                new Date(r.created_at).getTime()) /
              MS_PER_DAY;
            return sum + Math.max(0, days);
          }, 0) / resolved.length
        : null;

    const resolveRate = totalReports > 0 ? resolvedReports / totalReports : 0;

    // ── 分布 ──
    const byCategory = CATEGORIES.map((category) => ({
      category,
      count: reports.filter((r) => r.category === category).length,
    }));
    const byStatus = STATUSES.map((status) => ({
      status,
      count: reports.filter((r) => r.status === status).length,
    }));
    const bySeverity = SEVERITIES.map((severity) => ({
      severity,
      count: reports.filter((r) => r.severity === severity).length,
    }));

    // ── 14 天每日趨勢 ──
    const trend14d: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const count = reports.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= day.getTime() && t < next.getTime();
      }).length;
      const label = `${day.getMonth() + 1}/${day.getDate()}`;
      trend14d.push({ date: label, count });
    }

    const ranking = buildRiskRanking(reports).slice(0, 10);

    // ── 飲水機健康度 ──
    const wsTotal = stations.length;
    const wsNormal = stations.filter((s) => s.status === 'normal').length;
    const wsBroken = stations.filter((s) => s.status === 'broken').length;
    const wsFilterDue = stations.filter((s) => s.status === 'filter_due').length;
    const wsTotalBottlesSaved = stations.reduce(
      (sum, s) => sum + s.bottles_saved,
      0,
    );
    const wsBrokenList = stations
      .filter((s) => s.status === 'broken' || s.status === 'filter_due')
      .sort((a, b) => {
        const ta = a.last_reported_at
          ? new Date(a.last_reported_at).getTime()
          : 0;
        const tb = b.last_reported_at
          ? new Date(b.last_reported_at).getTime()
          : 0;
        return tb - ta;
      })
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        location_hint: s.location_hint,
        daysSinceReport: s.last_reported_at
          ? (now - new Date(s.last_reported_at).getTime()) / MS_PER_DAY
          : null,
      }));
    const wsBySource = (
      ['osm', 'official', 'merged'] as ('osm' | 'official' | 'merged')[]
    ).map((source) => ({
      source,
      count: stations.filter((s) => s.source === source).length,
    }));

    const payload: DashboardStats = {
      totalReports,
      activeReports,
      resolvedReports,
      highSeverityReports,
      pastWeekReports,
      prevWeekReports,
      avgResolveDays,
      resolveRate,
      byCategory,
      byStatus,
      bySeverity,
      trend14d,
      ranking,
      waterStations: {
        total: wsTotal,
        normal: wsNormal,
        broken: wsBroken,
        filterDue: wsFilterDue,
        totalBottlesSaved: wsTotalBottlesSaved,
        brokenList: wsBrokenList,
        bySource: wsBySource,
      },
    };
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
