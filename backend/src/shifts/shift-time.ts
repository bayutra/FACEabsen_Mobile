/**
 * STEP 6 — pure shift time math (PRD §20). No I/O, fully unit-tested.
 * Night shifts (e.g. 23:00 → 07:00) span two calendar days but count as ONE
 * shift anchored on workDate (the shift START date).
 *
 * Hospital-timezone evaluation: `workDate` is a calendar date in the hospital
 * zone (default Asia/Jakarta, configurable via HOSPITAL_TZ). Day anchors are
 * the UTC instant of local midnight in that zone. Callers that omit
 * `timeZone` get legacy UTC behaviour (kept for unit-test compatibility).
 */

export interface ShiftLike {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  overnight: boolean;
  gracePeriodMin: number;
  lateThresholdMin: number;
  earlyCheckoutThresholdMin: number;
}

export function parseHHmm(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new Error(`Invalid HH:mm: ${value}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** True when the wall-clock interval crosses midnight. */
export function isOvernightRange(startTime: string, endTime: string): boolean {
  return parseHHmm(endTime) <= parseHHmm(startTime);
}

function dayAnchor(workDate: string, timeZone = 'UTC'): number {
  const utcMidnight = Date.parse(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(utcMidnight)) throw new Error(`Invalid workDate: ${workDate}`);
  if (timeZone === 'UTC') return utcMidnight;
  // UTC instant of local midnight in `timeZone`. Refined twice so DST
  // transitions resolve to the correct offset.
  let guess = utcMidnight;
  for (let i = 0; i < 2; i++) {
    guess = utcMidnight - tzOffsetMs(timeZone, new Date(guess));
  }
  return guess;
}

/** Offset (ms) of `timeZone` ahead of UTC at `date` (negative when behind). */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  // Some ICU builds render midnight as 24:00 — normalise to 00:00.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asUTC = Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}Z`,
  );
  if (Number.isNaN(asUTC)) throw new Error(`Invalid timeZone: ${timeZone}`);
  return asUTC - date.getTime();
}

/** Hospital-local calendar key (YYYY-MM-DD) for an instant. */
export function workDateKeyIn(now: Date, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Concrete [start, end) window for a shift on a workDate. */
export function shiftWindow(workDate: string, shift: ShiftLike, timeZone = 'UTC'): { start: Date; end: Date } {
  const startMin = parseHHmm(shift.startTime);
  const endMin = parseHHmm(shift.endTime);
  const overnight = shift.overnight || endMin <= startMin;
  const start = new Date(dayAnchor(workDate, timeZone) + startMin * 60_000);
  const end = new Date(dayAnchor(workDate, timeZone) + endMin * 60_000 + (overnight ? 24 * 60 * 60_000 : 0));
  return { start, end };
}

export type CheckInStatus = 'ON_TIME' | 'LATE' | 'VERY_LATE';

export function evaluateCheckIn(
  checkInAt: Date,
  workDate: string,
  shift: ShiftLike,
  timeZone = 'UTC',
): { status: CheckInStatus; lateMinutes: number } {
  const { start } = shiftWindow(workDate, shift, timeZone);
  const lateMinutes = Math.max(0, Math.round((checkInAt.getTime() - start.getTime()) / 60_000));
  if (lateMinutes <= shift.gracePeriodMin) return { status: 'ON_TIME', lateMinutes };
  if (lateMinutes <= shift.lateThresholdMin) return { status: 'LATE', lateMinutes };
  return { status: 'VERY_LATE', lateMinutes };
}

export type CheckOutStatus = 'NORMAL_CHECKOUT' | 'EARLY_CHECKOUT';

export function evaluateCheckOut(
  checkOutAt: Date,
  workDate: string,
  shift: ShiftLike,
  timeZone = 'UTC',
): { status: CheckOutStatus; earlyMinutes: number } {
  const { end } = shiftWindow(workDate, shift, timeZone);
  const earlyMinutes = Math.max(0, Math.round((end.getTime() - checkOutAt.getTime()) / 60_000));
  if (earlyMinutes <= shift.earlyCheckoutThresholdMin) {
    return { status: 'NORMAL_CHECKOUT', earlyMinutes };
  }
  return { status: 'EARLY_CHECKOUT', earlyMinutes };
}
