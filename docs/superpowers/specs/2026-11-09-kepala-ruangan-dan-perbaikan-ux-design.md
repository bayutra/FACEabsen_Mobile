# Perbaikan beranda, operan, koreksi, dan role Kepala Ruangan (mobile) — Design

Tanggal: 2026-11-09
Status: sudah disepakati Cara 1, menunggu persetujuan dokumen

## Intent

Lima bug kecil + satu fitur role yang ditemukan saat uji coba langsung:

1. Beranda mobile menampilkan status check-in dua kali.
2. Operan bangsal di beranda (banner "Operan Jaga Bangsal Melati") hanya dummy
   dan tombol "Lihat Rekam Medis" tidak melakukan apa-apa.
3. Setelah koreksi disetujui di web, jam absen karyawan tidak terlihat berubah.
4. Form penambahan unit kerja masih meminta pilih RS, padahal hanya ada
   RS Darmayu Madiun; tab "Penggantian Perangkat" di web tidak dipakai.
5. Dibutuhkan role Kepala Ruangan yang log in hanya via mobile, bisa
   menyetujui koreksi dan review absensi anggota unitnya; superadmin bisa
   mengatur per akun apakah boleh login mobile, web, atau dua-duanya (CRUD).

## Goals

- Beranda mobile menampilkan banner status maksimal satu kali.
- Banner operan di beranda memakai data operan nyata dari
  `GET /handovers`; tombolnya membuka daftar/detail operan.
- Setelah approve koreksi, daftar presensi web dan riwayat mobile menampilkan
  `checkInAt`/`checkOutAt` baru.
- Form Penambahan Unit Kerja memakai RS default RSU Darmayu Madiun
  (tanpa dropdown bila hanya satu RS), dan nav "Penggantian Perangkat"
  dihapus dari dashboard web.
- Kepala Ruangan = `SUPERVISOR` + flag login-surface per akun
  (`mobile` | `web` | `both`, default `both`), dikelola superadmin via
  halaman Pengguna (CRUD sederhana).
- Akun `mobile` ditolak saat login web dengan `403`/`reason: MOBILE_ONLY_ACCOUNT`;
  akun `web` ditolak saat login mobile dengan `403`/`reason: WEB_ONLY_ACCOUNT`.
- Akun Supervisor (`mobile` atau `both`) bisa log in mobile dengan label
  tampilan "Kepala Ruangan"; label lain: "Karyawan" (Employee), "Admin",
  "Super Admin".
- Beranda mobile akun Supervisor menampilkan "Permintaan Persetujuan" dan
  badge notifikasi peninjauan yang belum selesai: koreksi presensi dan
  review absensi dari anggota `supervisorId`-nya, dengan aksi
  Setujui/Tolak yang memanggil endpoint yang sudah ada
  (`correction:approve:team`, `attendance:approve:team`).
- Superadmin bisa mengubah flag login-surface untuk semua akun, tanpa
  menambah permission baru; masih CRUD User + role seperti sekarang
  (`user:manage`).

## Non-goals

- Tidak menambah role DB baru (`KEPALA_RUANGAN` ditolak).
- Tidak mengubah skema permission atau rank role (`constants.ts` tetap).
- Tidak mengubah kontrak API koreksi/attendance; hanya halaman mobile
  dan perbaikan tampilan.
- Tidak menghapus backend `device-change`; hanya tab + halaman webnya.
- Tidak mengubah seed hospital (sudah `RS-A / RSU Darmayu Madiun`).

## Constraints

- `SUPERVISOR` / `ADMIN` / `SUPER_ADMIN` tetap dashboard-only kecuali
  akunnya diberi `loginSurface = 'mobile'` atau `'both'` via flag.
- Flag disimpan di `User.loginSurface` (kolom baru, default `'both'` agar
  tidak memutus akun lama); migrasi Prisma.
- Permission `correction:approve:team` dan `attendance:approve:team`
  tetap mengacu pada role `SUPERVISOR`; tidak perlu permission baru.
- Scope tinjauan tetap `target.supervisorId === reviewerEmployeeId`
  (`corrections.service.ts:344-353`, sama untuk attendance review).
- Self-approval tetap dilarang (`SELF_APPROVAL_FORBIDDEN`).
- Superadmin CRUD semua akun lewat halaman `/users` yang ada
  (`web/app/(dashboard)/users/page.tsx`) + endpoint backend yang ada
  (`user:manage`, `role:manage`).

## Approaches

### Kepala Ruangan

- **A. SUPERVISOR + flag login-surface (dipilih).** Ringkas, tidak tambah role,
  label tampilan dipetakan di mobile.
- **B. Role baru `KEPALA_RUANGAN` (ditolak).** Lebih luas, menambah RBAC.
- **C. Pakai ulang SUPERVISOR tanpa flag (ditolak).** Tidak memenuhi
  permintaan superadmin untuk memilih mobile/web/both per akun.

