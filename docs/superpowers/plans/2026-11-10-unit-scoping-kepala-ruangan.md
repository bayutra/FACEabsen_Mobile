# Unit Scoping Kepala Ruangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jadikan Kepala Ruangan (SUPERVISOR, 1 unit, 1 RS) dapat meninjau/approve & melihat antrean seluruh anggota unitnya (bukan bawahan langsung) untuk koreksi, cuti, dan review presensi, termasuk tampilan tim/ringkasan; serta ganti label user-facing "Departemen" → "Unit".

**Architecture:** Ganti scoping SUPERVISOR dari relasi `employee.supervisorId == reviewer` menjadi kesamaan `departmentId` (unit) milik karyawan reviewer, dengan penjagaan RS & fail-safe bila reviewer tak punya profil/departemen. Perubahan terpusat di helper tenant-scope + guard review/akses di corrections, leaves, attendance-query, dan supervisor service. Copy UI/laporan diubah ke "Unit" tanpa mengubah nama model/API (`Department`, `departmentId`, `/departments`).

**Tech Stack:** NestJS + Prisma (backend, Vitest), Next.js web (TypeScript/React), Flutter mobile (Dart).

**Spec:** `docs/superpowers/specs/2026-11-10-unit-scoping-kepala-ruangan-design.md`

## Global Constraints

- Scoping SUPERVISOR berbasis **`reviewer.employee.departmentId` (unit yang sama)**, 1 RS; **bukan** `supervisorId`. ADMIN (scope RS) & SUPER_ADMIN (global) tidak berubah.
- **Self-approval/review** tetap ditolak (koreksi, cuti, review presensi). Reviewer tanpa profil karyawan/`departmentId` → tidak dapat mengakses antrean/approve (fail-safe, `null`/403 sesuai konteks).
- Jangan ubah skema DB, nama model/API/field/route (`Department`, `departmentId`, `/departments`).
- "Notif" Kepala Ruangan = antrean/in-app hasil scope; push keputusan tetap ke karyawan pemohon.
- `HOSPITAL_TZ`/validasi waktu existing tidak diubah. `google-services.json` tidak di-commit.
- Setiap perubahan perilaku scope diuji (TDD). Commit terpisah per unit kerja logis.

## Review Focus

- **Reviewer tanpa departmentId / profil employee:** `resolveEmployeeTenantWhere` dan guard review/tim harus mengembalikan kosong/menolak (bukan throw tak tertangani, bukan bocor data lintas unit).
- **Self-review/approve tetap terblokir** walau target satu unit (corrections, leaves, attendance review).
- **Target beda unit/RS:** SUPERVISOR unit A tidak boleh lihat/approve anggota unit B meski dalam skenario lama mungkin "bawahan".
- **ADMIN & SUPER_ADMIN tidak regresi:** ADMIN tetap scope RS (bukan dibatasi unit reviewer), SUPER_ADMIN global.
- **String "Departemen" tersisa di output user-facing** (web, laporan PDF/XLS/CSV/JSON title/headers `ReportsService`, mobile copy) → audit & ganti ke "Unit".

---

### Task 1: Tenant scope helper — unit-based queue scoping

**Files:**
- Modify: `backend/src/auth/tenant-scope.ts`
- Create: `backend/src/auth/tenant-scope.spec.ts`

**Interfaces:**
- Consumes: Prisma `employee.findUnique` (by `userId`), `satisfiesRole`.
- Produces: `resolveEmployeeTenantWhere(prisma, userId, roles, base)` untuk non-admin (SUPERVISOR/team reviewer) mengembalikan `{ AND: [base?, { employee: { departmentId: <reviewer.departmentId> } }] }` (scoped ke unit reviewer) atau `null` jika reviewer tak punya employee/`departmentId`. SUPER_ADMIN/ADMIN perilaku tetap. (Boleh sertakan penjagaan hospital konsisten via relasi department bila tersedia.)

- [ ] **Step 1: Write the failing test** (`backend/src/auth/tenant-scope.spec.ts`)

