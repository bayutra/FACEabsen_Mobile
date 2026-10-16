# Play Integrity + App Attest — Go-Live Guide

## Status

- Server: `backend/src/integrity/` — verifikasi struktural JWT
  (expiry, package/bundle, `MEETS_DEVICE_INTEGRITY`, `PLAY_RECOGNIZED`),
  mode `INTEGRITY_STRICT` (prod=`true`), audit `INTEGRITY_FAILED`.
- Mobile: `mobile/lib/features/integrity/integrity_repository.dart` —
  `getToken()` masih **stub null** + `integrityToken` sudah dikirim
  `AttendanceRepository` bila ada.

## Yang wajib dilakukan di konsol (tidak bisa dari repo)

1. **Play Console → Setup → App integrity → Play Integrity API → Enable.**
   Daftarkan `ANDROID_PACKAGE_NAME` (= applicationId) + SHA-256 cert upload.
2. **Tambahkan plugin resmi** ke `mobile/pubspec.yaml` (mis. Play Integrity
   wrapper), implementasikan `IntegrityRepository.getToken()`:
   `requestIntegrityToken(nonce = requestId)` → kembalikan JWT verdict.
3. **iOS**: App Attest `generateKey` saat registrasi device, `attestKey`
   + `generateAssertion(challenge=requestId)` tiap presensi; server
   memvalidasi `bundleId` (`IOS_BUNDLE_ID`) + assertion (fase-2).
4. **Uji**: emulator/root tanpa token → `422 INTEGRITY_FAILED`;
   device farm bersih → lolos + `risk.integrityOk=true`.
5. **Fase-2 (dianjurkan ≤90 hari pasca-live)**: verifikasi server-to-server
   ke Google (` membutuhkan GOOGLE_SERVICE_ACCOUNT_JSON`) sebelum
   memercayai penuh verdict — stub struktural saat ini sudah menghentikan
   spoofing murahan, bukan attacker dengan Play signing key curian.

## Perilaku mode

| `INTEGRITY_STRICT` | Tanpa token | Token tidak valid |
|---|---|---|
| `false` (pilot) | fallback `!deviceCompromised` | tolak `INTEGRITY_FAILED` |
| `true` (prod) | tolak `INTEGRITY_FAILED` | tolak `INTEGRITY_FAILED` |
