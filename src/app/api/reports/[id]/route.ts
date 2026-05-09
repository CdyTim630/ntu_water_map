import { NextRequest, NextResponse } from 'next/server';
import { dataApi } from '@/lib/supabase';
import type { Report, ReportStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUSES: ReportStatus[] = ['active', 'reviewing', 'resolved', 'rejected'];

function authorize(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = req.headers.get('x-admin-password');
  return header === expected;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const report = await dataApi.getReport(params.id);
    if (!report) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<Report>;
    const patch: Partial<Report> = {};
    if (body.status) {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      patch.status = body.status;
    }
    if (typeof body.admin_note === 'string' || body.admin_note === null) {
      patch.admin_note = body.admin_note;
    }
    const updated = await dataApi.updateReport(params.id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ report: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const ok = await dataApi.deleteReport(params.id);
    if (!ok) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
