# Dokumentasi Face Absen Mobile

Indeks dokumen proyek. PRD adalah sumber kebenaran untuk ruang lingkup dan
perilaku produk; panduan teknis menjelaskan cara menjalankan dan merilis.

## Produk

| Dokumen | Isi |
|---|---|
| [`PRD.md`](PRD.md) | PRD versi 2.0 — mobile-only, alur presensi, keamanan, API, kriteria terima |
| [`design/mobile/`](design/mobile/) | Mockup Stitch 20 layar (HTML + PNG), termasuk `DESIGN.md` |

## Panduan teknis

| Dokumen | Isi |
|---|---|
| [`guides/DEPLOY.md`](guides/DEPLOY.md) | Deploy stack Docker + TLS + backup |
| [`guides/WEB_DASHBOARD.md`](guides/WEB_DASHBOARD.md) | Dashboard web supervisor/admin (Next.js) |
| [`guides/GO_LIVE.md`](guides/GO_LIVE.md) | Runbook go-live berurutan |
| [`guides/E2E_PROD_READINESS.md`](guides/E2E_PROD_READINESS.md) | E2E dengan PostgreSQL nyata |
| [`guides/ANDROID_COMPAT.md`](guides/ANDROID_COMPAT.md) | Dukungan Android API 21+ dan aturan upgrade dependency |
| [`guides/IOS_SETUP.md`](guides/IOS_SETUP.md) | Build iOS + liveness di iPhone |
| [`guides/INTEGRITY.md`](guides/INTEGRITY.md) | Play Integrity / App Attest |
| [`guides/FCM_PUSH.md`](guides/FCM_PUSH.md) | Notifikasi push FCM (token, endpoint, konfigurasi Firebase) |
| [`guides/CALIBRATION.md`](guides/CALIBRATION.md) | Kalibrasi ambang wajah dan risk |
| [`guides/DEVICE_FARM.md`](guides/DEVICE_FARM.md) | Pembersihan device farm pra-produksi |
| [`guides/DPO_REVIEW.md`](guides/DPO_REVIEW.md) | Paket review DPO / UU PDP |
| [`guides/ADMIN_MOBILE.md`](guides/ADMIN_MOBILE.md) | Catatan: mode admin mobile sudah dihapus |

## Konvensi

- Semua path kode relatif terhadap root repo.
- Dokumen berbahasa Indonesia; istilah teknis tetap dalam bahasa aslinya.
- Setiap perubahan perilaku wajib memperbarui `PRD.md` pada bagian terkait.
