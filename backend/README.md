# Face Absen API

Backend **NestJS + PostgreSQL + Redis** untuk aplikasi mobile Face Absen.
Tidak menyajikan web dashboard; seluruh trafik klien masuk lewat
`/api/v1/` dari aplikasi Android/iOS melalui nginx.

## Stack

- Node.js 24 / NestJS 12 / TypeScript
- PostgreSQL 17 + Prisma ORM
- Redis 7 (rate limit & lockout lintas instance, opsional di lokal)
- Argon2id, JWT + refresh rotation, Ed25519 device signature
- AES-256-GCM untuk template wajah
- Vitest (unit + E2E), oxlint, Prettier

## Struktur

```text
src/
├── app.module.ts / app.controller.ts / app.service.ts   # bootstrap & health
├── auth/             # login, refresh, sesi, ganti password, TOTP
├── users/            # manajemen akun (admin)
├── employees/        # karyawan, departemen, hospital
├── devices/          # binding perangkat, heartbeat, revoke, device change
├── face/             # registrasi & pencocokan template wajah
├── attendance/       # check-in/out, sinyal, riwayat, outbox server
├── shifts/           # shift & roster
├── corrections/      # pengajuan & approval koreksi
├── leaves/           # pengajuan & approval izin/cuti
├── supervisor/       # ringkasan tim
├── reports/          # laporan harian/bulanan/departemen
├── audit/            # audit log read-only
├── privacy/          # consent, export, hapus wajah, retensi (UU PDP)
├── integrity/        # Play Integrity / App Attest
├── risk/             # risk engine 100 poin
├── rate-limit/       # throttler per akun + Redis store
└── prisma/           # PrismaService
prisma/
├── schema.prisma
├── migrations/
├── seed.mjs          # seed demo/dev
├── seed.prod.mjs     # seed produksi idempoten
└── least-privilege.sql
scripts/              # env-check, kalibrasi, farm cleanup
test/                 # E2E HTTP
```

## Setup lokal

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Butuh PostgreSQL di `DATABASE_URL`. Redis opsional; tanpa Redis, rate limit
memakai memori per instance.

API berjalan di `http://localhost:3000/api/v1`.
Dokumentasi OpenAPI tersedia di `http://localhost:3000/docs` saat
`NODE_ENV != production` (atau `DOCS_ENABLED=true`).

## Environment

Variabel wajib ada di `.env.example`; ringkasannya:

| Grup | Variabel |
|---|---|
| Server | `PORT`, `API_PREFIX`, `NODE_ENV` |
| Database | `DATABASE_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SEC`, `REFRESH_TTL_DAYS`, `LOGIN_MAX_ATTEMPTS`, `LOCKOUT_MINUTES` |
| Biometrik | `DATA_ENCRYPTION_KEY`, `FACE_MATCH_THRESHOLD`, `LIVENESS_MAX_AGE_MIN` |
| Request | `REQUEST_MAX_SKEW_MIN`, `HOSPITAL_TZ` |
| Risk | `RISK_W_*`, `RISK_LOW_MIN`, `RISK_MEDIUM_MIN`, `RISK_MEDIUM_REVIEW` |
| Retensi | `RETENTION_SESSION_DAYS`, `RETENTION_FACE_INACTIVE_DAYS` |
| Integrity | `INTEGRITY_STRICT`, `ANDROID_PACKAGE_NAME`, `IOS_BUNDLE_ID` |
| Opsional | `REDIS_URL`, `CORS_ORIGIN`, `DOCS_ENABLED` |

Produksi memakai `.env.production` di root repo (lihat
`../.env.production.example`). `CORS_ORIGIN` tidak diperlukan untuk mobile.

## Testing

```bash
npm run lint
npm test
npm run test:e2e
```

E2E memakai Prisma double in-memory. Untuk menguji PostgreSQL nyata:

```bash
DATABASE_URL_E2E=postgresql://... npm run test:e2e -- test/login-db.e2e-spec.ts
```

Lihat `../docs/guides/E2E_PROD_READINESS.md`.

## Scripts operasional

| Script | Fungsi |
|---|---|
| `scripts/env-check.mjs` | Validasi `.env.production` sebelum deploy |
| `scripts/calibrate-thresholds.mjs` | Kalibrasi ambang wajah/risk dari CSV pilot |
| `scripts/farm-cleanup.mjs` | Bersihkan akun/device/template uji |

## Deployment

```bash
docker compose --env-file .env.production up -d --build
```

Runbook lengkap: `../docs/guides/DEPLOY.md` dan `../docs/guides/GO_LIVE.md`.
