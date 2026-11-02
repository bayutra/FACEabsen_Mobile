# Auto-replace perangkat saat login — Design

Tanggal: 2026-11-02
Status: menunggu persetujuan

## Intent

Akun yang login di HP baru harus langsung bisa presensi dari HP itu, dan HP lama
otomatis dilepas. Saat ini perangkat pertama menjadi `ACTIVE` dan perangkat
berikutnya `PENDING` (`devices.service.ts:143-149`), sehingga akun terlihat
"nyangkut" ke perangkat pertama sampai admin mengaktifkan perangkat baru.

## Goals

- `POST /devices/register` (dipanggil setelah login dan saat presensi pertama)
  menghasilkan tepat satu perangkat `ACTIVE` per karyawan.
- Perangkat `ACTIVE`/`PENDING` lain di-`REVOKED` dalam transaksi yang sama, dan
  sesi mereka dicabut (`Session.revokedAt`).
- Re-register dari HP yang sama bersifat idempotent.
- Perangkat lama berstatus `REVOKED`/`LOST`/`REPLACED` tidak dikembalikan lagi;
  endpoint membalas `409` agar mobile membersihkan identitas dan mendaftar
  ulang (retry yang sudah ada di `device_repository.dart:43-53`).
- Audit `DEVICE_REGISTERED` + `DEVICE_REVOKED` per perangkat lama, dan
  notifikasi push ke karyawan bahwa perangkat berpindah.
- Copy UI yang menyebut "boleh lebih dari satu perangkat" diperbarui.

## Non-goals

- Tidak mengubah alur admin `activate`/`revoke`; tetap tersedia untuk data lama.
- Tidak menambah verifikasi password ulang atau attestation.
- Tidak mengubah endpoint `device-change` dan halaman approval-nya.
- Tidak menambah unique index parsial di database (lihat Risks).

## Constraints

- Presensi tetap hanya menerima perangkat `ACTIVE`
  (`validateDeviceFor`, `devices.service.ts:285-297`).
- `Device.installationId` dan `Device.devicePublicKey` tetap unik.
- Kontrak `409` harus dipertahankan karena mobile mengandalkannya untuk
  `clearDeviceIdentity()` lalu retry sekali.
- Tidak ada perubahan kontrak API untuk mobile; bentuk respons tetap `Device`.

## Approaches

- **A. Auto-replace langsung di `register()` (dipilih).** Satu transaksi:
  cabut perangkat lama, cabut sesinya, aktifkan/buat perangkat baru. Paling
  ringkas dan cocok dengan permintaan.
- **B. Di balik env `DEVICE_BINDING_MODE` (ditolak).** Menyimpan dua mode
  (`AUTO_REPLACE`/`APPROVAL`); menambah cabang, test, dan dokumentasi untuk
  mode yang tidak dibutuhkan sekarang.
- **C. Auto-approve `DeviceChangeRequest` (ditolak).** Memakai ulang alur
  penggantian, tetapi menambah baris request dan kompleksitas; jejak audit
  sudah dicakup audit log.

## Perilaku yang diputuskan

1. `register()`:
   - Verifikasi proof dan cari `employee` seperti sekarang.
   - `clash` dicari dari `installationId` atau `devicePublicKey`:
     - milik karyawan lain → `409` (tidak berubah);
     - milik karyawan ini dan status `REVOKED`/`LOST`/`REPLACED` → `409`,
       sehingga mobile membuat identitas baru dan mendaftar ulang;
     - milik karyawan ini dan status `ACTIVE` → jadikan target, tetapi perangkat
       `ACTIVE`/`PENDING` lain tetap dicabut (menjaga invariant satu perangkat
       aktif);
     - milik karyawan ini dan status `PENDING` → baris itu yang diaktifkan
       (bukan membuat baris baru, agar tidak melanggar unique constraint).
   - Transaksi:
     - `device.updateMany` untuk perangkat lain milik karyawan dengan status
       `ACTIVE`/`PENDING` → `REVOKED`, `revokedAt`, `revokedBy: null`,
       `revokeReason: auto-replaced-by:<targetId>`;
     - `session.updateMany` untuk `deviceId in (perangkat yang dicabut)` dan
       `revokedAt: null` → `revokedAt: now`;
     - target `PENDING` → `ACTIVE`; jika tidak ada target → `device.create`
       dengan status `ACTIVE`.
   - Setelah commit: audit `DEVICE_REGISTERED`, audit `DEVICE_REVOKED` untuk
     tiap perangkat lama, lalu `push.notifyEmployee(...)` (opsional, `PushModule`
     sudah diimpor `DevicesModule`).
2. `activate()`/`revoke()`/`maxActive` tidak berubah. Data `PENDING` lama masih
   bisa diaktifkan admin lewat dashboard.
3. Copy UI diperbarui dari "multi-perangkat" menjadi "satu akun aktif di satu
   perangkat; login di HP baru memindahkan perangkat".

## File yang disentuh

- `backend/src/devices/devices.service.ts`
- `backend/src/devices/devices.service.spec.ts`
- `mobile/lib/features/device/presentation/device_register_screen.dart`
- `mobile/lib/features/device/presentation/device_screen.dart`
- `mobile/lib/features/device/presentation/device_sections.dart`
- Dokumen ini; catatan singkat di `docs/guides/WEB_DASHBOARD.md` bila masih
  menyebut multi-perangkat.

## Testing

- Unit (`npm test` di `backend/`):
  - perangkat kedua menggantikan yang lama: lama `REVOKED`, sesinya dicabut,
    baru `ACTIVE`, audit terpanggil;
  - `clash` `PENDING` diaktifkan tanpa `create`;
  - `clash` `REVOKED`/`LOST`/`REPLACED` → `409`;
  - `clash` `ACTIVE` milik sendiri → idempotent;
  - `clash` milik karyawan lain → `409`;
  - perangkat pertama tetap `ACTIVE`.
- `flutter analyze`/`flutter test` bila toolchain tersedia (perubahan hanya
  teks).

## Risks

- **Account takeover:** siapa pun yang tahu password bisa login di HP baru dan
  memaksa HP lama logout. Ini konsekuensi yang diterima dari opsi A; mitigasi:
  notifikasi push + audit log. Jika nanti ingin lebih ketat, aktifkan kembali
  alur approval.
- **Race:** dua registrasi bersamaan bisa menyisakan dua `ACTIVE` karena tidak
  ada unique index. Kemungkinan kecil; follow-up: index parsial
  `WHERE status = 'ACTIVE'` bila diperlukan.
- **Data lama:** perangkat `PENDING` yang sudah ada tidak otomatis tercabut
  sampai ada registrasi baru atau admin bertindak.
