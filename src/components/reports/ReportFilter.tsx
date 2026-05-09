'use client';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type ReportFilterState,
} from '@/lib/types';

interface Props {
  value: ReportFilterState;
  onChange: (v: ReportFilterState) => void;
  total: number;
  filtered: number;
}

const baseSelect =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function ReportFilter({ value, onChange, total, filtered }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <span className="text-xs text-slate-500">篩選</span>

      <select
        className={baseSelect}
        value={value.category}
        onChange={(e) =>
          onChange({ ...value, category: e.target.value as never })
        }
      >
        <option value="all">全部類別</option>
        {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map(
          (k) => (
            <option key={k} value={k}>
              {CATEGORY_LABEL[k]}
            </option>
          ),
        )}
      </select>

      <select
        className={baseSelect}
        value={value.severity}
        onChange={(e) =>
          onChange({ ...value, severity: e.target.value as never })
        }
      >
        <option value="all">全部嚴重度</option>
        {(Object.keys(SEVERITY_LABEL) as (keyof typeof SEVERITY_LABEL)[]).map(
          (k) => (
            <option key={k} value={k}>
              {SEVERITY_LABEL[k]}
            </option>
          ),
        )}
      </select>

      <select
        className={baseSelect}
        value={value.status}
        onChange={(e) =>
          onChange({ ...value, status: e.target.value as never })
        }
      >
        <option value="all">全部狀態</option>
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map(
          (k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ),
        )}
      </select>

      <div className="ml-auto text-xs text-slate-500">
        {filtered} / {total} 筆
      </div>
    </div>
  );
}
