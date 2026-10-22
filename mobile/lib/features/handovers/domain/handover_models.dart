library;

class Handover {
  const Handover({
    required this.id,
    required this.title,
    required this.status,
    this.patientSummary,
    this.pendingTasks,
    this.medications,
    this.incidents,
    this.notes,
    this.fromName,
    this.fromNo,
    this.toName,
    this.departmentName,
    this.createdAt,
    this.acknowledgedAt,
  });

  final String id;
  final String title;
  final String status;
  final String? patientSummary;
  final String? pendingTasks;
  final String? medications;
  final String? incidents;
  final String? notes;
  final String? fromName;
  final String? fromNo;
  final String? toName;
  final String? departmentName;
  final DateTime? createdAt;
  final DateTime? acknowledgedAt;

  bool get pending => status == 'PENDING';

  String get statusLabel => switch (status) {
        'PENDING' => 'Menunggu',
        'ACKNOWLEDGED' => 'Diterima',
        _ => status,
      };

  factory Handover.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? from = json['fromEmployee'] is Map
        ? Map<String, dynamic>.from(json['fromEmployee'] as Map)
        : null;
    final Map<String, dynamic>? to = json['toEmployee'] is Map
        ? Map<String, dynamic>.from(json['toEmployee'] as Map)
        : null;
    final Map<String, dynamic>? dept = json['department'] is Map
        ? Map<String, dynamic>.from(json['department'] as Map)
        : null;
    return Handover(
      id: _text(json['id']),
      title: _text(json['title']),
      status: _text(json['status'], 'PENDING'),
      patientSummary: _textOrNull(json['patientSummary']),
      pendingTasks: _textOrNull(json['pendingTasks']),
      medications: _textOrNull(json['medications']),
      incidents: _textOrNull(json['incidents']),
      notes: _textOrNull(json['notes']),
      fromName: _textOrNull(from?['name']),
      fromNo: _textOrNull(from?['employeeNo']),
      toName: _textOrNull(to?['name']),
      departmentName: _textOrNull(dept?['name']),
      createdAt: _date(json['createdAt']),
      acknowledgedAt: _date(json['acknowledgedAt']),
    );
  }
}

String _text(Object? value, [String fallback = '—']) {
  if (value is String && value.trim().isNotEmpty) return value;
  if (value is num) return value.toString();
  return fallback;
}

String? _textOrNull(Object? value) {
  if (value is String && value.trim().isNotEmpty) return value;
  if (value is num) return value.toString();
  return null;
}

DateTime? _date(Object? value) {
  if (value is String) return DateTime.tryParse(value);
  return null;
}
