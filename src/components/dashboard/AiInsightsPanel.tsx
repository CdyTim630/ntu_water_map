'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, SectionLabel } from '@/components/ui/Card';
import { downloadCSV } from '@/lib/utils';
import type { DashboardAiInsights } from '@/lib/types';

const severityTone: Record<
  DashboardAiInsights['anomalies'][number]['severity'],
  'red' | 'orange' | 'blue'
> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const severityLabel: Record<
  DashboardAiInsights['anomalies'][number]['severity'],
  string
> = {
  critical: '需立即處理',
  warning: '注意',
  info: '資訊',
};

const priorityTone: Record<
  DashboardAiInsights['priorities'][number]['priority'],
  'red' | 'orange' | 'blue'
> = {
  P0: 'red',
  P1: 'orange',
  P2: 'blue',
};

const typeLabel: Record<DashboardAiInsights['priorities'][number]['type'], string> = {
  risk_hotspot: '高風險熱點',
  water_station: '飲水設備',
  stale_case: '逾期案件',
};

export function AiInsightsPanel() {
  const [insights, setInsights] = useState<DashboardAiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/ai-insights', { cache: 'no-store' });
      if (!res.ok) throw new Error('AI 分析讀取失敗');
      setInsights((await res.json()) as DashboardAiInsights);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 分析讀取失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    if (!insights?.csvRows.length) return;
    downloadCSV(
      'ntu-water-maintenance-priorities.csv',
      insights.csvRows.map((row) => ({ ...row })),
    );
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <CardHeader
          className="mb-0"
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
              AI 管理分析助理
            </span>
          }
          description="彙整趨勢、異常、熱點與設備狀態，自動產生校方處理摘要"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {insights && (
                <Badge tone={insights.source === 'gemini' ? 'green' : 'gray'}>
                  {insights.source === 'gemini' ? 'Gemini API' : '本機分析'}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!insights?.csvRows.length}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
                匯出 CSV
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  strokeWidth={2.2}
                />
                重新分析
              </Button>
            </div>
          }
        />
      </div>

      {loading && !insights && (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px] text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          分析中…
        </div>
      )}

      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}

      {insights && (
        <div className="space-y-4 p-4">
          {insights.aiError && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Gemini 暫時未回應，已使用本機分析結果。
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3">
              <SectionLabel className="text-brand-700">管理摘要</SectionLabel>
              <p className="mt-2 text-base font-semibold leading-snug text-slate-900">
                {insights.headline}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                {insights.executiveSummary}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel>異常指數</SectionLabel>
                <Activity className="h-4 w-4 text-slate-400" strokeWidth={2.2} />
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-bold tabular text-slate-900">
                  {insights.anomalyScore}
                </span>
                <span className="pb-1 text-[12px] text-slate-400">/ 100</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${
                    insights.anomalyScore >= 70
                      ? 'bg-rose-500'
                      : insights.anomalyScore >= 35
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, insights.anomalyScore)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.15fr]">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2.2} />
                <h3 className="text-sm font-semibold text-slate-900">異常偵測</h3>
              </div>
              <ul className="space-y-2">
                {insights.anomalies.map((item, idx) => (
                  <li
                    key={`${item.title}-${idx}`}
                    className="rounded-lg border border-slate-200 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <Badge tone={severityTone[item.severity]}>
                        {severityLabel[item.severity]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      {item.evidence}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      {item.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-600" strokeWidth={2.2} />
                <h3 className="text-sm font-semibold text-slate-900">
                  維修優先順序
                </h3>
              </div>
              <ol className="space-y-2">
                {insights.priorities.map((item) => (
                  <li
                    key={`${item.rank}-${item.target}`}
                    className="grid grid-cols-[2rem_1fr] gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular text-slate-700">
                      {item.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {item.target}
                        </p>
                        <Badge tone={priorityTone[item.priority]}>
                          {item.priority}
                        </Badge>
                        <Badge tone="gray">{typeLabel[item.type]}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                        {item.reason}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                        {item.action}
                      </p>
                      <p className="mt-1 text-[10.5px] text-slate-400">
                        {item.ownerHint} · {item.slaHint}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" strokeWidth={2.2} />
              <h3 className="text-sm font-semibold text-slate-900">
                {insights.monthlyNarrative.title}
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600">
              {insights.monthlyNarrative.body}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
