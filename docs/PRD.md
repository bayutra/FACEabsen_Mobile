# PRD — Face Absen Mobile

**Versi:** 2.0 (mobile-only)
**Tanggal:** 20 Oktober 2026
**Status:** Baseline implementasi — inti presensi mobile sudah berjalan
**Produk:** Presensi karyawan RSU Darmayu Madiun
**Klien:** Aplikasi Flutter Android + iOS (satu-satunya klien)
**Backend:** NestJS / Node.js / PostgreSQL / Redis
**Face Recognition:** MobileFaceNet — on-device
**Dokumen terkait:** [`README.md`](README.md), [`guides/`](guides/), [`design/mobile/`](design/mobile/)

---

## 1. Ringkasan Eksekutif

Face Absen Mobile adalah sistem presensi karyawan rumah sakit yang
memverifikasi **wajah**, **liveness**, **perangkat**, dan **integritas
request** sebelum satu pun check-in/check-out diterima server.

Sejak versi 2.0, produk ini **mobile-only**:

- Tidak ada web dashboard, desktop app, atau target Flutter web/desktop.
- Tidak ada GPS/geofence. Kepercayaan tidak dibangun dari lokasi, melainkan
dari kecocokan wajah, liveness, binding perangkat, signature Ed25519,
device integrity, dan risk engine.
- Foto mentah tidak pernah meninggalkan perangkat. Klien mengirim embedding
192-d; server menyimpannya terenkripsi AES-256-GCM.

### 1.1 Tujuan

1. Mencegah titip absen dan pemalsuan presensi.
2. Membuat presensi cepat dan tahan sinyal buruk (outbox + retry).
3. Memberi karyawan akses mandiri ke jadwal, riwayat, koreksi, izin/cuti.
4. Memenuhi kewajiban UU PDP untuk data biometrik.
5. Menjadi satu sumber kebenaran data presensi bagi SDM rumah sakit.

### 1.2 Indikator keberhasilan


| Metrik                                   | Target                          |
| ---------------------------------------- | ------------------------------- |
| Presensi berhasil pada percobaan pertama | ≥ 98% (setelah kalibrasi)       |
| Waktu dari capture ke hasil              | ≤ 5 detik (jaringan normal)     |
| Presensi hilang karena jaringan          | 0 (masuk outbox, dikirim ulang) |
| Foto mentah tersimpan di server          | 0                               |
| Punch ganda untuk satu jadwal            | 0                               |
| Insiden data biometrik bocor             | 0                               |


### 1.3 Prinsip produk

```text
Zero Trust Client
Least Privilege
Defense in Depth
Privacy by Design
Server as Source of Truth
Offline-tolerant, not offline-authoritative
Audit everything important
```

Aplikasi mobile dan isinya dianggap **untrusted client**. Server tidak
mempercayai `employeeId`, `deviceId`, skor liveness, atau status perangkat
yang dikirim klien tanpa verifikasi.

---

## 2. Perubahan dari Versi 1.0


| Area                       | v1.0                                     | v2.0 (dokumen ini)                                          |
| -------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Platform                   | Mobile + Web                             | **Mobile saja** (Android + iOS)                             |
| Dashboard admin/supervisor | Next.js                                  | Dihapus dari repo; API tetap ada                            |
| GPS &amp; geofence         | Wajib                                    | **Dihapus total**                                           |
| Bobot risk                 | Termasuk GPS/geofence                    | Wajah 45, liveness 20, device 15, integrity 15, signature 5 |
| Target Flutter             | Android, iOS, web, Windows, Linux, macOS | Android + iOS                                               |
| Desain                     | Mockup mobile + dashboard                | Mockup mobile saja (lihat catatan historis)                 |


> **Catatan desain:** sebagian mockup di `docs/design/mobile/` masih
> menampilkan copy GPS/geofence dari versi 1.0. Implementasi saat ini **tidak**
> memakai lokasi; kode dan PRD ini adalah sumber kebenaran.

---

## 3. Ruang Lingkup

### 3.1 In scope

- Aplikasi Flutter untuk **karyawan** (Android 5.0+, iOS 15.5+).
- Login, sesi, ganti password, TOTP bila diaktifkan admin.
- Registrasi &amp; penggantian perangkat.
- Registrasi wajah + consent biometrik.
- Liveness aktif dan pasif.
- Check-in, check-out, outbox offline, retry.
- Riwayat presensi, jadwal dinas, koreksi presensi, izin/cuti.
- Profil, privasi (export/consent/hapus wajah), bantuan IT.
- API backend untuk seluruh fitur di atas.
- Infrastruktur deploy: Docker, nginx, PostgreSQL, Redis.

### 3.2 Out of scope

- Web dashboard, panel admin, panel supervisor (fase berikutnya).
- Aplikasi desktop/web.
- GPS, geofence, anti mock-location.
- Payroll, penjadwalan otomatis, integrasi SIMRS real-time.
- Push notification (belum ada).
- Face recognition di server (server hanya mencocokkan embedding).
- Deteksi wajah memakai foto referensi yang disimpan di server.

### 3.3 Pengguna dan status UI


| Peran                   | Kebutuhan                               | Status di repo                 |
| ----------------------- | --------------------------------------- | ------------------------------ |
| **Karyawan**            | Semua fitur presensi mandiri            | Mobile app lengkap             |
| **Atasan / Supervisor** | Approve koreksi/izin, lihat tim         | API tersedia, **belum ada UI** |
| **Admin**               | Kelola karyawan, shift, device, laporan | API tersedia, **belum ada UI** |
| **Super Admin**         | Kelola role, audit, retensi             | API tersedia, **belum ada UI** |


Keputusan produk: fase 1 fokus pada pengalaman karyawan. Fungsi
supervisor/admin tetap tersedia lewat API untuk integrasi, dan akan mendapat
UI mobile pada fase 2 (lihat §15).

---

## 4. Arsitektur

```text
┌─────────────────────────────────────────────┐
│           Flutter App (Android/iOS)         │
│                                             │
│  camera → face detect → quality → liveness  │
│       → embedding 192-d → sign request      │
│                                             │
│  secure storage: token, device key, outbox  │
└──────────────────────┬──────────────────────┘
                       │ HTTPS JSON (/api/v1)
                       ▼
┌─────────────────────────────────────────────┐
│                  nginx                      │
│        TLS 1.2/1.3 · routing · limit        │
└──────────────────────┬──────────────────────┘
                       ▼
┌─────────────────────────────────────────────┐
│                NestJS API                   │
│                                             │
│ auth · rbac · device · face · attendance    │
│ shift · risk · correction · leave · audit   │
│ privacy · integrity · reports · supervisor  │
└───────────┬──────────────────────┬──────────┘
            ▼                      ▼
┌───────────────────────┐  ┌──────────────────┐
│     PostgreSQL 17     │  │     Redis 7      │
│ users, employees      │  │ rate limit       │
│ devices, templates    │  │ lockout counter  │
│ attendance, audit     │  │ (shared)         │
└───────────────────────┘  └──────────────────┘
```

