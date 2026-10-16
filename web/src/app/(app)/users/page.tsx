import { cookies } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { Badge, EmptyRow, TableShell, Td, Th, Tr } from '@/components/ui/surface';
import { UserCreateForm } from './user-create-form';
import { UserRowActions } from './user-row-actions';

interface UserRow {
  id: string;
  email: string;
  isActive: boolean;
  lockedUntil?: string | null;
  roles: string[];
  employee?: {
    employeeNo: string;
    name: string;
    status: string;
    department?: { name: string } | null;
  } | null;
}

interface MeResponse {
  id: string;
  roles: string[];
}

interface ListResponse {
  data: UserRow[];
  pagination: { totalItems: number };
}

const ROLE_BADGE: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  SUPER_ADMIN: 'info',
  ADMIN: 'warning',
  SUPERVISOR: 'success',
  EMPLOYEE: 'neutral',
};

function roleTone(role: string): 'success' | 'warning' | 'info' | 'neutral' {
  return ROLE_BADGE[role] ?? 'neutral';
}

/**
 * Master data — login accounts (`user:manage`, SUPER_ADMIN only).
 *
 * Distinct from "Karyawan & Staf": that page owns people (NIP, department,
 * attendance). This one owns accounts that can sign in — roles, activation and
 * password resets. Only SUPER_ADMIN may open it; ADMIN stops at staff records.
 * The server enforces that and the row actions surface its refusals.
 */
export default async function UsersPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const [meRes, listRes] = await Promise.all([
    fetch(`${backendUrl()}/auth/me`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/users?pageSize=100`, { headers: auth, cache: 'no-store' }),
  ]);

  if (meRes.status === 401) redirect('/login');
  if (meRes.status === 403) forbidden();
  if (listRes.status === 401) redirect('/login');
  if (listRes.status === 403) forbidden();
  if (!listRes.ok) throw new Error('Gagal memuat daftar pengguna');

  const me = meRes.ok ? ((await meRes.json()) as MeResponse) : null;
  const listBody = (await listRes.json()) as ListResponse;
  const users = listBody.data;
  const totalAccounts = listBody.pagination?.totalItems ?? users.length;
  const isSuperAdmin = me?.roles.includes('SUPER_ADMIN') ?? false;

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Master Data
            <span className="text-primary">/ Pengguna</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Akun &amp; Peran</h1>
          <p className="text-body-sm text-outline">
            {activeCount} aktif dari {users.length} akun. Peran bersifat berjenjang: Admin
            mewarisi seluruh izin di bawahnya.
            {totalAccounts > users.length
              ? ` Menampilkan ${users.length} dari ${totalAccounts} akun.`
              : null}
          </p>
        </div>
        <UserCreateForm canGrantSuperAdmin={isSuperAdmin} />
      </div>

      <TableShell>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Akun</Th>
              <Th>Peran</Th>
              <Th>Data Karyawan</Th>
              <Th>Status</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <span className="font-medium">{u.email}</span>
                  {u.id === me?.id && (
                    <p className="text-label-sm text-outline">sedang masuk</p>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.map((r) => (
                      <Badge key={r} tone={roleTone(r)}>
                        {r.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>
                  {u.employee ? (
                    <>
                      <span className="tabular">{u.employee.employeeNo}</span>{' '}
                      {u.employee.name}
                      {u.employee.department && (
                        <p className="text-label-sm text-outline">
                          {u.employee.department.name}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-outline">akun tanpa data karyawan</span>
                  )}
                </Td>
                <Td>
                  {u.isActive ? (
                    <Badge tone="success">Aktif</Badge>
                  ) : (
                    <Badge tone="warning">Nonaktif</Badge>
                  )}
                </Td>
                <Td align="right">
                  <UserRowActions
                    id={u.id}
                    roles={u.roles}
                    isActive={u.isActive}
                    lockedUntil={u.lockedUntil}
                    isSelf={u.id === me?.id}
                    canGrantSuperAdmin={isSuperAdmin}
                  />
                </Td>
              </Tr>
            ))}
            {users.length === 0 && <EmptyRow colSpan={5}>Belum ada akun.</EmptyRow>}
          </tbody>
        </table>
      </TableShell>

      <p className="text-body-sm text-outline">
        Menonaktifkan akun langsung mengeluarkan sesi aktifnya. Reset password
        juga menghapus seluruh sesi dan membuka kondisi terkunci. Untuk staf yang
        perlu absensi, buat lewat halaman Karyawan &amp; Staf.
      </p>
    </div>
  );
}