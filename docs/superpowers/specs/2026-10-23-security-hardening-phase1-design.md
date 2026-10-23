# Design — Security Hardening Fase 1 (P0)

- Tanggal: 2026-10-23
- Revisi: 2 (setelah builder check)
- Status: menunggu persetujuan
- Ruang lingkup: 8 temuan P0 hasil audit keamanan
- Keputusan produk: **A** (interim attestation), **C** (registrasi + verifikasi email + approval), **B** (punch offline terlambat diterima)

---

## 1. Intent dan alasan

Sistem presensi ini sudah lengkap secara fitur, tetapi rantai kepercayaan intinya masih
bertumpu pada nilai yang dikirim klien: `liveness.passed`, `deviceCompromised`, dan
`qualityScore`. Tiga jalur fraud berikut terbuka:

1. Klien modifikasi mengaku lulus liveness dan perangkat bersih.
2. Pemegang akun mengganti template wajah menjadi wajah orang lain, lalu orang itu absen.
3. Siapa pun mendaftar akun publik dan langsung aktif.

Fase 1 menutup jalur-jalur itu, memperbaiki isolasi tenant dan self-approval, serta
membuat presensi offline benar-benar aman dan tidak kehilangan data.

Yang **tidak** diselesaikan di fase ini: verifikasi Play Integrity/App Attest
server-to-server. Fase 1 hanya menyiapkan kontraknya (nonce + payload bertanda tangan)
dan menghapus klaim keamanan yang belum terbukti.

---

## 2. Goals, non-goals, anti-goals

### Goals

- Punch hanya diterima jika payload ditandatangani utuh dan memakai nonce server yang sah.
- Template wajah tidak dapat diganti tanpa faktor autentikasi tambahan.
- Akun baru tidak aktif sampai email terverifikasi **dan** disetujui admin.
- Tidak ada role yang bisa menyetujui pengajuannya sendiri.
- Data presensi/laporan/handover tidak menyeberang rumah sakit.
- Device baru butuh persetujuan admin, dengan batas jumlah device aktif yang jelas.
- Punch offline bertahan hingga 24 jam, tercatat waktu kejadiannya, dan selalu masuk review.
- Retry tidak membuat data ganda dan tidak membuang data secara diam-diam.

### Non-goals

- Attestation perangkat nyata (fase 2).
- Liveness yang divalidasi model di server (fase 2).
- Web dashboard.
- Geofence.
- Perbaikan P1/P2 lain (throttle per IP, TOTP re-auth, retensi terjadwal, dll).

### Anti-goals (dianggap gagal walau fitur jalan)

- Presensi sah hilang karena antrean offline dibuang tanpa pemberitahuan.
- Karyawan shift malam tidak bisa check-out karena tanggal kerja berbeda.
- Karyawan tidak bisa absen karena lupa check-out hari sebelumnya.
- Perubahan ini memaksa admin memberi SUPER_ADMIN ke semua operator karena seed salah.
- Data lama rusak saat migrasi.

---

## 3. Constraints

- Stack tidak berubah: NestJS 12, Prisma 6, PostgreSQL, Flutter 3.22.
- Redis sudah tersedia; nonce dan rate limit boleh memakainya, tetapi nonce tetap harus
  berfungsi saat offline → disimpan di perangkat, bukan di Redis per request.
- Email belum ada infrastrukturnya. Fase 1 menambahkan SMTP (nodemailer).
- Aplikasi mobile belum beredar produksi → **hard cutover** diperbolehkan.
- Tidak menambah SaaS baru selain SMTP.
- Semua perubahan harus punya test; `npm test`, `npm run test:e2e`, `flutter test` hijau.
- PRD tetap sumber kebenaran; design ini menambah kontrol, bukan mengubah alur bisnis.

---

## 4. Pendekatan yang dipilih

### 4.1 Attestation — opsi A (interim)

**Dipilih:** nonce server + tanda tangan payload + penurunan klaim.

Alternatif yang dibuang:

- **Full Play Integrity/App Attest sekarang.** Paling kuat, tetapi butuh Google Cloud
  project, service account, App Attest (akun Apple Developer berbayar), dan mengubah
  kontrak mobile. Menunda seluruh P0 lain 3–5 hari.
- **Tetap seperti sekarang.** Ditolak: klaim keamanan tidak benar.

