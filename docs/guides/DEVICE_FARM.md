# Device Farm Bersih — Protokol Pra-Go-Live

Farm pilot terkontaminasi: akun demo (`*@rs.test`, `EMP-00*`), device
root/emulator, template wajah uji. Produksi harus mulai dari NOL.

## 1. Di tiap HP farm (fisik, oleh PIC)

1. **Factory reset** (bukan sekadar uninstall — menghapus keystore seed).
2. Install dari **Play Internal / App Store** (bukan APK sideload).
3. Pastikan: tidak di-root/jailbreak, Play Integrity lolos.
4. Daftarkan ulang sebagai karyawan NYATA (bukan akun `@rs.test`).
5. HP yang gagal integrity → karantina (stiker merah), JANGAN dipakai presensi.

## 2. Di server (staging lalu prod)

```sh
# kering: lihat apa yang akan dibersihkan
node backend/scripts/farm-cleanup.mjs --dry-run
# basah: revoke device uji + hapus template/consent/schedule uji
node backend/scripts/farm-cleanup.mjs --apply --match "@rs.test|demo|EMP-00"
```

Skrip hanya menyentuh baris yang cocok `--match` (case-insensitive,
email/employeeNo/installationId) + selalu menampilkan count sebelum hapus.
Riwayat `attendance/audit` TIDAK dihapus (bukti pilot) kecuali di DB yang
memang dibuat ulang.

## 3. Putar secret staging

```sh
sh scripts/rotate-secrets.sh
```

Memandu regenerasi `JWT_ACCESS_SECRET`, `DATA_ENCRYPTION_KEY`,
`POSTGRES_PASSWORD`, `REDIS_PASSWORD` + invalidasi semua session staging.

## 4. Bukti bersih

- `devices WHERE status='ACTIVE'` hanya milik karyawan nyata (tunjukkan count).
- `face_templates` untuk akun uji = 0.
- Login akun demo `employee@rs.test / Password123!` GAGAL di prod
  (seed.prod tidak pernah membuatnya).
