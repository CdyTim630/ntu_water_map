import { NextRequest, NextResponse } from 'next/server';
import { dataApi } from '@/lib/supabase';
import type { ConfirmationType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json()) as { type?: ConfirmationType };
    if (body.type !== 'still_exists' && body.type !== 'resolved') {
      return NextResponse.json(
        { error: 'type must be still_exists or resolved' },
        { status: 400 },
      );
    }
    const updated = await dataApi.addConfirmation(params.id, body.type);
    if (!updated) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ report: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
