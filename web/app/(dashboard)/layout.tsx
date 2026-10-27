'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Icon } from '@/components/Icon';
import { hasDashboardRole } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return <div className="loading">Memeriksa sesi…</div>;
  }

  if (!user) {
    return <div className="loading">Mengalihkan ke halaman masuk…</div>;
  }

  if (!hasDashboardRole(user.roles)) {
    return (
      <div className="login-page solo">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark">
              <Icon name="lock" size={22} />
            </div>
            <div className="login-brand-text">
              <strong>Akses terbatas</strong>
              <span>Dashboard kepegawaian RSU Darmayu Madiun</span>
            </div>
          </div>
          <div className="notice" style={{ marginTop: 18 }}>
            <Icon name="info" size={17} />
            <span>
              Akun <strong>{user.email}</strong> tidak memiliki peran supervisor,
              admin, atau super admin. Dashboard ini hanya untuk pengelola
              kepegawaian; karyawan memakai aplikasi mobile.
            </span>
          </div>
          <button
            type="button"
            className="btn block"
            style={{ marginTop: 18 }}
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Icon name="logout" size={16} />
            Keluar
          </button>
        </div>
      </div>
    );
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
