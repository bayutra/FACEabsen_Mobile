import { BadRequestException } from '@nestjs/common';
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

/** True when `value` is a real `YYYY-MM-DD` calendar date (no JS rollover). */
export function isValidCalendarDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Throws 400 when `value` is not a real calendar date key. */
export function assertCalendarDateKey(value: string): void {
  if (!isValidCalendarDateKey(value)) {
    throw new BadRequestException(`Invalid work date: ${value}`);
  }
}

/**
 * True when `value` parses to a real instant and, if it starts with a
 * `YYYY-MM-DD` calendar date, that date exists (rejects rollover like
 * 2026-02-31T08:00:00Z).
 */
export function isValidCalendarDateTime(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (match) return isValidCalendarDateKey(match[1]);
  return true;
}

/** Throws 400 when `value` is not a real ISO datetime. */
export function assertCalendarDateTime(value: string): void {
  if (!isValidCalendarDateTime(value)) {
    throw new BadRequestException(`Invalid datetime: ${value}`);
  }
}

/**
 * Wall-clock `HH:mm` in the hospital time zone.
 *
 * Reports used to print `new Date(x).toISOString().slice(11, 16)`, i.e. UTC,
 * so a 08:29 WIB check-in showed up as 01:29 on the web. Always render
 * punch times through this helper instead of slicing the ISO string.
 */
export function timeOfDayInTimeZone(
  value: Date | string,
  timeZone = 'Asia/Jakarta',
): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  const hour = pick('hour');
  return `${hour === '24' ? '00' : hour}:${pick('minute')}`;
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