### 4.1 Stack


| Layer         | Teknologi                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Mobile        | Flutter 3.22 / Dart 3.4, Dio, flutter\_secure\_storage, camera, google\_mlkit\_face\_detection, tflite\_flutter, cryptography |
| Face model    | MobileFaceNet `.tflite` (embedding 192-d, on-device)                                                                          |
| Backend       | NestJS 12, TypeScript, Prisma, Argon2id, JWT, ExcelJS, PDFKit                                                                 |
| Database      | PostgreSQL 17                                                                                                                 |
| Cache / limit | Redis 7 (opsional di lokal)                                                                                                   |
| Reverse proxy | nginx 1.27 + TLS                                                                                                              |
| Deploy        | Docker Compose                                                                                                                |
| Testing       | Vitest (backend), flutter\_test (mobile)                                                                                      |


### 4.2 Alur data presensi

```text
1. Karyawan menekan "Presensi"
2. Pra-validasi: sesi, karyawan, jadwal, consent, device, wajah terdaftar
3. Kamera + deteksi wajah + kualitas wajah
4. Liveness (aktif/pasif)
5. Embedding 192-d dihitung di perangkat
6. requestId + timestamp + signature Ed25519
7. POST /attendance/check-in (embedding + liveness + sinyal device)
8. Server: signature → device → consent → liveness shape → face match
   → risk engine → simpan presensi + audit
9. Hasil ditampilkan (berhasil / ditolak / di luar jadwal / review)
```

Tidak ada langkah yang mengirim gambar. Tidak ada langkah yang memakai GPS.

---

## 5. Information Architecture Mobile

### 5.1 Navigasi utama (5 tab)


| Tab           | Isi                                                                     |
| ------------- | ----------------------------------------------------------------------- |
| **Beranda**   | Sapaan, status shift hari ini, status presensi, CTA presensi, ringkasan |
| **Riwayat**   | Daftar presensi + filter + detail                                       |
| **Jadwal**    | Roster mingguan, status shift, navigasi minggu                          |
| **Perangkat** | Perangkat aktif, status, penggantian, bantuan IT                        |
| **Profil**    | Data karyawan, wajah, privasi, ganti password, logout                   |


Presensi, koreksi, izin/cuti, dan registrasi wajah berjalan sebagai **alur
linear** (bukan tab): CTA → pra-validasi → liveness → proses → hasil.

### 5.2 Inventaris layar


| #   | Layar                 | Implementasi                                                     | Mockup                                        |
| --- | --------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| 1   | Login karyawan        | `features/auth/presentation/login_screen.dart`                   | `login_karyawan_autentikasi`                  |
| 2   | Verifikasi TOTP       | alur login                                                       | —                                             |
| 3   | Daftarkan perangkat   | `features/device/presentation/device_register_screen.dart`       | `daftarkan_perangkat`                         |
| 4   | Beranda               | `features/home/presentation/home_dashboard.dart`                 | `beranda_presensi_dashboard_nakes`            |
| 5   | Pra-validasi presensi | `features/preflight/presentation/preflight_screen.dart`          | `presensi_pra_validasi_geofence`              |
| 6   | Liveness challenge    | `features/liveness/presentation/liveness_screen.dart`            | `presensi_liveness_challenge_biometrik`       |
| 7   | Pemindaian pasif      | `features/liveness/presentation/passive_scan_screen.dart`        | —                                             |
| 8   | Proses verifikasi     | alur presensi                                                    | `presensi_verifikasi_sedang_diproses`         |
| 9   | Hasil presensi        | `features/attendance/presentation/attendance_result_screen.dart` | `presensi_hasil_verifikasi_presensi`          |
| 10  | Riwayat presensi      | `features/attendance/presentation/history_screen.dart`           | `riwayat_presensi_detail_bottom_sheet`        |
| 11  | Jadwal dinas          | `features/schedule/presentation/schedule_screen.dart`            | `jadwal_dinas_mingguan_shift_nakes`           |
| 12  | Perangkat saya        | `features/device/presentation/device_screen.dart`                | `perangkat_saya_manajemen_perangkat`          |
| 13  | Form penggantian      | `features/device/presentation/replacement_screen.dart`           | `penggantian_perangkat_form_verifikasi`       |
| 14  | Status penggantian    | `features/device/presentation/replacement_status_screen.dart`    | `status_penggantian_perangkat_menunggu_admin` |
| 15  | Registrasi wajah      | `features/face/presentation/face_registration_screen.dart`       | `clinical_attendance_identity`                |
| 16  | Wajah berhasil        | `features/face/presentation/face_registered_screen.dart`         | `pendaftaran_wajah_berhasil`                  |
| 17  | Kendala pemindaian    | `features/face/presentation/face_scan_issue_screen.dart`         | `pendaftaran_wajah_kendala_pemindaian`        |
| 18  | Daftar koreksi        | `features/correction/presentation/correction_list_screen.dart`   | `riwayat_status_koreksi`                      |
| 19  | Form koreksi          | `features/correction/presentation/correction_form_screen.dart`   | `pengajuan_koreksi_presensi`                  |
| 20  | Daftar izin/cuti      | `features/leave/presentation/leave_list_screen.dart`             | `riwayat_kuota_cuti`                          |
| 21  | Form izin/cuti        | `features/leave/presentation/leave_form_screen.dart`             | `pengajuan_izin_cuti`                         |
| 22  | Profil                | `features/profile/presentation/profile_screen.dart`              | `profil_karyawan_pengaturan_akun`             |


### 5.3 Alur kunci

**Startup**

```text
Splash → refresh token ada?
  ├─ tidak → Login
  └─ ya → GET /auth/me
        ├─ sukses → Beranda
        └─ gagal/offline → layar "Tidak dapat terhubung" + Coba Lagi
```

**Registrasi perangkat pertama**

```text
Login → /devices/me kosong
  → GET /devices/register-challenge (nonce, 5 menit)
  → buat key pair Ed25519 di secure storage
  → POST /devices/register (public key + signature nonce)
  → perangkat pertama = ACTIVE
  → lanjut registrasi wajah
```

**Registrasi wajah**

```text
Consent biometrik (wajib)
  → kamera + kualitas wajah
  → liveness
  → embedding
  → POST /face/register
  → template terenkripsi di server
```

**Presensi**

```text
Beranda → CTA Presensi
  → pra-validasi (jadwal, consent, device, wajah)
  → liveness → embedding → signature
  → POST check-in / check-out
  ├─ 200 → layar hasil (status, shift, risk)
  ├─ 422 → alasan ditolak + langkah perbaikan
  ├─ 429/5xx/timeout → masuk outbox + info antrean
  └─ sukses → beranda diperbarui
```

