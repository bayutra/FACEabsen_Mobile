# Setup iOS — Hospital Face ID Attendance

> **Tidak bisa di-build di Windows.** iOS butuh macOS + Xcode. Semua yang bisa
> disiapkan dari Windows sudah ada di repo; compile, signing, dan uji simulator
> wajib di Mac atau CI (Codemagic / GitHub Actions `macos-latest`).

## Sudah disiapkan di repo

| Aspek | Nilai | File |
|---|---|---|
| Deployment target | iOS **15.5** (ML Kit 4.x mensyaratkannya) | `ios/Podfile`, `ios/Runner.xcodeproj/project.pbxproj` |
| Izin kamera | `NSCameraUsageDescription` | `ios/Runner/Info.plist` |
| ATS dev HTTP | `NSAllowsArbitraryLoads` (**dev only**) | `ios/Runner/Info.plist` |
| Pods | `use_frameworks!` | `ios/Podfile` |
| Bundle ID | `com.hospital.faceid.faceAbsenMobile` | `project.pbxproj` (wajib sama dengan `IOS_BUNDLE_ID` di `.env.production`) |
| Liveness iOS | fallback landmark | `lib/features/liveness/domain/eye_geometry.dart` |

## Blocker arsitektur: liveness di iOS

**`leftEyeOpenProbability` hanya ada di Android.** ML Kit iOS tidak
menghasilkan probabilitas mata terbuka, sehingga versi awal liveness hanya
bisa mendeteksi kedip di Android — di iPhone challenge blink tidak akan
pernah terpenuhi → `LIVENESS_FAILED` → presensi ditolak.

Solusi yang dipasang: aktifkan `enableContours`, lalu turunkan openness dari
**eye-aspect-ratio** (tinggi/lebar contour mata):

```
Android  probability  0.0 .. 1.0    buka > 0.60 · tutup < 0.40   (tak berubah)
iOS      landmarkRatio               buka > 0.16 · tutup < 0.09   (provisional)
```

`EyeSignalSource` memilih skala mana yang dipakai, jadi perilaku Android
tidak berubah. `test/eye_geometry_test.dart` (11 kasus) mengunci kontrak ini,
termasuk regression guard bahwa nilai skala-iOS tidak boleh dianggap "terbuka"
di skala probabilitas.

> ⚠️ **Ambang iOS masih provisional.** Logikanya teruji (pure Dart), tapi angka
> 0.16/0.09 harus dikalibrasi di iPhone nyata: rekam openness saat mata
> terbuka penuh vs tertutup. Dua koefisien itu ada di
> `BlinkThresholds.forLandmarkRatio`.

## Checklist di Mac

```sh
cd mobile
flutter pub get
cd ios && pod install && cd ..
flutter build ios --no-codesign      # cek kompilasi dulu
flutter run -d <simulator-iphone>
```

Lalu uji manual:
1. Izin kamera muncul.
2. Pendaftaran wajah: template 192-d terkirim, `POST /face/register` 200.
3. Liveness: challenge kedip **lolos** (kalau macet, cek ambang iOS di atas).
4. Check-in: wajah cocok + liveness valid → 200.
5. Ganti alamat server lewat dialog **"Server: …"** di dalam aplikasi
   (iPhone tidak bisa `10.0.2.2`). Gunakan URL HTTPS (ngrok/Tailscale) karena
   aplikasi menolak `http://` selain loopback. Untuk demo LAN darurat, build
   dengan `--dart-define=ALLOW_INSECURE_HTTP=true` (jelas tidak aman).

## Ganti alamat backend tanpa build ulang

Alamat API bisa diubah dari dalam aplikasi, berguna saat memakai ngrok atau
Tailscale yang URL-nya tidak tetap:

1. Login → tombol kecil **"Server: …"** di bawah pill verifikasi wajah.
2. Isi alamat, contoh `contoh.ngrok-free.app` (skema `https://` dan path
   `/api/v1` ditambahkan otomatis).
3. **Simpan**, lalu login. Tombol **Default** mengembalikan ke nilai
   `--dart-define=API_BASE_URL`.

Nilai disimpan di secure storage (`api_base_url`), jadi bertahan setelah
aplikasi ditutup. Bila aplikasi gagal terhubung saat start, layar error juga
menampilkan tombol server yang sama.

## Sideloadly: "Nothing to export" saat Start

Pesan `Install failed: Guru Meditation … Nothing to export: no changes
requested. Choose some modifications (or a signing mode) first.` **bukan** tanda
IPA rusak. Artinya mode instalasi di Sideloadly belum menyuruhnya menandatangani
apa pun:

- Sideloadly punya beberapa mode: **Apple ID Sideload**, **Normal Install**,
  **Ad-hoc Sign & Install**, dan **Export**.
- Mode **Export** hanya mengemas ulang IPA setelah ada tweak/perubahan, jadi
  dengan IPA polos ia berhenti dengan pesan di atas.
- Mode **Normal Install** mengharapkan IPA yang sudah bertanda tangan; IPA dari
  Codemagic masih *unsigned*.

Perbaikan:

1. Di jendela Sideloadly, buka dropdown mode (dekat kolom Apple ID / tombol
   **Start**) dan pilih **Apple ID Sideload**.
