import { NextRequest, NextResponse } from 'next/server';
import { waterStationApi } from '@/lib/waterStations';
import type { WaterStationReportType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_TYPES: WaterStationReportType[] = ['broken', 'fixed', 'refill'];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json()) as { type?: string };
    const t = body.type as WaterStationReportType;
    if (!t || !VALID_TYPES.includes(t)) {
      return NextResponse.json(
        { error: `invalid type, must be one of ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    const station = await waterStationApi.applyReport(params.id, t);
    if (!station) {
      return NextResponse.json({ error: 'station not found' }, { status: 404 });
    }
    return NextResponse.json({ station });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
