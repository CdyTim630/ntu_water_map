'use client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type Report,
} from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface Props {
  report: Report | null;
  onClose: () => void;
  onConfirm: (id: string, type: 'still_exists' | 'resolved') => void;
  busy?: boolean;
}

const severityTone = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
} as const;
const statusTone = {
  active: 'orange',
  reviewing: 'gray',
  resolved: 'green',
  rejected: 'slate',
} as const;

export function ReportDetailModal({ report, onClose, onConfirm, busy }: Props) {
  return (
    <Modal
      open={!!report}
      onClose={onClose}
      title={report?.title ?? '問題詳情'}
      size="md"
      footer={
        report ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => onConfirm(report.id, 'still_exists')}
              disabled={busy}
            >
              我也看到（+1）
            </Button>
            <Button
              onClick={() => onConfirm(report.id, 'resolved')}
              disabled={busy}
            >
              已改善（+1）
            </Button>
          </div>
        ) : null
      }
    >
      {report && (
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={severityTone[report.severity]}>
              {SEVERITY_LABEL[report.severity]}
            </Badge>
            <Badge tone="blue">{CATEGORY_LABEL[report.category]}</Badge>
            <Badge tone={statusTone[report.status]}>
              {STATUS_LABEL[report.status]}
            </Badge>
          </div>

          {report.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.image_url}
              alt=""
              className="max-h-72 w-full rounded-lg object-cover"
            />
          )}

          {report.description && (
            <p className="whitespace-pre-wrap leading-relaxed">
              {report.description}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            {report.location_name && (
              <>
                <dt className="text-slate-500">地點名稱</dt>
                <dd className="text-slate-800">{report.location_name}</dd>
              </>
            )}
            <dt className="text-slate-500">座標</dt>
            <dd className="text-slate-800">
              {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
            </dd>
            <dt className="text-slate-500">回報人</dt>
            <dd className="text-slate-800">{report.reporter_name ?? '匿名'}</dd>
            <dt className="text-slate-500">建立時間</dt>
            <dd className="text-slate-800">{formatDateTime(report.created_at)}</dd>
            <dt className="text-slate-500">更新時間</dt>
            <dd className="text-slate-800">{formatDateTime(report.updated_at)}</dd>
            <dt className="text-slate-500">我也看到</dt>
            <dd className="text-slate-800">{report.upvote_count}</dd>
            <dt className="text-slate-500">已改善</dt>
            <dd className="text-slate-800">{report.resolved_count}</dd>
          </dl>

          {report.admin_note && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 font-semibold">管理員註記</div>
              <p className="whitespace-pre-wrap">{report.admin_note}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