**Penggantian perangkat**

```text
Perangkat → Ajukan penggantian
  → daftarkan perangkat baru (PENDING)
  → POST /device-change (alasan)
  → status menunggu admin
  → disetujui: device lama REVOKED, baru ACTIVE
```

**Koreksi presensi**

```text
Riwayat → pilih presensi → Ajukan koreksi
  → jenis + jam yang benar + alasan
  → PENDING → disetujui/ditolak → presensi diperbarui
```

**Izin/cuti**

```text
Profil/Beranda → Izin & Cuti → ajukan
  → CUTI / SAKIT / IZIN / DINAS / LAINNYA
  → PENDING → disetujui/ditolak → riwayat
```

---

## 6. Functional Requirements

Kode prioritas: **P0** wajib untuk produksi, **P1** penting, **P2** fase
berikutnya.

### 6.1 Autentikasi &amp; sesi (FR-AUTH)


| ID         | Prioritas | Requirement                                                                                     |
| ---------- | --------- | ----------------------------------------------------------------------------------------------- |
| FR-AUTH-01 | P0        | Login dengan email akun + password. Password di-hash Argon2id.                                  |
| FR-AUTH-02 | P0        | Access token JWT berumur pendek (default 900 detik) + refresh token rotasi.                     |
| FR-AUTH-03 | P0        | Refresh token disimpan sebagai hash SHA-256 di server; token lama langsung dicabut saat rotasi. |
| FR-AUTH-04 | P0        | Lockout setelah `LOGIN_MAX_ATTEMPTS` gagal (default 5) selama `LOCKOUT_MINUTES` (default 15).   |
| FR-AUTH-05 | P0        | Logout mencabut sesi aktif; ganti password mencabut semua sesi lain.                            |
| FR-AUTH-06 | P1        | TOTP setup/verify/recover untuk akun yang diwajibkan MFA.                                       |
| FR-AUTH-07 | P0        | Aplikasi tidak menyimpan password. Token &amp; device key disimpan di secure storage.           |


**Acceptance criteria**

- Refresh token lama tidak dapat dipakai ulang setelah rotasi.
- Setelah 5 login gagal, percobaan ke-6 ditolak sampai masa lockout habis.
- Restart aplikasi tidak menghilangkan sesi yang masih valid.
- Logout lalu membuka aplikasi kembali menampilkan layar login.

### 6.2 Perangkat (FR-DEV)


| ID        | Prioritas | Requirement                                                                                       |
| --------- | --------- | ------------------------------------------------------------------------------------------------- |
| FR-DEV-01 | P0        | Satu karyawan hanya boleh punya **satu** perangkat ACTIVE (partial unique index).                 |
| FR-DEV-02 | P0        | Registrasi memakai challenge JWT 5 menit + signature Ed25519 atas nonce.                          |
| FR-DEV-03 | P0        | Perangkat pertama otomatis ACTIVE; perangkat berikutnya PENDING sampai penggantian disetujui.     |
| FR-DEV-04 | P0        | Perangkat dicabut tidak dapat dipakai presensi (`DEVICE_NOT_ACTIVE`).                             |
| FR-DEV-05 | P0        | Setiap presensi wajib menyertakan `deviceId` milik karyawan yang login.                           |
| FR-DEV-06 | P1        | Heartbeat memperbarui `lastSeenAt` dan versi aplikasi.                                            |
| FR-DEV-07 | P1        | Pengajuan penggantian memuat alasan; dapat dibatalkan selama PENDING.                             |
| FR-DEV-08 | P1        | Approval penggantian mencabut device lama, sesi lama, dan mengaktifkan device baru secara atomik. |


**Acceptance criteria**

- Mendaftarkan device kedua tidak langsung mengaktifkannya.
- Presensi dari device yang bukan milik akun → 403.
- Presensi dari device REVOKED/LOST → 422 `DEVICE_NOT_ACTIVE`.
- Setelah penggantian disetujui, device lama tidak bisa presensi lagi.

### 6.3 Wajah (FR-FACE)


| ID         | Prioritas | Requirement                                                                             |
| ---------- | --------- | --------------------------------------------------------------------------------------- |
| FR-FACE-01 | P0        | Foto mentah tidak boleh dikirim/dipertahankan; hanya embedding 192-d.                   |
| FR-FACE-02 | P0        | Registrasi wajah wajib consent `BIOMETRIC_ATTENDANCE`.                                  |
| FR-FACE-03 | P0        | Kualitas wajah diperiksa sebelum registrasi (pencahayaan, pose, ketajaman, satu wajah). |
| FR-FACE-04 | P0        | Template disimpan terenkripsi AES-256-GCM dan tidak pernah dikembalikan API.            |
| FR-FACE-05 | P0        | Pencocokan memakai cosine similarity; ambang default 0.5, dapat dikalibrasi.            |
| FR-FACE-06 | P1        | Karyawan dapat melihat status wajah terdaftar dan mengganti template.                   |
| FR-FACE-07 | P1        | Penghapusan wajah lewat privasi menghapus template dan menghentikan presensi wajah.     |


**Acceptance criteria**

- Response API tidak pernah memuat bytes/vektor template.
- Wajah tidak terdaftar → 422 `NO_FACE_TEMPLATE`.
- Skor di bawah ambang → 422 `FACE_MISMATCH`.
- Registrasi tanpa consent → ditolak `NO_CONSENT`.

### 6.4 Liveness (FR-LIVE)


| ID         | Prioritas | Requirement                                                                                                         |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| FR-LIVE-01 | P0        | Liveness aktif memakai challenge acak: kedip dan/atau menoleh.                                                      |
| FR-LIVE-02 | P1        | Liveness pasif mendukung mode tanpa instruksi dengan `padScore` &gt; 0.                                             |
| FR-LIVE-03 | P0        | Server memvalidasi `passed`, mode, daftar challenge/skor, dan kesegaran (`LIVENESS_MAX_AGE_MIN`, default 10 menit). |
| FR-LIVE-04 | P0        | Attestation liveness bukan batas keamanan tunggal; keputusan akhir tetap pada face match + device + integrity.      |
| FR-LIVE-05 | P1        | Kegagalan menampilkan panduan perbaikan, bukan error mentah.                                                        |


**Acceptance criteria**

- Attestation `passed=false` → 422 `LIVENESS_FAILED`.
- Attestation kedaluwarsa → 422 `LIVENESS_STALE`.
- Mode pasif tanpa `padScore` → 422 `LIVENESS_EMPTY`.
- Mode tidak dikenal → 422 `LIVENESS_MODE_UNSUPPORTED`.

### 6.5 Presensi (FR-ATT)


