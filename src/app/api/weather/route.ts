import { NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const snapshot = await fetchWeather();
    return NextResponse.json(snapshot);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
