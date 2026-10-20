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
5. Ganti IP di `--dart-define=API_BASE_URL` (iPhone tidak bisa `10.0.2.2`;
   pakai IP LAN laptop, sama seperti Android).

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
| App Attest (integrity) | ⏳ stub, blocker go-live iOS |
| Android | ✅ terpasang & teruji di HP (API 21–34) |