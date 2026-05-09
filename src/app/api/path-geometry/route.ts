import { NextRequest, NextResponse } from 'next/server';
import { fetchOsrmRoute, type OsrmProfile } from '@/lib/geometry';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

/**
 * GET /api/path-geometry?coords=lat1,lng1;lat2,lng2;...&mode=walk|bike
 * 回傳 OSRM 計算的真實道路折線（[lat, lng]）。
 *
 * 失敗時回 200 + { coordinates: null }，由前端 fallback。
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const coordsRaw = params.get('coords');
  const mode = params.get('mode') === 'bike' ? 'bike' : 'walk';
  if (!coordsRaw) {
    return NextResponse.json({ error: 'missing coords' }, { status: 400 });
  }
  let coords: [number, number][] = [];
  try {
    coords = coordsRaw.split(';').map((p) => {
      const [lat, lng] = p.split(',').map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('bad number');
      }
      return [lat, lng] as [number, number];
    });
  } catch {
    return NextResponse.json({ error: 'invalid coords' }, { status: 400 });
  }
  if (coords.length < 2) {
    return NextResponse.json({ error: 'need at least 2 points' }, { status: 400 });
  }

  try {
    const profile: OsrmProfile = mode === 'bike' ? 'bike' : 'foot';
    const result = await fetchOsrmRoute(coords, profile);
    if (!result) {
      return NextResponse.json({ coordinates: null, source: 'fallback' });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json(
      { coordinates: null, source: 'fallback', error: message },
      { status: 200 },
    );
  }
}
