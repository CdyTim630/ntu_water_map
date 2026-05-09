import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  ConfirmationType,
  CreateReportInput,
  Report,
} from './types';
import { mockStore } from './mockData';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'report-images';

const useMockEnv = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
export const USE_MOCK = useMockEnv || !SUPABASE_URL || !SUPABASE_ANON;

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (USE_MOCK) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return supabase;
}

/**
 * Server-safe data layer. 在 mock 模式下走 in-memory store；
 * 一旦設定好 Supabase env 就會自動切換。
 */
export const dataApi = {
  async listReports(): Promise<Report[]> {
    if (USE_MOCK) return mockStore.listReports();
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Report[];
  },

  async getReport(id: string): Promise<Report | null> {
    if (USE_MOCK) return mockStore.getReport(id);
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as Report) ?? null;
  },

  async createReport(input: CreateReportInput): Promise<Report> {
    if (USE_MOCK) return mockStore.createReport(input);
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('reports')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data as Report;
  },

  async updateReport(id: string, patch: Partial<Report>): Promise<Report | null> {
    if (USE_MOCK) return mockStore.updateReport(id, patch);
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from('reports')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return (data as Report) ?? null;
  },

  async deleteReport(id: string): Promise<boolean> {
    if (USE_MOCK) return mockStore.deleteReport(id);
    const sb = getSupabase()!;
    const { error } = await sb.from('reports').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async addConfirmation(
    reportId: string,
    type: ConfirmationType,
  ): Promise<Report | null> {
    if (USE_MOCK) return mockStore.addConfirmation(reportId, type);
    const sb = getSupabase()!;
    const { error: insertErr } = await sb
      .from('report_confirmations')
      .insert({ report_id: reportId, type });
    if (insertErr) throw insertErr;

    const field = type === 'still_exists' ? 'upvote_count' : 'resolved_count';
    // 取得當前值再加一（沒接 RPC，先走 select / update）
    const { data: current, error: selErr } = await sb
      .from('reports')
      .select(field)
      .eq('id', reportId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!current) return null;

    const next = ((current as Record<string, number>)[field] ?? 0) + 1;
    const { data: updated, error: updErr } = await sb
      .from('reports')
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq('id', reportId)
      .select('*')
      .maybeSingle();
    if (updErr) throw updErr;
    return (updated as Report) ?? null;
  },
};

/**
 * 客戶端：上傳圖片並回傳 public URL。Mock 模式下回傳本地預覽 URL。
 */
export async function uploadReportImage(file: File): Promise<string | null> {
  if (USE_MOCK) {
    return URL.createObjectURL(file);
  }
  const sb = getSupabase();
  if (!sb) return null;
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