Konsekuensi yang diterima: klien modifikasi masih bisa mengaku lulus liveness. Mitigasi
sementara: punch offline selalu `needsReview`, poin integritas tidak lagi gratis, dan
UI/dokumentasi tidak lagi mengklaim root detection sebagai kontrol.

### 4.2 Registrasi — opsi C (verifikasi email + approval)

**Dipilih:** endpoint publik dipertahankan, tetapi akun lahir `isActive=false`,
`emailVerifiedAt=null`; aktivasi butuh kode email + persetujuan SUPER_ADMIN.

Alternatif yang dibuang:

- **Hapus registrasi.** Aman, tetapi onboarding massal RS jadi manual dan user memilih C.
- **Undangan bertoken.** Mirip C tetapi menambah tabel undangan dan alur admin ganda.

Konsekuensi: butuh SMTP produksi dan template email; pendaftar bisa memilih unit yang
salah, jadi layar approval admin wajib menampilkan unit dan bisa mengubahnya.

### 4.3 Offline — opsi B (punch terlambat diterima)

**Dipilih:** punch disimpan dengan `captureAt` + `queuedAt` bertanda tangan, diterima
hingga 24 jam, selalu `needsReview`, status masuk/pulang dihitung dari `captureAt`.

Alternatif yang dibuang:

- **Tolak >10 menit.** Jujur, tetapi user memilih dukungan offline nyata.
- **Hapus outbox.** Menghilangkan fitur yang sudah ada.

Konsekuensi: `captureAt` tetap berasal klien (dibatasi 24 jam ke belakang dan 2 menit ke
depan). Ini risiko yang diterima dan dikompensasi dengan review + audit + fase 2.

---

## 5. Desain rinci

### 5.1 Kontrak punch dan nonce pool

**Kontrak baru**

```
POST /attendance/challenge   (JWT, per device)
  → { nonces: string[10], expiresAt }

POST /attendance/check-in | check-out
  {
    signatureVersion: "v1",
    deviceId, faceEmbedding[192], liveness,
    requestId, captureAt, queuedAt?, challengeNonce,
    signature, deviceCompromised, integrityToken?
  }
```

**Pesan yang ditandatangani (v1)**

```
v1|check-in|deviceId|requestId|captureAt|queuedAt|challengeNonce|
sha256(embedding)|sha256(liveness)
```

- `embedding`: 192 nilai `toStringAsFixed(6)` digabung `,`.
- `liveness`: field tetap berurutan `mode,passed,completedAt,score,padScore,challenges`,
  angka `toStringAsFixed(6)`, `challenges` digabung `,`.
- `queuedAt` string kosong jika punch online.
- Kanonikalisasi ada di satu file per sisi (`attendance/helpers.ts`,
  `attendance_repository.dart`) dan diuji dengan vektor yang sama.
- `requestTimestamp` dihapus; waktu kejadian diwakili `captureAt`.

**Nonce pool (menjawab keterbatasan offline)**

- `POST /attendance/challenge` mengembalikan **10 nonce sekali pakai** dengan TTL 24 jam.
- Mobile menyimpan pool di secure storage dan mengambil batch baru saat app start/resume
  bila stok < 3.
- Saat capture, satu nonce dikonsumsi lokal dan dimasukkan ke payload + outbox.
- Server mengonsumsi nonce secara atomik (`IdempotencyKey` key `nonce:<jti>`).
- Jika stok habis dan perangkat offline, capture diblokir dengan pesan jelas
  ("Buka aplikasi saat ada koneksi untuk menyiapkan sesi presensi"). Ini disengaja:
  lebih baik menolak di depan daripada menerima punch tanpa bukti.
- Pool yang tidak terpakai kedaluwarsa bersamaan dengan JWT-nya.

**Arti nonce vs idempotensi**

- Nonce mencegah pemakaian ulang payload yang ditandatangani.
- `requestId` mencegah duplikasi data. Keduanya diperlukan dan diuji terpisah.

### 5.2 Penggantian template wajah

- `POST /face/register` menerima `currentPassword?`.
- Jika sudah ada template:
  - wajib `currentPassword` valid (Argon2 verify);
  - hitung cosine(template lama, baru); simpan `replaceSimilarity` di audit;
  - similarity hanya sinyal audit + peringatan, bukan penolak (penampilan sah bisa
    berubah); gerbang tetap password;
  - throttle 5/menit; audit `FACE_UPDATED` memuat `similarity`, `ip`, `deviceId`.
