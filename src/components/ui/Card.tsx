'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 統一卡片基底 — 所有 panel / list 都用這個。
 * - 細邊 + 微陰影（不搶視線）
 * - 圓角 16px（rounded-2xl）
 * - 預設 padding 16px，可用 className 覆寫
 */
export function Card({
  className,
  children,
  interactive,
}: {
  className?: string;
  children: React.ReactNode;
  /** hover 時微抬升（給可點擊卡片用） */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft',
        interactive &&
          'transition-all duration-200 ease-soft-out hover:-translate-y-0.5 hover:shadow-lift hover:border-slate-300/80',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 卡片 header — 標題、描述、右側 action 三段式。
 * 統一 spacing：標題 14px semibold、描述 12px slate-500。
 */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 flex items-start justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/** 區塊小標 — 比 CardHeader 更輕，用於 card 內部分組 */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500',
        className,
      )}
    >
      {children}
    </div>
  );
}
