import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  classifyDay,
  assertRangeDays,
  eachDay,
} from '../supervisor/supervisor.service.js';
import {
  CONTENT_TYPES,
  toCSV,
  toPDF,
  toXLSX,
  type ExportFormat,
  type TabularReport,
} from './export.js';

export type ReportFormat = ExportFormat;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async scopeOf(userId: string, roles: string[]): Promise<string[] | null> {
    if (satisfiesRole(roles, 'SUPER_ADMIN')) return null;
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      const emps = await this.prisma.employee.findMany({
        where: { department: { hospitalId: scope.hospitalId } },
        select: { id: true },
      });
      return emps.map((e) => e.id);
    }
    const me = await this.prisma.employee.findUnique({ where: { userId } });
    if (!me) return [];
    const team = await this.prisma.employee.findMany({
      where: { supervisorId: me.id },
    });
    return team.map((m) => m.id);
  }

  async daily(
    date: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    const ids = await this.scopeOf(userId, roles);
    const whereId = ids ? { employeeId: { in: ids } } : {};
    const [schedules, rows, leaves, employees] = await Promise.all([
      this.prisma.employeeSchedule.findMany({
        where: { ...whereId, workDate: new Date(date) },
        include: { shift: true, employee: { include: { department: true } } },
      }),
      this.prisma.attendance.findMany({
        where: { ...whereId, workDate: new Date(date) },
        include: { shift: true, employee: { include: { department: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...(ids ? { employeeId: { in: ids } } : {}),
          status: 'APPROVED',
          startDate: { lte: new Date(date) },
          endDate: { gte: new Date(date) },
        },
      }),
      ids
        ? this.prisma.employee.findMany({
            where: { id: { in: ids } },
            include: { department: true },
          })
        : this.prisma.employee.findMany({ include: { department: true } }),
    ]);

    const byEmp = new Map(employees.map((e) => [e.id, e]));
    const attByEmp = new Map(rows.map((a) => [a.employeeId, a]));
    const leaveByEmp = new Map(leaves.map((l) => [l.employeeId, l]));
    const table: string[][] = [];
    let present = 0;
    let late = 0;
    let absent = 0;
    let onLeave = 0;
    for (const s of schedules) {
      const emp = byEmp.get(s.employeeId);
      const att = attByEmp.get(s.employeeId);
      const lv = leaveByEmp.get(s.employeeId);
      const st = classifyDay({
        onLeave: !!lv,
        scheduled: true,
        checkInStatus: att?.checkInStatus,
      });
      if (st === 'PRESENT') present++;
      else if (st === 'LATE') late++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'ON_LEAVE') onLeave++;
      table.push([
        emp?.employeeNo ?? s.employeeId,
        emp?.name ?? '-',
        (emp?.department as { name?: string } | null)?.name ?? '-',
        s.shift.name,
        att?.checkInAt
          ? new Date(att.checkInAt).toISOString().slice(11, 16)
          : '-',
        att?.checkOutAt
          ? new Date(att.checkOutAt).toISOString().slice(11, 16)
          : '-',
        st,
        att?.riskScore !== null && att?.riskScore !== undefined
          ? String(att.riskScore)
          : '-',
      ]);
    }

    for (const a of rows) {
      if (schedules.some((s) => s.employeeId === a.employeeId)) continue;
      const emp = byEmp.get(a.employeeId);
      if (a.checkInStatus === 'ON_TIME') present++;
      else late++;
      table.push([
        emp?.employeeNo ?? a.employeeId,
        emp?.name ?? '-',
        (emp?.department as { name?: string } | null)?.name ?? '-',
        a.shift.name,
        a.checkInAt ? new Date(a.checkInAt).toISOString().slice(11, 16) : '-',
        a.checkOutAt ? new Date(a.checkOutAt).toISOString().slice(11, 16) : '-',
        a.checkInStatus ?? '-',
        a.riskScore !== null && a.riskScore !== undefined
          ? String(a.riskScore)
          : '-',
      ]);
    }

    const report: TabularReport = {
      title: `Laporan Harian ${date}`,
      generatedAt: new Date().toISOString(),
      summary: [
        ['Terjadwal', String(schedules.length)],
        ['Hadir', String(present)],
        ['Terlambat', String(late)],
        ['Tidak hadir', String(absent)],
        ['Izin/cuti', String(onLeave)],
      ],
      headers: [
        'NIP',
        'Nama',
        'Departemen',
        'Shift',
        'Masuk',
        'Pulang',
        'Status',
        'Risiko',
      ],
      rows: table,
    };
    return this.render(report, format, `laporan-harian-${date}`);
  }

  async monthly(
    month: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(last).padStart(2, '0')}`;
    const days = eachDay(from, to);

    const ids = await this.scopeOf(userId, roles);
    const whereId = ids ? { employeeId: { in: ids } } : {};
    const [employees, schedules, rows, leaves] = await Promise.all([
      ids
        ? this.prisma.employee.findMany({
            where: { id: { in: ids } },
            orderBy: { name: 'asc' },
          })
        : this.prisma.employee.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.employeeSchedule.findMany({
        where: {
          ...whereId,
          workDate: { gte: new Date(from), lte: new Date(to) },
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          ...whereId,
          workDate: { gte: new Date(from), lte: new Date(to) },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...(ids ? { employeeId: { in: ids } } : {}),
          status: 'APPROVED',
          startDate: { lte: new Date(to) },
          endDate: { gte: new Date(from) },
        },
      }),
    ]);

    const table: string[][] = [];
    let tP = 0;
    let tL = 0;
    let tA = 0;
    let tO = 0;
    for (const e of employees) {
      let p = 0;
      let l = 0;
      let a = 0;
      let o = 0;
      for (const d of days) {
        const st = classifyDay({
          onLeave: leaves.some(
            (x) =>
              x.employeeId === e.id &&
              d >= iso(x.startDate) &&
              d <= iso(x.endDate),
          ),
          scheduled: schedules.some(
            (s) => s.employeeId === e.id && iso(s.workDate) === d,
          ),
          checkInStatus: rows.find(
            (r) => r.employeeId === e.id && iso(r.workDate) === d,
          )?.checkInStatus,
        });
        if (st === 'PRESENT') p++;
        else if (st === 'LATE') l++;
        else if (st === 'ABSENT') a++;
        else if (st === 'ON_LEAVE') o++;
      }
      tP += p;
      tL += l;
      tA += a;
      tO += o;
      table.push([
        e.employeeNo,
        e.name,
        String(p),
        String(l),
        String(a),
        String(o),
        String(p + l),
      ]);
    }
    const report: TabularReport = {
      title: `Laporan Bulanan ${month}`,
      generatedAt: new Date().toISOString(),
      summary: [
        ['Karyawan', String(employees.length)],
        ['Hadir', String(tP)],
        ['Terlambat', String(tL)],
        ['Tidak hadir', String(tA)],
        ['Izin/cuti', String(tO)],
      ],
      headers: [
        'NIP',
        'Nama',
        'Hadir',
        'Terlambat',
        'Tidak hadir',
        'Izin/cuti',
        'Kehadiran',
      ],
      rows: table,
    };
    return this.render(report, format, `laporan-bulanan-${month}`);
  }

  async heatmap(from: string, to: string, userId: string, roles: string[]) {
    assertRangeDays(from, to);
    const ids = await this.scopeOf(userId, roles);
    const rows = await this.prisma.attendance.findMany({
      where: {
        ...(ids ? { employeeId: { in: ids } } : {}),
        workDate: { gte: new Date(from), lte: new Date(to) },
        checkInAt: { not: null },
      },
      select: {
        workDate: true,
        checkInAt: true,
        checkInStatus: true,
      },
    });

    const timeZone = process.env.HOSPITAL_TZ?.trim() || 'Asia/Jakarta';
    const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const dayNames = [
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
      'Minggu',
    ];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0));

    let totalCheckIns = 0;
    let lateCheckIns = 0;
    let peakDay = 0;
    let peakHour = 0;
    let peakCount = 0;
    for (const row of rows) {
      if (!row.checkInAt) continue;
      const day = mondayFirstDay(row.workDate);
      const hour = hourInTimeZone(new Date(row.checkInAt), timeZone);
      cells[day][hour] += 1;
      const count = cells[day][hour];
      totalCheckIns++;
      if (row.checkInStatus === 'LATE' || row.checkInStatus === 'VERY_LATE') {
        lateCheckIns++;
      }
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
        peakHour = hour;
      }
    }

    return {
      title: `Heatmap Kehadiran ${from} s.d. ${to}`,
      generatedAt: new Date().toISOString(),
      from,
      to,
      timeZone,
      days: dayLabels,
      dayNames,
      hours,
      cells,
      maxCount: peakCount,
      totalCheckIns,
      lateCheckIns,
      peak:
        peakCount > 0
          ? { day: dayNames[peakDay], hour: peakHour, count: peakCount }
          : null,
      summary: [
        ['Total check-in', String(totalCheckIns)],
        ['Terlambat', String(lateCheckIns)],
        [
          'Jam tersibuk',
          peakCount > 0 ? `${String(peakHour).padStart(2, '0')}:00` : '-',
        ],
        ['Hari tersibuk', peakCount > 0 ? dayNames[peakDay] : '-'],
      ],
    };
  }

  async department(
    from: string,
    to: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    const ids = await this.scopeOf(userId, roles);
    const employees = ids
      ? await this.prisma.employee.findMany({
          where: { id: { in: ids } },
          include: { department: true },
        })
      : await this.prisma.employee.findMany({ include: { department: true } });
    const empIds = employees.map((e) => e.id);
    const [schedules, rows, leaves] = await Promise.all([
      this.prisma.employeeSchedule.findMany({
        where: {
          employeeId: { in: empIds },
          workDate: { gte: new Date(from), lte: new Date(to) },
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          employeeId: { in: empIds },
          workDate: { gte: new Date(from), lte: new Date(to) },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: empIds },
          status: 'APPROVED',
          startDate: { lte: new Date(to) },
          endDate: { gte: new Date(from) },
        },
      }),
    ]);

    const byDept = new Map<
      string,
      { name: string; p: number; l: number; a: number; o: number }
    >();
    const days = eachDay(from, to);
    for (const e of employees) {
      const dept = (e.department as { id: string; name: string } | null) ?? {
        id: '-',
        name: '-',
      };
      if (!byDept.has(dept.id))
        byDept.set(dept.id, { name: dept.name, p: 0, l: 0, a: 0, o: 0 });
      const acc = byDept.get(dept.id);
      if (!acc) continue;
      for (const d of days) {
        const st = classifyDay({
          onLeave: leaves.some(
            (x) =>
              x.employeeId === e.id &&
              d >= iso(x.startDate) &&
              d <= iso(x.endDate),
          ),
          scheduled: schedules.some(
            (s) => s.employeeId === e.id && iso(s.workDate) === d,
          ),
          checkInStatus: rows.find(
            (r) => r.employeeId === e.id && iso(r.workDate) === d,
          )?.checkInStatus,
        });
        if (st === 'PRESENT') acc.p++;
        else if (st === 'LATE') acc.l++;
        else if (st === 'ABSENT') acc.a++;
        else if (st === 'ON_LEAVE') acc.o++;
      }
    }
    const table = [...byDept.values()].map((d) => [
      d.name,
      String(d.p),
      String(d.l),
      String(d.a),
      String(d.o),
    ]);
    const report: TabularReport = {
      title: `Laporan Departemen ${from} → ${to}`,
      generatedAt: new Date().toISOString(),
      summary: [['Departemen', String(byDept.size)]],
      headers: ['Departemen', 'Hadir', 'Terlambat', 'Tidak hadir', 'Izin/cuti'],
      rows: table,
    };
    return this.render(report, format, `laporan-departemen-${from}-${to}`);
  }

  async employee(
    id: string,
    from: string,
    to: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    const target = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!target) throw new NotFoundException('Employee not found');
    const me = await this.prisma.employee.findUnique({ where: { userId } });
    const scope = await resolveHospitalScope(this.prisma, userId, roles);
    const sameHospital =
      scope.kind === 'hospital' &&
      target.department?.hospitalId === scope.hospitalId;
    const isOwner = me?.id === id;
    const isSupervisor = target.supervisorId === me?.id;
    const sameHospitalAdmin = satisfiesRole(roles, 'ADMIN') && sameHospital;
    if (
      !satisfiesRole(roles, 'SUPER_ADMIN') &&
      (!sameHospital || !(isOwner || isSupervisor || sameHospitalAdmin))
    ) {
      throw new NotFoundException('Employee not found');
    }

    const rows = await this.prisma.attendance.findMany({
      where: {
        employeeId: id,
        workDate: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { workDate: 'asc' },
      include: { shift: true },
    });
    const table = rows.map((a) => [
      iso(a.workDate),
      a.shift.name,
      a.checkInAt ? new Date(a.checkInAt).toISOString().slice(11, 16) : '-',
      a.checkOutAt ? new Date(a.checkOutAt).toISOString().slice(11, 16) : '-',
      a.checkInStatus ?? '-',
      a.riskScore !== null && a.riskScore !== undefined
        ? String(a.riskScore)
        : '-',
    ]);
    const report: TabularReport = {
      title: `Laporan Karyawan ${target.employeeNo} ${from} → ${to}`,
      generatedAt: new Date().toISOString(),
      summary: [
        ['Nama', target.name],
        ['Hari tercatat', String(rows.length)],
      ],
      headers: ['Tanggal', 'Shift', 'Masuk', 'Pulang', 'Status', 'Risiko'],
      rows: table,
    };
    return this.render(
      report,
      format,
      `laporan-karyawan-${target.employeeNo}-${from}-${to}`,
    );
  }

  async late(
    from: string,
    to: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    assertRangeDays(from, to);
    const ids = await this.scopeOf(userId, roles);
    const rows = await this.prisma.attendance.findMany({
      where: {
        ...(ids ? { employeeId: { in: ids } } : {}),
        workDate: { gte: new Date(from), lte: new Date(to) },
        checkInStatus: { in: ['LATE', 'VERY_LATE'] },
      },
      orderBy: [{ workDate: 'desc' }],
      include: { employee: true, shift: true },
    });
    const table = rows.map((a) => [
      iso(a.workDate),
      (a.employee as { employeeNo: string }).employeeNo,
      (a.employee as { name: string }).name,
      a.shift.name,
      a.checkInAt ? new Date(a.checkInAt).toISOString().slice(11, 16) : '-',
      a.checkInStatus ?? '-',
    ]);
    const report: TabularReport = {
      title: `Laporan Keterlambatan ${from} → ${to}`,
      generatedAt: new Date().toISOString(),
      summary: [['Kasus terlambat', String(rows.length)]],
      headers: ['Tanggal', 'NIP', 'Nama', 'Shift', 'Masuk', 'Status'],
      rows: table,
    };
    return this.render(report, format, `laporan-terlambat-${from}-${to}`);
  }

  async leaves(
    from: string,
    to: string,
    userId: string,
    roles: string[],
    format: ReportFormat = 'json',
  ) {
    assertRangeDays(from, to);
    const ids = await this.scopeOf(userId, roles);
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        ...(ids ? { employeeId: { in: ids } } : {}),
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      orderBy: [{ startDate: 'desc' }],
      include: { employee: true },
    });
    const table = rows.map((l) => [
      (l.employee as { employeeNo: string }).employeeNo,
      (l.employee as { name: string }).name,
      l.type,
      iso(l.startDate),
      iso(l.endDate),
      l.status,
    ]);
    const report: TabularReport = {
      title: `Laporan Izin/Cuti ${from} → ${to}`,
      generatedAt: new Date().toISOString(),
      summary: [['Pengajuan', String(rows.length)]],
      headers: ['NIP', 'Nama', 'Jenis', 'Mulai', 'Selesai', 'Status'],
      rows: table,
    };
    return this.render(report, format, `laporan-izin-${from}-${to}`);
  }

  async render(report: TabularReport, format: ReportFormat, filename: string) {
    if (format === 'json') return { format, report };
    if (format === 'csv') {
      return {
        format,
        filename: `${filename}.csv`,
        contentType: CONTENT_TYPES.csv,
        body: toCSV(report),
      };
    }
    if (format === 'xlsx') {
      return {
        format,
        filename: `${filename}.xlsx`,
        contentType: CONTENT_TYPES.xlsx,
        body: await toXLSX(report),
      };
    }
    return {
      format,
      filename: `${filename}.pdf`,
      contentType: CONTENT_TYPES.pdf,
      body: await toPDF(report),
    };
  }
}

function iso(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function mondayFirstDay(value: Date | string): number {
  const d = new Date(value);
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  return (utc.getUTCDay() + 6) % 7;
}

function hourInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const raw = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return raw === 24 ? 0 : raw;
}
