import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { TotpCard } from './totp-card';

interface MeResponse {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  totpEnabled?: boolean;
  employee?: {
    employeeNo: string;
    name: string;
    position?: string | null;
    department?: { name: string } | null;
    hospital?: { name: string } | null;
  } | null;
}

/**
 * System overview for SUPER_ADMIN: who is signed in, and whether the API is
 * answering. Deliberately read-only — there is no settings resource in the
 * backend, so this page reports the real state instead of a form that cannot
 * save. Anything editable needs a backend endpoint first.
 */
export default async function SettingsPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const [meRes, fenceRes] = await Promise.all([
    fetch(`${backendUrl()}/auth/me`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/geo/fence`, { headers: auth, cache: 'no-store' }).catch(() => null),
  ]);

  if (meRes.status === 401) redirect('/login');
  if (meRes.status === 403) forbidden();
  const me = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
  const fences = fenceRes?.ok
    ? ((await fenceRes.json()) as { name: string; radiusMeters: number; maxAccuracyM: number }[])
    : [];

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Keamanan
            <span className="text-primary">/ Pengaturan Sistem</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Informasi Sistem</h1>
          <p className="text-body-sm text-outline">
            Status layanan dan identitas akun yang sedang masuk.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
        <h2 className="text-headline-md text-on-surface">Sesi Saat Ini</h2>
        <dl className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-label-sm text-outline">Email</dt>
            <dd className="text-body-md text-on-surface">{me?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-outline">Peran</dt>
            <dd className="text-body-md text-on-surface">{me?.roles.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-label-sm text-outline">NIP</dt>
            <dd className="tabular text-body-md text-on-surface">
              {me?.employee?.employeeNo ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm text-outline">Unit</dt>
            <dd className="text-body-md text-on-surface">
              {me?.employee?.department?.name ?? '—'}
            </dd>
          </div>
        </dl>
        <p className="mt-space-md text-body-sm text-outline">
          Akun ini memegang {me?.permissions?.length ?? 0} izin pada sistem.
        </p>
      </section>

      <TotpCard initialActive={me?.totpEnabled ?? false} />

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
        <h2 className="text-headline-md text-on-surface">Status Layanan</h2>
        <p className="mt-1 text-body-sm text-outline">
          API presensi, validasi geofence, dan pencocokan biometrik.
        </p>
        <ul className="mt-space-md space-y-2">
          {fences.length === 0 ? (
            <li className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-sm text-outline">
              Belum ada fasilitas terdaftar.
            </li>
          ) : (
            fences.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-sm"
              >
                <span className="text-on-surface">
                  Radius {f.name} · maks akurasi {f.maxAccuracyM} m
                </span>
                <span className="tabular font-semibold text-primary">{f.radiusMeters} m</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
