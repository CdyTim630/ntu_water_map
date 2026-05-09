import { NextRequest, NextResponse } from 'next/server';
import { dataApi } from '@/lib/supabase';
import type {
  CreateReportInput,
  ReportCategory,
  ReportSeverity,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORIES: ReportCategory[] = [
  'flooding',
  'standing_water',
  'facility_leak',
  'poor_drainage',
  'other',
];
const SEVERITIES: ReportSeverity[] = ['low', 'medium', 'high'];

export async function GET() {
  try {
    const reports = await dataApi.listReports();
    return NextResponse.json({ reports });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateReportInput>;

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!body.category || !CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: 'category is required and must be valid' },
        { status: 400 },
      );
    }
    if (!body.severity || !SEVERITIES.includes(body.severity)) {
      return NextResponse.json(
        { error: 'severity is required and must be valid' },
        { status: 400 },
      );
    }
    if (
      typeof body.latitude !== 'number' ||
      typeof body.longitude !== 'number'
    ) {
      return NextResponse.json(
        { error: 'latitude and longitude are required' },
        { status: 400 },
      );
    }

    const report = await dataApi.createReport({
      title: body.title.trim(),
      description: body.description ?? null,
      category: body.category,
      severity: body.severity,
      location_name: body.location_name ?? null,
      latitude: body.latitude,
      longitude: body.longitude,
      image_url: body.image_url ?? null,
      reporter_name: body.reporter_name ?? null,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