### Approve bar mobile

- **A. Section "Permintaan Persetujuan" di beranda + halaman daftar
  peninjauan (dipilih).** Memakai endpoint queue yang sudah ada
  (`GET /corrections` dengan scope Supervisor), badge count di ikon
  notifikasi, tap menuju detail dengan tombol Setujui/Tolak.
- **B. Hanya push notification tanpa approve bar (ditolak).** Tidak memenuhi
  permintaan "munculkan bar approve".

### Banner operan

- **A. Ganti dummy dengan data nyata (dipilih).** Ambil operan
  `status = ACTIVE` / terbaru dari `GET /handovers`, tampilkan judul,
  catatan, dan penanggung jawab; tombol membuka `HandoverListScreen`.
  Bila kosong, tampilkan status kosong ("Belum ada operan aktif.")
- **B. Tampilkan dummy apa adanya (ditolak).**

## Perubahan yang direncanakan

### Backend
- `prisma/schema.prisma` + migrasi: `User.loginSurface String @default("both")`
  (`mobile` | `web` | `both`), validasi di DTO.
- `auth/auth.service.ts`: cek `loginSurface` saat login; tolak dengan
  `reason: MOBILE_ONLY_ACCOUNT` / `WEB_ONLY_ACCOUNT`. Aturan
  `DASHBOARD_ONLY_ROLES` tetap berlaku, tapi boleh di-override oleh
  `loginSurface = 'mobile'`/`'both'` untuk Supervisor; akun `web` tidak
  bisa login mobile.
- `auth/dto.ts`: tambah `loginSurface` opsional saat create/update user.
- Seed tidak berubah; semua akun lama otomatis `both`.

### Web
- `DashboardShell.tsx`: hapus item "Penggantian Perangkat"; hapus folder
  `web/app/(dashboard)/device-change/`. Backend tidak disentuh.
- `web/app/(dashboard)/departments/page.tsx`: form unit memakai hospital
  pertama (Darmayu) sebagai default; dropdown hanya tampil bila daftar RS
  > 1.
- `web/app/(dashboard)/users/page.tsx`: field "Login bisa dari" (select
  `mobile`/`web`/`both`) pada form create/edit akun superadmin.
- `web/app/(dashboard)/corrections/page.tsx` dan
  `web/app/(dashboard)/attendance/page.tsx`: setelah approve/reject,
  `reload()` kedua `useResource` (daftar + statistik) agar jam baru
  tampil; modal menampilkan "Jam lama → Jam diajukan".

### Mobile
- `home_dashboard.dart`: hapus satu blok banner check-in yang duplikat;
  ganti widget `handoverAnnouncement` dengan pemanggilan data nyata;
  tambah section "Permintaan Persetujuan" untuk role Supervisor/Kepala
  Ruangan (count + list ringkas + tombol Setujui/Tolak); badge bell
  menambah hitungan peninjauan.
- `lib/core/widgets/stitch.dart` atau mapping label role: `SUPERVISOR`
  dirender "Kepala Ruangan" pada layar profile/home; lainnya mapping
  seperti sekarang.
- Halaman peninjauan mobile (baru, ringan): daftar koreksi pending
  (`GET /corrections?status=PENDING`) + review attendance pending
  (`GET /attendance/review?status=PENDING`), reuse `ReviewModal`-like
  simple dialog dengan tombol Setujui/Tolak.

## Verifikasi

- Unit: test `isSameOrigin`-like login-surface (backend
  `auth.service.spec.ts`): `mobile` ditolak web, `web` ditolak mobile,
  `both` lolos dua-duanya; Supervisor dengan `mobile` lolos mobile.
- E2E ringan: superadmin mengubah `loginSurface`, lalu login web/mobile
  sesuai flag.
- `flutter analyze` + `flutter test` (mobile), `npm run typecheck` (web),
  build backend + test existing (`corrections.service.spec.ts` tetap hijau).

## Risiko / keputusan yang saya ambil (silakan koreksi)

- Flag login-surface ada di `User`, bukan di `Employee`, karena login
  terjadi sebelum employee profile dibaca.
- Label "Kepala Ruangan" hanya presentasi di mobile; role internal tetap
  `SUPERVISOR` sehingga tidak mengganggu web.
- Permintaan persetujuan Kepala Ruangan memakai antrian Supervisor yang
  sudah ada; terjadinya chatter hanya dari penambahan tampilan.

## Pertanyaan terbuka

- Apakah review absensi yang boleh disetujui Kepala Ruangan hanya yang
  belum divalidasi admin (status `PENDING`), atau juga yang bermasalah
  (`LATE`/`UNAPPROVED`)? Saya asumsikan hanya `PENDING` seperti web
  sekarang.
- Apakah scope Supervisor tetap `supervisorId` atau perlu ditambah
  "satu department"? Saya pakai `supervisorId` karena sudah ada dan
  dipahami superadmin saat CRUD karyawan.
