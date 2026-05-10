'use client';
import { MapPin, ThumbsUp, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type Report,
} from '@/lib/types';
import { formatRelative } from '@/lib/utils';

interface Props {
  report: Report;
  onClick?: (r: Report) => void;
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

export function ReportCard({ report, onClick }: Props) {
  return (
    <button
      onClick={() => onClick?.(report)}
      className="group w-full rounded-xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:shadow-soft"
    >
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={severityTone[report.severity]}>
          {SEVERITY_LABEL[report.severity]}
        </Badge>
        <Badge tone="blue">{CATEGORY_LABEL[report.category]}</Badge>
        <Badge tone={statusTone[report.status]}>
          {STATUS_LABEL[report.status]}
        </Badge>
      </div>
      <h4 className="mt-1.5 line-clamp-1 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
        {report.title}
      </h4>
      {report.location_name && (
        <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-slate-500">
          <MapPin className="h-3 w-3 flex-none" strokeWidth={2.2} />
          {report.location_name}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>{formatRelative(report.created_at)}</span>
        <span className="inline-flex items-center gap-2 tabular">
          <span className="inline-flex items-center gap-0.5">
            <ThumbsUp className="h-3 w-3" strokeWidth={2.2} />
            {report.upvote_count}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} />
            {report.resolved_count}
          </span>
        </span>
      </div>
    </button>
  );
}
