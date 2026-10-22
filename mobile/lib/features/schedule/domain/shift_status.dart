library;

class PunchStatus {
  const PunchStatus._();

  static const String onTime = 'ON_TIME';
  static const String late = 'LATE';
  static const String veryLate = 'VERY_LATE';
  static const String normalCheckout = 'NORMAL_CHECKOUT';
  static const String earlyCheckout = 'EARLY_CHECKOUT';
}

class ShiftVerdict {
  const ShiftVerdict(this.status, this.minutes);

  final String status;

  final int minutes;
}

int? minutesOfDay(String hhmm) {
  final List<String> parts = hhmm.split(':');
  if (parts.length < 2) return null;
  final int? h = int.tryParse(parts[0]);
  final int? m = int.tryParse(parts[1]);
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

DateTime _anchor(DateTime workDate) =>
    DateTime(workDate.year, workDate.month, workDate.day);

DateTime shiftEnd(
    DateTime workDate, String endTime, String startTime, bool overnight) {
  final int? startMin = minutesOfDay(startTime);
  final int? endMin = minutesOfDay(endTime);
  final bool ov =
      overnight || (startMin != null && endMin != null && endMin <= startMin);
  final int minutes = endMin ?? 0;
  return _anchor(workDate).add(Duration(minutes: minutes + (ov ? 24 * 60 : 0)));
}

DateTime shiftStart(DateTime workDate, String startTime) =>
    _anchor(workDate).add(Duration(minutes: minutesOfDay(startTime) ?? 0));

ShiftVerdict evaluateCheckInStatus({
  required DateTime now,
  required DateTime workDate,
  required String startTime,
  required int gracePeriodMin,
  required int lateThresholdMin,
}) {
  final int lateMinutes =
      (now.difference(shiftStart(workDate, startTime)).inMilliseconds / 60000)
          .round();
  final int clamped = lateMinutes < 0 ? 0 : lateMinutes;
  if (clamped <= gracePeriodMin) {
    return ShiftVerdict(PunchStatus.onTime, clamped);
  }
  if (clamped <= lateThresholdMin) {
    return ShiftVerdict(PunchStatus.late, clamped);
  }
  return ShiftVerdict(PunchStatus.veryLate, clamped);
}

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
  if (clamped <= earlyCheckoutThresholdMin) {
    return ShiftVerdict(PunchStatus.normalCheckout, clamped);
  }
  return ShiftVerdict(PunchStatus.earlyCheckout, clamped);
}
