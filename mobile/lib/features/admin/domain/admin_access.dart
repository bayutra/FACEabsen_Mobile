/// Role gating untuk area "Kelola" di aplikasi.
///
/// Backend sudah menegakkan RBAC per endpoint; helper di sini hanya mengatur
/// menu mana yang *ditampilkan*, supaya pengguna tidak menekan aksi yang pasti
/// ditolak server.
library;

const String roleEmployee = 'EMPLOYEE';
const String roleSupervisor = 'SUPERVISOR';
const String roleAdmin = 'ADMIN';
const String roleSuperAdmin = 'SUPER_ADMIN';

bool isSuperAdmin(List<String> roles) => roles.contains(roleSuperAdmin);

/// ADMIN pada SIMRS juga memangku hak SUPER_ADMIN untuk urusan operasional.
bool isAdmin(List<String> roles) =>
    roles.contains(roleAdmin) || isSuperAdmin(roles);

/// Supervisor melihat tim, koreksi, cuti, laporan, serta data karyawan/unit
/// terbatas pada unit/timnya.
bool isSupervisor(List<String> roles) =>
    roles.contains(roleSupervisor) || isAdmin(roles);

/// Pintu masuk area "Kelola" (disembunyikan untuk karyawan biasa).
bool canOpenAdminArea(List<String> roles) => isSupervisor(roles);

/// Hak penuh SDM: tambah & nonaktifkan karyawan, serta ubah unit/atasan.
/// Supervisor hanya boleh mengubah nama, telepon, dan jabatan anggotanya.
bool canManageAllEmployees(List<String> roles) => isAdmin(roles);