```ts
import { describe, expect, it, vi } from 'vitest';
import { resolveEmployeeTenantWhere } from './tenant-scope.js';

const prismaOf = (reviewer: any) => ({
  employee: { findUnique: vi.fn(async () => reviewer) },
}) as any;

describe('resolveEmployeeTenantWhere (supervisor unit scope)', () => {
  it('scopes non-admin reviewer to their departmentId (unit)', async () => {
    const prisma = prismaOf({ id: 'e-sup', departmentId: 'd1', department: { hospitalId: 'h1' } });
    const where = await resolveEmployeeTenantWhere(prisma, 'u-sup', ['SUPERVISOR'], { status: 'PENDING' });
    expect(where).toEqual({ AND: [{ status: 'PENDING' }, { employee: { departmentId: 'd1' } }] });
  });

  it('returns null when reviewer has no employee or no departmentId', async () => {
    expect(await resolveEmployeeTenantWhere(prismaOf(null), 'u', ['SUPERVISOR'], {})).toBeNull();
    expect(await resolveEmployeeTenantWhere(prismaOf({ id: 'e', departmentId: null }), 'u', ['SUPERVISOR'], {})).toBeNull();
  });

  it('keeps ADMIN hospital scope and SUPER_ADMIN global behavior', async () => {
    const adminPrisma = prismaOf({ id: 'e-adm', departmentId: 'd1', department: { hospitalId: 'h1' } });
    const admin = await resolveEmployeeTenantWhere(adminPrisma, 'u-adm', ['ADMIN'], {});
    expect(JSON.stringify(admin)).toContain('hospitalId');
    const sup = await resolveEmployeeTenantWhere(prismaOf(null), 'u-sa', ['SUPER_ADMIN'], { x: 1 });
    expect(sup).toEqual({ AND: [{ x: 1 }] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/auth/tenant-scope.spec.ts -v`  
Expected: FAIL (scope masih `employee.supervisorId` / kasus null departmentId belum ditangani).

- [ ] **Step 3: Implement unit scoping in `resolveEmployeeTenantWhere`**

In `backend/src/auth/tenant-scope.ts`, non-admin branch: `findUnique` reviewer select `{ id: true, departmentId: true, department: { select: { hospitalId: true } } }`; if no reviewer or no `departmentId` return `null`; push `{ employee: { departmentId: reviewer.departmentId } }`. Pertahankan komentar/JSDoc agar mencerminkan "same unit (departmentId)" untuk SUPERVISOR.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/auth/tenant-scope.spec.ts -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/tenant-scope.ts backend/src/auth/tenant-scope.spec.ts
git commit -m "feat(scope): scope supervisor queues by unit (departmentId)"
```

---

### Task 2: Corrections — unit-based review authorization & queue tests

**Files:**
- Modify: `backend/src/corrections/corrections.service.ts`
- Modify: `backend/src/corrections/corrections.service.spec.ts`

**Interfaces:**
- Consumes: `resolveEmployeeTenantWhere` (Task 1), Prisma employee (reviewer by userId, target by id) with `departmentId`/`department.hospitalId`.
- Produces: `assertCanReview` mengizinkan SUPERVISOR bila reviewer & target satu `departmentId` (dan RS sama) dan bukan self; `listQueue` mengikuti scope unit. SUPER_ADMIN/ADMIN unchanged.

- [ ] **Step 1: Update/write failing tests in `corrections.service.spec.ts`**

Sesuaikan fixture & ekspektasi dari `supervisorId` → `departmentId` (unit): 
- `byId`/data: reviewer & target berbagi `departmentId: 'd1'` (dan context RS bila diperlukan) agar approve sukses; target beda `departmentId` → `Not authorized`.
- `listQueue` SUPERVISOR: ekspektasi `where` mengandung `employee.departmentId` (bukan `supervisorId`).
- Pertahankan: self-approval/employee tidak bisa review, double review, off-day correction, ADMIN hospital behavior bila diuji.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/corrections/corrections.service.spec.ts -v`  
Expected: FAIL pada kasus scope unit baru.

- [ ] **Step 3: Implement unit-based `assertCanReview`**

In `backend/src/corrections/corrections.service.ts`: reviewer select `{ id, departmentId, department: { select: { hospitalId: true } } }`; target select `{ id, departmentId, department: { select: { hospitalId: true } } }`. Cabang SUPERVISOR: tolak jika `!reviewerEmployee?.departmentId || !target?.departmentId || target.departmentId !== reviewerEmployee.departmentId` (dan opsional pastikan hospital konsisten); izinkan jika sama. Pertahankan self-check, SUPER_ADMIN, ADMIN (hospital scope) logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/corrections/corrections.service.spec.ts -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/corrections/corrections.service.ts backend/src/corrections/corrections.service.spec.ts
git commit -m "feat(corrections): allow supervisor approval within same unit"
```

---

### Task 3: Leaves — unit-based review authorization & queue tests

**Files:**
- Modify: `backend/src/leaves/leaves.service.ts`
- Modify: `backend/src/leaves/leaves.service.spec.ts`

**Interfaces:**
- Consumes: `resolveEmployeeTenantWhere` (Task 1), Prisma employee reviewer/target dengan `departmentId`.
- Produces: `assertCanReview` & `listQueue` SUPERVISOR berbasis unit yang sama; SUPER_ADMIN/ADMIN unchanged.

- [ ] **Step 1: Update/write failing tests in `leaves.service.spec.ts`**

Ubah fixture `supervisorId` → `departmentId` unit sama/beda: supervisor satu unit dapat approve/reject & melihat antrian unit; beda unit / bukan anggota → ditolak. `listQueue` where berisi `employee.departmentId`. Pertahankan self/outsider/employee denied, double review, cancel owner-only.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/leaves/leaves.service.spec.ts -v`  
Expected: FAIL.

