# Desain: Scoping Unit (ex-Departemen) untuk Kepala Ruangan

**Tanggal:** 2026-11-10  
**Status:** Menunggu persetujuan

## Intent & tujuan
- Ganti istilah user-facing **“Departemen” → “Unit”**.
- Ubah kewenangan **Kepala Ruangan (role `SUPERVISOR`, login mobile)** agar, dalam **1 RS (hospital)** dan **1 unit**, dapat **approve/meninjau & melihat antrean/notifikasi in-app** dari **seluruh anggota unit yang sama**, bukan hanya bawahan langsung (`supervisorId`).
- Berlaku untuk **koreksi presensi, cuti (leaves), antrean/review presensi (attendance review), dan tampilan tim/ringkasan supervisor**.

## Non-goals / batasan
- **Tidak** mengubah nama model/API/field/route (`Department`, `departmentId`, `/departments`, skema DB) — hanya copy/label UI & output laporan yang user-facing.
- **Tidak** mengubah perilaku `ADMIN` (scope RS) dan `SUPER_ADMIN` (global) selain yang tidak terkait.
- **Tidak** menambah unit ganda per Kepala Ruangan (tetap 1 unit).
- Notifikasi push keputusan (ke karyawan pemohon) tetap seperti sekarang; “notif” Kepala Ruangan yang dimaksud = antrean/in-app dari scope barunya.

## Asumsi & constraint
- RS tunggal. Kepala Ruangan punya profil `Employee` dengan `departmentId` (unit) terisi dan valid di RS tersebut.
- Anggota unit = karyawan dengan `departmentId` sama (dalam RS yang sama). Self-approval tetap dilarang.
- `resolveEmployeeTenantWhere` / guard saat ini berbasis `employee.supervisorId == reviewer.id` untuk non-admin; ini diganti ke scope unit.

## Pendekatan (dipilih)
**Scoping berbasis `departmentId` milik Kepala Ruangan** (bukan `supervisorId`, bukan hybrid). Alasan: sesuai permintaan “seluruh anggota unit”, deterministik untuk 1 unit/1 RS, dan konsisten di semua permukaan.

## Perubahan yang direncanakan

### Backend — scoping & otorisasi
1. **`backend/src/auth/tenant-scope.ts` — `resolveEmployeeTenantWhere`** (cabang `!satisfiesRole(roles,'ADMIN')`, SUPERVISOR/team reviewer): 
   - Ambil employee reviewer `{ id, departmentId, department: { hospitalId } }`. Jika tidak ada/tanpa `departmentId` → `null` (antrean kosong, fail-safe).
   - Ganti filter `{ employee: { supervisorId: me.id } }` menjadi filter anggota **unit yang sama**: `employee.departmentId == reviewer.departmentId` (dan penjagaan RS sama, mis. via `employee.department.hospitalId` = reviewer’s hospital, bila tersedia) digabung dengan `base`.
2. **`backend/src/corrections/corrections.service.ts` — `assertCanReview`**: cabang SUPERVISOR (non-ADMIN/SUPER_ADMIN) mengizinkan jika `target.departmentId` (target punya department) sama dengan `departmentId` reviewer (satu RS), selain cek self-approval & eksistensi. SUPER_ADMIN/ADMIN hospital logic tetap.
3. **`backend/src/leaves/leaves.service.ts` — `assertCanReview`**: perubahan sama (scope unit), konsisten dengan koreksi.
4. **`backend/src/attendance/attendance-query.service.ts`**: 
   - `listReview` sudah memakai `resolveEmployeeTenantWhere` → mengikuti (1).
   - `requireReviewScope` (aksi review): cabang SUPERVISOR ganti cek `row.employee.supervisorId === me.id` menjadi cek **satu unit** (bandingkan departmentId reviewer vs row.employee.departmentId / row.employee.department, dalam RS sama). Self-review tetap ditolak.
5. **`backend/src/supervisor/supervisor.service.ts`**: 
   - `teamOf` cabang SUPERVISOR (non-admin/non-superadmin): kembalikan **seluruh karyawan aktif di unit yang sama** (`departmentId` = reviewer’s) alih-alih `supervisorId == me.id`.
   - `assertInScope`/akses detail & ringkasan anggota: izinkan jika anggota berada di unit yang sama (bukan harus bawahan langsung). ADMIN/SUPER_ADMIN perilaku tetap.

### UI/copy “Departemen” → “Unit” (user-facing)
- **Web** `web/app`: audit & ganti label/teks “Departemen/departemen” → “Unit/unit” yang tampil ke pengguna (menu/judul/filter/form/kolom/pesan), pertahankan route & identifier teknis (`/departments`, `departmentId`). Halaman departments/employees sudah banyak memakai “Unit” — pastikan konsisten & tidak ada sisa.
- **Backend laporan** `backend/src/reports/reports.service.ts`: ganti judul/header/label output (“Laporan Departemen…”, kolom “Departemen”) menjadi “Unit” agar dokumen/PDF/XLS/CSV yang dihasilkan konsisten.
- **Mobile** `mobile/lib`: ganti copy relevan “Departemen” → “Unit” (dan selaraskan komentar/teks yang menyebut scope `supervisorId` bila user-facing/misleading, mis. bar persetujuan “anggota unit Anda” tetap benar secara makna). Tidak mengubah kontrak API.

### Tes (akan disesuaikan/ditambah)
- Update ekspektasi unit/e2e terkait scope SUPERVISOR: `corrections.service.spec.ts`, `leaves` spec terkait, attendance review/query specs, `supervisor` service specs, dan `tenant-scope`/authz specs yang mengasumsikan `supervisorId` — ubah ke skenario **satu unit** (anggota satu department boleh, beda department ditolak, self-approval ditolak, ADMIN/SUPER_ADMIN tetap).
- Verifikasi: backend `vitest` (subset relevan + full bila stabil), `npm run build` backend; web `typecheck`/`build`; mobile `flutter analyze` + `flutter test`.

## Risiko & mitigasi
- **Kepala Ruangan tanpa `departmentId`** → antrean kosong / ditolak review (fail-safe) + perlu data diperbaiki. Mitigasi: guard eksplisit, pesan/hasil konsisten.
- **Data `supervisorId` lama** tidak lagi jadi dasar otorisasi SUPERVISOR; hubungan atasan-bawahan tetap tersimpan tapi bukan penentu approval. Diterima sesuai permintaan.
- **RS tunggal**: tetap validasi konsistensi hospital dari relasi department untuk aman.

## Kriteria penerimaan
- Akun SUPERVISOR (Kepala Ruangan) dengan `loginSurface` mobile dapat melihat antrean & approve/reject **koreksi, cuti, dan review presensi** untuk **semua karyawan di unit(department)-nya**, di RS yang sama; tidak bisa untuk unit lain / self.
- Tampilan tim/ringkasan supervisor mencakup seluruh anggota unit tersebut.
- Tidak ada label user-facing “Departemen” yang tertinggal di alur terkait (web/mobile/laporan); tes relevan lulus.