- Jika belum ada template: alur lama (consent + quality), audit `FACE_REGISTERED`.
- Password salah → `403 REAUTH_FAILED`; template tidak berubah.
- Reset darurat: admin reset password (`/users/:id/reset-password`), lalu user enroll ulang.

### 5.3 Registrasi, verifikasi email, approval

**Model data**

```prisma
model User {
  emailVerifiedAt DateTime? @map("email_verified_at")
  approvedAt      DateTime? @map("approved_at")
  approvedById    String?   @map("approved_by_id")
  emailCodes      EmailVerificationCode[]
}

model EmailVerificationCode {
  id         String    @id @default(cuid())
  userId     String    @map("user_id")
  codeHash   String    @map("code_hash")   // HMAC-SHA256(secret, code)
  attempts   Int       @default(0)
  expiresAt  DateTime  @map("expires_at")
  consumedAt DateTime? @map("consumed_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
}
```

- `isActive` tetap gerbang login; akun baru `isActive=false` sampai approval.
- Kode 6 digit, TTL 15 menit, maksimum 5 percobaan, single-use.
- Disimpan sebagai HMAC (bukan plaintext, bukan Argon2 — kode berumur pendek dan
  verifikasi harus cepat).

**Alur**

1. `POST /auth/register` (publik, throttle 5/jam/IP):
   - **email belum ada** → buat User (`isActive=false`), Employee, role EMPLOYEE dalam
     transaksi; kirim kode.
   - **email sudah ada dan belum terverifikasi** → **jangan ubah apa pun** (password,
     nama, unit tetap milik pendaftar pertama). Kirim email "akun menunggu verifikasi;
     gunakan Kirim Ulang"; balas 202 generik.
   - **email sudah terverifikasi** → tidak kirim apa pun; balas 202 generik.
   - Selalu `202 { message: 'Cek email untuk kode verifikasi' }` (anti-enumerasi).
2. `POST /auth/verify-email { email, code }`:
   - sukses → `emailVerifiedAt=now`; balas `{ status: 'PENDING_APPROVAL' }`;
   - gagal → `400 INVALID_CODE`, tambah `attempts`.
3. `POST /auth/resend-verification { email }` (throttle 3/15 menit): balas 202 generik.
4. `POST /users/:id/approve` (SUPER_ADMIN + `user:manage`):
   - syarat `emailVerifiedAt != null`;
   - set `approvedAt`, `approvedById`, `isActive=true`;
   - audit `USER_APPROVED`.
5. Login:
   - password salah → 401 generik (termasuk email tak dikenal);
   - password benar + `emailVerifiedAt=null` → `403 EMAIL_NOT_VERIFIED`;
   - password benar + belum approved → `403 PENDING_APPROVAL`;
   - password benar + aktif → token seperti sekarang.

**Pemulihan email salah / tidak terkirim**

- `PATCH /users/:id` (SUPER_ADMIN + `user:manage`) boleh mengubah `email` **hanya** bila
  `emailVerifiedAt=null`; audit `USER_EMAIL_CHANGED`.
- `POST /users/:id/verify-email-override` (SUPER_ADMIN, alasan wajib, audit
  `USER_EMAIL_OVERRIDDEN`) untuk kasus email tidak bisa diakses; tetap butuh approval.

**Email**

