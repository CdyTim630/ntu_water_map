import { NextResponse } from 'next/server';
import { dataApi } from '@/lib/supabase';
import { buildRiskRanking } from '@/lib/risk';
import type { DashboardStats, ReportCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORIES: ReportCategory[] = [
  'flooding',
  'standing_water',
  'facility_leak',
  'poor_drainage',
  'other',
];

export async function GET() {
  try {
    const reports = await dataApi.listReports();
    const totalReports = reports.length;
    const activeReports = reports.filter(
      (r) => r.status === 'active' || r.status === 'reviewing',
    ).length;
    const resolvedReports = reports.filter((r) => r.status === 'resolved').length;
    const highSeverityReports = reports.filter((r) => r.severity === 'high').length;

    const byCategory = CATEGORIES.map((category) => ({
      category,
      count: reports.filter((r) => r.category === category).length,
    }));

    // 近 7 天，包含今天，回傳由舊到新
    const trend7d: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const count = reports.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= day.getTime() && t < next.getTime();
      }).length;
      const label = `${day.getMonth() + 1}/${day.getDate()}`;
      trend7d.push({ date: label, count });
    }

    const ranking = buildRiskRanking(reports).slice(0, 10);

    const payload: DashboardStats = {
      totalReports,
      activeReports,
      resolvedReports,
      highSeverityReports,
      byCategory,
      trend7d,
      ranking,
    };
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
