'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  ErrorBanner,
  Loading,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useResource } from '@/lib/useResource';

type Notice = {
  version?: string;
  lang?: string;
  title?: string;
  body?: string[];
};

export default function PrivacyPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notice = useResource(() => api<Notice>('/privacy/notice'), []);

  const runRetention = async () => {
    if (
      !window.confirm(
        'Jalankan pembersihan data sesuai kebijakan retensi? Tindakan ini menghapus data lama secara permanen.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Record<string, unknown>>('/privacy/retention/run', { method: 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Privasi & Retensi"
        description="Pemberitahuan privasi yang tampil di aplikasi dan eksekusi kebijakan retensi data."
        actions={
          <button type="button" className="btn danger" onClick={runRetention} disabled={busy}>
            {busy ? 'Menjalankan…' : 'Jalankan retensi'}
          </button>
        }
      />
      <ErrorBanner message={error ?? notice.error} />

      {result ? (
        <div className="card">
          <h2 className="section-title">Hasil retensi</h2>
          <div className="grid stats">
            {Object.entries(result).map(([key, value]) => (
              <StatCard
                key={key}
                label={key}
                value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {notice.loading && !notice.data ? (
        <Loading />
      ) : notice.data ? (
        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {notice.data.title ?? 'Pemberitahuan Privasi'}
            </h2>
            <span className="spacer" />
            <span className="badge">Versi {notice.data.version ?? '—'}</span>
            <span className="badge">{notice.data.lang ?? 'id'}</span>
          </div>
          <ol className="stack" style={{ marginTop: 14, paddingLeft: 20 }}>
            {(notice.data.body ?? []).map((paragraph, index) => (
              <li key={index}>{paragraph}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="card">
        <h2 className="section-title">Catatan operasional</h2>
        <ul className="stack" style={{ paddingLeft: 18 }}>
          <li>Retensi sesi dan template wajah mengikuti variabel `RETENTION_*` di backend.</li>
          <li>Jalankan retensi berkala (mis. bulanan) dan simpan hasilnya untuk audit DPO.</li>
          <li>Permintaan ekspor/penghapusan data karyawan tetap diproses dari aplikasi mobile.</li>
        </ul>
      </div>
    </>
  );
}