| ID        | Prioritas | Requirement                                                                                                  |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| FR-ATT-01 | P0        | Check-in dan check-out hanya untuk karyawan yang punya jadwal pada `workDate` tersebut.                      |
| FR-ATT-02 | P0        | Satu jadwal = satu baris presensi. Check-in kedua saat masih terbuka ditolak `ALREADY_CHECKED_IN`.           |
| FR-ATT-03 | P0        | Check-out tanpa check-in ditolak `NO_OPEN_ATTENDANCE`.                                                       |
| FR-ATT-04 | P0        | Status check-in dihitung dari jam mulai shift: `ON_TIME`, `LATE`, `VERY_LATE`.                               |
| FR-ATT-05 | P0        | Status check-out dihitung dari jam selesai shift: `NORMAL_CHECKOUT`, `EARLY_CHECKOUT`.                       |
| FR-ATT-06 | P0        | Setiap request wajib `requestId` UUID v4 (single-use), `requestTimestamp` (±5 menit), dan signature Ed25519. |
| FR-ATT-07 | P0        | Risk score dihitung server; check-out menyimpan kategori **terburuk** dari check-in dan check-out.           |
| FR-ATT-08 | P0        | Semua penolakan dicatat di audit `ATTENDANCE_REJECTED` beserta alasan dan skor.                              |
| FR-ATT-09 | P1        | Hasil presensi menampilkan status, jam, nama shift, skor wajah, dan kategori risk.                           |
| FR-ATT-10 | P1        | Presensi yang sudah check-in tetapi belum check-out tampil sebagai "belum selesai" di beranda.               |


**Acceptance criteria**

- Tanpa jadwal → 422 `NO_SCHEDULE`.
- Request di luar skew waktu → 422 `STALE_REQUEST`.
- `requestId` yang sama dikirim dua kali → 409 `DUPLICATE_REQUEST`.
- Signature salah → 422 `INVALID_SIGNATURE`.
- Presensi sukses selalu punya baris audit `CHECK_IN`/`CHECK_OUT`.
- Check-out setelah check-in yang berisiko tidak menurunkan kategori risk.

### 6.6 Mode offline &amp; outbox (FR-OFF)


| ID        | Prioritas | Requirement                                                                                                               |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-OFF-01 | P0        | Punch yang gagal karena jaringan/timeout/429/5xx dimasukkan ke outbox terenkripsi.                                        |
| FR-OFF-02 | P0        | Outbox maksimal 10 entri; entri terlama dibuang saat melebihi batas.                                                      |
| FR-OFF-03 | P0        | Saat flush, setiap entri ditandatangani ulang dengan `requestId` dan timestamp baru.                                      |
| FR-OFF-04 | P0        | Respons 4xx (selain 429) dianggap verdict final: entri dihapus dan alasan dilaporkan.                                     |
| FR-OFF-05 | P1        | Outbox hanya untuk gangguan singkat; punch yang terlalu basi akan ditolak server dan dilaporkan, bukan diulang selamanya. |


**Acceptance criteria**

- Mode pesawat saat presensi → punch masuk antrean, UI memberi tahu.
- Koneksi kembali → outbox terkirim otomatis/berdasarkan aksi.
- Retry tidak membuat presensi ganda (guard `requestId` + `ALREADY_CHECKED_IN`).
- Entri korup di secure storage tidak membuat aplikasi crash.

### 6.7 Riwayat (FR-HIST)


| ID         | Prioritas | Requirement                                                            |
| ---------- | --------- | ---------------------------------------------------------------------- |
| FR-HIST-01 | P0        | Riwayat menampilkan tanggal, shift, check-in, check-out, status, risk. |
| FR-HIST-02 | P1        | Filter tanggal dan status check-in; pagination.                        |
| FR-HIST-03 | P1        | Detail presensi menampilkan alasan penolakan/koreksi bila ada.         |
| FR-HIST-04 | P1        | Data hanya milik karyawan yang login.                                  |


### 6.8 Jadwal (FR-SCH)


| ID        | Prioritas | Requirement                                                            |
| --------- | --------- | ---------------------------------------------------------------------- |
| FR-SCH-01 | P0        | `GET /schedules/me` mengembalikan roster pada rentang tanggal.         |
| FR-SCH-02 | P0        | Shift malam (mis. 23:00–07:00) dihitung satu shift pada tanggal mulai. |
| FR-SCH-03 | P1        | Tampilan mingguan dengan navigasi maju/mundur dan penanda hari ini.    |
| FR-SCH-04 | P1        | Status shift: akan datang, berlangsung, selesai, libur.                |


### 6.9 Koreksi (FR-COR)


| ID        | Prioritas | Requirement                                                                    |
| --------- | --------- | ------------------------------------------------------------------------------ |
| FR-COR-01 | P0        | Karyawan dapat mengajukan koreksi untuk presensi miliknya.                     |
| FR-COR-02 | P0        | Jenis: `MISSED_CHECK_IN`, `MISSED_CHECK_OUT`, `WRONG_TIME`, `TECHNICAL_ISSUE`. |
| FR-COR-03 | P0        | Minimal satu jam pengganti harus diisi; alasan wajib.                          |
| FR-COR-04 | P0        | Hanya satu koreksi PENDING per baris presensi.                                 |
| FR-COR-05 | P1        | Approval memperbarui presensi dan status secara atomik + audit.                |
| FR-COR-06 | P1        | Karyawan dapat membatalkan koreksi selama PENDING.                             |


### 6.10 Izin &amp; cuti (FR-LEAVE)


| ID          | Prioritas | Requirement                                                                                              |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------- |
| FR-LEAVE-01 | P0        | Jenis: `CUTI`, `SAKIT`, `IZIN`, `DINAS`, `LAINNYA`.                                                      |
| FR-LEAVE-02 | P0        | Rentang tanggal valid (`end >= start`) dan tidak boleh tumpang tindih dengan pengajuan PENDING/APPROVED. |
| FR-LEAVE-03 | P1        | Alasan wajib; status mengikuti alur PENDING/APPROVED/REJECTED/CANCELLED.                                 |
| FR-LEAVE-04 | P1        | Approval/reject hanya oleh atasan/admin yang berwenang.                                                  |
| FR-LEAVE-05 | P1        | Karyawan dapat membatalkan pengajuan selama PENDING.                                                     |


### 6.11 Profil &amp; privasi (FR-PROF / FR-PRIV)


| ID         | Prioritas | Requirement                                                                       |
| ---------- | --------- | --------------------------------------------------------------------------------- |
| FR-PROF-01 | P0        | Profil menampilkan NIP, nama, departemen, jabatan, status wajah, device, consent. |
| FR-PROF-02 | P1        | Ganti password dengan validasi minimal 8 karakter, huruf besar/kecil + angka.     |
| FR-PROF-03 | P1        | Bantuan IT dapat dihubungi dari layar perangkat.                                  |
| FR-PRIV-01 | P0        | Notice privasi versi `2026-10-01` ditampilkan sebelum consent.                    |
| FR-PRIV-02 | P0        | Consent dapat dicabut; presensi berikutnya ditolak `NO_CONSENT`.                  |
| FR-PRIV-03 | P0        | Karyawan dapat mengekspor datanya (tanpa template bytes) dan menghapus wajahnya.  |
| FR-PRIV-04 | P1        | Retensi sesi 30 hari dan wajah staf nonaktif 90 hari dijalankan berkala.          |


