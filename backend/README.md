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

## Manajemen server (troubleshooting)

Jalankan perintah dari folder `backend/`.

### Cek kesehatan
```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
# atau
curl http://127.0.0.1:3000/api/v1/health
```

### Start / stop / restart (dev)
```powershell
# start dev (watch mode)
npm run start:dev

# stop: Ctrl+C di terminal yang menjalankan, atau kill proses node
Get-Process node | Where-Object { $_.Path -like '*node*' } | Stop-Process -Force
# (hati-hati: ini menutup semua proses node)

# restart bersih: stop dulu, lalu hapus dist, build, start
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run build
npm run start:dev
```

### Build & test
```powershell
npm run build
npm test
npm run lint
```

### Database / Prisma
```powershell
# terapkan migrasi (produksi/lokal)
npx prisma migrate deploy

# seed demo/dev (idempoten untuk permission & role)
npx prisma db seed

# buka Prisma Studio
npx prisma studio

# reset DB dev (HATI-HATI: hapus data)
npx prisma migrate reset
```

### Masalah umum
- **Port 3000 sudah dipakai**: cek `Get-NetTCPConnection -LocalPort 3000`, lalu stop prosesnya atau ubah `PORT` di `.env`.
- **`Cannot find module dist/app.module.js`**: build gagal/terputus. Jalankan `npm run build` ulang setelah server stop.
- **Redis tidak tersedia**: aman; rate limit fallback ke memori per instance (warning `ECONNREFUSED`).
- **Permission baru tidak berlaku**: jalankan `npx prisma db seed` agar `RolePermission` tersinkron.
- **Akun admin nonaktif**: aktifkan via DB atau seed ulang (demo).
- **Lupa URL API di mobile**: set di layar Login (ikon server) atau panel error, nilai `http://<IP-LAN>:3000/api/v1`.

### Log
Log dev server tampil di terminal yang menjalankan `npm run start:dev`.
Untuk produksi (PM2/systemd), lihat log sesuai manager proses yang dipakai.
```

Then commit/push.<|end|><|start|><|start|>assistant to=shell<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd 'D:\Kuliah\FACEabsen_Mobile'; git add backend/README.md; git commit -m "docs: tambah panduan manajemen server troubleshooting" 2>&1 | Select-Object -Last 6; git push 2>&1 | Select-Object -Last 4