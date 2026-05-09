'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'gray' | 'red' | 'orange' | 'blue' | 'green' | 'slate';

const toneClasses: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700',
  slate: 'bg-slate-200 text-slate-800',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  orange: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
};

export function Badge({
  tone = 'gray',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
