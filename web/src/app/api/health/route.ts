import { NextResponse } from 'next/server';
import { backend } from '@/lib/api';

// Backend connectivity probe for the dashboard shell (STEP 4).
export async function GET() {
  try {
    const res = await backend('/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return NextResponse.json({ backend: 'ok' });
  } catch {
    return NextResponse.json({ backend: 'down' }, { status: 503 });
  }
}