- `nodemailer` + SMTP env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`.
- `EmailService` diabstraksi agar test memakai fake.
- Dev tanpa SMTP: hanya jika `NODE_ENV !== 'production'` **dan**
  `DEV_EMAIL_LOG_CODES=true`, kode ditulis ke log level warn. Produksi menolak boot tanpa
  SMTP (ditambahkan ke `security.ts` + `env-check.mjs`).
- Template teks sederhana; tidak ada tautan web (kode dimasukkan di app).

**Seed**

- `seed.mjs` dan `seed.prod.mjs` menambahkan `user:manage` ke SUPER_ADMIN.
- `seed.mjs` menolak jalan bila `NODE_ENV=production`.
- `DEPLOY.md` mengganti instruksi ke `seed.prod.mjs`.

### 5.4 Larangan self-approval

Berlaku untuk `corrections`, `leaves`, dan `attendance review`:

- resolve employee milik reviewer;
- jika `target.employeeId === reviewerEmployeeId` → `403 SELF_APPROVAL_FORBIDDEN`;
- SUPER_ADMIN juga diblokir; darurat lewat akun SUPER_ADMIN kedua;
- percobaan dicatat `*_SELF_APPROVAL_BLOCKED` di audit.

### 5.5 Isolasi tenant

- `GET /reports/employee/:id`: non-SUPER_ADMIN wajib
  `target.department.hospitalId === scope.hospitalId`; jika tidak → 404 (tidak
  membocorkan keberadaan).
- `GET /hospitals`: ADMIN hanya hospital-nya; SUPER_ADMIN semua.
- Handover:
  - `toEmployeeId` wajib satu hospital dengan pengirim (department sama lebih baik);
  - penerima hanya bisa membaca bila `handover.hospitalId === hospital penerima`;
  - SUPERVISOR tetap hanya untuk timnya;
  - `SUPER_ADMIN` mendapat akses global (memperbaiki list kosong).
- Semua jalur memakai `resolveHospitalScope`; test e2e lintas RS.

### 5.6 Kebijakan device (direvisi)

Repo ini **sengaja** beralih ke multi-device (migrasi `20261021000000_multi_device`:
HP pribadi + tablet bangsal). Fase 1 tidak mengembalikan aturan satu-device; yang
ditutup adalah **device tanpa persetujuan**.

- Device pertama karyawan → `ACTIVE`.
- Device berikutnya → `PENDING`, wajib diaktifkan admin.
- Batas device aktif: `MAX_ACTIVE_DEVICES_PER_EMPLOYEE` (default **2**).
- Aktivasi device saat batas tercapai → `409 DEVICE_LIMIT_REACHED`; admin harus
  mencabut salah satu dulu. Tidak ada auto-revoke diam-diam.
- Migrasi data: karyawan dengan device `ACTIVE` melebihi batas → pertahankan N device
  dengan `lastSeenAt` terbaru, sisanya `PENDING` + audit `DEVICE_DEMOTED`. **Bukan**
  `REVOKED`, agar tidak memutus perangkat yang sah tanpa keputusan admin.
- Tidak memakai partial unique index (batas >1); penegakan di service + transaksi.
- Registrasi device mengembalikan status; mobile menampilkan layar "menunggu persetujuan".
- `activate()` menolak bila batas tercapai dan mencatat audit.

### 5.7 Presensi offline dan idempotensi

**Model Attendance**

```prisma
captureAt DateTime? @map("capture_at")  // waktu scan wajah
syncedAt  DateTime  @default(now()) @map("synced_at")
offline   Boolean   @default(false)
staleAt   DateTime? @map("stale_at")    // penutupan otomatis record menggantung
```

- `checkInAt`/`checkOutAt` diisi `captureAt` → laporan & payroll memakai waktu kejadian.
- Migrasi: `capture_at = check_in_at`, `synced_at = created_at`, `offline = false`.

**Validasi waktu**

- Online: `now - captureAt <= LIVENESS_MAX_AGE_MIN` (10 menit).
- Offline (`queuedAt` ada):
  - `liveness.completedAt` harus sama dengan `captureAt` (±2 menit);
  - `now - captureAt <= OFFLINE_MAX_AGE_HOURS` (default 24 jam);
  - `captureAt <= now + 2 menit`;
  - `queuedAt` harus ≥ `captureAt` dan ≤ `now`;
  - semua field di atas ada di pesan yang ditandatangani.
- `captureAt` masa depan > 2 menit → `CAPTURE_IN_FUTURE`.
- Di luar batas → `LIVENESS_STALE` (alasan ini masuk daftar drop definitif, lihat bawah).

**Tanggal kerja dan shift malam**

- **Check-in:** `workDate` = tanggal `captureAt` di zona `Asia/Jakarta`.
- **Check-out:** tidak menghitung ulang `workDate`; gunakan `workDate` dan `shift` dari
  record terbuka yang cocok. Pencarian record terbuka melihat `captureAt` dan **satu hari
  sebelumnya** agar shift 23:00 → 07:00 tertangani.
- Untuk check-in, record terbuka yang `workDate`-nya hari ini atau kemarin (shift lintas
  hari) dianggap "sudah check-in". Record lebih lama dari 24 jam ditutup otomatis
  (lihat bawah).
- Evaluasi status masuk/pulang tetap memakai `captureAt` dan shift record tersebut.

**Record menggantung**

- Check-in baru menutup record terbuka > 24 jam dengan:
  `staleAt=now`, `needsReview=true`, `notes=AUTO_CLOSED_PREVIOUS_DAY`, `checkOutAt` tetap
  `null`.
- Record dengan `staleAt != null` tidak dianggap "terbuka" dan tidak menghalangi check-in.
- Laporan menampilkan checkout kosong (jujur: punch hilang), supervisor menindak lewat
  koreksi. Tidak ada waktu checkout palsu.
- Audit `ATTENDANCE_AUTO_STALE`.

**Dampak risiko**

- Offline → `offline=true`, minimal `riskCategory=MEDIUM`, `needsReview=true`,
  `notes` memuat `OFFLINE_LATE_SYNC`.
- `HIGH` juga masuk antrean (`needsReview` untuk MEDIUM dan HIGH).
- Integritas hanya memberi poin bila token terverifikasi; fase 1 selalu `false`.

**Idempotensi**

- `IdempotencyKey` menyimpan `employeeId`, `action`, `responseJson`, `createdAt`, `kind`
  (`request` | `nonce`)`.
