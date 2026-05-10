'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  type CreateReportInput,
  type ReportCategory,
  type ReportSeverity,
} from '@/lib/types';
import { uploadReportImage } from '@/lib/supabase';
import { incrementStat } from '@/lib/statsStore';

const LocationPicker = dynamic(
  () => import('@/components/map/LocationPicker').then((m) => m.LocationPicker),
  { ssr: false },
);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface Props {
  initialLocation?: { lat: number; lng: number } | null;
  onSubmitted: () => void;
  onCancel?: () => void;
}

export function ReportForm({ initialLocation, onSubmitted, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ReportCategory>('flooding');
  const [severity, setSeverity] = useState<ReportSeverity>('medium');
  const [locationName, setLocationName] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLocation ?? null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialLocation) setCoords(initialLocation);
  }, [initialLocation]);

  const labelClass = 'block text-xs font-medium text-slate-700';
  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError('請輸入標題');
    if (!coords) return setError('請在地圖上點選問題位置');
    if (file && file.size > MAX_IMAGE_BYTES) {
      return setError('圖片不可超過 5MB');
    }

    try {
      setSubmitting(true);

      let image_url: string | null = null;
      if (file) {
        image_url = await uploadReportImage(file);
      }

      const payload: CreateReportInput = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        severity,
        location_name: locationName.trim() || null,
        latitude: coords.lat,
        longitude: coords.lng,
        image_url,
        reporter_name: reporterName.trim() || null,
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '送出失敗');
      }
      // hook stats: 累積到 /me 個人成績單
      incrementStat('report_filed');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={labelClass}>
          標題 <span className="text-red-500">*</span>
        </label>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：小椰林道大雨後嚴重淹水"
          maxLength={100}
        />
      </div>

      <div>
        <label className={labelClass}>說明</label>
        <textarea
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="請描述問題情況、嚴重程度、影響範圍等"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>
            類別 <span className="text-red-500">*</span>
          </label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
          >
            {(
              Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]
            ).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            嚴重度 <span className="text-red-500">*</span>
          </label>
          <select
            className={inputClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
          >
            {(
              Object.keys(SEVERITY_LABEL) as (keyof typeof SEVERITY_LABEL)[]
            ).map((k) => (
              <option key={k} value={k}>
                {SEVERITY_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>
          地點 <span className="text-red-500">*</span>{' '}
          <span className="text-slate-400">(在地圖上點選)</span>
        </label>
        <div className="mt-1">
          <LocationPicker value={coords} onChange={setCoords} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>地點名稱</label>
          <input
            className={inputClass}
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="例：小椰林道、總圖前"
          />
        </div>
        <div>
          <label className={labelClass}>回報人</label>
          <input
            className={inputClass}
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            placeholder="可填暱稱或留空"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>圖片（&lt; 5MB）</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {file && (
          <p className="mt-1 text-xs text-slate-500">
            已選 {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? '送出中…' : '送出回報'}
        </Button>
      </div>
    </form>
  );
}
