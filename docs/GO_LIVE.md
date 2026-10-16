# Go-Live Runbook — Hospital Face ID Attendance

> Satu pintu check sebelum produksi nyata. Urutan WAJIB berurutan 1→7.
> Tiap langkah punya perintah + bukti. Jangan lanjut bila langkah merah.

## 1. Host Docker (Linux)

```sh
sudo sh scripts/host-prepare.sh
cp .env.production.example .env.production
chmod 600 .env.production
# isi SEMUA CHANGE-ME di host (jangan commit)
node backend/scripts/env-check.mjs --file .env.production
docker compose --env-file .env.production config >/dev/null
```

Bukti: `env-check → OK`, `config` exit 0, `ufw status` hanya 80/443 publik.

## 2. Postgres + migrate deploy + seed prod

```sh
sh scripts/db-go-live.sh
```

Yang dilakukan skrip: `up postgres+redis → migrate deploy (fail-closed) →
seed prod idempoten → verifikasi count (roles/permissions/admin)`.
Seed prod TIDAK membuat user demo. Bootstrap admin dari
`BOOTSTRAP_ADMIN_EMAIL/PASSWORD`, lalu kosongkan password dari file env.

Bukti: `migrate deploy` exit 0, `seed.prod` → `seed.prod ok`,
`SELECT count(*) FROM roles` = 4.

Least-privilege: `backend/prisma/least-privilege.sql` (contoh CREATE ROLE
app + GRANT minimal). `POSTGRES_USER` produksi = role app, bukan superuser.

## 3. DB untuk login / E2E penuh

E2E lama memakai Prisma double in-memory. Go-live wajib lolos DB nyata:

```sh
# staging / host dengan DATABASE_URL_E2E menunjuk Postgres kosong
$env:DATABASE_URL_E2E="postgresql://.../face_absen_e2e?schema=public"  # PowerShell
npx prisma migrate deploy
npm run test:e2e
sh scripts/smoke-api.sh https://absen.rumahsakit.example
```

`smoke-api.sh` mengecek: `/health (db=up)` → `login bootstrap admin` →
`GET /auth/me` → `POST /geo/check` → ringkasan PASS/FAIL.
Bukti: E2E hijau + smoke `4/4 PASS`. Simpan log sebagai lampiran berita acara.

Tambahan: cek visual + split nginx lewat `check-pages.mjs` dari folder `web/`
(butuh backend + web hidup, atau origin deploy):
```sh
cd web
WEB_ORIGIN=https://absen.rumahsakit.example API_ORIGIN=https://absen.rumahsakit.example/api/v1 CHECK_NGINX=1 node scripts/check-pages.mjs
```
`CHECK_NGINX=1` menegaskan `/api/*` ke BFF dan `/api/v1/*` ke backend
langsung (penjaga regresi routing nginx Tahap 1).

## 3b. Operasi jam sibuk / rush hour (500 karyawan)

Angka: ~2.500 request/45 menit (≈55/mnt, puncak ~150/mnt) — satu Postgres
sanggup. Yang dijaga adalah antrean + satu titik mati, bukan CPU:

1. **Skala backend** (stateless; Redis berbagi limit, sesi di DB):
   ```sh
   docker compose up -d --build --scale backend=3
   docker compose ps   # 3x backend Up (healthy)
   ```
2. **Alerting gratis** (tanpa ini, yang tahu mati duluan adalah perawat):
   UptimeRobot/healthchecks.io → cek tiap 1 menit ke Telegram/HP:
   `GET https://<host>/api/v1/health/live` (liveness) dan
   `GET https://<host>/api/v1/health` (readiness + DB).
3. **Yang dipantau saat 06:30–07:30**: 429 di log nginx
   (`docker compose logs nginx | grep " 429 "`) = tanda limit perlu
   naik; antrean `needsReview` menumpuk = supervisor siaga.
   Rate limit kini per-akun (satu WiFi NAT tak lagi berbagi ember),
   dan HP menunda-otomatis (Retry-After + backoff) lalu mengantre —
   jangan panik melihat 429 sesekali, itu sistem bekerja.

