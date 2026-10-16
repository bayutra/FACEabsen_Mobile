// STEP 6 — web read model for shifts & schedules (mutations follow admin flows).

export interface ShiftItem {
  id: string;
  hospitalId: string;
  name: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  gracePeriodMin: number;
  lateThresholdMin: number;
  earlyCheckoutThresholdMin: number;
  hospital?: { id: string; code: string; name: string } | null;
}

export interface ScheduleItem {
  id: string;
  employeeId: string;
  shiftId: string;
  workDate: string;
  shift?: Pick<ShiftItem, 'id' | 'name' | 'startTime' | 'endTime' | 'overnight'> | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
}

export interface ScheduleListResponse {
  data: ScheduleItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

/** Renders a shift window, marking overnight spans (PRD night-shift case). */
export function formatWindow(shift: Pick<ShiftItem, 'startTime' | 'endTime' | 'overnight'>): string {
  const base = `${shift.startTime} → ${shift.endTime}`;
  return shift.overnight ? `${base} (+1 hari)` : base;
}

/** Serializes schedule filters to the BFF query string (drops empties). */
export function toScheduleQueryString(q: {
  from?: string;
  to?: string;
  employeeId?: string;
  shiftId?: string;
}): string {
  const params = new URLSearchParams();
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.employeeId) params.set('employeeId', q.employeeId);
  if (q.shiftId) params.set('shiftId', q.shiftId);
  const s = params.toString();
  return s ? `?${s}` : '';
}
