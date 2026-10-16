import { cookies } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';
import { ACCESS_COOKIE, backendUrl } from '@/lib/api';
import { formatWindow, type ScheduleListResponse, type ShiftItem } from '@/lib/shifts';
import {
  EmptyRow,
  Field,
  FilterBar,
  TableShell,
  Td,
  Th,
  Tr,
  inputClass,
} from '@/components/ui/surface';
import {
  ScheduleCreateForm,
  type EmployeeOption,
} from './schedule-create-form';
import { ScheduleRowActions } from './schedule-row-actions';

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

interface EmployeeListResponse {
  data?: { id: string; employeeNo: string; name: string; status: string }[];
}

/**
 * Roster Jadwal (admin `schedule:manage`).
 *
 * Reads need `schedule:manage`, and so do the writes. The employee and shift
 * pickers come from `/employees` and `/shifts`; an inactive employee is left out
 * of the picker because a roster for someone who cannot clock in is pointless.
 */
export default async function SchedulesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');

  const auth = { Authorization: `Bearer ${token}` };
  const qs = new URLSearchParams();
  if (sp.from) qs.set('from', sp.from);
  if (sp.to) qs.set('to', sp.to);

  const [res, empRes, shiftRes] = await Promise.all([
    fetch(`${backendUrl()}/schedules?${qs.toString()}`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/employees?pageSize=100`, { headers: auth, cache: 'no-store' }),
    fetch(`${backendUrl()}/shifts`, { headers: auth, cache: 'no-store' }),
  ]);

  if (res.status === 401) redirect('/login');
  if (res.status === 403) forbidden();
  if (!res.ok) throw new Error('Gagal memuat jadwal');

  const { data, pagination } = (await res.json()) as ScheduleListResponse;
  const employees: EmployeeOption[] = empRes.ok
    ? ((await empRes.json()) as EmployeeListResponse).data
        ?.filter((e) => e.status === 'ACTIVE')
        .map((e) => ({ id: e.id, employeeNo: e.employeeNo, name: e.name })) ?? []
    : [];
  const shifts: ShiftItem[] = shiftRes.ok ? ((await shiftRes.json()) as ShiftItem[]) : [];

  // Grid kalender mingguan (read-only): Senin–Minggu × shift per karyawan,
  // dihitung dari baris yang sudah dimuat. Sel dengan >1 shift ditandai
  // konflik (amber). Drag-and-drop/swap butuh endpoint tulis roster —
  // aksi tetap lewat tabel + form di bawah.
  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;
  const mondayOf = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x;
  };
  const weekStart =
    data.length > 0
      ? mondayOf(new Date(`${data.map((s) => s.workDate.slice(0, 10)).sort()[0]}T00:00:00Z`))
      : null;
  const weekDays = weekStart
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      })
    : [];
  const gridEmployees = (() => {
    const seen = new Map<string, { id: string; name: string; employeeNo: string }>();
    for (const s of data) {
      const e = s.employee;
      if (e && !seen.has(e.id)) seen.set(e.id, e);
    }
    return [...seen.values()];
  })();
  const cellFor = (empId: string, day: string) =>
    data.filter((s) => s.employee?.id === empId && s.workDate.slice(0, 10) === day);

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col justify-between gap-2 border-b border-outline-variant/30 pb-4 md:flex-row md:items-center">
        <div>
          <p className="flex items-center gap-2 text-label-md text-outline">
            Master Data
            <span className="text-primary">/ Roster Jadwal</span>
          </p>
          <h1 className="mt-1 text-headline-xl text-on-surface">Roster Jadwal Mingguan</h1>
          <p className="text-body-sm text-outline">
            Shift yang berlaku untuk setiap karyawan pada rentang tanggal terpilih.
          </p>
        </div>
        <ScheduleCreateForm employees={employees} shifts={shifts} />
      </div>

      <FilterBar>
        <Field label="Dari">
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={inputClass} />
        </Field>
        <Field label="Sampai">
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={inputClass} />
        </Field>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-body-md-medium text-on-primary transition-colors hover:bg-[#0d9488]"
        >
          Tampilkan
        </button>
      </FilterBar>

      {weekStart && gridEmployees.length > 0 && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-surface-1">
          <h2 className="text-headline-md text-on-surface">Kalender Mingguan</h2>
          <p className="tabular text-body-sm text-outline">
            {weekDays[0]} → {weekDays[6]} · baca-saja (ubah via tabel di bawah)
          </p>
          <div className="mt-space-md overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-surface-container-lowest p-2 text-left text-label-md text-outline">
                    Karyawan
                  </th>
                  {weekDays.map((d, i) => (
                    <th key={d} className="p-2 text-center text-label-md text-outline">
                      {HARI[i]}
                      <span className="tabular block font-normal">{d.slice(8, 10)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridEmployees.map((e) => (
                  <tr key={e.id} className="border-t border-outline-variant/40">
                    <td className="sticky left-0 bg-surface-container-lowest p-2">
                      <p className="text-body-sm font-medium">{e.name}</p>
                      <p className="tabular text-label-sm text-outline">{e.employeeNo}</p>
                    </td>
                    {weekDays.map((d) => {
                      const cells = cellFor(e.id, d);
                      return (
                        <td key={d} className="p-1.5 text-center align-top">
                          {cells.length === 0 ? (
                            <span className="text-outline">·</span>
                          ) : (
                            <div className="space-y-1">
                              {cells.map((s) => (
                                <span
                                  key={s.id}
                                  className={`inline-block rounded-md border px-2 py-1 text-label-sm ${
                                    cells.length > 1
                                      ? 'border-warning-border bg-warning-bg text-warning-fg'
                                      : 'border-outline-variant bg-surface-container-low text-on-surface-variant'
                                  }`}
                                  title={
                                    s.shift
                                      ? `${s.shift.name} · ${formatWindow(s.shift)}`
                                      : 'Tanpa shift'
                                  }
                                >
                                  {s.shift?.name ?? '—'}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TableShell>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-outline-variant bg-surface">
            <tr>
              <Th>Tanggal</Th>
              <Th>Karyawan</Th>
              <Th>Shift</Th>
              <Th align="right">Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => {
              const date = new Date(s.workDate).toISOString().slice(0, 10);
              return (
                <Tr key={s.id}>
                  <Td tabular>{date}</Td>
                  <Td>
                    {s.employee ? (
                      <Link
                        href={`/employees/${s.employee.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {s.employee.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                    {s.employee && (
                      <p className="tabular text-label-sm text-outline">{s.employee.employeeNo}</p>
                    )}
                  </Td>
                  <Td tabular>{s.shift ? `${s.shift.name} · ${formatWindow(s.shift)}` : '—'}</Td>
                  <Td align="right">
                    <ScheduleRowActions
                      id={s.id}
                      employeeName={s.employee?.name ?? date}
                      workDate={date}
                    />
                  </Td>
                </Tr>
              );
            })}
            {data.length === 0 && (
              <EmptyRow colSpan={4}>Tidak ada jadwal pada rentang ini.</EmptyRow>
            )}
          </tbody>
        </table>
      </TableShell>
      <p className="tabular text-body-sm text-outline">
        {pagination.totalItems} jadwal · shift malam dihitung satu hari kerja (tanggal mulai).
        Jadwal yang sudah dipakai untuk absensi tidak dapat dihapus.
      </p>
    </div>
  );
}