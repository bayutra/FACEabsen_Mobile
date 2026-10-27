# Kompatibilitas Android — HP lama s.d. terbaru

Target: **Android 5.0 (API 21) sampai Android terbaru**. Batas bawah bukan
pilihan bebas — ia ditentukan oleh syarat maksimum semua plugin native.

## Tabel batas (terkunci di `pubspec.lock`)

| Paket (versi kunci) | minSdk | Keterangan |
|---|---|---|
| tflite_flutter **0.9.5** | 16 | JANGAN `^`: 0.10.x butuh **26** (Android 8+) |
| flutter_secure_storage **9.2.4** | 19 | JANGAN `^`: 10.x butuh **23** |
| google_mlkit_face_detection 0.9.0 | 21 | ← penentu floor |
| camera_android 0.10.x | 21 | ← penentu floor |
| device_info_plus / package_info_plus 10.x/8.x | 19 | |
| share_plus **7.1.0** | 19 | JANGAN `^`: 12.x butuh AGP 8.12 + Java 17 |
| path_provider **2.1.2** + path_provider_android **2.2.0** | 16/19 | Android impl 2.2.10 butuh AGP 8.5 |

`android/app/build.gradle` mematok `minSdk = 21` eksplisit (bukan
`flutter.minSdkVersion`) agar tidak bergeser diam-diam saat Flutter upgrade.

## Aturan upgrade dependency

1. `flutter pub upgrade` hanya untuk paket Dart murni. Untuk paket di tabel:
   cek `~/.pub-cache/.../android/build.gradle` (`minSdkVersion`) DULU.
2. Kalau minSdk baru > 21, pilih: tahan versi lama, atau naikkan floor dan
   korbankan HP di bawahnya (catat di berita acara).
3. Setelah upgrade: `flutter build apk --debug` di Windows + install ke HP
   tertua (farm) sebelum merge.

## Catatan runtime per versi

- **API 21–23 (HP lama):** butuh Google Play Services terbaru untuk ML Kit
  (deteksi wajah + liveness). Tanpa itu muncul pesan eksplisit, bukan gagal
  diam-diam. Download model ML Kit pertama kali butuh internet sekali.
- **API 29+:** scoped storage — aplikasi hanya pakai kamera langsung, aman.
- **API 31+:** permission kamera model baru — ditangani plugin.
- **Rilis Play Store:** ABI default Flutter (arm64 + arm-v7a) JANGAN difilter
  agar HP 32-bit tetap bisa install; `usesCleartextTraffic` dev-only WAJIB
  dicabut dan diganti `https://` sebelum rilis.
