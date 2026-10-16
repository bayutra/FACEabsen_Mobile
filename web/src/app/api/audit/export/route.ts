import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, backend } from '@/lib/api';
import type { AuditListResponse } from '@/lib/audit';

// Ekspor CSV jejak audit untuk filter aktif. Tanpa endpoint ekspor di
// backend, BFF mem-pageing daftar (maks 100/baris, maks 50 halaman = 5000
// baris) lalu merender CSV server-side — tidak ada data yang dikarang.
const MAX_PAGES = 50;
const PAGE_SIZE = 100;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const auth = { Authorization: `Bearer ${token}` };
  const { searchParams } = new URL(req.url);
  const base = new URLSearchParams();
  for (const k of ['action', 'actorEmail', 'result', 'from', 'to', 'security']) {
    const v = searchParams.get(k);
    if (v) base.set(k, v);
  }

  const rows: Array<Record<string, unknown>> = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = new URLSearchParams(base.toString());
    qs.set('page', String(page));
    qs.set('pageSize', String(PAGE_SIZE));
    const res = await backend(`/audit?${qs.toString()}`, { headers: auth }, 30_000);
    if (res.status === 401) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
    if (!res.ok) return NextResponse.json({ message: 'Gagal memuat audit log' }, { status: res.status });
    const body = (await res.json()) as AuditListResponse;
    total = body.pagination.totalItems;
    for (const r of body.data) {
      rows.push({
        waktu: r.timestamp,
        pelaku: r.actor?.email ?? r.actorId ?? '',
        aksi: r.action,
        target: r.targetType ? `${r.targetType}:${r.targetId ?? ''}` : '',
        hasil: r.result ?? '',
        ip: r.ipAddress ?? '',
        perangkat: r.device?.deviceName ?? r.deviceId ?? '',
      });
    }
    if (rows.length >= total || body.data.length === 0) break;
  }

  const header = ['waktu', 'pelaku', 'aksi', 'target', 'hasil', 'ip', 'perangkat'];
  const lines = [header.map(csvCell).join(';')];
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(';'));
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return new NextResponse(`\uFEFF${lines.join('\r\n')}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-${stamp}.csv"`,
    },
  });
}
