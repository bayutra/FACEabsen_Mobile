# Review DPO — Paket Persetujuan Go-Live (UU PDP No. 27/2022)

> Notice di aplikasi (`backend/src/privacy/notice.ts` v`2026-10-01`) adalah
> **placeholder teknis**. DPO + legal RS wajib mereview dan menandatangani
> bagian bawah sebelum data karyawan nyata diproses. Tanpa tanda tangan = JANGAN live.

## 1. DPIA ringkas (diisi DPO)

| Pertanyaan | Jawaban teknis (awal) | Keputusan DPO |
|---|---|---|
| Data apa? | Template biometrik wajah (embedding 192-float terenkripsi AES-256-GCM, bukan foto), GPS fix + akurasi, device key Ed25519, audit presensi | |
| Tujuan + dasar hukum? | Presensi karyawan (kontrak kerja + persetujuan eksplisit `BIOMETRIC_ATTENDANCE`, UU PDP ps. 20–21) | |
| Foto mentah? | TIDAK PERNAH dikirim/disimpan (computasi on-device; server hanya terima embedding) | |
| Persetujuan? | `POST /privacy/consent` versi notice; presensi + registrasi wajah DITOLAK tanpa consent (`NO_CONSENT`); pencabutan kapan saja | |
| Hak subjek? | Export (`GET /privacy/export`), hapus wajah (`DELETE /privacy/face`), cabut consent — semua teraudit | |
| Retensi? | Session 30 hari, wajah staf nonaktif 90 hari (`RETENTION_*`, job `runRetention` SUPER_ADMIN), idempotency 24 jam | |
| Keamanan? | Argon2id, JWT HS256 issuer-pinned, TLS via nginx, least-privilege PG role, rate-limit Redis, backup sha256 retensi 14 | |
| Risiko sisa? | FAR wajah (lihat `calibration-report.json`), GPS mock (server-side verdict + mock flag), device root (Play Integrity strict) | |

## 2. Uji verifikasi hak (dilakukan bersama DPO, di staging)

```sh
# login sebagai karyawan uji, lalu:
curl -H "Authorization: Bearer $T" $BASE/api/v1/privacy/notice
curl -H "Authorization: Bearer $T" $BASE/api/v1/privacy/export   # tanpa template bytes
curl -X DELETE -H "Authorization: Bearer $T" $BASE/api/v1/privacy/face
curl -X POST -H "Authorization: Bearer $T" $BASE/api/v1/privacy/consent -d '{"purpose":"BIOMETRIC_ATTENDANCE","granted":false}'
# presensi berikutnya harus 422 NO_CONSENT
```

Centang: [ ] notice tampil di aplikasi [ ] export tanpa biometrik mentah
[ ] hapus wajah efektif [ ] cabut consent memblokir presensi [ ] retention log ada.

## 3. Retensi + penghapusan

Jadwalkan `runRetention` (cron/mingguan, SUPER_ADMIN), catat output
`{sessions, idempotencyKeys, faceTemplates}` tiap jalan. Karyawan keluar:
`status=INACTIVE` → template terpurge otomatis >90 hari; penghapusan cepat
via erase endpoint + tiket SDM.

## 4. Sign-off

| Peran | Nama | Tanggal | Versi notice | Keputusan |
|---|---|---|---|---|
| DPO | | | 2026-10-01 | [ ] Setuju live [ ] Setuju bersyarat: ___ [ ] Tolak |
| Direksi/SDM | | | | |
| IT/Security | | | | |

Lampirkan: calibration-report, log E2E+smoke, hasil uji hak di atas.
