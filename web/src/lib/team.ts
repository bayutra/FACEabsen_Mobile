// STEP 17 — web read model for the supervisor section.
export interface TeamMember {
  id: string;
  name: string;
  employeeNo: string;
  position?: string | null;
  department?: { id: string; name: string } | null;
}

export interface TeamAttendanceRow {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInStatus?: string | null;
  shift?: { id: string; name: string } | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
}

export interface TeamSummary {
  from: string;
  to: string;
  totals: { members: number; present: number; late: number; absent: number; onLeave: number };
  members: Array<TeamMember & { days: Record<string, string> }>;
}

export interface ReviewQueueItem {
  id: string;
  status: string;
  reason: string;
  reviewNote?: string | null;
  employee?: { id: string; name: string; employeeNo: string } | null;
  attendance?: { id: string; workDate: string } | null;
  type?: string;
  startDate?: string;
  endDate?: string;
}

/** Serializes team filters (drops empties). */
export function toTeamQueryString(q: { from?: string; to?: string; status?: string }): string {
  const params = new URLSearchParams();
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.status) params.set('status', q.status);
  const s = params.toString();
  return s ? `?${s}` : '';
}