2. Pastikan Apple ID `bayudark86@gmail.com` terisi, lalu **Start** dan masukkan
   password + kode 2FA.
3. Jika dropdown tidak ada, tutup Sideloadly (termasuk ikon tray), hapus folder
   `%LOCALAPPDATA%\Sideloadly`, lalu pasang ulang versi terbaru dari
   sideloadly.io — pengaturan mode kembali ke default.

Setelah terpasang: **Settings → General → VPN & Device Management** → percayai
sertifikat developer, lalu **Settings → Privacy & Security → Developer Mode** →
aktifkan dan restart iPhone.

## Build unsigned IPA di Codemagic (troubleshooting)

Workflow `ios-unsigned` di `codemagic.yaml` sengaja **tidak** memakai
`flutter build ios` untuk build sebenarnya, karena Flutter menyembunyikan
output `xcodebuild` dan menggantinya dengan diagnosis yang menyesatkan:

```
Building a deployable iOS app requires a selected Development Team ...
```

Pesan itu dicetak oleh `flutter_tools/lib/src/ios/mac.dart`
(`_missingDevelopmentTeam`) untuk **setiap** kegagalan build device selama
project tidak punya `DEVELOPMENT_TEAM`/`PROVISIONING_PROFILE` — bukan berarti
penyebabnya signing. Alur yang dipakai:

1. `flutter build ios --release --no-codesign --config-only` → hanya menyiapkan
   `Flutter/Generated.xcconfig` (termasuk `DART_DEFINES`) + `pod install`.
2. `xcodebuild -workspace Runner.xcworkspace -scheme Runner -configuration
   Release -sdk iphoneos -destination 'generic/platform=iOS'
   -derivedDataPath build/ios/derived -quiet ... build` → build sebenarnya,
   dengan error asli terlihat di log.
3. Paketkan `Runner.app` dari `build/ios/derived/Build/Products/Release-iphoneos`
   memakai `ditto` (menjaga symlink framework), setelah memverifikasi
   `Runner.app/Runner` dan `Frameworks/Flutter.framework/Flutter` ada.

Jebakan yang sudah pernah menggagalkan build:

| Gejala | Penyebab & perbaikan |
|---|---|
| Pesan "Development Team" padahal signing sudah mati | Diagnosis generik Flutter; lihat error `xcodebuild` asli. |
| `include of non-modular header inside framework module 'firebase_messaging...'` | Xcode 16 menjadikannya error. Set `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` (Podfile `post_install` + `Flutter/*.xcconfig`). |
| `unsupported preprocessor directive 'Firebase/MLKit'` | Di `.xcconfig` komentar wajib `//`, bukan `#` (`#` hanya untuk `#include`). |
| `Resource ".../FirebaseCoreInternal_Privacy.bundle" not found` | Jangan override `CONFIGURATION_BUILD_DIR`; script copy-resources pod ikut setting itu. Pakai `-derivedDataPath`. |
| IPA <2 MB / Sideloadly `bundle_main_missing: Payload/Runner.app/Runner` | `Runner.app` yang dipak tidak lengkap. Langkah *Package IPA* sekarang menolak memaket tanpa binary utama. |

Signing dimatikan di level project (`CODE_SIGNING_ALLOWED = NO`,
`CODE_SIGN_STYLE = Manual`, identity kosong di `project.pbxproj`,
`Flutter/Debug.xcconfig`, `Flutter/Release.xcconfig`, dan `Podfile`), jadi
`xcodebuild` tidak menuntut Development Team. Jika suatu saat ingin build
dengan sertifikat asli, aktifkan kembali signing di Xcode.

## Sebelum rilis (wajib)

- [ ] **Hapus blok `NSAppTransportSecurity`** dari `Info.plist` — produksi
      memakai `https://` lewat nginx._cleartext di iStore = ditolak review.
- [ ] `IntegrityRepository.getToken()` masih stub `null`. iOS perlu **App
      Attest** (`generateKey` saat registrasi device + `attestKey` saat
      ganti perangkat + `generateAssertion(challenge)` per presensi). Selama
      stub, server `INTEGRITY_STRICT=true` akan menolak presensi iOS dengan
      `INTEGRITY_FAILED`. Lihat `docs/guides/INTEGRITY.md`.
- [ ] Signing: Apple Developer account + provisioning profile.
- [ ] `camera` iOS butuh `NSMicrophoneUsageDescription` kalau `enableAudio`
      tidak dimatikan — di repo ini `enableAudio: false`, jadi aman.

## Status

| Bagian | Status |
|---|---|
| Konfigurasi iOS (Podfile, Info.plist, target, bundle ID) | ✅ siap |
| Liveness iOS (landmark fallback) | ✅ kode + tes, ⚠️ ambah perlu kalibrasi device |
| Build di simulator | ⏳ butuh Mac |
| Build unsigned IPA via Codemagic (`ios-unsigned`) | ✅ menghasilkan IPA lengkap untuk Sideloadly |
| App Attest (integrity) | ⏳ stub, blocker go-live iOS |
| Android | ✅ terpasang & teruji di HP (API 21–34) |