### 6.12 Device integrity (FR-INT)


| ID        | Prioritas | Requirement                                                                                                      |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| FR-INT-01 | P1        | Android mengirim Play Integrity token; iOS mengirim App Attest assertion.                                        |
| FR-INT-02 | P1        | Server memvalidasi expiry, package/bundle, dan verdict integritas.                                               |
| FR-INT-03 | P0        | `INTEGRITY_STRICT=false` (pilot): tanpa token, fallback ke `deviceCompromised`; token tidak valid tetap ditolak. |
| FR-INT-04 | P0        | `INTEGRITY_STRICT=true` (produksi): tanpa token = ditolak `INTEGRITY_FAILED`.                                    |
| FR-INT-05 | P2        | Verifikasi server-to-server ke Google/Apple (fase 2).                                                            |


> **Status:** `IntegrityRepository.getToken()` masih stub `null`. Karena itu
> produksi harus memakai `INTEGRITY_STRICT=false` sampai implementasi klien
> dan verifikasi server selesai.

### 6.13 API supervisor/admin (FR-ADM, tanpa UI)


| ID        | Prioritas | Requirement                                                           |
| --------- | --------- | --------------------------------------------------------------------- |
| FR-ADM-01 | P1        | CRUD karyawan, departemen, shift, roster, user, role.                 |
| FR-ADM-02 | P1        | Approve/reject koreksi, izin, dan penggantian perangkat.              |
| FR-ADM-03 | P1        | Laporan harian, bulanan, departemen, keterlambatan, cuti (Excel/PDF). |
| FR-ADM-04 | P1        | Audit log read-only dan ekspor.                                       |
| FR-ADM-05 | P1        | Revoke/activate device dan queue `needsReview`.                       |
| FR-ADM-06 | P2        | UI mobile untuk supervisor/admin.                                     |


---

## 7. Aturan Bisnis

### 7.1 Shift &amp; tanggal kerja


| Parameter                   | Default  | Arti                                |
| --------------------------- | -------- | ----------------------------------- |
| `startTime` / `endTime`     | —        | Jam shift (`HH:mm`)                 |
| `overnight`                 | otomatis | `true` bila jam selesai ≤ jam mulai |
| `gracePeriodMin`            | 15       | Toleransi keterlambatan             |
| `lateThresholdMin`          | 30       | Batas `LATE` → `VERY_LATE`          |
| `earlyCheckoutThresholdMin` | 15       | Toleransi pulang cepat              |


- `workDate` = tanggal **mulai** shift pada zona `HOSPITAL_TZ`
(default `Asia/Jakarta`).
- Shift malam 23:00 → 07:00 tetap satu baris presensi pada tanggal mulai.
- Contoh: check-in 23 Sep 22:50, check-out 24 Sep 07:05 = satu shift
23 September.

Perhitungan:

```text
lateMinutes = checkInAt − shiftStart
  ≤ gracePeriodMin                     → ON_TIME
  ≤ lateThresholdMin                   → LATE
  > lateThresholdMin                   → VERY_LATE

earlyMinutes = shiftEnd − checkOutAt
  ≤ earlyCheckoutThresholdMin          → NORMAL_CHECKOUT
  > earlyCheckoutThresholdMin          → EARLY_CHECKOUT
```

### 7.2 Risk engine

Bobot default (jumlah = 100, divalidasi saat boot):


| Sinyal            | Bobot | Syarat poin penuh               |
| ----------------- | ----- | ------------------------------- |
| Face match        | 45    | Cosine similarity × 45          |
| Liveness          | 20    | Attestation valid               |
| Trusted device    | 15    | Device ACTIVE milik karyawan    |
| Device integrity  | 15    | Token valid / tidak compromised |
| Request signature | 5     | Ed25519 valid                   |



| Skor    | Kategori | Keputusan                                                              |
| ------- | -------- | ---------------------------------------------------------------------- |
| 90–100  | LOW      | Presensi normal                                                        |
| 70–89   | MEDIUM   | Presensi diterima, `needsReview=true` untuk atasan                     |
| &lt; 70 | HIGH     | Tidak boleh menjadi presensi valid; gate individual menolak lebih dulu |


Semua bobot dan ambang dapat diubah lewat env dan **wajib dikalibrasi**
dengan data pilot (lihat `guides/CALIBRATION.md`).

### 7.3 Status &amp; transisi

**Presensi**

```text
Check-in  → ON_TIME | LATE | VERY_LATE
Check-out → NORMAL_CHECKOUT | EARLY_CHECKOUT
```

**Pengajuan (koreksi/izin/penggantian)**

```text
PENDING → APPROVED
PENDING → REJECTED
PENDING → CANCELLED (oleh pemohon)
```

**Perangkat**

```text
PENDING → ACTIVE → REVOKED
ACTIVE  → LOST
ACTIVE  → REPLACED
```

Aturan: satu karyawan = satu ACTIVE. Aktivasi/approval mencabut perangkat
lama beserta sesinya.

### 7.4 Idempotensi &amp; anti-replay

- `requestId` UUID v4 disimpan di `idempotency_keys`; duplikat → 409.
- `requestTimestamp` harus dalam ±`REQUEST_MAX_SKEW_MIN` (default 5 menit).
- Signature = Ed25519 atas `"<requestId>.<requestTimestamp>"`.
- Kunci idempotensi lama dibersihkan berkala.

---

## 8. Keamanan

### 8.1 Ancaman &amp; mitigasi


| Ancaman              | Mitigasi                                                |
| -------------------- | ------------------------------------------------------- |
| Titip absen          | Face match + liveness + device binding + audit          |
| Replay request       | `requestId` single-use + timestamp window + signature   |
| Request diubah       | Signature Ed25519 atas requestId + timestamp            |
| Device dicuri        | Perangkat terikat 1:1; bisa dicabut admin; sesi dicabut |
| Root/jailbreak       | Integrity token + `deviceCompromised`                   |
| Template wajah bocor | AES-256-GCM, akses terbatas, tidak pernah keluar API    |
| Brute force login    | Argon2id + lockout + rate limit per akun                |
| Enumeration          | Error login generik; rate limit                         |
| Manipulasi lokal     | Server menghitung ulang semua keputusan                 |
| Foto dipalsukan      | Liveness aktif/pasif + kualitas wajah                   |


### 8.2 Autentikasi &amp; otorisasi

