'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/Icon';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const OTP_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, verifyTotp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    if (totpToken) otpRefs.current[0]?.focus();
  }, [totpToken]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.totpRequired) {
        setTotpToken(result.totpToken);
      } else {
        router.replace('/');
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!totpToken) return;
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Masukkan 6 digit kode autentikator.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyTotp(totpToken, code);
      router.replace('/');
    } catch (err) {
      setError(messageOf(err));
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      otpRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '');
    setDigits((current) => {
      const next = [...current];
      next[index] = clean.slice(-1);
      return next;
    });
  }

  function onOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function onOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    event.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, index) => text[index] ?? '');
    setDigits(next);
    otpRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  }

  function backToCredentials() {
    setTotpToken(null);
    setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    setError(null);
  }

  if (loading) return <div className="loading">Memeriksa sesi…</div>;

  return (
    <div className="login-page">
      <div className="login-topbar">
        <span>
          <Icon name="shield" size={16} />
          <strong>Portal Kepegawaian</strong>
          <span aria-hidden>·</span>
          RSU Darmayu Madiun
        </span>
        <span>
          <Icon name="lock" size={15} />
          Akses khusus supervisor, admin, dan super admin
        </span>
      </div>

      <div className="login-shell">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-brand">
            <div className="brand-mark">
              <Icon name="building" size={22} />
            </div>
            <div className="login-brand-text">
              <strong id="login-title">Face Absen</strong>
              <span>RSU Darmayu Madiun · Dashboard Kepegawaian</span>
            </div>
            <span className="spacer" />
            <span className="tag">v2.0</span>
          </div>

          <div className="login-steps" aria-label="Tahapan masuk">
            <div className={`login-step ${totpToken ? '' : 'active'}`}>
              <span className="login-step-index">1</span>
              <span className="login-step-text">
                <strong>Identitas &amp; Sandi</strong>
                <span>Email akun kepegawaian</span>
              </span>
            </div>
            <span className="login-step-divider" aria-hidden>
              <Icon name="chevronRight" size={16} />
            </span>
            <div className={`login-step ${totpToken ? 'active' : ''}`}>
              <span className="login-step-index">2</span>
              <span className="login-step-text">
                <strong>Verifikasi 2FA</strong>
                <span>Kode autentikator 6 digit</span>
              </span>
            </div>
          </div>

          <div className="notice">
            <Icon name="shield" size={17} />
            <span>
              Dashboard ini untuk pengelola kepegawaian. Akun karyawan tetap memakai
              aplikasi mobile Face Absen untuk presensi.
            </span>
          </div>

          {error ? (
            <div className="alert error" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
              <Icon name="alert" size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          {totpToken ? (
            <form className="login-form" onSubmit={submitTotp}>
              <div className="otp-panel">
                <div className="otp-panel-head">
                  <div>
                    <div className="otp-panel-title">
                      <Icon name="key" size={18} />
                      Autentikasi Dua Faktor
                    </div>
                    <p className="otp-panel-sub">
                      Masukkan 6 digit dari aplikasi authenticator untuk{' '}
                      <strong>{email || 'akun Anda'}</strong>.
                    </p>
                  </div>
                  <span className="tag">Wajib</span>
                </div>

                <div className="otp-row">
                  {digits.map((digit, index) => (
                    <span key={index} style={{ display: 'contents' }}>
                      {index === 3 ? (
                        <span className="otp-sep" aria-hidden>
                          –
                        </span>
                      ) : null}
                      <input
                        ref={(element) => {
                          otpRefs.current[index] = element;
                        }}
                        className={`otp-box ${digit ? 'filled' : ''}`}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        aria-label={`Digit ${index + 1}`}
                        value={digit}
                        onChange={(event) => {
                          setDigit(index, event.target.value);
                          if (event.target.value && index < OTP_LENGTH - 1) {
                            otpRefs.current[index + 1]?.focus();
                          }
                        }}
                        onKeyDown={(event) => onOtpKeyDown(index, event)}
                        onPaste={onOtpPaste}
                      />
                    </span>
                  ))}
                </div>

                <div className="otp-hint">
                  <span>Kode berubah setiap 30 detik.</span>
                  <span>Kehilangan akses? Hubungi admin sistem.</span>
                </div>
              </div>

              <button type="submit" className="btn login-submit" disabled={busy}>
                <Icon name="shield" size={17} />
                {busy ? 'Memverifikasi…' : 'Verifikasi & masuk ke dashboard'}
              </button>
              <button type="button" className="login-back" onClick={backToCredentials}>
                <Icon name="refresh" size={15} />
                Kembali ke input kredensial
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={submitCredentials}>
              <label className="field">
                <span>Email institusi</span>
                <span className="input-wrap">
                  <span className="input-icon">
                    <Icon name="users" size={17} />
                  </span>
                  <input
                    className="input"
                    type="email"
                    autoComplete="username"
                    placeholder="nama@rsud-darmayu.go.id"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="field">
                <span>Kata sandi</span>
                <span className="input-wrap">
                  <span className="input-icon">
                    <Icon name="lock" size={17} />
                  </span>
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Kata sandi akun dashboard"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
                  </button>
                </span>
              </label>

              <button type="submit" className="btn login-submit" disabled={busy}>
                <Icon name="arrowRight" size={17} />
                {busy ? 'Memeriksa kredensial…' : 'Lanjutkan ke verifikasi'}
              </button>

              <div className="login-form-footer">
                <span>Lupa kata sandi atau akun terkunci?</span>
                <span>Hubungi admin sistem kepegawaian.</span>
              </div>
            </form>
          )}
        </section>

        <aside className="login-side">
          <section className="side-card" aria-labelledby="compliance-title">
            <div className="side-card-head">
              <div className="side-card-title">
                <Icon name="shield" size={20} />
                <div>
                  <strong id="compliance-title">Kepatuhan &amp; Keamanan</strong>
                  <span>Akses berbasis peran (RBAC)</span>
                </div>
              </div>
              <span className="tag">Audit</span>
            </div>
            <p>
              Dashboard ini terhubung langsung ke API presensi Face Absen. Setiap
              persetujuan, perubahan data, dan ekspor laporan tercatat pada audit
              log sesuai kewenangan peran.
            </p>
            <div className="mini-tiles">
              <div className="mini-tile">
                <span>Peran dashboard</span>
                <strong>
                  <Icon name="users" size={15} />
                  Supervisor · Admin
                </strong>
              </div>
              <div className="mini-tile">
                <span>Sesi</span>
                <strong>
                  <Icon name="refresh" size={15} />
                  Token otomatis diperbarui
                </strong>
              </div>
            </div>
            <div className="status-line">
              <span className="status-dot" aria-hidden />
              Server presensi terhubung melalui API terautentikasi
            </div>
          </section>

          <section className="side-card" aria-labelledby="guide-title">
            <div className="side-card-head">
              <div className="side-card-title">
                <Icon name="info" size={20} />
                <div>
                  <strong id="guide-title">Panduan Akses</strong>
                  <span>SOP kerja pengelola kepegawaian</span>
                </div>
              </div>
            </div>
            <ul className="side-list">
              <li>
                <Icon name="checkCircle" size={16} />
                <span>
                  <strong>Gunakan akun pengelola.</strong> Akun karyawan tidak bisa
                  masuk dashboard dan hanya memakai aplikasi mobile.
                </span>
              </li>
              <li>
                <Icon name="key" size={16} />
                <span>
                  <strong>Aktifkan 2FA.</strong> Token autentikator diminta setiap
                  kali masuk dashboard.
                </span>
              </li>
              <li>
                <Icon name="lock" size={16} />
                <span>
                  <strong>Jangan berbagi kredensial.</strong> Semua tindakan
                  tercatat atas nama akun yang dipakai.
                </span>
              </li>
            </ul>
            <div className="status-line">
              <Icon name="users" size={15} />
              Tambah peran atau reset sandi dilakukan super admin lewat menu
              Pengguna &amp; Peran.
            </div>
          </section>
        </aside>
      </div>

      <footer className="login-copyright">
        <span>
          <Icon name="building" size={14} />
          Hak cipta © {new Date().getFullYear()} RSU Darmayu Madiun · Sistem Presensi
          Face Absen
        </span>
        <span>Dashboard kepegawaian · akses terbatas</span>
      </footer>
    </div>
  );
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Email atau kata sandi tidak sesuai.';
    if (error.status === 403) {
      if (error.reason === 'PENDING_APPROVAL') {
        return 'Akun masih menunggu persetujuan admin.';
      }
      if (error.reason === 'EMAIL_NOT_VERIFIED') {
        return 'Email belum diverifikasi.';
      }
      return error.message;
    }
    if (error.status === 429) {
      return 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Gagal masuk.';
}
