# Menu Admin di Aplikasi Mobile

Area **Kelola** menjadikan aplikasi mobile sebagai konsol administrasi ringkas
selain API. Setiap layar memanggil endpoint yang sama dengan backend, jadi
tidak ada logika bisnis yang diduplikasi.

## Akses

- Pintasan **"Mode Admin"** tampil di **Beranda** (banner di atas konten) dan
  di halaman **Profil**, hanya untuk peran `SUPERVISOR`, `ADMIN`, atau
  `SUPER_ADMIN`.
- Karyawan biasa tidak pernah melihat pintasan maupun layar admin.
- Server tetap menegakkan RBAC per endpoint; UI hanya menyembunyikan menu
  yang tidak berhak diakses.

## Pendaftaran akun

- Layar login punya tautan **Daftar** untuk pendaftaran mandiri
  (`POST /auth/register`). Akun baru otomatis mendapat peran `EMPLOYEE`,
  nomor karyawan dibuat otomatis (`EMP-###`) bila dikosongkan, dan sesi
  langsung terbit sehingga pengguna masuk ke Beranda tanpa login ulang.
- Peran `SUPERVISOR`/`ADMIN`/`SUPER_ADMIN` **tidak** bisa dipilih saat
  mendaftar; hanya SUPER_ADMIN yang dapat memberikannya lewat
  **Kelola → Pengguna**.
- Setelah login/daftar, aplikasi mendaftarkan perangkat secara otomatis dan
  langsung membuka Beranda (tidak ada layar "menunggu aktivasi"). Satu akun
  boleh dipakai di beberapa perangkat.

## Modul

| Seksi | Modul | Peran | Endpoint |
|---|---|---|---|
| SDM | Karyawan | ADMIN | `GET/POST /employees`, `PATCH /employees/{id}`, `POST /employees/{id}/deactivate` |
| SDM | Departemen | ADMIN | `GET/POST /departments`, `PATCH/DELETE /departments/{id}` |
| SDM | Shift | ADMIN | `GET/POST /shifts`, `PATCH/DELETE /shifts/{id}` |
| SDM | Jadwal | ADMIN | `GET/POST /schedules`, `DELETE /schedules/{id}` |
| Persetujuan | Koreksi Presensi | SUPERVISOR+ | `GET /corrections`, `POST /corrections/{id}/approve\|reject` |
| Persetujuan | Cuti & Izin | SUPERVISOR+ | `GET /leaves`, `POST /leaves/{id}/approve\|reject` |
| Laporan | Laporan | SUPERVISOR+ | `GET /reports/{daily,monthly,late,leaves,department,employee}` |
| Laporan | Tim Supervisor | SUPERVISOR+ | `GET /supervisor/{team,team/{id},attendance,summary}` |
| Operasional | Perangkat | SUPER_ADMIN | `GET /devices`, `POST /devices/{id}/{activate,revoke,mark-lost}` |
| Operasional | Penggantian Perangkat | SUPER_ADMIN | `GET /device-change`, `POST /device-change/{id}/{approve,reject}` |
| Keamanan | Audit Log | SUPER_ADMIN | `GET /audit`, `GET /audit/actions` |
| Keamanan | Pengguna | SUPER_ADMIN | `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` |
| Keamanan | Privasi & Retensi | SUPER_ADMIN | `GET /privacy/notice`, `POST /privacy/retention/run` |

## Catatan pengujian lokal

- Akun demo: `supervisor@rs.test`, `admin@rs.test`, `superadmin@rs.test`
  (semua password `Password123!`).
- Perangkat baru langsung ACTIVE saat registrasi (multi-perangkat), jadi
  aktivasi manual hanya diperlukan untuk perangkat lama yang masih PENDING.
  Aktivasi bisa lewat layar **Kelola → Perangkat** atau skrip
  `scripts/approve-device.ps1` yang memanggil endpoint yang sama.
- Semua aksi di area ini tercatat di audit log (`GET /audit`).
