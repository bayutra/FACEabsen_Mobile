# Face Absen Mobile

Aplikasi presensi karyawan **RSU Darmayu Madiun** untuk Android dan iOS.
Verifikasi wajah dan liveness berjalan **on-device**; server hanya menerima
embedding 192-d, bukan foto.

## Fitur

| Fitur | Lokasi kode |
|---|---|
| Login, sesi, ganti password | `lib/features/auth/` |
| Beranda & status shift | `lib/features/home/` |
| Pra-validasi presensi | `lib/features/preflight/` |
| Liveness aktif/pasif | `lib/features/liveness/` |
| Registrasi & verifikasi wajah | `lib/features/face/` |
| Check-in / check-out + outbox offline | `lib/features/attendance/` |
| Riwayat presensi | `lib/features/attendance/presentation/history_screen.dart` |
| Jadwal dinas | `lib/features/schedule/` |
| Perangkat & penggantian perangkat | `lib/features/device/` |
| Koreksi presensi | `lib/features/correction/` |
| Izin & cuti | `lib/features/leave/` |
| Profil, consent, privasi | `lib/features/profile/`, `lib/features/face/domain/privacy_notice.dart` |
| Integrity token (stub fase-2) | `lib/features/integrity/` |

## Persyaratan

- Flutter **3.22.x** / Dart **3.4.x** (lihat `pubspec.yaml`).
- Android **5.0 (API 21)** ke atas, iOS **15.5** ke atas.
- Kamera depan + Google Play Services (ML Kit) di Android.
- Backend Face Absen berjalan (lihat `../backend/README.md`).

> Dependency native dipin eksak (`tflite_flutter 0.9.5`,
> `flutter_secure_storage 9.2.4`). Baca `../docs/guides/ANDROID_COMPAT.md`
> sebelum upgrade.

## Menjalankan

```bash
flutter pub get
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 \
  --dart-define=APP_NAME="Face Absen"
```

- Emulator Android: `10.0.2.2` = localhost host.
- HP fisik: pakai IP LAN laptop, mis. `http://192.168.1.10:3000/api/v1`.
- iOS: `localhost` bekerja di simulator; HP fisik pakai IP LAN.
- Produksi: `https://<domain>/api/v1` (wajib HTTPS).

## Testing

```bash
flutter analyze
flutter test
```

Unit/widget test ada di `test/` (liveness, kualitas wajah, outbox, retry,
model presensi, password policy, dan lainnya).

## Build

```bash
# Android debug
flutter build apk --debug

# Android release (wajib android/key.properties)
flutter build appbundle --release

# iOS (butuh macOS + Xcode)
flutter build ios --release
```

Panduan signing & rilis: `../docs/guides/ANDROID_COMPAT.md`,
`../docs/guides/IOS_SETUP.md`.

## Struktur

```text
lib/
├── main.dart
├── app.dart                 # bootstrap, sesi, routing awal
├── core/
│   ├── config/              # env (--dart-define)
│   ├── crypto/              # device key Ed25519
│   ├── navigation/          # 5 tab + startup state
│   ├── network/             # Dio client, error mapping
│   ├── storage/             # secure storage
│   ├── theme/               # warna & tema
│   ├── validation/          # password policy
│   └── widgets/             # komponen Stitch
└── features/
    ├── attendance/          # check-in/out, outbox, riwayat
    ├── auth/                # login & repository
    ├── correction/          # koreksi presensi
    ├── device/              # binding & replacement
    ├── face/                # deteksi, embedding, registrasi
    ├── home/                # beranda
    ├── integrity/           # Play Integrity / App Attest (stub)
    ├── leave/               # izin & cuti
    ├── liveness/            # active + passive liveness
    ├── preflight/           # pra-validasi presensi
    ├── profile/             # profil & pengaturan
    └── schedule/            # jadwal dinas
```

Setiap fitur mengikuti pola `data/` (repository API), `domain/` (model/logika
murni), `presentation/` (layar & widget).

## Aset

- `assets/models/mobilefacenet.tflite` — model embedding 192-d (on-device).
- `android/app/src/main/jniLibs/` — library TensorFlow Lite untuk tiap ABI.

## Dokumen terkait

- PRD lengkap: [`../docs/PRD.md`](../docs/PRD.md)
- Desain/mockup: [`../docs/design/mobile/`](../docs/design/mobile/)
- Setup iOS: [`../docs/guides/IOS_SETUP.md`](../docs/guides/IOS_SETUP.md)
- Kompatibilitas Android: [`../docs/guides/ANDROID_COMPAT.md`](../docs/guides/ANDROID_COMPAT.md)
