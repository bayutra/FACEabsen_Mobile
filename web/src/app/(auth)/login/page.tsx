'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/surface';

/**
 * Stitch "Login — Verifikasi TOTP": a centred two-column split. The left rail
 * carries the clinical identity and the privacy promise; the right carries the
 * credentials form. A notice strip sits above the fold.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Langkah kedua TOTP: diisi saat backend menantang `{ totpRequired: true }`.
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  function succeed() {
    router.push('/dashboard');
    router.refresh();
  }

  async function readMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    return typeof body?.message === 'string' && body.message.length > 0
      ? body.message
      : fallback;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // BFF menyamarkan 400/401 sebagai kredensial salah (anti-enumerasi),
        // status lain (terkunci, rate-limit) meneruskan pesan backend.
        if (res.status === 401) throw new Error('Email atau password salah');
        throw new Error(await readMessage(res, 'Login gagal. Coba lagi nanti.'));
      }
      const body = await res.json().catch(() => null);
      if (body?.totpRequired === true && typeof body?.totpToken === 'string') {
        setTotpToken(body.totpToken);
        setCode('');
        setRecoveryCode('');
        setUseRecovery(false);
        return;
      }
      succeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  }

  async function onTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totpToken) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(useRecovery ? '/api/auth/totp/recover' : '/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          useRecovery ? { totpToken, recoveryCode } : { totpToken, code },
        ),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Verifikasi gagal'));
      succeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-on-surface">
      {/* Notice strip */}
      <div className="w-full border-b border-outline-variant/30 bg-surface-container-lowest px-margin-desktop py-space-xs text-on-surface-variant">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between text-label-sm">
          <span className="flex items-center gap-space-sm">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 p-0.5 text-primary">
              <Fingerprint size={16} aria-hidden />
            </span>
            <span className="font-body-md-medium text-on-surface">RS Absen</span>
            <span className="hidden text-outline-variant md:inline-block">
              Sistem Absensi &amp; Verifikasi Biometrik
            </span>
          </span>
          <span className="hidden items-center gap-1 text-on-surface-variant sm:flex">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981]" aria-hidden />
            Layanan normal
          </span>
          <span className="tabular hidden items-center gap-1.5 border border-outline-variant/20 rounded bg-surface-container-low px-2.5 py-0.5 md:flex">
            <ShieldCheck size={15} className="text-primary" aria-hidden />
            TLS 1.3
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-margin-tablet py-space-xl lg:px-margin-desktop">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-stretch gap-gutter-desktop lg:grid-cols-12">
          {/* Identity rail */}
          <aside className="flex flex-col justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-space-xl shadow-surface-1 lg:col-span-5">
            <div className="flex items-center gap-space-md">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-surface-1">
                <Fingerprint size={28} aria-hidden />
              </span>
              <div className="flex flex-col">
                <h1 className="text-headline-md font-extrabold tracking-tight text-primary">
                  Admisi &amp; Kehadiran
                </h1>
                <span className="text-label-sm text-outline">RSUD Sehat Sentosa</span>
              </div>
            </div>

            <p className="mt-space-lg text-body-md text-on-surface-variant">
              Satu portal untuk_monitor shift, roster, dan verifikasi biometrik
              seluruh unit layanan.
            </p>

            <ul className="mt-space-lg space-y-3">
              <li className="flex gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
                <Lock size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span className="text-body-sm text-on-surface">
                  Sesi terenkripsi dan perangkat ikatan diverifikasi di server.
                </span>
              </li>
              <li className="flex gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span className="text-body-sm text-on-surface">
                  Foto wajah tidak pernah disimpan. Hanya template vektor
                  terenkripsi (AES-256-GCM).
                </span>
              </li>
            </ul>
          </aside>

          {/* Credentials */}
          <section className="flex flex-col justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-space-xl shadow-surface-1 lg:col-span-7">
            <h2 className="text-headline-lg text-on-surface">Masuk ke Dashboard</h2>
            <p className="mt-1 text-body-sm text-outline">
              Gunakan akun fasilitas yang terdaftar. Akses dibatasi berdasarkan
              peran.
            </p>

            {totpToken === null ? (
            <form onSubmit={onSubmit} className="mt-space-lg space-y-space-md">
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@rsud.go.id"
                  className={inputClass}
                />
              </Field>
              <Field label="Password">
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

              {error ? (
                <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>
            ) : (
            <form onSubmit={onTotpSubmit} className="mt-space-lg space-y-space-md">
              <p className="text-body-sm text-outline">
                Akun Anda memakai verifikasi dua langkah. Buka aplikasi
                autentikator lalu masukkan kode 6 digit yang tampil.
              </p>
              {useRecovery ? (
              <Field label="Kode pemulihan">
                <input
                  type="text"
                  required
                  autoComplete="one-time-code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="XXXX-XXXXXX"
                  className={`${inputClass} tabular`}
                />
              </Field>
              ) : (
              <Field label="Kode autentikator">
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
              )}

              {error ? (
                <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Memverifikasi…' : 'Verifikasi'}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setError(null);
                  }}
                  className="text-body-sm text-primary hover:underline"
                >
                  {useRecovery ? 'Pakai kode autentikator' : 'Pakai kode pemulihan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTotpToken(null);
                    setCode('');
                    setRecoveryCode('');
                    setError(null);
                  }}
                  className="text-body-sm text-on-surface-variant hover:underline"
                >
                  Kembali
                </button>
              </div>
            </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
