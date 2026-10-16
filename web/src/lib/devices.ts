// STEP 18 — web read model for admin device management.
export interface DeviceRow {
  id: string;
  employeeId: string;
  installationId: string;
  platform: string;
  deviceName?: string | null;
  appVersion?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'LOST' | 'REPLACED';
  registeredAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
}

export interface DeviceListResponse {
  data: DeviceRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface DeviceDetail extends DeviceRow {
  sessions?: Array<{ id: string; createdAt: string; expiresAt: string; revokedAt?: string | null }>;
  oldChanges?: Array<{ id: string; status: string; requestedAt: string; reason: string }>;
  newChanges?: Array<{ id: string; status: string; requestedAt: string; reason: string }>;
}

export interface DeviceQuery {
  page?: number;
  status?: string;
  employeeId?: string;
  search?: string;
}

/** Serializes admin device filters (drops empties). */
export function toDeviceQueryString(q: DeviceQuery): string {
  const params = new URLSearchParams();
  if (q.page && q.page > 1) params.set('page', String(q.page));
  if (q.status) params.set('status', q.status);
  if (q.employeeId) params.set('employeeId', q.employeeId);
  if (q.search?.trim()) params.set('search', q.search.trim());
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function deviceStatusLabel(status?: string | null): string {
  switch (status) {
    case 'PENDING':
      return 'Menunggu';
    case 'ACTIVE':
      return 'Aktif';
    case 'REVOKED':
      return 'Dicabut';
    case 'LOST':
      return 'Hilang';
    case 'REPLACED':
      return 'Diganti';
    default:
      return status ?? '—';
  }
}
