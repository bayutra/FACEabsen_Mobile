# Kepala Ruangan (mobile) + Perbaikan UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan login-surface per akun (mobile/web/both) untuk role Supervisor Kepala Ruangan di mobile, sekaligus memperbaiki banner ganda, operan dummy, jam koreksi, unit kerja, dan hapus tab perangkat web.

**Architecture:** Backend tetap memakai role `SUPERVISOR` + `User.loginSurface`; web hanya ubah navigasi/form; mobile tambah section persetujuan yang memakai endpoint queue yang sudah ada.

**Tech Stack:** NestJS 11 + Prisma 6, Next.js 15 (web), Flutter 3.22.2 (mobile).

**Spec:** `docs/superpowers/specs/2026-11-09-kepala-ruangan-dan-perbaikan-ux-design.md`

## Global Constraints

- Role internal tetap `SUPERVISOR`, label "Kepala Ruangan" hanya presentasi mobile.
- `User.loginSurface` default `'both'` agar tidak memutus akun lama.
- Permission `correction:approve:team` dan `attendance:approve:team` tetap di role Supervisor; tidak tambah permission baru.
- Scope tinjauan tetap `target.supervisorId === reviewerEmployeeId`; self-approval tetap `SELF_APPROVAL_FORBIDDEN`.
- Backend `device-change` tidak diubah; hanya tab + halaman web dihapus.
- Hospital seed tidak diubah (`RS-A / RSU Darmayu Madiun`).

## Review Focus

- **Akun Supervisor `loginSurface='both'` login di web dan mobile** — harus diterima di kedua surface (dashboard-only tetap berlaku kecuali flag mengizinkan mobile).
- **Akun `mobile` mencoba POST /auth/login client=WEB** — harus ditolak 403 `MOBILE_ONLY_ACCOUNT`.
- **Akun `web` mencoba login mobile** — harus ditolak 403 `WEB_ONLY_ACCOUNT`.
- **Koreksi disetujui → jam absen berubah** — `attendance.checkInAt/checkOutAt` harus berubah dan web/mobile memuat ulang.
- **Approve bar Kepala Ruangan hanya menampilkan anggota `supervisorId`-nya** — karyawan lain tidak boleh muncul dan tombol harus 403 bila dipaksa.

---

## File Structure

**Backend (buat/ubah):**
- Modify: `backend/prisma/schema.prisma` — tambah `loginSurface`.
- Create: `backend/prisma/migrations/20261109000000_login_surface/migration.sql` — SQL migrasi.
- Modify: `backend/src/auth/dto.ts` — `loginSurface?: 'mobile'|'web'|'both'`.
- Modify: `backend/src/auth/auth.service.ts` — validasi surface saat login.
- Modify: `backend/src/auth/auth.service.spec.ts` — test baru.

**Web (ubah/hapus):**
- Modify: `web/components/DashboardShell.tsx` — hapus nav `/device-change`.
- Delete: `web/app/(dashboard)/device-change/page.tsx`.
- Modify: `web/app/(dashboard)/departments/page.tsx` — default RS Darmayu.
- Modify: `web/app/(dashboard)/users/page.tsx` — field select login-surface + kirim ke API.
- Modify: `web/app/(dashboard)/corrections/page.tsx` + `attendance/page.tsx` — reload setelah approve + tampil jam lama→baru.

**Mobile (ubah/tambah):**
- Modify: `mobile/lib/features/home/presentation/home_dashboard.dart` — hapus duplikat banner, tambah section persetujuan, badge.
- Modify: `mobile/lib/features/home/presentation/home_sections.dart` — ganti `handoverAnnouncement` dummy dengan widget data nyata.
- Modify: `mobile/lib/features/handovers/data/handover_repository.dart` — pastikan `list(status: 'ACTIVE')` dapat dipakai dari home.
- Create: `mobile/lib/features/reviews/presentation/review_queue_screen.dart` — daftar koreksi pending + review pending dengan tombol Setujui/Tolak.
- Modify: `mobile/lib/features/profile/presentation/profile_screen.dart` (atau tempat label role) — mapping `SUPERVISOR` → "Kepala Ruangan".

---
### Task 1: Backend loginSurface + auth gate

