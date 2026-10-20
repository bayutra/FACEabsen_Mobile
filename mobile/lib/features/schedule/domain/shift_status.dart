/// Pure shift-time math mirroring the server (`backend/src/shifts/shift-time.ts`).
///
/// The server stays authoritative: the mobile app only *previews* the same
/// verdict (ON_TIME / LATE / VERY_LATE, NORMAL_CHECKOUT / EARLY_CHECKOUT) so the
/// shift master's tolerances are visible before a punch. No I/O, unit-testable.
library;

/// Wire-status codes shared with the server response.
class PunchStatus {
  const PunchStatus._();

  static const String onTime = 'ON_TIME';
  static const String late = 'LATE';
  static const String veryLate = 'VERY_LATE';
  static const String normalCheckout = 'NORMAL_CHECKOUT';
  static const String earlyCheckout = 'EARLY_CHECKOUT';
}

/// A punched verdict: the status code plus the late/early minutes it carries.
class ShiftVerdict {
  const ShiftVerdict(this.status, this.minutes);

  /// One of [PunchStatus]'s codes.
  final String status;

  /// Minutes late (check-in) or minutes early (check-out); 0 when on time.
  final int minutes;
}

/// Parses `HH:mm` to minutes past midnight, or null when malformed.
int? minutesOfDay(String hhmm) {
  final List<String> parts = hhmm.split(':');
  if (parts.length < 2) return null;
  final int? h = int.tryParse(parts[0]);
  final int? m = int.tryParse(parts[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/// Local midnight of [workDate] (the shift START date).
DateTime _anchor(DateTime workDate) =>
    DateTime(workDate.year, workDate.month, workDate.day);

/// Concrete end instant of the shift on its [workDate].
DateTime shiftEnd(DateTime workDate, String endTime, String startTime, bool overnight) {
  final int? startMin = minutesOfDay(startTime);
  final int? endMin = minutesOfDay(endTime);
  final bool ov = overnight || (startMin != null && endMin != null && endMin <= startMin);
  final int minutes = endMin ?? 0;
  return _anchor(workDate).add(Duration(minutes: minutes + (ov ? 24 * 60 : 0)));
}

/// Concrete start instant of the shift on its [workDate].
DateTime shiftStart(DateTime workDate, String startTime) =>
    _anchor(workDate).add(Duration(minutes: minutesOfDay(startTime) ?? 0));

/// Mirrors server `evaluateCheckIn`: grace minutes stay ON_TIME, up to the late
/// threshold is LATE, beyond it is VERY_LATE.
ShiftVerdict evaluateCheckInStatus({
  required DateTime now,
  required DateTime workDate,
  required String startTime,
  required int gracePeriodMin,
  required int lateThresholdMin,
}) {
  final int lateMinutes =
      (now.difference(shiftStart(workDate, startTime)).inMilliseconds / 60000).round();
  final int clamped = lateMinutes < 0 ? 0 : lateMinutes;
  if (clamped <= gracePeriodMin) return ShiftVerdict(PunchStatus.onTime, clamped);
  if (clamped <= lateThresholdMin) return ShiftVerdict(PunchStatus.late, clamped);
  return ShiftVerdict(PunchStatus.veryLate, clamped);
}

/// Mirrors server `evaluateCheckOut`: leaving within the early threshold still
/// counts as a normal checkout, otherwise EARLY_CHECKOUT.
ShiftVerdict evaluateCheckOutStatus({
  required DateTime now,
  required DateTime workDate,
  required String startTime,
  required String endTime,
  required int earlyCheckoutThresholdMin,
  required bool overnight,
}) {
  final DateTime end = shiftEnd(workDate, endTime, startTime, overnight);
  final int earlyMinutes = (end.difference(now).inMilliseconds / 60000).round();
  final int clamped = earlyMinutes < 0 ? 0 : earlyMinutes;
  if (clamped <= earlyCheckoutThresholdMin) return ShiftVerdict(PunchStatus.normalCheckout, clamped);
  return ShiftVerdict(PunchStatus.earlyCheckout, clamped);
}
