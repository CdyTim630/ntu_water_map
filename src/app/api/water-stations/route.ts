import { NextResponse } from 'next/server';
import { waterStationApi } from '@/lib/waterStations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stations = await waterStationApi.list();
    return NextResponse.json({ stations });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
