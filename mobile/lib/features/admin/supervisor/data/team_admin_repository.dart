import 'package:dio/dio.dart';

import '../domain/team_admin_models.dart';





class TeamAdminRepository {
  TeamAdminRepository({required Dio dio}) : _dio = dio;

  final Dio _dio;

  Future<List<TeamMember>> team() async {
    final Response<dynamic> res = await _dio.get<dynamic>('/supervisor/team');
    return _membersOf(res.data);
  }

  Future<TeamSummary> summary({
    required String from,
    required String to,
  }) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/supervisor/summary',
      queryParameters: <String, dynamic>{'from': from, 'to': to},
    );
    return TeamSummary.fromJson(_asMap(res.data));
  }

  Future<List<TeamAttendance>> attendance({
    String? from,
    String? to,
    String? status,
  }) async {
    final Response<dynamic> res = await _dio.get<dynamic>(
      '/supervisor/attendance',
      queryParameters: <String, dynamic>{
        if (from != null && from.isNotEmpty) 'from': from,
        if (to != null && to.isNotEmpty) 'to': to,
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    final Object? data = res.data;
    final List<dynamic> list;
    if (data is List) {
      list = data;
    } else if (data is Map) {
      list = (data['data'] as List?) ?? const <dynamic>[];
    } else {
      list = const <dynamic>[];
    }
    return list
        .whereType<Map>()
        .map((Map e) => TeamAttendance.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  
  
  Future<TeamMemberDetail?> memberDetail(String id) async {
    final Response<dynamic> res =
        await _dio.get<dynamic>('/supervisor/team/$id');
    final Map<String, dynamic> map = _asMap(res.data);
    if (!map.containsKey('member') && !map.containsKey('recent')) {
      return null;
    }
    return TeamMemberDetail.fromJson(map);
  }

  List<TeamMember> _membersOf(Object? data) {
    final List<dynamic> list;
    if (data is List) {
      list = data;
    } else if (data is Map) {
      list = (data['data'] as List?) ?? const <dynamic>[];
    } else {
      list = const <dynamic>[];
    }
    return list
        .whereType<Map>()
        .map((Map e) => TeamMember.fromJson(Map<String, dynamic>.from(e)))
        .where((TeamMember m) => m.id.isNotEmpty)
        .toList();
  }
}

Map<String, dynamic> _asMap(Object? data) {
  if (data is Map) return Map<String, dynamic>.from(data);
  return const <String, dynamic>{};
}