- Argon2id untuk password.
- JWT HS256 dengan issuer/audience terikat; access token pendek.
- Refresh token rotasi + hash SHA-256 + revoke.
- RBAC: `EMPLOYEE`, `SUPERVISOR`, `ADMIN`, `SUPER_ADMIN`.
- Permission granular (`resource:action`) dan scope per rumah sakit/atasan.
- Server menentukan employee dari JWT, **bukan** dari body.

### 8.3 Perangkat

- Key pair Ed25519 dibuat di perangkat; private key di secure storage.
- Registrasi memakai challenge JWT berumur 5 menit.
- Presensi ditandatangani private key; server memverifikasi public key.
- Partial unique index mencegah dua ACTIVE per karyawan.

### 8.4 Wajah &amp; liveness

- Deteksi &amp; embedding 100% on-device.
- Server hanya menyimpan embedding terenkripsi.
- Raw image tidak pernah dikirim, tidak pernah disimpan.
- Liveness: challenge acak (kedip/toleh), evaluasi landmark, skor PAD.
- Attestation klien tidak dipercaya sendirian; digabung face match,
device, dan integrity.

### 8.5 Integritas request &amp; rate limit

- Helmet security headers.
- ValidationPipe: whitelist + forbid unknown fields.
- Global exception filter: error tak terduga tidak membocorkan stack.
- Rate limit per akun (fallback IP), shared via Redis saat multi-instance.
- `trust proxy` 1 hop di belakang nginx.

### 8.6 Audit

Aksi yang dicatat antara lain:

```text
LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT
DEVICE_REGISTERED / DEVICE_REVOKED / DEVICE_REPLACED
FACE_REGISTERED / FACE_VERIFICATION_FAILED
LIVENESS_FAILED
CHECK_IN / CHECK_OUT / ATTENDANCE_REJECTED
CORRECTION_CREATED / APPROVED / REJECTED
LEAVE_CREATED / APPROVED / REJECTED
ROLE_CHANGED / PASSWORD_CHANGED / ADMIN_ACTION
INTEGRITY_FAILED
```

Audit log append-only; user biasa tidak dapat mengubah/menghapus.

### 8.7 Infrastruktur

- Hanya nginx yang terbuka (80/443). Backend, PostgreSQL, Redis internal.
- TLS 1.2/1.3, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`.
- Secret produksi di `.env.production` (chmod 600), tidak di image.
- Boot gagal bila secret masih placeholder (`assertProductionEnv`).
- Backup harian + retensi 14 hari + checksum.
- Least-privilege PostgreSQL role.

---

## 9. Privasi &amp; UU PDP

### 9.1 Data yang diproses


| Data                                  | Tujuan                       | Dasar                                          | Retensi                                           |
| ------------------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Embedding wajah (192-d, terenkripsi)  | Verifikasi presensi          | Consent `BIOMETRIC_ATTENDANCE` + kontrak kerja | Sampai consent dicabut / 90 hari setelah nonaktif |
| Foto mentah                           | —                            | —                                              | **Tidak pernah dikirim/disimpan**                 |
| NIP, nama, email, departemen, jabatan | Identitas &amp; administrasi | Kontrak kerja                                  | Sesuai kebijakan SDM                              |
| Device ID, public key, nama perangkat | Binding &amp; keamanan       | Kepentingan sah                                | Selama perangkat aktif + audit                    |
| Presensi, shift, risk, audit          | Operasional &amp; bukti      | Kontrak kerja / kewajiban hukum                | Sesuai retensi SDM                                |
| Consent                               | Bukti kepatuhan              | UU PDP                                         | Selama + setelah pencabutan                       |


### 9.2 Hak subjek data

- Melihat notice privasi dan versi yang disetujui.
- Memberi/mencabut consent kapan saja.
- Mengekspor data (tanpa template bytes).
- Menghapus wajah (presensi berikutnya berhenti).
- Menanyakan retensi dan penghapusan ke DPO/SDM.

### 9.3 Aturan consent

- Registrasi wajah dan presensi **ditolak** tanpa consent aktif.
- Pencabutan tidak menghapus riwayat presensi yang sudah terjadi.
- Notice wajib direview DPO sebelum produksi (`guides/DPO_REVIEW.md`).

---

## 10. Model Data (ringkas)


| Tabel                                                    | Isi penting                                              |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `hospitals`                                              | Identitas rumah sakit                                    |
| `departments`                                            | Departemen/unit                                          |
| `users`                                                  | Akun login, hash password, TOTP, lockout                 |
| `employees`                                              | NIP, nama, departemen, jabatan, atasan, status           |
| `roles`, `permissions`, `role_permissions`, `user_roles` | RBAC                                                     |
| `face_templates`                                         | Embedding terenkripsi, algoritma, versi, kualitas        |
| `devices`                                                | Public key, installation id, platform, status, last seen |
| `device_change_requests`                                 | Pengajuan penggantian + review                           |
| `shifts`                                                 | Jam, overnight, grace, late, early checkout              |
| `employee_schedules`                                     | Roster per karyawan per `workDate`                       |
| `attendance`                                             | Check-in/out, status, risk, device, schedule             |
| `correction_requests`                                    | Koreksi + review                                         |
| `leave_requests`                                         | Izin/cuti + review                                       |
| `audit_logs`                                             | Append-only                                              |
| `sessions`                                               | Refresh token hash, expiry, revoke                       |
| `idempotency_keys`                                       | Anti-replay                                              |
| `consents`                                               | Consent per purpose + versi notice                       |
| `totp_recovery_codes`                                    | Kode pemulihan MFA                                       |


Constraint penting:

- `employees.employee_no` unik.
- `face_templates.employee_id` unik (satu template aktif).
- `employee_schedules (employee_id, work_date)` unik.
- `attendance.schedule_id` unik (satu presensi per roster).
- Satu device ACTIVE per karyawan (partial unique index).
- `consents (employee_id, purpose)` unik.

---

## 11. API Contract

Base URL: `https://<domain>/api/v1`
Autentikasi: `Authorization: Bearer <accessToken>`
Content-Type: `application/json`

### 11.1 Konvensi

- Error bisnis: HTTP 422 dengan body
`{ "reason": "...", "message": "...", "riskScore": 0, "riskCategory": "LOW" }`.
- Duplikat: 409. Tidak ditemukan: 404. Bukan pemilik: 403.
- Rate limit: 429 dengan `Retry-After`.
- Semua waktu ISO-8601 UTC.

### 11.2 Endpoint mobile


