# Dashboard Web (Next.js)

Mode admin di aplikasi mobile **dihapus**. Semua pekerjaan supervisor, admin,
dan super admin dilakukan dari dashboard web di folder `web/`.

## Ringkasan

- **Stack:** Next.js 15 (App Router) + React 19, tanpa framework UI tambahan.
- **Auth:** endpoint backend yang sama (`POST /auth/login`, `client: 'WEB'`,
  TOTP lewat `POST /auth/totp/verify`).
- **API:** browser memanggil `/api/v1/*` pada origin dashboard; Next.js
  mem-proxy ke `API_ORIGIN` sehingga tidak perlu CORS.
- **Token:** access + refresh disimpan di `localStorage`; refresh otomatis saat
  401. Logout mencabut sesi di backend.

## Menjalankan lokal

```bash
cd web
npm install
API_ORIGIN=http://localhost:3000 npm run dev   # http://localhost:3001
```

Backend harus berjalan (`cd backend && npm run start:dev`). Akun demo seed:

| Email | Peran |
|---|---|
| `supervisor@rs.test` | Supervisor (tim sendiri) |
| `admin@rs.test` | Admin |
| `superadmin@rs.test` | Super Admin |

Kata sandi seed: `Password123!`.

## Login ditolak di mobile

`LoginDto.client` menerima `MOBILE` atau `WEB`. Bila `MOBILE` dan akun memiliki
peran `SUPERVISOR`, `ADMIN`, atau `SUPER_ADMIN`, backend membalas `403` dengan
`reason: DASHBOARD_ONLY_ROLE`; aplikasi mobile menampilkan pesan bahwa akun
hanya bisa masuk lewat dashboard. Klien lama yang tidak mengirim `client`
diperlakukan sebagai integrasi API biasa.

## Halaman & izin

| Halaman | Peran minimum | Endpoint utama |
|---|---|---|
| Ringkasan | Supervisor | laporan harian, antrean koreksi/cuti/review, audit |
| Tinjauan Presensi | Supervisor | `GET /attendance/review`, `POST /attendance/{id}/review` |
| Koreksi | Supervisor | `GET /corrections`, `POST /corrections/{id}/approve\|reject` |
| Cuti & Izin | Supervisor | `GET /leaves`, `POST /leaves/{id}/approve\|reject` |
| Tim | Supervisor | `GET /supervisor/{team,summary,attendance,team/{id}}` |
| Karyawan | Supervisor (tulis: Admin) | `GET/POST /employees`, `PATCH`, `deactivate` |
| Unit | Admin | `GET/POST/PATCH/DELETE /departments`, `GET /hospitals` |
| Shift | Admin | `GET/POST/PATCH/DELETE /shifts` |
| Jadwal | Admin | `GET/POST /schedules`, `DELETE /schedules/{id}` |
| Perangkat | Super Admin | `GET /devices`, `POST /devices/{id}/{activate,revoke,mark-lost}` |
| Penggantian Perangkat | Super Admin | `GET /device-change`, `POST /device-change/{id}/{approve,reject}` |
| Laporan | Supervisor | `GET /reports/*`, ekspor `?format=csv\|xlsx\|pdf` |
| Pengguna | Super Admin | `GET/POST /users`, `PATCH`, `reset-password`, `approve` |
| Audit | Super Admin | `GET /audit`, `GET /audit/actions` |
| Privasi | Super Admin | `GET /privacy/notice`, `POST /privacy/retention/run` |

Server tetap menegakkan RBAC; halaman hanya menyembunyikan menu yang tidak
berhak.

## Deploy

`docker-compose.yml` menambahkan service `web` (build `./web`) dan nginx
meneruskan seluruh path non-API ke `web:3001`.

```bash
docker compose --env-file .env.production up -d --build
```

Variabel yang dipakai:

| Variabel | Arti |
|---|---|
| `API_ORIGIN` | Origin backend untuk rewrite `/api` (compose: `http://backend:3000`) |
| `NEXT_PUBLIC_API_BASE_URL` | Opsional; panggil API absolut dari browser |

Catatan keamanan:

- Dashboard harus di belakang TLS (nginx), seperti API.
- Jangan set `NEXT_PUBLIC_API_BASE_URL` ke origin lain tanpa CORS yang ketat.
- Peran dashboard tidak lagi bisa login mobile; pastikan akun pengelola
  didaftarkan dengan peran yang benar dari halaman **Pengguna**.
