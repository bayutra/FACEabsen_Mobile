# Push notifications (FCM HTTP v1)

Notifikasi push dipakai untuk memberi tahu karyawan saat pengajuan koreksi,
cuti, atau penggantian perangkat sudah ditinjau. Backend mengirim lewat FCM
HTTP v1 (bukan legacy server key); mobile memakai `firebase_core` +
`firebase_messaging`.

## 1. Sisi Firebase

1. Buat project Firebase, lalu tambahkan aplikasi Android dengan package
   `com.hospital.faceid.face_absen_mobile` (harus sama dengan `applicationId`
   di `mobile/android/app/build.gradle`).
2. Unduh `google-services.json`, simpan di `mobile/android/app/google-services.json`.
   File yang ada di repo hanyalah placeholder — build tetap jalan, tetapi
   aplikasi tidak bisa menerima push sampai file asli dipasang.
3. Firebase Console → Project settings → **Service accounts** →
   *Generate new private key*. Simpan JSON-nya di mesin backend, **jangan**
   commit (sudah di-ignore: `secrets/`, `*service-account*.json`).

## 2. Environment backend

Pilih salah satu cara:

```dotenv
# A. File service account (disarankan)
FCM_SERVICE_ACCOUNT_PATH=secrets/firebase-service-account.json

# B. JSON mentah / base64 (cocok untuk secret manager / env saja)
FCM_SERVICE_ACCOUNT_JSON=<isi JSON atau base64-nya>

# C. Kredensial terpisah
FCM_PROJECT_ID=face-absen
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@face-absen.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Opsional: matikan pengiriman tanpa menghapus kredensial
FCM_ENABLED=true
```

Bila tidak ada kredensial sama sekali, backend tetap berjalan dan pengiriman
push di-skip (log: `FCM disabled: ...`). Konfigurasi setengah jadi (misalnya
hanya `FCM_PROJECT_ID`) akan ditolak saat startup oleh `validateEnv`.

## 3. Endpoint token

Semua endpoint butuh `Authorization: Bearer <access token>`.

| Method | Path | Body | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/api/v1/push/tokens` | `{ "token": "...", "installationId": "..." }` | Menyimpan token FCM untuk perangkat ACTIVE milik user. `installationId` opsional bila akun hanya punya satu perangkat. |
| `DELETE` | `/api/v1/push/tokens/:token` | — | Melepas token milik user (dipakai saat logout). |

Aturan:

- Token hanya boleh terikat ke perangkat `ACTIVE` milik user; selain itu
  `404 No active device`.
- Token yang sudah terikat ke perangkat lain ditolak `409`.
- Satu perangkat hanya menyimpan token terbaru (`lastSeenAt` diperbarui saat
  registrasi).
- Token yang ditolak FCM (`UNREGISTERED` / 404) otomatis dihapus dari database
  oleh `PushService`, jadi token mati tidak menumpuk.

## 4. Payload

Backend mengirim notifikasi + data:

```json
{
  "type": "correction",
  "id": "cuid",
  "status": "APPROVED"
}
```

Nilai `type` yang dipakai mobile untuk navigasi:

| `type` | Layar tujuan |
| --- | --- |
| `attendance` | Preflight / mulai presensi |
| `correction` | Daftar koreksi presensi |
| `leave` | Daftar pengajuan cuti |
| `schedule` | Tab Jadwal |
| `handover` | Daftar handover |
| `device` | Tab Profil (perangkat) |

Android channel: `face_absen_notifications` (dibuat aplikasi saat startup,
prioritas HIGH, bunyi default). Tanpa channel tersebut FCM akan memakai
fallback channel bawaan.

## 5. Perilaku mobile

- Izin notifikasi diminta sekali setelah login (Android 13+ memunculkan dialog
  `POST_NOTIFICATIONS`).
- Token didaftarkan ulang setiap aplikasi dibuka/resume dan saat
  `onTokenRefresh` (rotasi token FCM).
- Notifikasi saat aplikasi foreground ditampilkan lewat
  `flutter_local_notifications`.
- Tap notifikasi (cold start maupun background) membuka layar terkait; jika
  belum login, navigasi ditunda sampai `HomeShell` siap.
- Logout melepas token sebelum sesi dicabut.

## 6. Troubleshooting

- `FCM disabled` di log backend → kredensial tidak terbaca; cek path file
  (relatif terhadap direktori kerja backend) dan format PEM (`\n` ter-escape).
- `OAuth 400 invalid_grant` → service account salah project atau private key
  tidak cocok.
- Aplikasi tidak menerima notifikasi → pastikan `google-services.json` asli,
  package name sama, dan channel notifikasi tidak dimatikan di pengaturan HP.
- Token dihapus otomatis tetapi user masih ingin notifikasi → aplikasi akan
  mendaftarkan token baru saat dibuka.