| Method | Path                          | Fungsi                                   |
| ------ | ----------------------------- | ---------------------------------------- |
| POST   | `/auth/login`                 | Login, kembalikan access + refresh token |
| POST   | `/auth/refresh`               | Rotasi refresh token                     |
| POST   | `/auth/logout`                | Cabut sesi                               |
| GET    | `/auth/me`                    | Profil akun + role                       |
| POST   | `/auth/change-password`       | Ganti password                           |
| POST   | `/auth/totp/verify`           | Verifikasi TOTP                          |
| POST   | `/auth/totp/recover`          | Pemulihan TOTP                           |
| GET    | `/devices/register-challenge` | Nonce registrasi (5 menit)               |
| POST   | `/devices/register`           | Daftarkan perangkat + public key         |
| GET    | `/devices/me`                 | Perangkat milik akun                     |
| POST   | `/devices/:id/heartbeat`      | Update last seen                         |
| GET    | `/device-change/me`           | Status pengajuan penggantian             |
| POST   | `/device-change`              | Ajukan penggantian                       |
| POST   | `/device-change/:id/cancel`   | Batalkan pengajuan                       |
| GET    | `/face/status`                | Status template wajah                    |
| POST   | `/face/register`              | Registrasi template wajah                |
| GET    | `/privacy/notice`             | Notice privasi aktif                     |
| POST   | `/privacy/consent`            | Beri/cabut consent                       |
| GET    | `/privacy/consents/me`        | Riwayat consent                          |
| GET    | `/privacy/export/me`          | Ekspor data pribadi                      |
| DELETE | `/privacy/face/me`            | Hapus wajah                              |
| POST   | `/attendance/check-in`        | Check-in                                 |
| POST   | `/attendance/check-out`       | Check-out                                |
| GET    | `/attendance/me`              | Riwayat presensi sendiri                 |
| GET    | `/attendance/:id`             | Detail presensi                          |
| GET    | `/schedules/me`               | Jadwal sendiri                           |
| GET    | `/corrections/me`             | Koreksi sendiri                          |
| POST   | `/corrections`                | Ajukan koreksi                           |
| POST   | `/corrections/:id/cancel`     | Batalkan koreksi                         |
| GET    | `/leaves/me`                  | Izin/cuti sendiri                        |
| POST   | `/leaves`                     | Ajukan izin/cuti                         |
| POST   | `/leaves/:id/cancel`          | Batalkan izin/cuti                       |
| GET    | `/employees/me`               | Data karyawan sendiri                    |
| GET    | `/health`                     | Readiness + status DB                    |
| GET    | `/health/live`                | Liveness probe                           |


### 11.3 Endpoint supervisor/admin (tanpa UI)

```text
GET/POST/PATCH/DELETE  /employees, /departments, /users
POST                   /employees/:id/deactivate
POST                   /users/:id/reset-password
POST/PATCH/DELETE      /shifts, /schedules
POST                   /devices/:id/revoke | activate | mark-lost
POST                   /device-change/:id/approve | reject
POST                   /corrections/:id/approve | reject
POST                   /leaves/:id/approve | reject
GET                    /attendance (filter admin)
GET                    /attendance/:id
GET                    /audit, /audit/actions, /audit/export
GET                    /reports/daily | monthly | department | late | leaves
GET                    /supervisor/team | team/:id | attendance | summary
POST                   /privacy/retention/run (SUPER_ADMIN)
```

### 11.4 Contoh payload check-in

```json
{
  "deviceId": "dev_123",
  "faceEmbedding": [0.0123, -0.0456, "... 192 nilai ..."],
  "liveness": {
    "passed": true,
    "challenges": ["BLINK", "TURN_LEFT"],
    "completedAt": "2026-10-20T00:31:20.000Z",
    "score": 0.96,
    "mode": "active",
    "padScore": 0.91
  },
  "requestId": "0f8fad5b-d9cb-469f-a165-70867728950e",
  "requestTimestamp": "2026-10-20T00:31:25.000Z",
  "signature": "base64-ed25519-signature",
  "deviceCompromised": false,
  "integrityToken": "optional-jwt"
}
```

### 11.5 Kode alasan penolakan


| Kode                        | Arti                                 |
| --------------------------- | ------------------------------------ |
| `NO_CONSENT`                | Consent biometrik belum/tidak aktif  |
| `NO_SCHEDULE`               | Tidak ada jadwal pada tanggal kerja  |
| `ALREADY_CHECKED_IN`        | Masih ada presensi terbuka           |
| `NO_OPEN_ATTENDANCE`        | Check-out tanpa check-in             |
| `NO_FACE_TEMPLATE`          | Wajah belum terdaftar                |
| `FACE_MISMATCH`             | Skor wajah di bawah ambang           |
| `LIVENESS_FAILED`           | Liveness tidak lolos                 |
| `LIVENESS_STALE`            | Attestation kedaluwarsa              |
| `LIVENESS_EMPTY`            | Challenge/skor tidak ada             |
| `LIVENESS_MODE_UNSUPPORTED` | Mode tidak dikenal                   |
| `DEVICE_NOT_ACTIVE`         | Perangkat tidak aktif                |
| `INVALID_SIGNATURE`         | Signature perangkat salah            |
| `STALE_REQUEST`             | Timestamp di luar jendela            |
| `DUPLICATE_REQUEST`         | `requestId` sudah dipakai            |
| `INTEGRITY_FAILED`          | Verifikasi integritas gagal          |
| `DEVICE_COMPROMISED`        | Perangkat terindikasi root/jailbreak |


---

## 12. Non-Functional Requirements

### 12.1 Performa


| Aspek                            | Target                           |
| -------------------------------- | -------------------------------- |
| Deteksi wajah + liveness         | ≤ 2 detik di perangkat mid-range |
| Total presensi (jaringan normal) | ≤ 5 detik                        |
| API p95                          | ≤ 500 ms (di luar biometrik)     |
| Cold start aplikasi              | ≤ 3 detik                        |
| Ukuran APK                       | Wajar untuk model 5 MB + TFLite  |


### 12.2 Kapasitas &amp; ketersediaan

- 500 karyawan, puncak ~150 request/menit saat pergantian shift.
- Backend stateless; dapat di-scale horizontal (`--scale backend=3`).
- Rate limit dan lockout berbagi state via Redis.
- Target uptime 99,5% pada jam operasional.

### 12.3 Kompatibilitas


| Platform  | Minimum                               |
| --------- | ------------------------------------- |
| Android   | 5.0 (API 21), arm64-v8a + armeabi-v7a |
| iOS       | 15.5                                  |
| Orientasi | Portrait (utama)                      |
| Koneksi   | HTTPS; HTTP hanya untuk development   |


### 12.4 UX &amp; aksesibilitas

- Bahasa Indonesia.
- Target sentuh ≥ 48 dp, kontras WCAG AA.
- Pesan error menjelaskan langkah perbaikan, bukan kode mentah.
- Kamera memberi panduan posisi wajah dan pencahayaan.
- Layar sempit (≤ 360 dp) tidak boleh overflow.

### 12.5 Observability

- `GET /health` (DB) dan `GET /health/live` (tanpa DB).
- Log terstruktur ke stdout, rotasi Docker.
- Audit untuk semua aksi penting.
- Alert minimal: health turun, 5xx &gt; 1%, antrean `needsReview` menumpuk.

---

