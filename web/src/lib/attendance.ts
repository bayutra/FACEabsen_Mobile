// STEP 14 — web read model for the attendance section.
export interface AttendanceRow {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInStatus?: string | null;
  checkOutStatus?: string | null;
  riskScore?: number | null;
  riskCategory?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  needsReview?: boolean;
  shift?: { id: string; name: string; startTime: string; endTime: string } | null;
  // Bukti GPS per baris (kolom Titik Tap). Liveness/faceScore tidak
  // disimpan server — drawer detail hanya menampilkan yang tersimpan.
  checkInLat?: number | null;
  checkInLon?: number | null;
  checkInAccuracy?: number | null;
  checkOutLat?: number | null;
  checkOutLon?: number | null;
  geofencePass?: boolean | null;
  notes?: string | null;
  employee?: {
    id: string;
    name: string;
    employeeNo: string;
    department?: { id: string; name: string } | null;
  } | null;
}

export interface AttendanceListResponse {
  data: AttendanceRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

/** GET /attendance/:id — baris penuh + perangkat + bukti GPS (akses dikontrol server). */
export interface AttendanceDetail extends AttendanceRow {
  deviceId?: string | null;
  device?: { id: string; deviceName?: string | null; platform?: string | null } | null;
}

export interface AttendanceQuery {
  page?: number;
  search?: string;
  departmentId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  checkInStatus?: string;
  riskCategory?: string;
  needsReview?: boolean;
}

/** Serializes admin filters to the BFF query string (drops empties). */
export function toAttendanceQueryString(q: AttendanceQuery): string {
  const params = new URLSearchParams();
  if (q.page && q.page > 1) params.set('page', String(q.page));
  if (q.search?.trim()) params.set('search', q.search.trim());
  if (q.departmentId) params.set('departmentId', q.departmentId);
  if (q.employeeId) params.set('employeeId', q.employeeId);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.checkInStatus) params.set('checkInStatus', q.checkInStatus);
  if (q.riskCategory) params.set('riskCategory', q.riskCategory);
  if (q.needsReview !== undefined) params.set('needsReview', String(q.needsReview));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function riskBadgeClass(category?: string | null): string {
  if (category === 'LOW') {
    return 'bg-success-bg text-success-fg';
  }
  if (category === 'MEDIUM') {
    return 'bg-warning-bg text-warning-fg';
  }
  if (category === 'HIGH') {
    return 'bg-danger-bg text-danger-fg';
  }
  return 'bg-surface-container-low text-on-surface-variant';
}
