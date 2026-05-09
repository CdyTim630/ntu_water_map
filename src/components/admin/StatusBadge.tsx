'use client';
import { Badge } from '@/components/ui/Badge';
import { STATUS_LABEL, type ReportStatus } from '@/lib/types';

const tone: Record<ReportStatus, 'orange' | 'gray' | 'green' | 'slate'> = {
  active: 'orange',
  reviewing: 'gray',
  resolved: 'green',
  rejected: 'slate',
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={tone[status]}>{STATUS_LABEL[status]}</Badge>;
}