- [ ] **Step 3: Implement unit-based `assertCanReview`**

Mirror Task 2 di `backend/src/leaves/leaves.service.ts`: reviewer/target load `departmentId` (+ hospital via department bila perlu); SUPERVISOR diizinkan hanya jika `target.departmentId === reviewer.departmentId` dan keduanya valid & satu RS; self-check/ADMIN/SUPER_ADMIN tetap.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/leaves/leaves.service.spec.ts -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/leaves/leaves.service.ts backend/src/leaves/leaves.service.spec.ts
git commit -m "feat(leaves): allow supervisor approval within same unit"
```

---

### Task 4: Attendance review & access — unit-based scope

**Files:**
- Modify: `backend/src/attendance/attendance-query.service.ts`
- Test: add/modify attendance-query/review specs if present under `backend/src/attendance` (search `*attendance*spec*`); if none, create `backend/src/attendance/attendance-query.service.spec.ts` covering `requireReviewScope`/`getOne`/`listReview` scoping for SUPERVISOR unit.

**Interfaces:**
- Consumes: `resolveEmployeeTenantWhere` (Task 1) for `listReview`; Prisma attendance+employee(departmentId,hospitalId) for `requireReviewScope` and `getOne`.
- Produces: SUPERVISOR dapat list/review/get attendance milik karyawan **satu unit**; self-review tetap ditolak di `review()` (sudah ada, jangan regress). ADMIN/SUPER_ADMIN/owner unchanged.

- [ ] **Step 1: Write/update failing tests**

Kasus minimal: (a) `listReview` SUPERVISOR memfilter `employee.departmentId` unit reviewer (via helper/mocked prisma shape). (b) `review`/`requireReviewScope` mengizinkan target satu unit, menolak beda unit, menolak self. (c) `getOne` mengizinkan SUPERVISOR mengakses detail karyawan satu unit, menolak beda unit.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/attendance -v` (atau file spec yang ditambah)  
Expected: FAIL pada skenario unit.

- [ ] **Step 3: Implement unit-based checks**

