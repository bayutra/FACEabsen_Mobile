
const List<String> kAdminRoles = <String>[
  'EMPLOYEE',
  'SUPERVISOR',
  'ADMIN',
  'SUPER_ADMIN',
];


class AdminUser {
  const AdminUser({
    required this.id,
    required this.email,
    required this.isActive,
    required this.roles,
    this.failedLoginAttempts,
    this.lockedUntil,
    this.createdAt,
    this.employeeNo,
    this.employeeName,
    this.employeeStatus,
    this.departmentName,
  });

  final String id;
  final String email;
  final bool isActive;
  final List<String> roles;
  final int? failedLoginAttempts;
  final DateTime? lockedUntil;
  final DateTime? createdAt;
  final String? employeeNo;
  final String? employeeName;
  final String? employeeStatus;
  final String? departmentName;

  
  bool get locked =>
      lockedUntil != null && lockedUntil!.isAfter(DateTime.now());

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? emp =
        json['employee'] is Map ? Map<String, dynamic>.from(json['employee'] as Map) : null;
    final Map<String, dynamic>? dept =
        emp?['department'] is Map
            ? Map<String, dynamic>.from(emp!['department'] as Map)
            : null;
    final List<dynamic> rawRoles = (json['roles'] as List?) ?? const <dynamic>[];
    return AdminUser(
      id: json['id'] as String,
      email: json['email'] as String? ?? '—',
      isActive: json['isActive'] as bool? ?? true,
      roles: rawRoles.map((dynamic e) => e.toString()).toList(),
      failedLoginAttempts: (json['failedLoginAttempts'] as num?)?.toInt(),
      lockedUntil: DateTime.tryParse(json['lockedUntil'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      employeeNo: emp?['employeeNo'] as String?,
      employeeName: emp?['name'] as String?,
      employeeStatus: emp?['status'] as String?,
      departmentName: dept?['name'] as String?,
    );
  }
}

class AdminUserPage {
  const AdminUserPage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final List<AdminUser> items;
  final int page;
  final int totalPages;
  final int totalItems;
}
