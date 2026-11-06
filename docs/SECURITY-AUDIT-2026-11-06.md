# Audit dependensi npm — 2026-11-06

Item 15 dari audit proyek (Security/hardening).

## Perubahan yang diterapkan

- `npm audit fix` di `backend/` — menerapkan pembaruan non-breaking yang tersedia.
- `npm audit fix` di `web/` — sama (tidak ada perbaikan non-breaking untuk sisa advisory).

## Sisa advisory (memerlukan upgrade major / breaking)

### backend (5 advisory, 2 moderate + 3 high)

| Advisory | Jalur | Catatan |
| --- | --- | --- |
| `deepmerge-ts < 8.0.0` (stack exhaustion) | `prisma` → `@prisma/config` | Fix memaksa upgrade ke `prisma@7.10.1` (major). |
| `uuid < 11.1.1` (bounds check, hanya bila `buf` dipakai) | `exceljs` → `uuid` | Fix memaksa downgrade/breaking `exceljs@3.4.0`. |

### web (2 advisory, 1 moderate + 1 high)

| Advisory | Jalur | Catatan |
| --- | --- | --- |
| `postcss <= 8.5.22` (XSS / sourceMappingURL) | `next` → `postcss` | Fix memaksa upgrade ke `next@16.4.5` (major). |

## Keputusan

Tidak ada "force" install untuk upgrade major pada rilis ini. Migrasi Next 16 dan
Prisma 7 direncanakan sebagai pekerjaan terpisah dengan pengujian penuh.

Risiko yang tersisa dinilai wajar untuk rilis saat ini:

- `postcss` via Next — dieksploitasi lewat CSS/build input tidak terpercaya; proyek ini
  hanya memproses aset aplikasi sendiri.
- `uuid` via exceljs — hanya bila `buf` disediakan oleh pemanggil; exceljs tidak
  menerima input pengguna langsung untuk jalur ini.
- `deepmerge-ts` via prisma — crash konfigurasi hanya dari konfigurasi aplikasi sendiri,
  bukan dari input eksternal.

## Efek perubahan kode

- `toCSV`/`toXLSX`/`toPDF` kini dibatasi maksimum 10.000 baris (HTTP 413
  `EXPORT_TOO_LARGE`).
- Formula injection dinormalkan pada ekspor XLSX (sama seperti CSV yang sudah ada).
