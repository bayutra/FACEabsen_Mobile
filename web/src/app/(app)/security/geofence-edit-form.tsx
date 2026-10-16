'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const GeofenceMap = dynamic(() => import('./geofence-map').then((m) => m.GeofenceMap), {
  ssr: false,
  loading: () => (
    <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-body-md text-outline md:col-span-2">
      Memuat peta…
    </p>
  ),
});

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
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null);

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

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`Pencarian gagal (${res.status})`);
      const body = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
      setHits(
        (Array.isArray(body) ? body : [])
          .filter((h) => h.lat !== undefined && h.lon !== undefined)
          .map((h) => ({ name: h.display_name ?? q, lat: Number(h.lat), lon: Number(h.lon) })),
      );
      if (!Array.isArray(body) || body.length === 0) setHits([]);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
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
      <div className="md:col-span-2">
        <p className="text-label-md text-on-surface">Titik di peta (klik / geser pin)</p>
        <div className="mt-1 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Cari RS / alamat — mis. RSU Darmayu Madiun"
            className={`${inputClass} w-full`}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching}
            className="h-10 shrink-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-body-md-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
          >
            {searching ? '…' : 'Cari'}
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="mt-2 divide-y divide-outline-variant/40 rounded-lg border border-outline-variant bg-surface-container-lowest">
            {hits.map((h) => (
              <li key={`${h.lat},${h.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    setLatitude(h.lat.toFixed(6));
                    setLongitude(h.lon.toFixed(6));
                    setFocus({ lat: h.lat, lon: h.lon, key: Date.now() });
                    setHits([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-body-sm text-on-surface hover:bg-surface-container-low"
                >
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <GeofenceMap
            hospitalId={hospitalId}
            latitude={Number(latitude)}
            longitude={Number(longitude)}
            radiusMeters={Number(radius)}
            focus={focus}
            onMove={(lat, lon) => {
              setLatitude(lat.toFixed(6));
              setLongitude(lon.toFixed(6));
            }}
          />
        </div>
      </div>
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
      <div className="md:col-span-2">
        <label className="block text-label-md text-on-surface" htmlFor="geofence-radius">
          Radius: <span className="tabular">{radius || '—'} meter</span> (10…1000)
        </label>
        <input
          id="geofence-radius"
          type="range"
          min={10}
          max={1000}
          step={5}
          value={Number(radius) || 0}
          onChange={(e) => setRadius(e.target.value)}
          className="mt-2 w-full accent-primary"
        />
      </div>
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