## 4. Kalibrasi ambang (face + risk)

Default (`FACE_MATCH_THRESHOLD=0.5`, `LOW≥90/MED≥70`) adalah titik awal,
BUKAN hasil ukur. Wajib kalibrasi dari data pilot (lihat `docs/CALIBRATION.md`):

```sh
node backend/scripts/calibrate-thresholds.mjs --input pilot-scores.csv --out calibration-report.json
```

Input: CSV `score,label` (`label=match|nonmatch`, score=cosine 0..1 dari
`matchScore` log pilot). Output: FAR/FRR per ambang + rekomendasi EER +
dampak ke skor risk (face 30 poin). Tetapkan ambang di `.env.production`,
ulangi `env-check`, catat di berita acara (tanggal, N sampel, FAR/FRR).

Aturan: N ≥ 50 pasang genuine + 50 impostor per device kelas (low-end wajib
diikutkan). Jangan naikkan ambang tanpa data.

## 5. Play Integrity (Android) + App Attest (iOS)

Client lama hanya lapor `deviceCompromised` (jailbreak detect) — bisa
dipalsukan. Go-live:

- Android: aktifkan Play Integrity API di Play Console, isi
  `ANDROID_PACKAGE_NAME`. `INTEGRITY_STRICT=true` HANYA setelah mobile
  benar-benar mengirim `integrityToken` DAN backend verifikasi signature
  server-to-server (fase-2) — dengan klien saat ini `true` = semua
  presensi 422 `INTEGRITY_FAILED`.
- Mobile: `IntegrityRepository.getToken()` mengirim `integrityToken`
  di tiap check-in/out (lihat `mobile/lib/features/integrity/`).
- Server: `IntegrityService.verify()` menolak token kadaluwarsa /
  package salah / `deviceIntegrity` tanpa `MEETS_DEVICE_INTEGRITY`
  (mode strict). Audit `ATTENDANCE_REJECTED{reason: INTEGRITY_FAILED}`.

Bukti: presensi dari emulator/root tanpa token → 422 `INTEGRITY_FAILED`;
dari device farm bersih → lolos.

## 6. Review DPO

Wajib sebelum data karyawan nyata masuk. Paket: `docs/DPO_REVIEW.md`
(DPIA ringkas, dasar hukum UU PDP, retensi, hak subjek data, daftar audit).
Langkah:

1. DPO baca `privacy notice` di aplikasi + `docs/DPO_REVIEW.md`.
2. Uji hak: export (`GET /privacy/export`), cabut consent, hapus wajah
   (`DELETE /privacy/face`), retention dry-run.
3. Tanda tangan tabel sign-off (nama, tanggal, versi notice `2026-10-01`).

Tanpa tanda tangan DPO = JANGAN go-live.

## 7. Device farm bersih

Farm pilot penuh akun demo + template uji. Prosedur `docs/DEVICE_FARM.md`:

```sh
# di tiap HP farm: factory reset → install dari Play Internal → daftar ulang
# di server (staging/prod): revoke device uji + hapus template uji
node backend/scripts/farm-cleanup.mjs --dry-run
node backend/scripts/farm-cleanup.mjs --apply --match "@rs.test|demo|EMP-00"
sh scripts/rotate-secrets.sh   # putar semua secret staging
```

Bukti: `devices WHERE status=ACTIVE` hanya milik karyawan nyata,
`face_templates` uji = 0, secret staging sudah diputar.

---

## Sign-off go-live (tempel di berita acara)

| Item | Bukti | PIC | Tanggal |
|---|---|---|---|
| Host + env-check OK | log `env-check` | | |
| migrate + seed.prod OK | log `db-go-live` | | |
| E2E DB + smoke 4/4 | log vitest + smoke | | |
| Kalibrasi ambang | `calibration-report.json` + N sampel | | |
| Integrity strict lolos | log tolak emulator | | |
| DPO sign-off | `docs/DPO_REVIEW.md` ttd | | |
| Farm bersih | `farm-cleanup` log | | |
