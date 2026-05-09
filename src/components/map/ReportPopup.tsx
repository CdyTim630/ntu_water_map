'use client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type Report,
} from '@/lib/types';
import { formatRelative } from '@/lib/utils';

interface Props {
  report: Report;
  onConfirm: (id: string, type: 'still_exists' | 'resolved') => void;
  onOpenDetails: (report: Report) => void;
  busy?: boolean;
}

const severityTone: Record<Report['severity'], 'red' | 'orange' | 'blue'> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const statusTone: Record<Report['status'], 'gray' | 'orange' | 'green' | 'slate'> = {
  active: 'orange',
  reviewing: 'gray',
  resolved: 'green',
  rejected: 'slate',
};

export function ReportPopupContent({
  report,
  onConfirm,
  onOpenDetails,
  busy,
}: Props) {
  return (
    <div className="w-[260px] space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={severityTone[report.severity]}>
          {SEVERITY_LABEL[report.severity]}
        </Badge>
        <Badge tone="blue">{CATEGORY_LABEL[report.category]}</Badge>
        <Badge tone={statusTone[report.status]}>
          {STATUS_LABEL[report.status]}
        </Badge>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-slate-900">
        {report.title}
      </h3>
      {report.location_name && (
        <p className="text-xs text-slate-500">📍 {report.location_name}</p>
      )}
      {report.description && (
        <p className="line-clamp-3 text-xs text-slate-600">{report.description}</p>
      )}
      {report.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.image_url}
          alt=""
          className="mt-1 h-28 w-full rounded-md object-cover"
        />
      )}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
        <span>{formatRelative(report.created_at)}</span>
        <span>👍 {report.upvote_count} · ✅ {report.resolved_count}</span>
      </div>
      <div className="flex gap-1.5 pt-1">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onConfirm(report.id, 'still_exists')}
          className="flex-1"
        >
          我也看到
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onConfirm(report.id, 'resolved')}
          className="flex-1"
        >
          已改善
        </Button>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onOpenDetails(report)}
        className="w-full"
      >
        查看完整詳情 →
      </Button>
    </div>
  );
}
