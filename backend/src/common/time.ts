import { workDateKeyIn } from '../shifts/shift-time.js';

export function utcWorkDate(now = new Date()): { date: Date; key: string } {
  const key = now.toISOString().slice(0, 10);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid HOSPITAL_TZ: ${timeZone}`);
  }
}

export function hospitalWorkDate(
  now = new Date(),
  timeZone = 'Asia/Jakarta',
): { date: Date; key: string } {
  const key = workDateKeyIn(now, timeZone);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}

export type PunchTimeReject =
  | 'LIVENESS_STALE'
  | 'CAPTURE_IN_FUTURE'
  | 'QUEUED_TIME_INVALID';

export function validatePunchTime(input: {
  captureAt: string;
  queuedAt?: string;
  livenessCompletedAt: string;
  now: Date;
  maxOnlineAgeMin: number;
  maxOfflineAgeHours: number;
}): { ok: true; offline: boolean } | { ok: false; reason: PunchTimeReject } {
  const capture = new Date(input.captureAt);
  const completed = new Date(input.livenessCompletedAt);
  if (Number.isNaN(capture.getTime()) || Number.isNaN(completed.getTime())) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  if (capture.getTime() - input.now.getTime() > 2 * 60_000) {
    return { ok: false, reason: 'CAPTURE_IN_FUTURE' };
  }
  const offline = Boolean(input.queuedAt);
  let queued: Date | undefined;
  if (input.queuedAt) {
    queued = new Date(input.queuedAt);
    if (Number.isNaN(queued.getTime())) {
      return { ok: false, reason: 'QUEUED_TIME_INVALID' };
    }
    if (
      queued.getTime() < capture.getTime() ||
      queued.getTime() > input.now.getTime()
    ) {
      return { ok: false, reason: 'QUEUED_TIME_INVALID' };
    }
  }
  const maxAgeMs = offline
    ? input.maxOfflineAgeHours * 3600_000
    : input.maxOnlineAgeMin * 60_000;
  if (input.now.getTime() - capture.getTime() > maxAgeMs) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  if (
    offline &&
    Math.abs(completed.getTime() - capture.getTime()) > 2 * 60_000
  ) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  return { ok: true, offline };
}
