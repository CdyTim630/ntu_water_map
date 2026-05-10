'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ReportFilter } from '@/components/reports/ReportFilter';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportForm } from '@/components/reports/ReportForm';
import { ReportDetailModal } from '@/components/reports/ReportDetailModal';
import { RiskRanking } from '@/components/dashboard/RiskRanking';
import { NearbyFountainsCard } from '@/components/water/NearbyFountainsCard';
import { TodayCommuteCard } from '@/components/commute/TodayCommuteCard';
import { AddCommuteRouteModal } from '@/components/commute/AddCommuteRouteModal';
import { TodayBriefingCard } from '@/components/today/TodayBriefingCard';
import { incrementStat } from '@/lib/statsStore';
import { buildRiskRanking } from '@/lib/risk';
import type {
  Report,
  ReportFilterState,
  RiskRankingEntry,
  WaterStation,
  WaterStationReportType,
} from '@/lib/types';

const CampusMap = dynamic(() => import('@/components/map/CampusMap'), {
  ssr: false,
  loading: () => <MapPlaceholder>地圖載入中…</MapPlaceholder>,
});

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full w-full place-items-center bg-slate-50 text-sm text-slate-400">
      {children}
    </div>
  );
}

export default function HomePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilterState>({
    category: 'all',
    severity: 'all',
    status: 'all',
  });
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [detail, setDetail] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusReportId, setFocusReportId] = useState<string | null>(null);

  const [waterStations, setWaterStations] = useState<WaterStation[]>([]);
  const [showWaterStations, setShowWaterStations] = useState(true);
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [addRouteOpen, setAddRouteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', { cache: 'no-store' });
      if (!res.ok) throw new Error('讀取失敗');
      const data = (await res.json()) as { reports: Report[] };
      setReports(data.reports);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法讀取');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWaterStations = useCallback(async () => {
    try {
      const res = await fetch('/api/water-stations', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { stations: WaterStation[] };
      setWaterStations(data.stations);
    } catch {
      /* ignore */
    }
  }, []);

  const handleWaterStationReport = useCallback(
    async (id: string, type: WaterStationReportType) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/water-stations/${id}/report`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type }),
        });
        if (!res.ok) throw new Error('回報失敗');
        const data = (await res.json()) as { station: WaterStation };
        setWaterStations((arr) =>
          arr.map((s) => (s.id === data.station.id ? data.station : s)),
        );
        if (type === 'refill') incrementStat('water_refill');
        else if (type === 'broken') incrementStat('broken_reported');
      } catch (e) {
        alert(e instanceof Error ? e.message : '回報失敗');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleLocateFountain = useCallback((s: WaterStation) => {
    setMapFlyTo({ lat: s.latitude, lng: s.longitude });
  }, []);

  useEffect(() => {
    load();
    loadWaterStations();
  }, [load, loadWaterStations]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter.category !== 'all' && r.category !== filter.category)
        return false;
      if (filter.severity !== 'all' && r.severity !== filter.severity)
        return false;
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      return true;
    });
  }, [reports, filter]);

  const ranking = useMemo(
    () => buildRiskRanking(reports).slice(0, 6),
    [reports],
  );

  const handleConfirm = useCallback(
    async (id: string, type: 'still_exists' | 'resolved') => {
      setBusy(true);
      try {
        const res = await fetch(`/api/reports/${id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type }),
        });
        if (!res.ok) throw new Error('更新失敗');
        const data = (await res.json()) as { report: Report };
        setReports((rs) =>
          rs.map((r) => (r.id === data.report.id ? data.report : r)),
        );
        if (detail?.id === data.report.id) setDetail(data.report);
      } catch (e) {
        alert(e instanceof Error ? e.message : '更新失敗');
      } finally {
        setBusy(false);
      }
    },
    [detail],
  );

  const handleRankingSelect = (entry: RiskRankingEntry) => {
    const reportAtLocation = reports.find(
      (r) =>
        r.location_name === entry.location_name ||
        (Math.abs(r.latitude - entry.latitude) < 1e-4 &&
          Math.abs(r.longitude - entry.longitude) < 1e-4),
    );
    if (reportAtLocation) setFocusReportId(reportAtLocation.id);
  };

  return (
    <div className="px-4 py-4 sm:px-6">
      {/* ─── 1. 今日水情報（hero） ─── */}
      <div className="mb-4 animate-fade-in">
        <TodayBriefingCard waterStations={waterStations} />
      </div>

      {/* ─── 2. 工具列：filter + 圖層 + 主 CTA 三合一 ─── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ReportFilter
          value={filter}
          onChange={setFilter}
          total={reports.length}
          filtered={filtered.length}
        />
        <div className="flex items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={showWaterStations}
              onChange={(e) => setShowWaterStations(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
            />
            <span>💧 飲水機</span>
            <span className="text-[10px] text-slate-400 tabular">
              {waterStations.length}
            </span>
          </label>
        </div>
        <Button
          size="sm"
          onClick={() => setReportFormOpen(true)}
          className="ml-auto"
        >
          ＋ 我要回報
        </Button>
      </div>

      {/* ─── 3. 地圖 + 側欄 ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          <div className="relative h-[55vh] min-h-[420px] lg:h-[calc(100vh-260px)]">
            {loading ? (
              <MapPlaceholder>讀取中…</MapPlaceholder>
            ) : error ? (
              <MapPlaceholder>
                <div className="text-center">
                  <p className="text-red-600">{error}</p>
                  <Button size="sm" className="mt-2" onClick={load}>
                    重試
                  </Button>
                </div>
              </MapPlaceholder>
            ) : (
              <CampusMap
                reports={filtered}
                focusReportId={focusReportId}
                onConfirm={handleConfirm}
                onOpenDetails={setDetail}
                busy={busy}
                waterStations={waterStations}
                showWaterStations={showWaterStations}
                onWaterStationReport={handleWaterStationReport}
                flyToLat={mapFlyTo?.lat ?? null}
                flyToLng={mapFlyTo?.lng ?? null}
              />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <TodayCommuteCard onAddRoute={() => setAddRouteOpen(true)} />

          <NearbyFountainsCard
            stations={waterStations}
            onLocate={handleLocateFountain}
            onRefill={(s) => handleWaterStationReport(s.id, 'refill')}
          />

          <RiskRanking
            ranking={ranking}
            compact
            onSelect={handleRankingSelect}
          />

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">最新回報</h3>
              <span className="text-[11px] text-slate-400 tabular">
                {filtered.length} 筆
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-400">
                目前沒有符合篩選條件的回報。
              </p>
            ) : (
              <div className="grid max-h-[40vh] grid-cols-1 gap-2 overflow-y-auto pr-1 lg:max-h-[60vh]">
                {filtered.slice(0, 30).map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    onClick={(rep) => {
                      setFocusReportId(rep.id);
                      setDetail(rep);
                    }}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={reportFormOpen}
        onClose={() => setReportFormOpen(false)}
        title="回報新問題"
        size="lg"
      >
        <ReportForm
          onCancel={() => setReportFormOpen(false)}
          onSubmitted={() => {
            setReportFormOpen(false);
            load();
          }}
        />
      </Modal>

      <ReportDetailModal
        report={detail}
        onClose={() => setDetail(null)}
        onConfirm={handleConfirm}
        busy={busy}
      />

      <AddCommuteRouteModal
        open={addRouteOpen}
        onClose={() => setAddRouteOpen(false)}
      />
    </div>
  );
}