- Retry `requestId` sama → kembalikan respons tersimpan (200), bukan 409.
- Retensi key:
  - `request:<id>` disimpan **25 jam** (24 jam offline + 1 jam buffer) supaya retry
    setelah koneksi pulih tetap idempoten.
  - `nonce:<jti>` disimpan sampai `exp` JWT (24 jam).
  - Purge lewat job/endpoint retensi, bukan `deleteMany` di jalur panas.
- Bila request gagal definitif **sebelum** attendance commit: hapus key `request:` dan
  `nonce:` agar user bisa memperbaiki lalu mengirim ulang dengan nonce yang sama.
- Bila commit berhasil: kedua key dipertahankan sampai TTL.
- Bila proses mati di antara klaim dan commit: nonce dianggap terpakai; klien mengambil
  nonce baru. Tidak ada data ganda.

**Mobile outbox**

- `OutboxEntry` bertambah: `requestId`, `captureAt`, `queuedAt`, `challengeNonce`,
  `signatureVersion`, `attempts`, `lastError`.
- `requestId` dibuat **saat capture** dan dipakai ulang setiap retry.
- Migrasi JSON: entri lama tanpa field ini ditandai `needsAction`, tidak dikirim.
- Kapasitas 50; saat penuh, berhenti menerima + pesan; tidak membuang entri lama.
- Flush dipicu app start, resume, dan konektivitas pulih.
- Urutan FIFO berdasarkan `queuedAt`; berhenti pada error jaringan pertama.
- Status per entri: `pending` → `sent` | `needsAction` (dengan alasan terlihat).
  Tidak pernah dihapus diam-diam.
- Whitelist drop definitif (langsung `needsAction`, bukan hilang):
  `NO_SCHEDULE`, `ALREADY_CHECKED_IN`, `NO_OPEN_ATTENDANCE`, `FACE_MISMATCH`,
  `LIVENESS_FAILED`, `LIVENESS_STALE`, `CAPTURE_IN_FUTURE`, `CHALLENGE_INVALID`,
  `INVALID_SIGNATURE` setelah 3 percobaan.
- Keep & retry: jaringan, 5xx, 429, `401` (berhenti + minta login), `403` device
  (berhenti + tampilkan status device), `422` lain.
- Setelah 5 percobaan pada entri yang keep, ubah ke `needsAction` dengan alasan; user
  bisa "Kirim Ulang" atau "Buang" secara eksplisit.
- Outbox di-scope per `sub`; logout/consent revocation membersihkan outbox user itu.

### 5.8 Pembersihan klaim yang belum benar

- UI dan README tidak lagi menyebut root/jailbreak detection sebagai kontrol keamanan;
  statusnya "unverified, menunggu fase 2".
- `deviceCompromised` tetap dikirim sebagai sinyal risiko, tetapi tidak memberi poin
  integritas kecuali `integrityToken` terverifikasi (fase 2).

---

## 6. API dan konfigurasi baru

| Item | Perubahan |
|---|---|
| `POST /attendance/challenge` | baru, mengembalikan 10 nonce |
| `POST /auth/verify-email` | baru |
| `POST /auth/resend-verification` | baru |
| `POST /users/:id/approve` | baru |
| `POST /users/:id/verify-email-override` | baru |
| `PATCH /users/:id` | boleh ubah `email` bila belum terverifikasi |
| `POST /face/register` | `currentPassword?` |
| `POST /attendance/check-in/out` | signature v1, `captureAt`, `queuedAt`, `challengeNonce` |
| `POST /devices/register` | respons memuat status |
| env | `SMTP_*`, `DEV_EMAIL_LOG_CODES`, `OFFLINE_MAX_AGE_HOURS`, `FACE_CHANGE_SIMILARITY_MIN`, `MAX_ACTIVE_DEVICES_PER_EMPLOYEE`, `ATTENDANCE_NONCE_BATCH`, `IDEMPOTENCY_RETENTION_HOURS` |