**Files:**
- Modify: `backend/prisma/schema.prisma:109-136` (model User)
- Create: `backend/prisma/migrations/20261109000000_login_surface/migration.sql`
- Modify: `backend/src/auth/dto.ts`, `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `User` model existing, `DASHBOARD_ONLY_ROLES`, DTO login `{ email, password, client?, platform? }`.
- Produces: `User.loginSurface: 'mobile'|'web'|'both'`, `LoginDto.loginSurface?` untuk create/update user, error reasons `MOBILE_ONLY_ACCOUNT` / `WEB_ONLY_ACCOUNT` (HTTP 403).

- [ ] **Step 1: Write the failing tests**

```ts
it('menolak akun mobile-only saat login web', async () => {
  await expect(service.login(dtoWeb, meta)).rejects.toThrowError(expect.objectContaining({ response: expect.objectContaining({ reason: 'MOBILE_ONLY_ACCOUNT' }) }));
});
it('menolak akun web-only saat login mobile', async () => {
  await expect(service.login(dtoMobile, meta)).rejects.toThrowError(expect.objectContaining({ response: expect.objectContaining({ reason: 'WEB_ONLY_ACCOUNT' }) }));
});
it('menerima Supervisor both di web dan mobile', async () => {
  await expect(service.login(dtoWebSupervisorBoth, meta)).resolves.toBeDefined();
  await expect(service.login(dtoMobileSupervisorBoth, meta)).resolves.toBeDefined();
});
it('Supervisor mobile-only diterima di mobile', async () => {
  await expect(service.login(dtoMobileSupervisorMobileOnly, meta)).resolves.toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- auth.service.spec.ts` (dari `backend/`)
Expected: FAIL — `loginSurface` tidak dikenal / reason belum ada.

- [ ] **Step 3: Add column + migration**

Implementasi minimal:
```prisma
loginSurface String @default("both") @map("login_surface")
```
`migration.sql`: `ALTER TABLE "users" ADD COLUMN "login_surface" TEXT NOT NULL DEFAULT 'both';` + `CHECK (login_surface IN ('mobile','web','both'))`.
DTO: `@IsOptional() @IsIn(['mobile','web','both']) loginSurface?: string`.

- [ ] **Step 4: Implement auth gate di `auth.service.ts`**

Aturan (setelah validasi kredensial, sebelum terbitkan sesi):
1. Jika `user.loginSurface === 'mobile'` dan `client === 'WEB'` → 403 `MOBILE_ONLY_ACCOUNT`.
2. Jika `user.loginSurface === 'web'` dan `client !== 'WEB'` (mobile) → 403 `WEB_ONLY_ACCOUNT`.
3. Jika `roles` mengandung `SUPERVISOR|ADMIN|SUPER_ADMIN` (dashboard-only) tapi akun bukan `both` dan bukan `mobile` untuk SUPERVISOR, tetap tolak seperti sekarang.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- auth.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261109000000_login_surface/ backend/src/auth/dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): login-surface per account (mobile/web/both) for head-of-ward"
```

---
### Task 2: Web — hapus tab perangkat, default RS, CRUD login-surface, reload koreksi

**Files:**
- Modify: `web/components/DashboardShell.tsx`, `web/app/(dashboard)/departments/page.tsx`, `web/app/(dashboard)/users/page.tsx`, `web/app/(dashboard)/corrections/page.tsx`, `web/app/(dashboard)/attendance/page.tsx`
- Delete: `web/app/(dashboard)/device-change/page.tsx`

**Interfaces:**
- Consumes: `User.loginSurface` dari Task 1 (API create/update user).
- Produces: tidak ada API baru; hanya UI.

- [ ] **Step 1: Hapus nav + halaman device-change**

```tsx
// DashboardShell.tsx — hapus baris:
{ href: '/device-change', label: 'Penggantian Perangkat', icon: 'swap', visible: superAdmin },
```
Hapus folder `web/app/(dashboard)/device-change/`.

- [ ] **Step 2: Form unit default RS Darmayu**

Di `departments/page.tsx`: ambil `hospitals.data?.[0]` (sudah RS Darmayu dari seed) sebagai default `hospitalId` untuk create; sembunyikan `Select` hospital bila `hospitals.data.length <= 1`.

- [ ] **Step 3: Field login-surface di users CRUD**

Form create/edit menambah:
```tsx
<label className="field"><span>Login bisa dari</span>
  <Select value={form.loginSurface ?? 'both'} onChange={...}>
    <option value="both">Mobile & Web</option>
    <option value="mobile">Mobile saja</option>
    <option value="web">Web saja</option>
  </Select>
</label>
```
Kirim `loginSurface` saat POST/PATCH user.

- [ ] **Step 4: Reload koreksi/attendance setelah approve**

Di `corrections/page.tsx` dan `attendance/page.tsx`: setelah `decide`/`validate` sukses, panggil `reload()` pada kedua `useResource` (daftar + statistik). Di modal, tampilkan `checkInAt` lama → `requestedCheckIn` baru.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (dari `web/`)
Expected: PASS.

```bash
git add web/components/DashboardShell.tsx web/app/ \(dashboard\)/departments/page.tsx web/app/ \(dashboard\)/users/page.tsx web/app/ \(dashboard\)/corrections/page.tsx web/app/ \(dashboard\)/attendance/page.tsx
git rm -r web/app/\(dashboard\)/device-change
git commit -m "feat(web): remove device-change tab, default hospital, login-surface CRUD, reload after approve"
```

---
### Task 3: Mobile — banner ganda, operan nyata, approve bar, label Kepala Ruangan

**Files:**
- Modify: `mobile/lib/features/home/presentation/home_dashboard.dart`, `home_sections.dart`
- Create: `mobile/lib/features/reviews/presentation/review_queue_screen.dart`
- Modify: label role (cek `mobile/lib/features/profile/...`)

**Interfaces:**
- Consumes: `GET /handovers?status=ACTIVE`, `GET /corrections?status=PENDING` (scope Supervisor), `GET /attendance/review?status=PENDING`, `POST /corrections/:id/approve|reject`, `POST /attendance/:id/review`.
- Produces: UI approve bar + badge count; label role `SUPERVISOR` → "Kepala Ruangan".

- [ ] **Step 1: Hapus duplikat banner check-in**

Di `home_dashboard.dart`, hapus satu blok `if (_needsCheckoutReminder) ...` yang duplikat (baris ~360-386). Verifikasi dengan `flutter analyze`.

- [ ] **Step 2: Banner operan data nyata**

Ganti `handoverAnnouncement()` dummy di `home_sections.dart` menjadi widget yang menerima `List<Handover> active` dan `VoidCallback onOpenHandovers`. `home_dashboard.dart` memuat `handoverRepository.list(status: 'ACTIVE')` sejajar dengan `_load()`, menampilkan operan terbaru; tombol membuka `HandoverListScreen`. Jika kosong tampilkan "Belum ada operan aktif." Teks dummy SBAR/bed 304/"Lihat Rekam Medis" dihapus.

- [ ] **Step 3: Label Kepala Ruangan**

Mapping di mobile: `SUPERVISOR` → "Kepala Ruangan", `EMPLOYEE` → "Karyawan", `ADMIN` → "Admin", `SUPER_ADMIN` → "Super Admin" pada profile chip + header beranda.

- [ ] **Step 4: Section Permintaan Persetujuan + badge**

Di `home_dashboard.dart`: jika role mengandung `SUPERVISOR`, muat `corrections?status=PENDING` dan `attendance/review?status=PENDING`, tampilkan count di badge bell (`_outboxCount + pendingDevices + pendingReviews`), dan list ringkas dengan tombol Setujui/Tolak yang memanggil endpoint approve/reject, lalu `_load()` ulang.

- [ ] **Step 5: Review queue screen (opsional, ringan)**

Halaman `ReviewQueueScreen(dio)` menampilkan daftar koreksi pending dan attendance pending dari API, tiap item dengan tombol "Setujui"/"Tolak" + field catatan, reuse pola `ReviewModal`-like simple dialog. Dipakai dari section beranda.

- [ ] **Step 6: Analyze + test + commit**

Run: `flutter analyze` dan `flutter test` (dari `mobile/`)
Expected: PASS (warnings lint yang sudah ada boleh tetap).

```bash
git add mobile/lib/features/home/presentation/home_dashboard.dart mobile/lib/features/home/presentation/home_sections.dart mobile/lib/features/reviews/presentation/review_queue_screen.dart mobile/lib/features/profile/
git commit -m "feat(mobile): single status banner, real handover, head-of-ward approve bar, role label"
```

---

## Self-Review

1. **Spec coverage:** Task 1 = flag + superadmin CRUD backend; Task 2 = web (tab hapus, RS default, CRUD UI, reload koreksi); Task 3 = mobile (banner ganda, operan nyata, approve bar, label). Semua poin spec terpetakan.
2. **Step scan:** Tiap task punya test dulu (Task 1), implementasi minimal, verifikasi, commit. Tidak ada step tanpa hasil terukur.
3. **Type consistency:** `loginSurface` konsisten `'mobile'|'web'|'both'` di schema, DTO, dan UI web.
4. **Review Focus:** 5 baris di atas masing-masing terikat Task 1 (login-surface ×4) dan Task 3 (scope supervisorId + koreksi berubah di Task 2 Step 4).
5. **Proportion:** Rencana ~120 baris untuk spec ~165 baris — berupa keputusan dan signature, bukan transkrip kode.
