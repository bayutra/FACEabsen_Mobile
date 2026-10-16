import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import { ACCESS_COOKIE, backendUrl, type SessionUser } from '@/lib/api';
import { canUseWeb } from '@/lib/nav';

// Protected shell: token revalidated server-side on every navigation.
//
// Rotasi refresh SENGAJA tidak dilakukan di sini: backend memakai
// compare-and-swap atomik sehingga refresh lama hangus saat dipakai, dan
// server component tidak bisa menyimpan cookie hasil rotasi — rotasi di sini
// akan membunuh sesi pada navigasi berikutnya. Sesi kedaluwarsa dilempar ke
// GET /api/auth/refresh yang merotasi + menyimpan cookie + kembali.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/api/auth/refresh');

  const res = await fetch(`${backendUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/api/auth/refresh');
  if (!res.ok) redirect('/login');

  const user = (await res.json()) as SessionUser;
  // Backstop untuk sesi karyawan lama yang terbit sebelum gate BFF login.
  if (!canUseWeb(user.roles ?? [])) forbidden();
  return <Shell user={user}>{children}</Shell>;
}
