const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
});

function parse(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: unknown): string {
  const date = parse(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value: unknown): string {
  const date = parse(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatTime(value: unknown): string {
  const date = parse(value);
  return date ? timeFormatter.format(date) : '—';
}

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export function startOfMonthIso(date = new Date()): string {
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonthIso(date = new Date()): string {
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function weekRange(date = new Date()): { from: string; to: string } {
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: isoDate(monday), to: isoDate(sunday) };
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
  REVOKED: 'Dicabut',
  LOST: 'Hilang',
  REPLACED: 'Diganti',
  INACTIVE: 'Nonaktif',
  ON_TIME: 'Tepat waktu',
  LATE: 'Terlambat',
  VERY_LATE: 'Sangat terlambat',
  PRESENT: 'Hadir',
  ABSENT: 'Absen',
  ON_LEAVE: 'Cuti',
  OFF: 'Off',
  SUCCESS: 'Berhasil',
  FAILED: 'Gagal',
  DENIED: 'Ditolak',
};

const typeLabels: Record<string, string> = {
  MISSED_CHECK_IN: 'Lupa presensi masuk',
  MISSED_CHECK_OUT: 'Lupa presensi pulang',
  WRONG_TIME: 'Jam presensi salah',
  TECHNICAL_ISSUE: 'Kendala teknis',
  CUTI: 'Cuti',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  DINAS: 'Dinas',
  LAINNYA: 'Lainnya',
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  ANDROID: 'Android',
  IOS: 'iOS',
};

export function statusLabel(status: unknown): string {
  const key = String(status ?? '').toUpperCase();
  return statusLabels[key] ?? (key || '—');
}

export function typeLabel(type: unknown): string {
  const key = String(type ?? '').toUpperCase();
  return typeLabels[key] ?? (key || '—');
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    EMPLOYEE: 'Karyawan',
    SUPERVISOR: 'Supervisor',
    ADMIN: 'Admin',
    SUPER_ADMIN: 'Super Admin',
  };
  return labels[role] ?? role;
}

export function shortId(id: unknown): string {
  const value = String(id ?? '');
  return value.length > 12 ? `${value.slice(0, 10)}…` : value || '—';
}
