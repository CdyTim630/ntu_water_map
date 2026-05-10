'use client';
import { useState } from 'react';
import { ThumbsUp, CheckCircle2, MessageSquare, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from './StatusBadge';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  type Report,
  type ReportStatus,
} from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface Props {
  reports: Report[];
  password: string;
  onChanged: () => void;
}

const statuses: ReportStatus[] = ['active', 'reviewing', 'resolved', 'rejected'];

const severityTone = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
} as const;

export function AdminReportTable({ reports, password, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  async function patch(id: string, body: Partial<Report>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onChanged();
    } catch (e) {
      alert(`更新失敗：${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('確定刪除這筆 report？此動作無法復原。')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      });
      if (!res.ok) throw new Error(await res.text());
      onChanged();
    } catch (e) {
      alert(`刪除失敗：${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusyId(null);
    }
  }

  if (!reports.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
        目前沒有任何回報。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-soft">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">標題</th>
            <th className="px-3 py-2 text-left font-medium">類別</th>
            <th className="px-3 py-2 text-left font-medium">嚴重</th>
            <th className="px-3 py-2 text-left font-medium">狀態</th>
            <th className="px-3 py-2 text-left font-medium">位置</th>
            <th className="px-3 py-2 text-left font-medium">建立</th>
            <th className="px-3 py-2 text-left font-medium">統計</th>
            <th className="px-3 py-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reports.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{r.title}</div>
                {r.description && (
                  <div className="line-clamp-2 text-xs text-slate-500">
                    {r.description}
                  </div>
                )}
                {editingNoteId === r.id ? (
                  <div className="mt-2">
                    <textarea
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                      rows={2}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                    />
                    <div className="mt-1 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingNoteId(null)}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await patch(r.id, { admin_note: noteDraft });
                          setEditingNoteId(null);
                        }}
                      >
                        儲存註記
                      </Button>
                    </div>
                  </div>
                ) : r.admin_note ? (
                  <div className="mt-1 inline-flex items-start gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    <MessageSquare className="mt-0.5 h-3 w-3 flex-none" strokeWidth={2.2} />
                    <span>{r.admin_note}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-3 text-xs text-slate-700">
                {CATEGORY_LABEL[r.category]}
              </td>
              <td className="px-3 py-3">
                <Badge tone={severityTone[r.severity]}>
                  {SEVERITY_LABEL[r.severity]}
                </Badge>
              </td>
              <td className="px-3 py-3">
                <select
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  value={r.status}
                  disabled={busyId === r.id}
                  onChange={(e) =>
                    patch(r.id, { status: e.target.value as ReportStatus })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="mt-1">
                  <StatusBadge status={r.status} />
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-600">
                {r.location_name ?? '—'}
                <div className="text-[10px] text-slate-400">
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-500">
                {formatDateTime(r.created_at)}
              </td>
              <td className="px-3 py-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2 tabular">
                  <span className="inline-flex items-center gap-0.5">
                    <ThumbsUp className="h-3 w-3" strokeWidth={2.2} />
                    {r.upvote_count}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} />
                    {r.resolved_count}
                  </span>
                </span>
              </td>
              <td className="px-3 py-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingNoteId(r.id);
                      setNoteDraft(r.admin_note ?? '');
                    }}
                  >
                    編輯註記
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === r.id}
                    onClick={() => remove(r.id)}
                  >
                    刪除
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
