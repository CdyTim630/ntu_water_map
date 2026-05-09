/**
 * 個人化通勤路線 — 純 client localStorage（不上 server，零後端負擔，零 PII 風險）。
 *
 * 存放 key: `ntu-commute-routes-v1`
 * 結構: CommuteRoute[]
 *
 * 後續若要做跨裝置同步，可加 Supabase 表 + auth。現階段以 MVP 為主。
 */
'use client';
import { useCallback, useEffect, useState } from 'react';
import type { CommuteRoute } from './types';
import { uuid } from './utils';

const KEY = 'ntu-commute-routes-v1';

function readAll(): CommuteRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CommuteRoute =>
        r &&
        typeof r.id === 'string' &&
        typeof r.startNodeId === 'string' &&
        typeof r.endNodeId === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(routes: CommuteRoute[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(routes));
  // 同 tab 各 component 用 storage 事件不會觸發，自己 dispatch 一個
  window.dispatchEvent(new CustomEvent('ntu-commute-changed'));
}

export function useCommuteRoutes() {
  const [routes, setRoutes] = useState<CommuteRoute[]>([]);

  const reload = useCallback(() => {
    setRoutes(readAll());
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener('ntu-commute-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('ntu-commute-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [reload]);

  const add = useCallback(
    (input: Omit<CommuteRoute, 'id' | 'createdAt'>) => {
      const next: CommuteRoute = {
        ...input,
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      const all = readAll();
      writeAll([...all, next]);
      return next;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    const all = readAll().filter((r) => r.id !== id);
    writeAll(all);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<CommuteRoute>) => {
      const all = readAll().map((r) => (r.id === id ? { ...r, ...patch } : r));
      writeAll(all);
    },
    [],
  );

  return { routes, add, remove, update };
}
