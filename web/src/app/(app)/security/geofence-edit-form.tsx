'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface FenceOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// Form ubah perimeter per fasilitas. Nilai awal = fence live dari server;
// submit PUT ke BFF yang meneruskan ke PUT /geo/fence/:hospitalId.
export function GeofenceEditForm({ fences }: { fences: FenceOption[] }) {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState(fences[0]?.id ?? '');
  const current = fences.find((f) => f.id === hospitalId) ?? fences[0];
  const [latitude, setLatitude] = useState(String(current?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(current?.longitude ?? ''));
  const [radius, setRadius] = useState(String(current?.radiusMeters ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Ganti fasilitas = muat ulang nilai live-nya, bukan menimpa ketikan
  // yang sedang berjalan (pola adjust-during-render).
  const sig = current?.id ?? '';
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) {
    setPrevSig(sig);
    setLatitude(String(current?.latitude ?? ''));
    setLongitude(String(current?.longitude ?? ''));
    setRadius(String(current?.radiusMeters ?? ''));
    setError(null);
    setOk(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !hospitalId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/geo/fence/${encodeURIComponent(hospitalId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radius),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        throw new Error(msg ?? `Gagal (${res.status})`);
      }
      setOk('Perimeter tersimpan dan tercatat di audit log.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perimeter.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <label className="block text-label-md text-on-surface md:col-span-2">
        Fasilitas
        <select
          value={hospitalId}
          onChange={(e) => setHospitalId(e.target.value)}
          className={`${inputClass} mt-1 w-full`}
        >
          {fences.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-label-md text-on-surface">
        Latitude (-90…90)
        <input
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          inputMode="decimal"
          placeholder="-6.175400"
          className={`${inputClass} mt-1 w-full tabular`}
        />
      </label>
      <label className="block text-label-md text-on-surface">
        Longitude (-180…180)
        <input
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          inputMode="decimal"
          placeholder="106.827100"
          className={`${inputClass} mt-1 w-full tabular`}
        />
      </label>
      <label className="block text-label-md text-on-surface">
        Radius meter (10…1000)
        <input
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          inputMode="numeric"
          placeholder="100"
          className={`${inputClass} mt-1 w-full tabular`}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg md:col-span-2">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-lg border border-success-border bg-success-bg px-3 py-2 text-body-sm text-success-fg md:col-span-2">
          {ok}
        </p>
      )}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488] disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan Perimeter'}
        </button>
      </div>
    </form>
  );
}
