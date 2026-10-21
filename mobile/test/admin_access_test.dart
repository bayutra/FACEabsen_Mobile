import 'package:flutter_test/flutter_test.dart';
import 'package:face_absen_mobile/features/admin/domain/admin_access.dart';

void main() {
  group('admin area access', () {
    test('karyawan biasa tidak melihat menu Kelola', () {
      expect(canOpenAdminArea(const <String>['EMPLOYEE']), isFalse);
      expect(canOpenAdminArea(const <String>[]), isFalse);
    });

    test('supervisor hanya membuka area persetujuan & laporan', () {
      const List<String> roles = <String>['SUPERVISOR'];
      expect(canOpenAdminArea(roles), isTrue);
      expect(isSupervisor(roles), isTrue);
      expect(isAdmin(roles), isFalse);
      expect(isSuperAdmin(roles), isFalse);
    });

    test('admin lebih tinggi dari supervisor, bukan super admin', () {
      const List<String> roles = <String>['ADMIN'];
      expect(isSupervisor(roles), isTrue);
      expect(isAdmin(roles), isTrue);
      expect(isSuperAdmin(roles), isFalse);
    });

    test('super admin membuka semua modul', () {
      const List<String> roles = <String>['SUPER_ADMIN'];
      expect(isSupervisor(roles), isTrue);
      expect(isAdmin(roles), isTrue);
      expect(isSuperAdmin(roles), isTrue);
    });

    test('multi-peran mengikuti hak tertinggi', () {
      const List<String> roles = <String>['EMPLOYEE', 'SUPERVISOR'];
      expect(canOpenAdminArea(roles), isTrue);
      expect(isAdmin(roles), isFalse);
    });
  });

  test('supervisor tidak punya hak penuh SDM (hanya ubah kontak)', () {
    const List<String> roles = <String>['SUPERVISOR'];
    expect(canManageAllEmployees(roles), isFalse);
    expect(canManageAllEmployees(const <String>['ADMIN']), isTrue);
    expect(canManageAllEmployees(const <String>['SUPER_ADMIN']), isTrue);
  });
}