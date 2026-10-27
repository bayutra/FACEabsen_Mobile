# Face Absen — RSU Darmayu Madiun

Sistem presensi karyawan berbasis pengenalan wajah dan liveness on-device.
Karyawan memakai aplikasi Flutter (Android + iOS); supervisor, admin, dan
super admin memakai dashboard web Next.js. Backend NestJS melayani API untuk
keduanya.

> Orang yang absen harus karyawan yang benar, memakai perangkat yang terikat,
> pada shift yang benar, dan request tidak dapat diputar ulang.

---

## Arsitektur

```text
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  Flutter App (Android / iOS) │   │  Dashboard web (Next.js)     │
│  kamera · liveness · face    │   │  monitoring · approval · SDM │
│  embedding on-device         │   │  laporan · audit             │
└──────────────┬───────────────┘   └──────────────┬───────────────┘
               │ HTTPS (JSON)                     │ HTTPS
               └────────────────┬─────────────────┘
                                ▼
┌──────────────────────────────┐
│  nginx (TLS, rate limit)     │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐        ┌──────────────────┐
│  NestJS API  /api/v1         │───────▶│   PostgreSQL 17  │
│  auth · device · face        │        └──────────────────┘
│  attendance · shift · risk   │        ┌──────────────────┐
│  correction · leave · audit  │───────▶│      Redis 7     │
└──────────────────────────────┘        └──────────────────┘
```

- **Foto tidak pernah dikirim.** Klien menghitung embedding 192-d dan hanya
  mengirim vektor itu; server menyimpannya terenkripsi AES-256-GCM.
- **GPS/geofence tidak dipakai.** Kepercayaan dibangun dari kecocokan wajah,
  liveness, binding perangkat, signature Ed25519, dan device integrity.
- **Mode admin tidak ada di mobile.** Approval dan administrasi hanya lewat
  dashboard web (`web/`); login mobile dengan peran pengelola ditolak.

---

## Struktur repo

```text
.
├── mobile/                  # Flutter app (Android + iOS)
│   ├── lib/core/            # config, network, storage, theme, navigation
│   ├── lib/features/        # 12 fitur (attendance, face, device, ...)
│   ├── assets/models/       # mobilefacenet.tflite
│   └── test/                # unit + widget test
├── backend/                 # NestJS API
│   ├── src/                 # 18 modul domain
│   ├── prisma/              # schema, migrations, seed
│   ├── scripts/             # env-check, kalibrasi, farm cleanup
│   └── test/                # E2E HTTP
├── web/                     # Dashboard web Next.js (supervisor/admin)
│   ├── app/                 # halaman + route grup dashboard
│   ├── components/          # shell, tabel, modal, form
│   └── lib/                 # API client, auth, hook data
├── docs/
│   ├── PRD.md               # PRD (sumber kebenaran)
│   ├── README.md            # indeks dokumen
│   ├── design/mobile/       # mockup Stitch 20 layar
│   └── guides/              # deploy, go-live, iOS, Android, privasi, dll.
├── nginx/                   # reverse proxy API + dashboard + TLS
├── scripts/                 # host prep, backup, restore, smoke, cert
├── docker-compose.yml       # postgres + redis + backend + web + nginx
└── .env.production.example
```

---

## Mulai cepat

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # Windows: copy .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run start:dev          # http://localhost:3000/api/v1
```

### 2. Mobile

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

Emulator Android memakai `10.0.2.2`; HP fisik memakai IP LAN laptop.
Panduan lengkap ada di [`mobile/README.md`](mobile/README.md) dan
[`backend/README.md`](backend/README.md).

### 3. Dashboard web

```bash
cd web
npm install
API_ORIGIN=http://localhost:3000 npm run dev   # http://localhost:3001
```

Login memakai akun supervisor/admin (`supervisor@rs.test`, `admin@rs.test`,
`superadmin@rs.test` pada data seed). Detail: [`web/README.md`](web/README.md)
dan [`docs/guides/WEB_DASHBOARD.md`](docs/guides/WEB_DASHBOARD.md).

### 4. Produksi

```bash
cp .env.production.example .env.production
# isi semua CHANGE-ME
node backend/scripts/env-check.mjs --file .env.production
docker compose --env-file .env.production up -d --build
sh scripts/smoke-api.sh https://<domain>
```

Urutan go-live lengkap: [`docs/guides/GO_LIVE.md`](docs/guides/GO_LIVE.md).

---

## Testing

```bash
# backend
cd backend && npm run lint && npm test && npm run test:e2e

# mobile
cd mobile && flutter analyze && flutter test

# web
cd web && npm run typecheck && npm run build
```

---

## Dokumen

| Dokumen | Isi |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | PRD: ruang lingkup, alur, keamanan, API |
| [`docs/README.md`](docs/README.md) | Indeks seluruh dokumen |
| [`docs/guides/WEB_DASHBOARD.md`](docs/guides/WEB_DASHBOARD.md) | Dashboard web supervisor/admin |
| [`docs/guides/DEPLOY.md`](docs/guides/DEPLOY.md) | Deploy Docker + TLS |
| [`docs/guides/GO_LIVE.md`](docs/guides/GO_LIVE.md) | Runbook go-live |
| [`docs/guides/IOS_SETUP.md`](docs/guides/IOS_SETUP.md) | Build & liveness iOS |
| [`docs/guides/ANDROID_COMPAT.md`](docs/guides/ANDROID_COMPAT.md) | Batas Android API 21 |
| [`docs/guides/DPO_REVIEW.md`](docs/guides/DPO_REVIEW.md) | Kepatuhan UU PDP |
| [`docs/guides/CALIBRATION.md`](docs/guides/CALIBRATION.md) | Kalibrasi ambang wajah/risk |

---

## Keamanan singkat

- Argon2id + JWT access pendek + refresh rotation + lockout.
- Device binding dengan key pair Ed25519; setiap presensi ditandatangani dan
  `requestId` hanya boleh dipakai sekali (anti-replay).
- Liveness aktif (kedip/tengok) dan pasif; server memvalidasi bentuk,
  kesegaran, dan skor.
- Face template terenkripsi, tidak pernah dikembalikan API, dapat dihapus
  lewat endpoint privasi.
- Risk engine 100 poin: wajah 45, liveness 20, device 15, integrity 15,
  signature 5. Skor < 70 ditolak; 70–89 masuk review.
- Audit log append-only untuk aksi penting.
