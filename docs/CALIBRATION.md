# Kalibrasi Ambang — Face + Risk (wajib sebelum go-live)

Default repo (`FACE_MATCH_THRESHOLD=0.5`, `RISK_LOW_MIN=90`, `RISK_MEDIUM_MIN=70`)
adalah **titik awal dari PRD, bukan hasil ukur**. Bagian ini menjelaskan cara
menggantinya dengan angka dari data pilot rumah sakit.

## 1. Kumpulkan skor pilot (anonim, tanpa foto)

Setiap upaya presensi pilot mencatat `matchScore` (cosine −1..1 dari
`FaceService.matchScore`) + label ground-truth (`match` = pemilik sah,
`nonmatch` = impostor/uji titip-absen). Kumpulkan ke CSV:

```
score,label
0.87,match
0.31,nonmatch
...
```

Syarat go-live: **≥50 genuine + ≥50 impostor per kelas device**
(flagship + low-end dipisah; kamera murah biasanya butuh ambang lebih rendah).
Jangan pakai data device farm yang sudah di-root untuk kalibrasi.

## 2. Jalankan kalibrator

```sh
node backend/scripts/calibrate-thresholds.mjs --input pilot-scores.csv --out calibration-report.json
```

Contoh dengan sampel bawaan:

```sh
node backend/scripts/calibrate-thresholds.mjs --input backend/scripts/calib-sample.csv --out /tmp/calib.json
```

Output: tabel FAR/FRR per ambang 0.30–0.80 + kandidat EER
(`|FAR−FRR|` minimum) + kolom `riskAtThreshold` (dampak ke skor 100-poin:
`face = score×30`, sisa sinyal lolos = 70).

## 3. Baca tabel + tetapkan ambang

- **FAR** = impostor lolos (risiko titip-absen). **FRR** = pemilik sah ditolak
  (risiko antrean/komplain).
- Ambang naik → FAR turun, FRR naik. Pilih titik di mana FRR operasional
  masih nyaman (target awal: **FAR ≤ 1%**, FRR ≤ 5%; sesuaikan dengan DPO).
- Isi ke `.env.production`: `FACE_MATCH_THRESHOLD=<pilihan>`,
  lalu `node backend/scripts/env-check.mjs` (menolak di luar 0.30–0.80).
- Bobot risk (`RISK_W_*`, jumlah 100) dan batas `RISK_LOW_MIN/MEDIUM_MIN`
  defaultnya JANGAN diubah dulu; kalibrasi bobot adalah fase-2 setelah
  30 hari log `riskScore/riskCategory` produksi. Yang wajib aktif saat
  go-live: `RISK_MEDIUM_REVIEW=true` (antrean supervisor menyerap
  kasus batas).

## 4. Bukti untuk berita acara

Simpan: `pilot-scores.csv` (anonim), `calibration-report.json`, tanggal,
jumlah sampel per kelas device, ambang terpilih + FAR/FRR-nya, nama yang
menyetujui. Ulangi kalibrasi tiap ganti model embedding
(`MobileFaceNet_v1` → versi baru) atau tiap keluhan FRR naik.
