import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { TableShell, Td, Th, Tr } from '@/components/ui/surface';
import { GeofenceEditForm } from './geofence-edit-form';
import { GeofenceProbe, type GeofenceDefaults } from './geofence-probe';

interface FenceRow {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyM: number;
  maxSkewMin: number;
}

/**
 * Super-admin geofence console: tabel fence live + form ubah perimeter
 * (PUT /geo/fence/:hospitalId, diaudit GEOFENCE_UPDATED) + probe penilaian
 * server-side yang sama dengan gerbang presensi.
 */
export default async function SecurityPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const res = await fetch(`${backendUrl()}/geo/fence`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat konfigurasi geofence');

  const fences = (await res.json()) as FenceRow[];

  const defaults: GeofenceDefaults = {
    latitude: fences[0]?.latitude ?? 0,
    longitude: fences[0]?.longitude ?? 0,
    radiusMeters: fences[0]?.radiusMeters ?? 200,
  };

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Keamanan
            <span className="text-primary">/ Konfigurasi Geofence</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Keamanan &amp; Geofence</h1>
          <p className="text-body-sm text-outline">
            Titik presensi dan radius yang berlaku per fasilitas.
          </p>
        </div>
      </div>

      <TableShell>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Fasilitas</Th>
              <Th>Kode</Th>
              <Th>Titik Presensi</Th>
              <Th align="right">Radius</Th>
              <Th align="right">Maks. Akurasi</Th>
              <Th align="right">Maks. Selisih Waktu</Th>
            </tr>
          </thead>
          <tbody>
            {fences.map((f) => (
              <Tr key={f.id}>
                <Td>
                  <span className="font-medium">{f.name}</span>
                </Td>
                <Td tabular>{f.code}</Td>
                <Td tabular>
                  {f.latitude.toFixed(6)}, {f.longitude.toFixed(6)}
                </Td>
                <Td tabular align="right">
                  {f.radiusMeters} m
                </Td>
                <Td tabular align="right">
                  {f.maxAccuracyM} m
                </Td>
                <Td tabular align="right">
                  {f.maxSkewMin} mnt
                </Td>
              </Tr>
            ))}
            {fences.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-body-md text-outline">
                  Belum ada fasilitas terdaftar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
        <div className="mb-space-md">
          <h2 className="text-headline-md text-on-surface">Ubah Perimeter</h2>
          <p className="text-body-sm text-outline">
            Titik presensi dan radius per fasilitas. Setiap perubahan tercatat
            di audit log beserta nilai sebelum/sesudah.
          </p>
        </div>
        {fences.length > 0 ? (
          <GeofenceEditForm fences={fences} />
        ) : (
          <p className="text-body-md text-outline">Belum ada fasilitas terdaftar.</p>
        )}
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
        <div className="mb-space-md">
          <h2 className="text-headline-md text-on-surface">Uji Lokasi</h2>
          <p className="text-body-sm text-outline">
            Server menilai radius, akurasi, dan kesegaran waktu pada setiap
            presensi. Probe ini memanggil penilaian yang sama.
          </p>
        </div>
        <GeofenceProbe defaults={defaults} />
      </section>
    </div>
  );
}