`env-check.mjs` dan `security.ts` menolak produksi tanpa SMTP dan tanpa secret email.

---

## 7. Test

**Unit (backend)**

- Kanonikalisasi tanda tangan: vektor sama dengan Dart, urutan field, pembulatan.
- Nonce: kedaluwarsa, dipakai dua kali, milik user lain, batch dipakai sebagian.
- Face replace: tanpa password → 403; password salah → 403; sukses menaikkan versi.
- Registrasi: kode salah/kedaluwarsa/attempt; email tak dikenal tetap 202; email
  terdaftar-belum-verifikasi tidak menimpa password/nama/unit.
- Login: belum verifikasi, belum approval, aktif.
- Self-approval: tiga modul, termasuk SUPER_ADMIN.
- Scope laporan/handover lintas RS; hospitals list ter-scope.
- Device: kedua PENDING, batas N=2, aktivasi ke-3 ditolak, demosi migrasi.
- Offline: 23 jam diterima + MEDIUM review; 25 jam ditolak; `captureAt` masa depan ditolak.
- Shift malam: check-in 23:00, check-out 06:30 memakai record & shift yang sama.
- Record menggantung: >24 jam ditutup `staleAt`, check-in baru lolos, checkout tetap null.
- Idempotensi: retry mengembalikan respons sama; gagal definitif melepas key; retensi 25 jam.

**E2E**

- Alur penuh: register → verifikasi → approve → login → device → enroll → check-in.
- Offline: capture → queue → 2 jam kemudian flush → masuk review supervisor.
- Replay: dua kali `requestId` sama → satu baris, respons identik.
- Tenant: ADMIN RS A → laporan karyawan RS B = 404.
- Device: device kedua PENDING, presensi ditolak sampai aktivasi.

**Mobile**

- Vektor tanda tangan cocok dengan backend.
- Outbox menyimpan `requestId`/nonce dan memakainya ulang.
- Flush berhenti pada 401 dan mempertahankan entri.
- Tidak ada eviction senyap; status `needsAction` tampil dengan alasan.
- `flutter analyze` bersih (kecuali info lama).

---

## 8. Rollout dan migrasi

1. Migrasi Prisma + backfill:
   - `capture_at = check_in_at`, `synced_at = created_at`;
   - user lama: `email_verified_at = created_at`, `approved_at = created_at`.
2. Normalisasi device berlebih menjadi `PENDING` (bukan revoke).
3. Deploy backend.
4. Rilis mobile baru (hard cutover).
5. Verifikasi: smoke test alur baru + cek audit.

Tidak ada downtime yang direncanakan; migrasi hanya menambah kolom dan index.

---

## 9. Keputusan yang saya ambil (bukan kesepakatan Anda)

1. Nonce berbentuk **pool 10**, bukan satu nonce per punch — supaya offline benar-benar
   bisa dipakai di area tanpa sinyal setelah app sempat online.
2. `requestTimestamp` dihapus; `captureAt` menjadi satu-satunya waktu kejadian.
3. Check-out memakai `workDate`/shift dari record terbuka, bukan tanggal kalender
   `captureAt` — memperbaiki shift malam.
4. Record menggantung ditandai `staleAt`, `checkOutAt` tetap null — tidak memalsukan data.
5. Batas device aktif **2** (env), tanpa auto-revoke; device berlebih di-`PENDING`.
6. Similarity template hanya sinyal audit; password yang menjadi gerbang.
7. Offline selalu `needsReview`.
8. Registrasi selalu 202 generik dan tidak menimpa akun yang sudah ada.
9. Anti-enumerasi login tetap 401 generik; pesan khusus hanya setelah password benar.
10. `HIGH` ikut masuk antrean review.

## 10. Risiko yang tersisa

- `captureAt` masih bisa dipalsukan dalam batas 24 jam oleh klien modifikasi; ditandai
  review, bukan dicegah.
- Liveness tetap keputusan klien sampai fase 2.
- Email deliverability (spam folder) bisa menghambat onboarding; ada resend + override.
- Hard cutover memaksa semua perangkat update.
- Menambah satu dependency (`nodemailer`) dan satu jalur operasional (SMTP).
