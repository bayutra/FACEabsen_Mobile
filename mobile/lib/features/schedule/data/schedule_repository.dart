import 'package:dio/dio.dart';

import '../domain/shift_status.dart';



class ScheduleRepository {
  ScheduleRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<ScheduleEntry>> mySchedule({required DateTime from, required DateTime to}) async {
    final String fromKey = dateKey(from);
    final String toKey = dateKey(to);
    final Response res = await _dio.get(
      '/schedules/me?from=$fromKey&to=$toKey&pageSize=100',
    );
    final Map<String, dynamic> body = Map<String, dynamic>.from(res.data as Map);
    final List list = (body['data'] as List?) ?? const [];
    return list
        .map((e) => ScheduleEntry.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static String dateKey(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}


class ScheduleEntry {
  ScheduleEntry({
    required this.id,
    required this.workDate,
    required this.shiftName,
    required this.startTime,
    required this.endTime,
    required this.overnight,
    this.gracePeriodMin = 15,
    this.lateThresholdMin = 30,
    this.earlyCheckoutThresholdMin = 15,
  });

  final String id;
  final DateTime workDate;
  final String shiftName;
  final String startTime;
  final String endTime;
  final bool overnight;

  
  
  final int gracePeriodMin;
  final int lateThresholdMin;
  final int earlyCheckoutThresholdMin;

  factory ScheduleEntry.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? shift =
        json['shift'] as Map<String, dynamic>?;
    return ScheduleEntry(
      id: json['id'] as String? ?? '',
      workDate: DateTime.parse(json['workDate'] as String),
      shiftName: shift?['name'] as String? ?? '—',
      startTime: shift?['startTime'] as String? ?? '--:--',
      endTime: shift?['endTime'] as String? ?? '--:--',
      overnight: shift?['overnight'] == true,
      gracePeriodMin: _intOr(shift?['gracePeriodMin'], 15),
      lateThresholdMin: _intOr(shift?['lateThresholdMin'], 30),
      earlyCheckoutThresholdMin: _intOr(shift?['earlyCheckoutThresholdMin'], 15),
    );
  }

  static int _intOr(Object? value, int fallback) =>
      value is num ? value.toInt() : fallback;

  String get window => '$startTime → $endTime';

  
  ShiftVerdict checkInStatusAt(DateTime now) => evaluateCheckInStatus(
        now: now,
        workDate: workDate,
        startTime: startTime,
        gracePeriodMin: gracePeriodMin,
        lateThresholdMin: lateThresholdMin,
      );

  
  ShiftVerdict checkOutStatusAt(DateTime now) => evaluateCheckOutStatus(
        now: now,
        workDate: workDate,
        startTime: startTime,
        endTime: endTime,
        earlyCheckoutThresholdMin: earlyCheckoutThresholdMin,
        overnight: overnight,
      );

  
  
  int? get durationHours {
    final int? start = _minutes(startTime);
    final int? end = _minutes(endTime);
    if (start == null || end == null) return null;
    int mins = end - start;
    if (mins <= 0) mins += 24 * 60;
    return mins ~/ 60;
  }

  
  
  
  ShiftKind get kind {
    final int? start = _minutes(startTime);
    final int? end = _minutes(endTime);
    if (start == null || end == null) return ShiftKind.pagi;
    if (start >= 22 * 60 || end <= 6 * 60) return ShiftKind.malam;
    if (start >= 14 * 60) return ShiftKind.siang;
    return ShiftKind.pagi;
  }

  static int? _minutes(String hhmm) {
    final List<String> parts = hhmm.split(':');
    if (parts.length < 2) return null;
    final int? h = int.tryParse(parts[0]);
    final int? m = int.tryParse(parts[1]);
    if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
}

enum ShiftKind { pagi, siang, malam }
