# Face Absen · Dashboard Web

Dashboard Next.js untuk supervisor, admin, dan super admin. Mode admin sudah
dihapus dari aplikasi mobile; seluruh approval, administrasi kepegawaian, dan
monitoring dilakukan di sini.

## Menjalankan

```bash
cd web
npm install
# opsional bila backend bukan http://localhost:3000
# API_ORIGIN=http://localhost:3000
npm run dev        # http://localhost:3001
```

Build produksi:

```bash
npm run build
API_ORIGIN=http://localhost:3000 npm run start
```

Browser memanggil `/api/v1/*` pada origin yang sama; Next.js mem-proxy ke
`API_ORIGIN` (lihat `next.config.mjs`) sehingga tidak perlu CORS di backend.
`NEXT_PUBLIC_API_BASE_URL` bisa dipakai bila ingin memanggil API absolut.

## Akun

- Login memakai endpoint backend yang sama (`POST /auth/login`) dengan
  `client: 'WEB'`. TOTP didukung (`/auth/totp/verify`).
- Peran `SUPERVISOR`, `ADMIN`, atau `SUPER_ADMIN` hanya bisa masuk dari
  dashboard. Login mobile dengan peran tersebut ditolak
  (`DASHBOARD_ONLY_ROLE`).
- Token disimpan di `localStorage` setelah login; refresh token diputar
  otomatis oleh `lib/api.ts` saat menerima 401.

## Halaman

| Path | Isi | Peran |
|---|---|---|
| `/` | Ringkasan monitoring + antrean persetujuan | supervisor+ |
| `/attendance` | Tinjauan presensi risiko sedang | supervisor+ |
| `/corrections` | Approve/reject koreksi presensi | supervisor+ |
| `/leaves` | Approve/reject cuti & izin | supervisor+ |
| `/team` | Rekap tim + presensi terbaru | supervisor+ |
| `/employees` | Data karyawan (CRUD sesuai peran) | supervisor+ |
| `/departments` | Unit kerja | admin+ |
| `/shifts` | Shift & toleransi | admin+ |
| `/schedules` | Penugasan jadwal | admin+ |
| `/devices` | Aktivasi/cabut/tandai hilang perangkat | super admin |
| `/device-change` | Approval penggantian perangkat | super admin |
| `/reports` | 7 laporan + ekspor CSV/Excel/PDF | supervisor+ |
| `/users` | Akun, peran, approve, reset password | super admin |
| `/audit` | Audit log | super admin |
| `/privacy` | Notice privasi + eksekusi retensi | super admin |

Backend tetap menegakkan RBAC; UI hanya menyembunyikan menu yang tidak relevan.

## Struktur

```text
web/
├── app/                 # App Router (login + route group dashboard)
├── components/          # shell, tabel, modal, form, badge
├── lib/api.ts           # fetch + refresh token + unduh laporan
├── lib/auth.tsx         # AuthProvider (login/TOTP/logout)
├── lib/useResource.ts   # hook loading/error/reload
└── Dockerfile           # image produksi (node:22-alpine)
```
