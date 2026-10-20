# E2E Database Penuh — Login & Presensi (go-live gate)

E2E yang ada (`test/*.e2e-spec.ts`) memakai **Prisma double in-memory**:
bagus untuk logika HTTP, tapi TIDAK membuktikan Postgres produksi bisa
login. Gerbang go-live ini menutup celah itu.

## 1. Siapkan Postgres E2E (staging / host)

```sh
createdb face_absen_e2e
$env:DATABASE_URL_E2E="postgresql://postgres:postgres@localhost:5432/face_absen_e2e?schema=public"
$env:DATABASE_URL=$env:DATABASE_URL_E2E
npx prisma migrate deploy   # dari backend/
```

## 2. Jalankan DB E2E login

```sh
npm run test:e2e -- test/login-db.e2e-spec.ts
```

Tanpa `DATABASE_URL_E2E` file ini **skip** (exit hijau) agar CI tanpa
Postgres tetap jalan. Dengan URL, ia menguji di Postgres nyata:

- argon2 verify lewat baris `users` (jalur `AuthService.login`),
- kolom lockout `failed_login_attempts/locked_until` naik + reset,
- rotasi refresh token tersimpan **sha256** + revoke (`sessions`).

## 3. E2E HTTP penuh di host

Setelah `scripts/db-go-live.sh` hijau, jalankan suite HTTP terhadap
backend staging yang menunjuk DB tersebut + `scripts/smoke-api.sh`.
Urutannya: `migrate deploy → seed.prod → vitest e2e → smoke-api 4/4`.
Simpan kedua log sebagai lampiran berita acara go-live.
