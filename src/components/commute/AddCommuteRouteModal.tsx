'use client';
import { useEffect, useState } from 'react';
import { Footprints, Bike } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CAMPUS_NODES } from '@/lib/campus';
import { useCommuteRoutes } from '@/lib/commuteStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const baseSelect =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

const PRESETS: { label: string; startId: string; endId: string }[] = [
  // 用最常見的「校門口 → 工綜」之類預設，讓使用者一鍵加好
  { label: '校門口 → 工綜', startId: 'main_gate', endId: 'engineering' },
  { label: '校門口 → 總圖', startId: 'main_gate', endId: 'main_library' },
  { label: '公館站 3 號出口 → 工綜', startId: 'gongguan_exit_3', endId: 'engineering' },
  { label: '校門口 → 醉月湖', startId: 'main_gate', endId: 'drunk_moon_lake' },
];

export function AddCommuteRouteModal({ open, onClose }: Props) {
  const { add } = useCommuteRoutes();
  const [label, setLabel] = useState('');
  const [startNodeId, setStartNodeId] = useState('main_gate');
  const [endNodeId, setEndNodeId] = useState('engineering');
  const [mode, setMode] = useState<'walk' | 'bike'>('walk');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel('');
      setError(null);
    }
  }, [open]);

  const startNode = CAMPUS_NODES.find((n) => n.id === startNodeId);
  const endNode = CAMPUS_NODES.find((n) => n.id === endNodeId);

  // label 自動填入「起 → 終」如果使用者沒手動填
  const effectiveLabel =
    label.trim() ||
    (startNode && endNode ? `${startNode.name} → ${endNode.name}` : '');

  const submit = () => {
    if (!startNode || !endNode) {
      setError('起點 / 終點不存在');
      return;
    }
    if (startNodeId === endNodeId) {
      setError('起點與終點不能相同');
      return;
    }
    add({
      label: effectiveLabel,
      startNodeId,
      endNodeId,
      mode,
      preferredTimes: [],
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="新增通勤路線" size="md">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            快速範本
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setStartNodeId(p.startId);
                  setEndNodeId(p.endId);
                  setLabel(p.label);
                }}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-200"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              出發
            </label>
            <select
              className={baseSelect}
              value={startNodeId}
              onChange={(e) => setStartNodeId(e.target.value)}
            >
              {CAMPUS_NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              目的地
            </label>
            <select
              className={baseSelect}
              value={endNodeId}
              onChange={(e) => setEndNodeId(e.target.value)}
            >
              {CAMPUS_NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            標籤（自動填入「起→終」，可改成「上課」「下班」等）
          </label>
          <input
            type="text"
            className={baseSelect}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={effectiveLabel || '上課路線'}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            交通方式
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('walk')}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors ${
                mode === 'walk'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Footprints className="h-4 w-4" strokeWidth={2.2} />
              步行
            </button>
            <button
              type="button"
              onClick={() => setMode('bike')}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors ${
                mode === 'bike'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Bike className="h-4 w-4" strokeWidth={2.2} />
              腳踏車
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit}>儲存路線</Button>
        </div>
      </div>
    </Modal>
  );
}
