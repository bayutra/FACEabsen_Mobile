# Production Deployment Runbook — Hospital Face ID Attendance (PRD STEP 25)

> Checklist status: infra files in repo ✅ · live-host execution ⏳ (needs a
> Linux host with Docker; this workstation has none).

## 0. Prasyarat host

- Docker Engine 24+ + Compose v2, Linux x86_64, ≥4 GB RAM
- DNS `absen.rumahsakit.example` → host, port 80/443 terbuka ke internet
- `openssl`, `sha256sum`, cron/systemd timer

## 1. Secrets (`Environment Secret` ✅ file, ⏳ isi)

```sh
cp .env.production.example .env.production
chmod 600 .env.production
# Isi SEMUA CHANGE-ME: POSTGRES_*, REDIS_PASSWORD, JWT_ACCESS_SECRET (≥32 acak),
# DATA_ENCRYPTION_KEY (base64 32 byte acak), CORS_ORIGIN (domain asli).
```

Boot guard (`assertProductionEnv`) menolak start bila secret placeholder.

## 2. Database (`Database Backup` ✅ skrip, ⏳ jadwal)

- Postgres 17 image resmi, volume `pgdata`, healthcheck `pg_isready`.
- Buat role aplikasi least-privilege (bukan superuser) untuk `POSTGRES_USER`.
- Migrasi otomatis saat container backend start (`migrate deploy`, fail-closed).
- Seed awal (sekali, manual, dari working copy backend dengan DATABASE_URL staging):
  `npx prisma db seed` — membuat role + user demo; GANTI password demo segera.

## 3. HTTPS (`HTTPS` ✅ config, ⏳ sertifikat)

- Staging: `sh scripts/gen-cert.sh` (self-signed, JANGAN produksi).
- Produksi: certbot webroot (`/var/www/certbot` → mount ke nginx), cron renew,
  `docker compose exec nginx nginx -s reload`.

## 4. Firewall (`Firewall` ⏳ host)

```sh
ufw allow 80,443/tcp && ufw deny 3000,3001/tcp && ufw enable
```

Hanya nginx yang terekspos; backend/web/postgres/redis di network `internal`.

## 5. Rate limit & Redis (`Rate Limit` ✅ kode, ⏳ verifikasi beban)

- Global 120/mnt + per-endpoint; Redis shared store aktif bila `REDIS_URL` diset
  (fail-open bila Redis mati — logged, bukan 500).
- Verifikasi: `ab -n 200` ke `/api/v1/auth/login` → 429 muncul, Redis `KEYS *` bertambah.

## 6. Monitoring & Alert (`Monitoring`, `Alert` ⏳ integrasi)

- Health: `GET /api/v1/health` → `{status, db, uptimeSec}` (compose healthcheck).
- Log: stdout + rotasi `json-file` (10–20 MB × 5–10) di compose.
- Alert minimum: uptime monitor ke `/api/v1/health` + notifikasi bila `db != up`
  atau 5xx > 1% (Uptime Kuma / cloud monitor).

## 7. Backup & recovery (`Backup Test`, `Recovery Test` ⏳ jadwal)

- Backup: `sh scripts/backup-db.sh` (cron harian, retensi 14, sha256).
- Recovery test (wajib berkala): restore ke project staging terpisah, verifikasi
  count + smoke login, catat hasilnya. JANGAN restore ke produksi tanpa change window.

## 8. Deploy & smoke

```sh
docker compose --env-file .env.production up -d --build
docker compose ps                          # semua healthy
curl -k https://localhost/api/v1/health    # {"status":"ok","db":"up",...}
```

## 9. Security review (`Security Review` ✅ STEP 22/24)

Terakhir: STEP 22 (hardening) + STEP 24 (13 serangan ditolak).
Sebelum go-live ulangi: `npm audit`, rotasi semua secret staging, review
`docker compose config` (pastikan tak ada secret di image/env bocor).