## 13. Pengujian &amp; Kriteria Terima

### 13.1 Lapisan pengujian


| Lapisan            | Cakupan                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| Unit backend       | Shift math, risk, liveness, signature, DTO, config, privacy                      |
| E2E backend        | Auth, device, face, attendance, correction, leave, audit, reports, TOTP, privacy |
| E2E DB nyata       | Login Argon2, lockout, rotasi refresh token (PostgreSQL)                         |
| Unit/widget mobile | Liveness, eye geometry, kualitas wajah, outbox, retry, model, password policy    |
| Security test      | 13 skenario serangan (replay, signature, device, integrity, dsb.)                |
| Device farm        | HP bersih, bukan root/emulator, kalibrasi ambang                                 |


### 13.2 Definition of Done

- [ ] `flutter analyze` bersih.
- [ ] `flutter test` hijau.
- [ ] `npm run lint`, `npm test`, `npm run test:e2e` hijau.
- [ ] Smoke API 4/4 di staging.
- [ ] Presensi sukses di HP fisik Android API 21 dan versi terbaru.
- [ ] Presensi sukses di iPhone (minimal satu device nyata).
- [ ] Ambang wajah/risk terkalibrasi dan tercatat.
- [ ] DPO menandatangani review privasi.
- [ ] Device farm bersih; tidak ada akun/template uji di produksi.
- [ ] Backup + restore test terdokumentasi.
- [ ] `INTEGRITY_STRICT` sesuai status implementasi klien.

---

## 14. Status Implementasi &amp; Roadmap

### 14.1 Fase 1 — selesai (baseline)


| Modul                                           | Status             |
| ----------------------------------------------- | ------------------ |
| Auth, refresh rotation, lockout, ganti password | Selesai            |
| Device binding, challenge, revoke, replacement  | Selesai            |
| Face registration + enkripsi template           | Selesai            |
| Liveness aktif + pasif                          | Selesai            |
| Attendance engine + risk + audit                | Selesai            |
| Outbox + retry + cancel                         | Selesai            |
| Riwayat, jadwal, koreksi, izin/cuti             | Selesai            |
| Privasi (consent/export/erase/retensi)          | Selesai            |
| API supervisor/admin/report/audit               | Selesai (tanpa UI) |
| Restrukturisasi mobile-only                     | Selesai            |


### 14.2 Fase 2 — berikutnya


| Item                              | Alasan                                   |
| --------------------------------- | ---------------------------------------- |
| UI mobile supervisor/admin        | Saat ini approval hanya lewat API        |
| Play Integrity / App Attest penuh | Stub klien + verifikasi server-to-server |
| Kalibrasi ambang produksi         | Default belum diukur                     |
| Push notification                 | Belum ada notifikasi approval/pengingat  |
| Liveness iOS final                | Ambang landmark masih provisional        |
| Offline lebih lama                | Outbox saat ini untuk gangguan singkat   |


---

## 15. Risiko &amp; Mitigasi


| Risiko                           | Dampak                        | Mitigasi                                              |
| -------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Ambang wajah belum dikalibrasi   | FAR/FRR tidak sesuai          | Kalibrasi ≥ 50 genuine + 50 impostor per kelas device |
| Liveness klien bisa dimodifikasi | Attestation palsu             | Face match + device + integrity + audit               |
| Integrity masih stub             | Root device lolos di mode lax | `strict=false` sampai fase 2; monitoring audit        |
| Approval admin tanpa UI          | Operasional macet             | Integrasi API sementara / prioritaskan UI fase 2      |
| Sinyal buruk di basement         | Presensi gagal                | Outbox + retry; komunikasi batas waktu                |
| HP lama (API 21)                 | ML Kit butuh Play Services    | Pesan eksplisit + daftar device yang didukung         |
| Kebocoran template               | Risiko privasi tinggi         | AES-256-GCM, akses terbatas, audit, retensi           |


---

## 16. Keputusan Terbuka

1. **UI admin/supervisor**: mobile app terpisah, role-aware di app yang sama,
 atau integrasi SIMRS?
2. **Kebijakan cuti**: kuota dan approval berlapis belum dimodelkan.
3. **Push notification**: perlu atau cukup polling saat app dibuka?
4. **Integrity produksi**: kapan `INTEGRITY_STRICT=true` diaktifkan?
5. **Ambang risk**: perlu penurunan bobot face setelah kalibrasi?
6. **Retensi audit**: berapa tahun sesuai kebijakan SDM/legal?

---

## 17. Lampiran

### 17.1 Struktur repo

```text
mobile/       Flutter app (Android + iOS)
backend/      NestJS API, Prisma, E2E
docs/         PRD, panduan, mockup
nginx/        reverse proxy API
scripts/      operasional host/DB/smoke
```

### 17.2 Environment penting


| Variabel                       | Default      | Fungsi                      |
| ------------------------------ | ------------ | --------------------------- |
| `FACE_MATCH_THRESHOLD`         | 0.5          | Ambang cosine similarity    |
| `LIVENESS_MAX_AGE_MIN`         | 10           | Kesegaran attestation       |
| `REQUEST_MAX_SKEW_MIN`         | 5            | Jendela timestamp           |
| `RISK_W_FACE`                  | 45           | Bobot wajah                 |
| `RISK_W_LIVENESS`              | 20           | Bobot liveness              |
| `RISK_W_DEVICE`                | 15           | Bobot device                |
| `RISK_W_INTEGRITY`             | 15           | Bobot integrity             |
| `RISK_W_SIGNATURE`             | 5            | Bobot signature             |
| `RISK_LOW_MIN`                 | 90           | Batas LOW                   |
| `RISK_MEDIUM_MIN`              | 70           | Batas MEDIUM                |
| `HOSPITAL_TZ`                  | Asia/Jakarta | Zona tanggal kerja          |
| `RETENTION_SESSION_DAYS`       | 30           | Retensi sesi                |
| `RETENTION_FACE_INACTIVE_DAYS` | 90           | Retensi wajah staf nonaktif |
| `INTEGRITY_STRICT`             | false        | Mode integritas             |


### 17.3 Glosarium


| Istilah       | Arti                                              |
| ------------- | ------------------------------------------------- |
| Embedding     | Vektor 192 angka hasil model wajah                |
| Liveness      | Bukti subjek adalah orang hidup, bukan foto/video |
| PAD           | Presentation Attack Detection                     |
| Binding       | Pengikatan 1 karyawan ke 1 perangkat              |
| Outbox        | Antrean punch terenkripsi saat jaringan gagal     |
| `workDate`    | Tanggal mulai shift pada zona rumah sakit         |
| `needsReview` | Presensi MEDIUM risk yang perlu ditinjau atasan   |
| DPO           | Data Protection Officer                           |
| UU PDP        | UU No. 27/2022 tentang Pelindungan Data Pribadi   |


---

**Akhir dokumen.**