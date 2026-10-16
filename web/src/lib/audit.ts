// STEP 19 — web read model for the audit viewer (read-only by design).
export interface AuditRow {
  id: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  timestamp: string;
  ipAddress?: string | null;
  deviceId?: string | null;
  result?: string | null;
  actor?: { id: string; email: string } | null;
  device?: { id: string; deviceName?: string | null } | null;
}

export interface AuditListResponse {
  data: AuditRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface AuditQuery {
  page?: number;
  action?: string;
  actorEmail?: string;
  result?: string;
  from?: string;
  to?: string;
  security?: boolean;
}

/** Serializes audit filters (drops empties). */
export function toAuditQueryString(q: AuditQuery): string {
  const params = new URLSearchParams();
  if (q.page && q.page > 1) params.set('page', String(q.page));
  if (q.action) params.set('action', q.action);
  if (q.actorEmail?.trim()) params.set('actorEmail', q.actorEmail.trim());
  if (q.result) params.set('result', q.result);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.security) params.set('security', 'true');
  const s = params.toString();
  return s ? `?${s}` : '';
}
