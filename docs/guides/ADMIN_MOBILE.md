# Mode Admin Mobile — Dihapus

Area **Kelola / Mode Admin** di aplikasi mobile sudah **dihapus**. Aplikasi
mobile sekarang hanya untuk karyawan: presensi, riwayat, jadwal, koreksi,
cuti, profil, dan privasi.

Alasannya: approval dan administrasi kepegawaian lebih nyaman dan aman
dilakukan di layar besar. Pengelolaan dipindahkan ke dashboard web:

- Panduan: [`WEB_DASHBOARD.md`](WEB_DASHBOARD.md)
- Kode: [`web/`](../../web)
- Login mobile dengan peran `SUPERVISOR`, `ADMIN`, atau `SUPER_ADMIN` ditolak
  backend (`DASHBOARD_ONLY_ROLE`); akun tersebut harus memakai dashboard.
- API supervisor/admin tetap sama dan tetap menegakkan RBAC untuk integrasi.

Pendaftaran akun mandiri dari mobile, pemilihan unit, pembatasan peran, dan
kebijakan perangkat tidak berubah; lihat PRD §3 dan §6.
