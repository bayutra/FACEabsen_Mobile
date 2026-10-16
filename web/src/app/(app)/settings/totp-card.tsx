'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Field, inputClass } from '@/components/ui/surface';

interface SetupResponse {
  secret: string;
  otpauthUri: string;
}

/**
 * Pendaftaran autentikasi dua faktor (TOTP) mandiri.
 *
 * Status awal berasal dari server (`/auth/me` → `totpEnabled`); aksi
 * enable/disable di kartu ini memperbarui badge secara optimistis.
 */
export function TotpCard({ initialActive = false }: { initialActive?: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function readMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    return typeof body?.message === 'string' && body.message.length > 0
      ? body.message
      : fallback;
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setError('Gagal menyalin. Salin manual teks di bawah.');
    }
  }

  async function startSetup() {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
      if (!res.ok) throw new Error(await readMessage(res, 'Gagal memulai pendaftaran'));
      const body = (await res.json()) as SetupResponse;
      if (typeof body.secret !== 'string' || typeof body.otpauthUri !== 'string') {
        throw new Error('Respons pendaftaran tidak valid');
      }
      setSetup(body);
      setCode('');
      setRecoveryCodes(null);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulai pendaftaran');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Kode salah. Coba lagi.'));
      const body = (await res.json()) as { recoveryCodes?: unknown };
      if (!Array.isArray(body.recoveryCodes) || body.recoveryCodes.length !== 8) {
        throw new Error('Respons pendaftaran tidak valid');
      }
      setRecoveryCodes(body.recoveryCodes as string[]);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode salah. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  function finishEnable() {
    setSetup(null);
    setRecoveryCodes(null);
    setCode('');
    setActive(true);
    setDone('Autentikasi dua faktor aktif.');
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Gagal menonaktifkan'));
      setActive(false);
      setShowDisable(false);
      setPassword('');
      setSetup(null);
      setRecoveryCodes(null);
      setDone('Autentikasi dua faktor dinonaktifkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menonaktifkan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-headline-md text-on-surface">Autentikasi dua faktor (TOTP)</h2>
          <p className="mt-1 text-body-sm text-outline">
            Kode 6 digit dari aplikasi autentikator di tiap login. Simpan kode
            pemulihan di tempat aman — hanya tampil sekali.
          </p>
        </div>
        <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Aktif' : 'Belum aktif'}</Badge>
      </div>

      {error ? (
        <p role="alert" className="mt-space-md rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-space-md rounded-lg border border-success-border bg-success-bg px-3 py-2 text-body-sm text-success-fg">
          {done}
        </p>
      ) : null}

      {recoveryCodes ? (
        <div className="mt-space-md space-y-space-md">
          <p className="text-body-sm text-on-surface">
            Simpan kedelapan kode pemulihan ini sekarang. Kode tidak akan
            ditampilkan lagi dan masing-masing hanya berlaku sekali.
          </p>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recoveryCodes.map((c) => (
              <li
                key={c}
                className="tabular rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-md text-on-surface"
              >
                {c}
              </li>
            ))}
          </ol>
          <label className="flex items-start gap-2 text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="mt-1"
            />
            Saya sudah menyimpan kedelapan kode ini di tempat aman
          </label>
          <Button onClick={finishEnable} disabled={!saved}>
            Selesai
          </Button>
        </div>
      ) : setup ? (
        <div className="mt-space-md space-y-space-md">
          <div>
            <p className="text-label-md text-on-surface">Secret (entri manual)</p>
            <p className="tabular mt-1 break-all rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-md text-on-surface">
              {setup.secret}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => copy(setup.secret, 'secret')}
            >
              {copied === 'secret' ? 'Disalin' : 'Salin secret'}
            </Button>
          </div>
          <div>
            <p className="text-label-md text-on-surface">URI autentikator</p>
            <p className="mt-1 break-all rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-body-sm text-on-surface">
              {setup.otpauthUri}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => copy(setup.otpauthUri, 'uri')}
            >
              {copied === 'uri' ? 'Disalin' : 'Salin URI'}
            </Button>
          </div>
          <form onSubmit={confirmEnable} className="space-y-space-md">
            <Field label="Kode 6 digit dari aplikasi autentikator">
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                className={`${inputClass} tabular`}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Memverifikasi…' : 'Konfirmasi & aktifkan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSetup(null);
                  setCode('');
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      ) : showDisable ? (
        <form onSubmit={confirmDisable} className="mt-space-md space-y-space-md">
          <Field label="Password saat ini (konfirmasi)">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? 'Memproses…' : 'Nonaktifkan'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setShowDisable(false);
                setPassword('');
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-space-md flex flex-wrap gap-2">
          <Button onClick={startSetup} disabled={busy}>
            {busy ? 'Memproses…' : active ? 'Aktifkan ulang' : 'Aktifkan'}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setShowDisable(true);
              setError(null);
            }}
          >
            Nonaktifkan
          </Button>
        </div>
      )}
      {!setup && !recoveryCodes && !showDisable ? (
        <p className="mt-space-md text-body-sm text-outline">
          Mengaktifkan ulang akan mengganti secret dan menghanguskan kode
          pemulihan lama.
        </p>
      ) : null}
    </section>
  );
}
