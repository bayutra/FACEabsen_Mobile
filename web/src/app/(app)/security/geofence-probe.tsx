'use client';

import { useState } from 'react';
import { Crosshair, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Field, inputClass } from '@/components/ui/surface';

/**
 * Live geofence diagnostic for SUPER_ADMIN.
 *
 * This is deliberately a *probe*, not a settings form: the backend exposes
 * `POST /geo/check` but no endpoint to persist a radius, so a form that looked
 * editable could never save. Here the admin submits a real coordinate and sees
 * the server's verdict against the hospital's actual fence.
 */
export function GeofenceProbe({ defaults }: { defaults: GeofenceDefaults }) {
  const [lat, setLat] = useState(String(defaults.latitude));
  const [lng, setLng] = useState(String(defaults.longitude));
  const [acc, setAcc] = useState('12');
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/geo/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: Number(lat),
          longitude: Number(lng),
          accuracyM: Number(acc),
          timestamp: new Date().toISOString(),
          isMocked: false,
        }),
      });
      if (!res.ok) throw new Error(`Gagal memprobe (${res.status})`);
      setResult((await res.json()) as ProbeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memprobe');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={probe} className="space-y-space-md">
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
        <Field label="Latitude">
          <input
            required
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={`${inputClass} tabular`}
          />
        </Field>
        <Field label="Longitude">
          <input
            required
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className={`${inputClass} tabular`}
          />
        </Field>
        <Field label="Akurasi (meter)">
          <input
            required
            type="number"
            min={0}
            value={acc}
            onChange={(e) => setAcc(e.target.value)}
            className={`${inputClass} tabular`}
          />
        </Field>
      </div>

      <Button type="submit" disabled={busy}>
        <Crosshair className="h-4 w-4" aria-hidden />
        {busy ? 'Memeriksa…' : 'Periksa Lokasi'}
      </Button>

      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-headline-md text-on-surface">
              <ShieldCheck size={18} className="text-primary" aria-hidden />
              Hasil Pemeriksaan
            </h3>
            <Badge tone={result.inside ? 'success' : 'danger'}>
              {result.inside ? 'Di dalam radius' : 'Di luar radius'}
            </Badge>
          </div>
          <dl className="mt-space-md grid grid-cols-2 gap-space-md sm:grid-cols-4">
            <div>
              <dt className="text-label-sm text-outline">Jarak</dt>
              <dd className="tabular text-body-md text-on-surface">{result.distanceM} m</dd>
            </div>
            <div>
              <dt className="text-label-sm text-outline">Radius</dt>
              <dd className="tabular text-body-md text-on-surface">{result.radiusM} m</dd>
            </div>
            <div>
              <dt className="text-label-sm text-outline">Akurasi</dt>
              <dd className="tabular text-body-md text-on-surface">{result.accuracyM} m</dd>
            </div>
            <div>
              <dt className="text-label-sm text-outline">Lokasi palsu</dt>
              <dd className="text-body-md text-on-surface">{result.mockSuspected ? 'Diduga' : 'Tidak'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </form>
  );
}

export interface GeofenceDefaults {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface ProbeResult {
  inside: boolean;
  distanceM: number;
  radiusM: number;
  accuracyM: number;
  mockSuspected: boolean;
  checks?: Record<string, boolean>;
}
