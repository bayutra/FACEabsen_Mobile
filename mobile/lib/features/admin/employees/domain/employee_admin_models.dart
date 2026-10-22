
class AdminEmployee {
  const AdminEmployee({
    required this.id,
    required this.employeeNo,
    required this.name,
    required this.email,
    required this.status,
    this.userId,
    this.phone,
    this.position,
    this.departmentId,
    this.departmentName,
    this.supervisorName,
  });

  final String id;
  final String? userId;
  final String employeeNo;
  final String name;
  final String email;
  final String status;
  final String? phone;
  final String? position;
  final String? departmentId;
  final String? departmentName;
  final String? supervisorName;

  bool get active => status == 'ACTIVE';

  factory AdminEmployee.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? dept =
        json['department'] is Map ? Map<String, dynamic>.from(json['department'] as Map) : null;
    final Map<String, dynamic>? sup =
        json['supervisor'] is Map ? Map<String, dynamic>.from(json['supervisor'] as Map) : null;
    return AdminEmployee(
      id: json['id'] as String,
      userId: json['userId'] as String?,
      employeeNo: json['employeeNo'] as String? ?? 'â€”',
      name: json['name'] as String? ?? 'â€”',
      email: json['email'] as String? ?? 'â€”',
      status: json['status'] as String? ?? 'ACTIVE',
      phone: json['phone'] as String?,
      position: json['position'] as String?,
      departmentId: json['departmentId'] as String?,
      departmentName: dept?['name'] as String?,
      supervisorName: sup?['name'] as String?,
    );
  }
}

class AdminEmployeePage {
  const AdminEmployeePage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final List<AdminEmployee> items;
  final int page;
  final int totalPages;
  final int totalItems;
}


class AdminDepartment {
  const AdminDepartment({required this.id, required this.name, this.hospitalId});

  final String id;
  final String name;
  final String? hospitalId;

  factory AdminDepartment.fromJson(Map<String, dynamic> json) => AdminDepartment(
        id: json['id'] as String,
        name: json['name'] as String? ?? 'â€”',
        hospitalId: json['hospitalId'] as String?,
      );
}