In `attendance-query.service.ts`:
- `requireReviewScope`: load reviewer employee `{ id, departmentId, department: { select: { hospitalId: true } } }`; ganti `row.employee.supervisorId === me.id` dengan kesamaan unit (dan hospital konsisten) `me.departmentId && row.employee.departmentId/department?.id context` — pastikan include row.employee menyeleksi `departmentId`/department info yang dibutuhkan.
- `getOne`: cabang SUPERVISOR izinkan jika reviewer & row.employee satu `departmentId` (RS sama), bukan `supervisorId`.
`listReview` otomatis mengikuti Task 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/attendance -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance/attendance-query.service.ts backend/src/attendance/*attendance*spec* 2>/dev/null || true
git commit -m "feat(attendance): scope supervisor review/access by unit"
```

---

### Task 5: Supervisor team & summary — unit-based

**Files:**
- Modify: `backend/src/supervisor/supervisor.service.ts`
- Modify: `backend/src/supervisor/supervisor.service.spec.ts`

**Interfaces:**
- Consumes: Prisma employee (reviewer with `departmentId`), `resolveHospitalScope`.
- Produces: `teamOf` (SUPERVISOR non-admin) mengembalikan karyawan aktif di **unit yang sama**; `assertInScope` mengizinkan anggota satu unit (pesan error boleh disesuaikan, mis. "Not in your unit", dan tes diperbarui). ADMIN/SUPER_ADMIN unchanged.

- [ ] **Step 1: Update failing tests in `supervisor.service.spec.ts`**

Ubah ekspektasi scope: reviewer & anggota satu `departmentId` terlihat/diizinkan; beda unit ditolak. Update pesan error assertion (`Not in your team` → label baru bila diubah). ADMIN facility scope tests tetap hijau.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/supervisor/supervisor.service.spec.ts -v`  
Expected: FAIL.

- [ ] **Step 3: Implement unit-based team/scope**

- `teamOf` cabang SUPERVISOR: ambil reviewer `{ id, departmentId }` (dan butuh profil+departmentId; jika tidak, throw/return sesuai perilaku aman — pilih konsisten & perbarui tes bila perlu). `findMany` where `{ status: 'ACTIVE', departmentId: reviewer.departmentId }` (RS tunggal).
- `assertInScope` cabang SUPERVISOR: izinkan jika `target.departmentId === reviewer.departmentId` (dan keduanya valid). `summary`/`memberDetail`/`teamAttendance` mengikuti.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/supervisor/supervisor.service.spec.ts -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/supervisor/supervisor.service.ts backend/src/supervisor/supervisor.service.spec.ts
git commit -m "feat(supervisor): show and scope team by unit"
```

---

### Task 6: Rename "Departemen" → "Unit" (user-facing)

**Files:**
- Modify: `backend/src/reports/reports.service.ts` (title/summary/headers/filename label user-facing)
- Modify: user-facing web files under `web/app` (dan `web/components` bila ada) yang masih berlabel "Departemen" — audit dengan `rg -n "Departemen|departemen" web`
- Modify: user-facing mobile strings under `mobile/lib` bila ada "Departemen" (audit `rg -n "Departemen|departemen" mobile/lib`); pertahankan makna "anggota unit Anda".

**Interfaces:**
- Produces: label/teks output ke pengguna menampilkan "Unit" (bukan "Departemen"); kontrak data/API/route tidak berubah.

- [ ] **Step 1: Audit & update failing expectations if any**

`rg -n "Departemen|departemen" backend/src web mobile/lib` dan perbarui semua kemunculan user-facing (laporan: `Laporan Unit`, header/summary `Unit`, nama file boleh `laporan-unit-...`). Jangan ubah identifier teknis.

- [ ] **Step 2: Apply changes & run checks**

Run: `cd backend && npx vitest run src/reports -v 2>&1 | tail -40` (jika ada spec reports; sesuaikan ekspektasi string), `cd web && npm run typecheck`, `cd mobile && flutter analyze`.  
Expected: hijau; tidak ada "Departemen" user-facing tersisa di area yang diubah.

- [ ] **Step 3: Commit**

```bash
git add backend/src/reports/reports.service.ts web mobile/lib
git commit -m "chore(ui): rename Departemen labels to Unit"
```

---

### Task 7: Full verification & stabilization

**Files:**
- Modify: any additional specs broken by unit-scoping rename of behavior (e.g. other `*correction*`/`*leave*`/`*attendance*`/`*supervisor*` tests outside those edited) as needed.

**Interfaces:**
- Produces: seluruh area terdampak lulus verifikasi; tidak ada regresi authz.

- [ ] **Step 1: Run targeted backend tests**

Run: `cd backend && npx vitest run src/auth/tenant-scope.spec.ts src/corrections src/leaves src/attendance src/supervisor src/reports -v`  
Expected: PASS (perbaiki kegagalan yang valid akibat perubahan scope/label).

- [ ] **Step 2: Run broader backend + build**

Run: `cd backend && npx vitest run` dan `cd backend && npm run build`  
Expected: build hijau; tes lulus (catat bila ada kegagalan flaky pre-existing yang tak terkait, verifikasi terisolasi).

- [ ] **Step 3: Run web & mobile checks**

Run: `cd web && npm run typecheck && npm run build`; `cd mobile && flutter analyze && flutter test`  
Expected: PASS.

- [ ] **Step 4: Commit fixes (if any) and push**

```bash
git add -A
git commit -m "test: stabilize unit scoping for Kepala Ruangan" # jika ada perubahan
git push origin master
```
(Commit hanya jika ada perubahan; pastikan `google-services.json` dan `node_modules` tidak ikut.)

---

## Self-Review Notes
- **Spec coverage:** queue+approve koreksi/cuti/review presensi, tim/ringkasan supervisor, rename "Departemen"→"Unit", 1 unit/1 RS, fail-safe tanpa departmentId — tercakup (Tasks 1-6).
- **Step scan:** tiap step aksi terverifikasi (tes/command/commit); implementasi diarahkan oleh signature & perilaku tanpa menyalin seluruh body.
- **Type/signature consistency:** gunakan field existing Prisma (`employee.departmentId`, relasi `department.hospitalId`) dan helper `resolveEmployeeTenantWhere`/`resolveHospitalScope`.
- **Review focus:** 5 item dipetakan ke tes/guard (reviewer tanpa dept, self, beda unit, ADMIN/SUPER_ADMIN, sisa label).
- **Proportion:** rencana fokus pada keputusan & file; detail algoritma minimal.