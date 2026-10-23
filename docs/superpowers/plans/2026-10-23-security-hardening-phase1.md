# Security Hardening Fase 1 (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup delapan temuan P0 audit: payload presensi bertanda tangan + nonce, proteksi ganti template wajah, registrasi berverifikasi email + approval, larangan self-approval, isolasi tenant, device PENDING, presensi offline 24 jam, dan outbox/idempotensi yang tidak kehilangan data.

**Architecture:** Backend NestJS menjadi satu-satunya pemutus kepercayaan. Klien menandatangani payload kanonik v1 dengan kunci Ed25519 perangkat dan memakai nonce pool 10 buah; server memverifikasi tanda tangan, mengonsumsi nonce, lalu menyimpan presensi dengan `captureAt` sebagai waktu kejadian. Identitas baru lahir nonaktif dan hanya aktif setelah verifikasi email + approval SUPER_ADMIN. Mobile menyimpan punch yang sudah ditandatangani ke outbox dan mengirim ulang payload yang sama tanpa menandatangani ulang.

**Tech Stack:** NestJS 12, Prisma 6, PostgreSQL, Redis (rate limit), nodemailer/SMTP, Flutter 3.22, `cryptography` (Ed25519 + SHA-256), flutter_secure_storage.

**Spec:** `docs/superpowers/specs/2026-10-23-security-hardening-phase1-design.md`

## Global Constraints

- `signatureVersion` wajib `"v1"`; body tanpa field ini ditolak `SIGNATURE_VERSION_REQUIRED`.
- Pesan tanda tangan persis:
  `v1|<check-in|check-out>|<deviceId>|<requestId>|<captureAt>|<queuedAt atau string kosong>|<challengeNonce>|<sha256(canonicalEmbedding)>|<sha256(canonicalLiveness)>`
- `canonicalEmbedding`: setiap nilai `toFixed(6)`/`toStringAsFixed(6)`, digabung `,`.
- `canonicalLiveness`: `mode:<mode>|passed:<1|0>|completedAt:<ISO>|score:<6 desimal>|padScore:<6 desimal, default 0.000000>|challenges:<digabung koma>`.
- `captureAt` dan `queuedAt` adalah string ISO-8601 UTC dengan milidetik, dikirim apa adanya (server tidak menormalkan ulang sebelum verifikasi tanda tangan).
- `checkInAt`/`checkOutAt` diisi `captureAt`; `syncedAt` diisi waktu server menerima. `offline=true` bila `queuedAt` ada.
- Batas waktu: online `<= LIVENESS_MAX_AGE_MIN` (10 menit); offline `<= OFFLINE_MAX_AGE_HOURS` (24 jam); `captureAt` maksimal 2 menit di masa depan; `liveness.completedAt` harus dalam ±2 menit dari `captureAt` saat offline.
- Nonce: batch 10 (`ATTENDANCE_NONCE_BATCH`), TTL 24 jam (`ATTENDANCE_CHALLENGE_TTL_MIN=1440`), sekali pakai.
- Retensi idempotensi: 25 jam (`IDEMPOTENCY_RETENTION_HOURS=25`); purge tidak boleh di jalur panas setiap request.
- Device: device pertama `ACTIVE`, berikutnya `PENDING`; maksimum `MAX_ACTIVE_DEVICES_PER_EMPLOYEE=2` device aktif; tidak ada auto-revoke.
- Email: kode 6 digit, TTL 15 menit, maksimum 5 percobaan, disimpan sebagai HMAC-SHA256.
- Lintas rumah sakit untuk non-SUPER_ADMIN selalu `404`, bukan `403`.
- Outbox maksimum 50 entri; penuh = tolak capture baru, tidak pernah membuang entri lama; tidak ada drop diam-diam.
- Semua waktu bisnis memakai `HOSPITAL_TZ=Asia/Jakarta`; `workDate` check-in dari `captureAt`, check-out dari record terbuka.
- Tidak menambah SaaS baru selain SMTP. Hard cutover: app lama tidak didukung setelah backend baru.
- Perintah verifikasi: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`, `flutter analyze`, `flutter test`.

## Review Focus

1. **Shift malam:** check-in 23:00 lalu check-out 06:30 keesokan hari harus memakai `workDate` dan shift dari record terbuka, bukan tanggal kalender check-out. Test di Task 7.
2. **Offline >24 jam:** punch harus menjadi `needsAction` dengan alasan `LIVENESS_STALE`, terlihat di UI, bukan hilang. Test di Task 16.
3. **Replay `requestId` sama:** respons pertama dikembalikan apa adanya, tidak ada baris kedua. Test di Task 5 dan Task 6.
4. **Registrasi email yang sudah terdaftar tetapi belum verifikasi:** password/nama/unit lama tidak boleh tertimpa. Test di Task 10.
5. **Device ke-3 saat batas 2:** aktivasi ditolak `409 DEVICE_LIMIT_REACHED`, device lama tidak dicabut otomatis. Test di Task 14.

---

### Task 1: Fondasi skema dan migrasi

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261023000000_security_phase1/migration.sql`
- Test: verifikasi `npx prisma validate` + `npm run build`

**Interfaces:**
- Produces: field Prisma `User.emailVerifiedAt`, `User.approvedAt`, `User.approvedById`, model `EmailVerificationCode`, field `Attendance.captureAt`, `Attendance.syncedAt`, `Attendance.offline`, `Attendance.staleAt`, field `IdempotencyKey.kind/employeeId/action/responseJson`.

- [ ] **Step 1: Ubah `schema.prisma`**

Tambahkan ke `model User` (setelah `totpEnabled`):

```prisma
  emailVerifiedAt     DateTime?             @map("email_verified_at")
  approvedAt          DateTime?             @map("approved_at")
  approvedById        String?               @map("approved_by_id")
  emailCodes          EmailVerificationCode[]
```

Tambahkan model baru setelah `TotpRecoveryCode`:

```prisma
model EmailVerificationCode {
  id         String    @id @default(cuid())
  userId     String    @map("user_id")
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash   String    @map("code_hash")
  attempts   Int       @default(0)
  expiresAt  DateTime  @map("expires_at")
  consumedAt DateTime? @map("consumed_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@map("email_verification_codes")
}
```

Tambahkan ke `model Attendance` (setelah `checkOutStatus`):

```prisma
  captureAt       DateTime?           @map("capture_at")
  syncedAt        DateTime            @default(now()) @map("synced_at")
  offline         Boolean             @default(false)
  staleAt         DateTime?           @map("stale_at")
```

Ganti `model IdempotencyKey` menjadi:

```prisma
model IdempotencyKey {
  key          String   @id
  kind         String   @default("request") @map("kind")
  employeeId   String?  @map("employee_id")
  action       String?
  responseJson Json?    @map("response_json")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@index([kind])
  @@map("idempotency_keys")
}
```

- [ ] **Step 2: Validasi skema**

Run: `cd backend; npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`.

- [ ] **Step 3: Buat migrasi tanpa apply**

Run: `cd backend; npx prisma migrate dev --create-only --name security_phase1`
Expected: folder `prisma/migrations/<timestamp>_security_phase1/migration.sql` dibuat.

- [ ] **Step 4: Tambahkan backfill ke akhir `migration.sql`**

```sql
-- Backfill waktu kejadian untuk data lama.
UPDATE "attendance" SET "capture_at" = "check_in_at", "synced_at" = "created_at"
WHERE "capture_at" IS NULL;

UPDATE "users" SET "email_verified_at" = "created_at", "approved_at" = "created_at"
WHERE "email_verified_at" IS NULL;

-- Normalkan device ACTIVE berlebih: pertahankan 2 dengan last_seen_at terbaru.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "employee_id"
    ORDER BY "last_seen_at" DESC NULLS LAST, "registered_at" DESC
  ) AS rn
  FROM "devices"
  WHERE "status" = 'ACTIVE'
),
demoted AS (
  UPDATE "devices" d SET "status" = 'PENDING'
  FROM ranked r WHERE d.id = r.id AND r.rn > 2
  RETURNING d.id, d."employee_id"
)
INSERT INTO "audit_logs" ("id", "action", "target_type", "target_id", "result", "metadata", "timestamp")
SELECT
  'audit_' || md5(random()::text || demoted.id),
  'DEVICE_DEMOTED',
  'device',
  demoted.id,
  'SUCCESS',
  jsonb_build_object(
    'employeeId', demoted."employee_id",
    'oldStatus', 'ACTIVE',
    'newStatus', 'PENDING'
  ),
  CURRENT_TIMESTAMP
FROM demoted;
```

- [ ] **Step 5: Apply dan generate**

Run: `cd backend; npx prisma migrate dev; npx prisma generate; npm run build`
Expected: migrasi sukses, build sukses (tipe baru tersedia).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add security phase 1 schema and backfill"
```

---

### Task 2: Kanonikalisasi tanda tangan v1

**Files:**
- Modify: `backend/src/attendance/helpers.ts`
- Test: `backend/src/attendance/helpers.spec.ts`

**Interfaces:**
- Produces:
  - `export interface SignPayloadV1 { action: 'check-in' | 'check-out'; deviceId: string; requestId: string; captureAt: string; queuedAt?: string; nonce: string; faceEmbedding: number[]; liveness: LivenessAttestation }`
  - `export function canonicalEmbedding(values: number[]): string`
  - `export function canonicalLiveness(att: LivenessAttestation): string`
  - `export function buildSignMessageV1(payload: SignPayloadV1): string`
- Consumes: `node:crypto` `createHash`. `buildSignMessage` lama tetap ada sampai Task 6 selesai.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `helpers.spec.ts`:

```ts
import {
  buildSignMessageV1,
  canonicalEmbedding,
  canonicalLiveness,
} from './helpers.js';

describe('signature v1', () => {
  const liveness = {
    passed: true,
    mode: 'active' as const,
    completedAt: '2026-10-23T07:00:00.000Z',
    score: 0.987654321,
    padScore: 0.5,
    challenges: ['blink', 'turn_left'],
  };

  it('memformat embedding 6 desimal', () => {
    expect(canonicalEmbedding([0.1, -0.25, 0.3333333333])).toBe(
      '0.100000,-0.250000,0.333333',
    );
  });

  it('memformat liveness deterministik', () => {
    expect(canonicalLiveness(liveness)).toBe(
      'mode:active|passed:1|completedAt:2026-10-23T07:00:00.000Z|score:0.987654|padScore:0.500000|challenges:blink,turn_left',
    );
  });

  it('membangun pesan v1 persis', () => {
    expect(
      buildSignMessageV1({
        action: 'check-in',
        deviceId: 'd1',
        requestId: '11111111-2222-3333-4444-555555555555',
        captureAt: '2026-10-23T07:00:00.000Z',
        nonce: 'nonce-abc',
        faceEmbedding: [0.1, -0.25, 0.3333333333],
        liveness,
      }),
    ).toBe(
      'v1|check-in|d1|11111111-2222-3333-4444-555555555555|2026-10-23T07:00:00.000Z||nonce-abc|666a0811ed27009b72350c48071862ff9228939118c89672bc349194caef88fb|b019db2a3f847f4fc92123aaf7f1b77be6e5dd9a1ef9f1311a02d30bd0cde14f',
    );
  });

  it('memakai string kosong untuk queuedAt online', () => {
    const msg = buildSignMessageV1({
      action: 'check-out',
      deviceId: 'd1',
      requestId: '11111111-2222-3333-4444-555555555555',
      captureAt: '2026-10-23T07:00:00.000Z',
      nonce: 'n',
      faceEmbedding: [0],
      liveness,
    });
    expect(msg.split('|')[5]).toBe('');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/helpers.spec.ts`
Expected: FAIL karena `buildSignMessageV1` belum ada.

- [ ] **Step 3: Implementasi di `helpers.ts`**

```ts
export interface SignPayloadV1 { /* persis seperti Interfaces */ }

export function canonicalEmbedding(values: number[]): string {
  return values.map((v) => v.toFixed(6)).join(',');
}

export function canonicalLiveness(att: LivenessAttestation): string {
  const mode = att.mode ?? 'active';
  const score = typeof att.score === 'number' ? att.score : 0;
  const pad = typeof att.padScore === 'number' ? att.padScore : 0;
  return [
    `mode:${mode}`,
    `passed:${att.passed ? 1 : 0}`,
    `completedAt:${att.completedAt}`,
    `score:${score.toFixed(6)}`,
    `padScore:${pad.toFixed(6)}`,
    `challenges:${(att.challenges ?? []).join(',')}`,
  ].join('|');
}

export function buildSignMessageV1(p: SignPayloadV1): string {
  const sha = (s: string) =>
    createHash('sha256').update(s, 'utf8').digest('hex');
  return [
    'v1',
    p.action,
    p.deviceId,
    p.requestId,
    p.captureAt,
    p.queuedAt ?? '',
    p.nonce,
    sha(canonicalEmbedding(p.faceEmbedding)),
    sha(canonicalLiveness(p.liveness)),
  ].join('|');
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd backend; npx vitest run src/attendance/helpers.spec.ts`
Expected: PASS (semua test lama + 4 test baru).

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance/helpers.ts backend/src/attendance/helpers.spec.ts
git commit -m "feat(attendance): add canonical v1 payload signature"
```

---

### Task 3: Validasi waktu punch online/offline

**Files:**
- Modify: `backend/src/attendance/helpers.ts`
- Test: `backend/src/attendance/helpers.spec.ts`

**Interfaces:**
- Produces:
  - `export type PunchTimeReject = 'LIVENESS_STALE' | 'CAPTURE_IN_FUTURE' | 'QUEUED_TIME_INVALID'`
  - `export function validatePunchTime(input: { captureAt: string; queuedAt?: string; livenessCompletedAt: string; now: Date; maxOnlineAgeMin: number; maxOfflineAgeHours: number }): { ok: true; offline: boolean } | { ok: false; reason: PunchTimeReject }`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { validatePunchTime } from './helpers.js';

const NOW = new Date('2026-10-23T08:00:00.000Z');
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();
const base = {
  now: NOW,
  maxOnlineAgeMin: 10,
  maxOfflineAgeHours: 24,
  captureAt: at(9 * 60_000),
  livenessCompletedAt: at(9 * 60_000),
};

it('menerima punch online 9 menit', () => {
  expect(validatePunchTime(base)).toEqual({ ok: true, offline: false });
});

it('menolak punch online 11 menit', () => {
  expect(
    validatePunchTime({ ...base, captureAt: at(11 * 60_000), livenessCompletedAt: at(11 * 60_000) }),
  ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
});

it('menerima offline 23 jam', () => {
  expect(
    validatePunchTime({
      ...base,
      captureAt: at(23 * 3600_000),
      livenessCompletedAt: at(23 * 3600_000),
      queuedAt: at(2 * 3600_000),
    }),
  ).toEqual({ ok: true, offline: true });
});

it('menolak offline 25 jam', () => {
  expect(
    validatePunchTime({
      ...base,
      captureAt: at(25 * 3600_000),
      livenessCompletedAt: at(25 * 3600_000),
      queuedAt: at(2 * 3600_000),
    }),
  ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
});

it('menolak captureAt 3 menit di masa depan', () => {
  expect(
    validatePunchTime({ ...base, captureAt: at(-3 * 60_000), livenessCompletedAt: at(0) }),
  ).toEqual({ ok: false, reason: 'CAPTURE_IN_FUTURE' });
});

it('menolak queuedAt sebelum captureAt', () => {
  expect(
    validatePunchTime({
      ...base,
      captureAt: at(2 * 3600_000),
      livenessCompletedAt: at(2 * 3600_000),
      queuedAt: at(3 * 3600_000),
    }),
  ).toEqual({ ok: false, reason: 'QUEUED_TIME_INVALID' });
});

it('menolak completedAt beda 3 menit dari captureAt saat offline', () => {
  expect(
    validatePunchTime({
      ...base,
      captureAt: at(2 * 3600_000),
      livenessCompletedAt: at(2 * 3600_000 + 3 * 60_000),
      queuedAt: at(3600_000),
    }),
  ).toEqual({ ok: false, reason: 'LIVENESS_STALE' });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/helpers.spec.ts`
Expected: FAIL `validatePunchTime is not a function`.

- [ ] **Step 3: Implementasi**

Aturan implementasi:
1. Parse `captureAt`, `livenessCompletedAt`, `queuedAt`; NaN → `LIVENESS_STALE` (queued invalid → `QUEUED_TIME_INVALID`).
2. `capture - now > 2 menit` → `CAPTURE_IN_FUTURE`.
3. `offline = queuedAt !== undefined`; jika offline dan (`queuedAt < captureAt` atau `queuedAt > now`) → `QUEUED_TIME_INVALID`.
4. Umur maksimum = `offline ? maxOfflineAgeHours*3600_000 : maxOnlineAgeMin*60_000`; `now - captureAt > max` → `LIVENESS_STALE`.
5. Jika offline dan `|completedAt - captureAt| > 2 menit` → `LIVENESS_STALE`.
6. Selain itu `{ ok: true, offline }`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd backend; npx vitest run src/attendance/helpers.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance/helpers.ts backend/src/attendance/helpers.spec.ts
git commit -m "feat(attendance): validate online and offline punch windows"
```

---

### Task 4: Nonce pool dan endpoint challenge

**Files:**
- Create: `backend/src/attendance/challenge.service.ts`
- Create: `backend/src/attendance/challenge.service.spec.ts`
- Modify: `backend/src/attendance/attendance.module.ts`
- Modify: `backend/src/attendance/attendance.controller.ts`
- Modify: `backend/src/config-validation.ts`, `backend/.env.example`

**Interfaces:**
- Produces:
  - `class ChallengeService { issue(userId: string, deviceId?: string): Promise<{ nonces: string[]; expiresAt: string }>; consume(input: { nonce: string; userId: string; deviceId: string; employeeId: string; action: 'check-in' | 'check-out' }): Promise<{ jti: string }>; release(jti: string): Promise<void> }`
  - `POST /attendance/challenge` (JWT) body `{ deviceId?: string }`, response `{ nonces: string[]; expiresAt: string }`.

- [ ] **Step 1: Tulis test yang gagal**

`challenge.service.spec.ts` memakai `new JwtService({ secret: 'test-secret' })` dan Prisma stub:

```ts
const created = new Set<string>();
const prisma = {
  idempotencyKey: {
    create: vi.fn(async ({ data }: any) => {
      if (created.has(data.key)) throw { code: 'P2002' };
      created.add(data.key);
      return data;
    }),
    delete: vi.fn(async ({ where }: any) => { created.delete(where.key); }),
  },
} as never;

it('menerbitkan 10 nonce unik', async () => {
  const res = await svc.issue('u1', 'd1');
  expect(res.nonces).toHaveLength(10);
  expect(new Set(res.nonces).size).toBe(10);
});

it('mengonsumsi nonce sekali', async () => {
  const { nonces } = await svc.issue('u1', 'd1');
  await expect(
    svc.consume({ nonce: nonces[0], userId: 'u1', deviceId: 'd1', employeeId: 'e1', action: 'check-in' }),
  ).resolves.toMatchObject({ jti: expect.any(String) });
  await expect(
    svc.consume({ nonce: nonces[0], userId: 'u1', deviceId: 'd1', employeeId: 'e1', action: 'check-in' }),
  ).rejects.toMatchObject({ response: { reason: 'CHALLENGE_INVALID' } });
});

it('menolak nonce milik device lain', async () => {
  const { nonces } = await svc.issue('u1', 'd1');
  await expect(
    svc.consume({ nonce: nonces[0], userId: 'u1', deviceId: 'd2', employeeId: 'e1', action: 'check-in' }),
  ).rejects.toMatchObject({ response: { reason: 'CHALLENGE_INVALID' } });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/challenge.service.spec.ts`
Expected: FAIL modul belum ada.

- [ ] **Step 3: Implementasi `ChallengeService`**

- Konstanta `export const ATTENDANCE_CHALLENGE_PURPOSE = 'attendance-challenge'`.
- `issue`: baca `ATTENDANCE_NONCE_BATCH` (default 10) dan `ATTENDANCE_CHALLENGE_TTL_MIN` (default 1440); untuk setiap nonce `jwt.signAsync({ sub: userId, purpose, deviceId: deviceId ?? null, jti: randomUUID() }, { expiresIn: ttlSec, issuer: 'faceabsen' })`; `expiresAt` = now + ttl.
- `consume`: `jwt.verifyAsync` dengan `{ algorithms: ['HS256'], issuer: 'faceabsen' }`; tolak bila `purpose`, `sub`, atau `deviceId` tidak cocok. Lalu `idempotencyKey.create({ data: { key: 'nonce:'+jti, kind: 'nonce', employeeId, action } })`; `P2002` → `throw new UnprocessableEntityException({ reason: 'CHALLENGE_INVALID', message: 'Sesi presensi tidak valid' })`. Return `{ jti }`.
- `release(jti)`: `deleteMany({ where: { key: 'nonce:'+jti, kind: 'nonce' } })` (deleteMany agar tidak error bila sudah hilang).
- Daftarkan di `attendance.module.ts` providers/exports; inject ke controller dan (Task 6) service.
- Controller:
```ts
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@HttpCode(HttpStatus.OK)
@Post('challenge')
challenge(@Body() body: { deviceId?: string }, @CurrentUser() user: AuthContext) {
  return this.challenge.issue(user.userId, body?.deviceId);
}
```
- Config validation: `ATTENDANCE_NONCE_BATCH` 1–20; `ATTENDANCE_CHALLENGE_TTL_MIN` 60–1440; `OFFLINE_MAX_AGE_HOURS` 1–48; `IDEMPOTENCY_RETENTION_HOURS` >= 25.
- `.env.example`: tambahkan keempat variabel dengan nilai default di atas.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd backend; npx vitest run src/attendance/challenge.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance/challenge.service.ts backend/src/attendance/challenge.service.spec.ts backend/src/attendance/attendance.module.ts backend/src/attendance/attendance.controller.ts backend/src/config-validation.ts backend/.env.example
git commit -m "feat(attendance): add single-use nonce pool challenge"
```

### Task 5: Ledger idempotensi (replay, release, purge)

**Files:**
- Create: `backend/src/attendance/idempotency.service.ts`
- Create: `backend/src/attendance/idempotency.service.spec.ts`
- Modify: `backend/src/attendance/attendance.module.ts`

**Interfaces:**
- Produces:
  - `class IdempotencyService { begin(input: { requestId: string; employeeId: string; action: 'check-in' | 'check-out' }): Promise<{ mode: 'new' } | { mode: 'replay'; response: unknown }>; complete(requestId: string, response: unknown): Promise<void>; release(requestId: string): Promise<void>; maybePurge(now?: Date): Promise<void> }`
  - Key format: `request:<requestId>`; nonce memakai `nonce:<jti>` dari Task 4.

- [ ] **Step 1: Tulis test yang gagal**

```ts
const rows = new Map<string, any>();
const prisma = {
  idempotencyKey: {
    create: vi.fn(async ({ data }: any) => {
      if (rows.has(data.key)) throw { code: 'P2002' };
      rows.set(data.key, { ...data, responseJson: null });
      return data;
    }),
    findUnique: vi.fn(async ({ where }: any) => rows.get(where.key) ?? null),
    update: vi.fn(async ({ where, data }: any) => {
      const row = { ...rows.get(where.key), ...data };
      rows.set(where.key, row);
      return row;
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      let count = 0;
      for (const [k, v] of rows) {
        if (where.key?.startsWith && k.startsWith(where.key.startsWith)) { rows.delete(k); count++; }
        else if (where.key && k === where.key) { rows.delete(k); count++; }
        else if (where.createdAt?.lt && v.createdAt < where.createdAt.lt) { rows.delete(k); count++; }
      }
      return { count };
    }),
  },
} as never;

it('replay mengembalikan respons tersimpan', async () => {
  await svc.begin({ requestId: 'r1', employeeId: 'e1', action: 'check-in' });
  await svc.complete('r1', { id: 'a1' });
  await expect(
    svc.begin({ requestId: 'r1', employeeId: 'e1', action: 'check-in' }),
  ).resolves.toEqual({ mode: 'replay', response: { id: 'a1' } });
});

it('requestId milik karyawan lain ditolak', async () => {
  await svc.begin({ requestId: 'r2', employeeId: 'e1', action: 'check-in' });
  await expect(
    svc.begin({ requestId: 'r2', employeeId: 'e2', action: 'check-in' }),
  ).rejects.toMatchObject({ response: { reason: 'REQUEST_OWNER_MISMATCH' } });
});

it('release membebaskan key', async () => {
  await svc.begin({ requestId: 'r3', employeeId: 'e1', action: 'check-in' });
  await svc.release('r3');
  await expect(svc.begin({ requestId: 'r3', employeeId: 'e1', action: 'check-in' })).resolves.toEqual({ mode: 'new' });
});

it('purge hanya sekali per jam dan memakai batas 25 jam', async () => {
  const t0 = new Date('2026-10-23T00:00:00.000Z');
  await svc.maybePurge(t0);
  await svc.maybePurge(new Date(t0.getTime() + 60_000));
  expect((prisma as any).idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/idempotency.service.spec.ts`
Expected: FAIL modul belum ada.

- [ ] **Step 3: Implementasi**

- `begin`: `create({ data: { key: 'request:'+requestId, kind: 'request', employeeId, action } })`; sukses → `{ mode: 'new' }`.
- `P2002` → `findUnique`; bila `employeeId` beda → `ConflictException({ reason: 'REQUEST_OWNER_MISMATCH' })`; bila `responseJson != null` → `{ mode: 'replay', response: row.responseJson }`; selain itu → `ConflictException({ reason: 'REQUEST_IN_PROGRESS' })`.
- `complete`: `update({ where: { key: 'request:'+requestId }, data: { responseJson: response as Prisma.InputJsonValue } })`.
- `release`: `deleteMany({ where: { key: 'request:'+requestId } })`.
- `maybePurge(now = new Date())`: field `lastPurge = 0`; bila `now - lastPurge < 3600_000` return; set `lastPurge`; `deleteMany({ where: { createdAt: { lt: new Date(now - retentionHours*3600_000) } } })` dengan `retentionHours = Number(config.get('IDEMPOTENCY_RETENTION_HOURS', 25))`. Jangan pernah memanggil purge di setiap request.
- Daftarkan provider/exports.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd backend; npx vitest run src/attendance/idempotency.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance/idempotency.service.ts backend/src/attendance/idempotency.service.spec.ts backend/src/attendance/attendance.module.ts
git commit -m "feat(attendance): add idempotency replay ledger"
```

---

### Task 6: Check-in memakai kontrak v1, nonce, dan captureAt

**Files:**
- Modify: `backend/src/attendance/dto.ts`
- Modify: `backend/src/attendance/attendance.service.ts`
- Modify: `backend/src/attendance/attendance.service.spec.ts`
- Modify: `backend/src/risk/risk.service.ts`
- Modify: `backend/src/risk/risk.service.spec.ts`
- Modify: `backend/test/attendance.e2e-spec.ts`

**Interfaces:**
- Consumes: `buildSignMessageV1`, `validatePunchTime`, `ChallengeService.consume/release`, `IdempotencyService.begin/complete/release/maybePurge`.
- Produces: DTO `CheckInDto`/`CheckOutDto` dengan `signatureVersion: 'v1'`, `captureAt`, `queuedAt?`, `challengeNonce`; `requestTimestamp` dihapus.

- [ ] **Step 1: Ubah DTO dan tulis test yang gagal**

`AttendanceSignalsDto` menjadi:

```ts
  @IsOptional()
  @IsIn(['v1'])
  signatureVersion?: 'v1';

  @IsISO8601()
  captureAt!: string;
```

Hapus `requestTimestamp`. Service wajib memeriksa `dto.signatureVersion !== 'v1'` sebelum langkah lain dan menolak `SIGNATURE_VERSION_REQUIRED` (DTO dibuat optional agar pesan error konsisten).

  @IsOptional()
  @IsISO8601()
  queuedAt?: string;

  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  challengeNonce!: string;
```

Hapus `requestTimestamp`. Tambahkan test service:

```ts
it('menolak replay dengan mengembalikan respons pertama', async () => {
  const requestId = '11111111-2222-3333-4444-555555555555';
  const first = await svc.checkIn(dto({ requestId }), 'u1');
  const second = await svc.checkIn(dto({ requestId }), 'u1');
  expect(second).toEqual(first);
  expect((prisma as any).attendance.create).toHaveBeenCalledTimes(1);
});

it('offline 2 jam memakai captureAt dan masuk review MEDIUM', async () => {
  const captureAt = new Date(Date.now() - 2 * 3600_000).toISOString();
  const res = await svc.checkIn(
    dto({
      captureAt,
      queuedAt: new Date().toISOString(),
      liveness: { ...dto().liveness, completedAt: captureAt },
    }),
    'u1',
  );
  expect(res.risk.category).toBe('MEDIUM');
  expect(res.risk.needsReview).toBe(true);
  expect((prisma as any).attendance.create.mock.calls[0][0].data.checkInAt.toISOString()).toBe(captureAt);
  expect((prisma as any).attendance.create.mock.calls[0][0].data.offline).toBe(true);
});

it('menutup record menggantung >24 jam tanpa checkOutAt palsu', async () => {
  const old = { id: 'old', checkInAt: new Date(Date.now() - 25 * 3600_000), checkOutAt: null, notes: null };
  (prisma as any).attendance.findMany.mockResolvedValue([old]);
  await svc.checkIn(dto(), 'u1');
  const upd = (prisma as any).attendance.update.mock.calls[0][0];
  expect(upd.data.staleAt).toBeInstanceOf(Date);
  expect(upd.data.checkOutAt).toBeUndefined();
  expect(upd.data.needsReview).toBe(true);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/attendance.service.spec.ts`
Expected: FAIL (DTO lama / method belum ada).

- [ ] **Step 3: Implementasi `checkIn`**

Urutan wajib:

1. `const now = new Date(); const employee = await this.requireEmployee(userId); const risk = blankRisk(false);`
2. Bila `dto.signatureVersion !== 'v1'` → `reject('SIGNATURE_VERSION_REQUIRED')` sebelum klaim idempotensi.
3. `const idem = await this.idempotency.begin({ requestId: dto.requestId, employeeId: employee.id, action: 'check-in' }); if (idem.mode === 'replay') return idem.response;`
4. `const time = validatePunchTime({ captureAt: dto.captureAt, queuedAt: dto.queuedAt, livenessCompletedAt: dto.liveness.completedAt, now, maxOnlineAgeMin: this.livenessMaxAgeMin, maxOfflineAgeHours: this.offlineMaxAgeHours });` gagal → `await this.idempotency.release(dto.requestId); return this.reject(...)`.
5. `void this.idempotency.maybePurge(now);`
6. `consent`, `requireDevice` (seperti sekarang).
7. Verifikasi tanda tangan: `buildSignMessageV1({ action: 'check-in', deviceId: dto.deviceId, requestId: dto.requestId, captureAt: dto.captureAt, queuedAt: dto.queuedAt, nonce: dto.challengeNonce, faceEmbedding: dto.faceEmbedding, liveness: dto.liveness })`. Gagal → release + reject `INVALID_SIGNATURE`.
8. `nonce = await this.challenge.consume({ nonce: dto.challengeNonce, userId, deviceId: dto.deviceId, employeeId: employee.id, action: 'check-in' })`; deklarasikan `let nonce: { jti: string } | undefined;` **sebelum** `try`; error → release + rethrow.
9. `applyIntegrity` dan `rejectIfBadIntegrity` (Task 18).
10. `const capture = new Date(dto.captureAt); const { key: workKey, date: workDate } = hospitalWorkDate(capture, this.hospitalTz);`
11. Ambil schedule: `findUnique({ where: { employeeId_workDate: { employeeId: employee.id, workDate } }, include: { shift: true } })`; kosong → release + reject `NO_SCHEDULE`.
12. `await this.closeStaleOpen(employee.id, now)`; lalu cek open: `findFirst({ where: { employeeId, checkOutAt: null, staleAt: null, workDate: { gte: new Date(workDate.getTime() - 86400_000) } }, orderBy: { checkInAt: 'desc' } })`; ada → release + reject `ALREADY_CHECKED_IN`.
13. `validateLiveness` tetap dipanggil untuk bentuk (mode/pad/challenges) dengan `maxAgeMin = time.offline ? this.offlineMaxAgeHours*60 : this.livenessMaxAgeMin`; setelah `validatePunchTime` lolos ini hanya memeriksa bentuk.
14. Face match, risk verdict; `const category = time.offline ? worseCategory(verdict.category, 'MEDIUM') : verdict.category; const flagged = time.offline || this.risk.needsReview(category);`
15. `evaluateCheckIn(capture, workKey, schedule.shift, tz)`.
16. `create({ data: { employeeId, shiftId: schedule.shiftId, scheduleId: schedule.id, workDate, checkInAt: capture, captureAt: capture, syncedAt: now, offline: time.offline, checkInStatus: evalIn.status, deviceId: device.id, riskScore: verdict.score, riskCategory: category, needsReview: flagged, notes: time.offline ? 'OFFLINE_LATE_SYNC' : null } })`.
17. Audit `CHECK_IN` metadata: `captureAt`, `syncedAt`, `offline`, `status`, `lateMinutes`, `matchScore`, risk.
18. `const response = {...}; await this.idempotency.complete(dto.requestId, response);` lalu `return response`.
19. Bungkus langkah 5–18 dalam `try/catch`; field `let committed = false` diset `true` tepat setelah `attendance.create`; di `catch`, bila `!committed` → `await this.idempotency.release(dto.requestId); if (nonce) await this.challenge.release(nonce.jti);` lalu `throw`. Bila error Prisma `P2002` pada `schedule_id`, lempar `409 ALREADY_CHECKED_IN` (jangan biarkan 500).
20. Tambahkan `private async closeStaleOpen(employeeId: string, now: Date)`: `findMany({ where: { employeeId, checkOutAt: null, staleAt: null, checkInAt: { lt: new Date(now - 24*3600_000) } } })`; untuk tiap row `update({ data: { staleAt: now, needsReview: true, notes: row.notes ? row.notes+'\nAUTO_CLOSED_PREVIOUS_DAY' : 'AUTO_CLOSED_PREVIOUS_DAY' } })` + audit `ATTENDANCE_AUTO_STALE`.
21. Setelah semua pemanggil pindah, hapus `buildSignMessage` lama dari `helpers.ts` dan test vektornya.
22. `RiskService.needsReview`: ubah menjadi `return category === 'HIGH' || (category === 'MEDIUM' && this.mediumReview);` agar HIGH selalu masuk antrean review. Tambahkan test `needsReview('HIGH') === true` meski `mediumReview=false`.

- [ ] **Step 4: Perbarui `attendance.service.spec.ts`**

- Tambahkan `idempotency` dan `challenge` stub ke `makeDeps` dan constructor.
- `prisma.attendance.findMany` (untuk stale) default `[]`.
- `prisma.attendance.create` tetap.
- `dto()` default: `signatureVersion:'v1'`, `captureAt: nowIso`, `challengeNonce:'nonce-1'`; hapus `requestTimestamp`.
- Stub `challenge.consume` mengembalikan `{ jti: 'j1' }`; `idempotency.begin` mengembalikan `{ mode:'new' }` kecuali test replay.
- Ganti test lama `STALE_REQUEST` menjadi `LIVENESS_STALE` (capture 11 menit) dan `DUPLICATE_REQUEST` menjadi replay/in-progress.
- `dto.spec.ts`: ganti payload lama dengan `signatureVersion:'v1'`, `captureAt`, `challengeNonce`; hapus semua referensi `requestTimestamp`.

- [ ] **Step 5: Perbarui e2e**

`backend/test/attendance.e2e-spec.ts`: tambahkan map `idempotencyKey` (create/findUnique/update/deleteMany), endpoint `/attendance/challenge` di app nyata (tidak perlu fake), dan helper `signedBody(action, over)` yang memakai `buildSignMessageV1`. Setiap request harus meminta challenge dulu, lalu menyertakan `challengeNonce`, `captureAt`, `queuedAt`.

- [ ] **Step 6: Jalankan semua test terkait**

Run: `cd backend; npx vitest run src/attendance; npm run test:e2e -- attendance`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/attendance backend/test/attendance.e2e-spec.ts
git commit -m "feat(attendance): enforce v1 signature, nonce, and captureAt check-in"
```

---

### Task 7: Check-out, shift malam, dan record menggantung

**Files:**
- Modify: `backend/src/attendance/attendance.service.ts`
- Modify: `backend/src/attendance/attendance.service.spec.ts`
- Modify: `backend/test/attendance.e2e-spec.ts`

**Interfaces:**
- Consumes: semua dari Task 6.
- Produces: `checkOut` memakai `workDate`/`shift` dari record terbuka; `captureAt` menyimpan waktu check-out terakhir; `offline` = `open.offline || punchOffline`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('check-out 06:30 memakai workDate shift malam 23:00', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T06:31:00.000Z'));
  const open = {
    id: 'a-night',
    workDate: new Date('2026-10-22T00:00:00.000Z'),
    checkInAt: new Date('2026-10-22T23:00:00.000Z'),
    checkOutAt: null,
    riskScore: 100,
    riskCategory: 'LOW',
    needsReview: false,
    shift: { ...SHIFT, startTime: '23:00', endTime: '07:00', overnight: true },
  };
  (prisma as any).attendance.findFirst.mockResolvedValue(open);
  const captureAt = '2026-10-23T06:30:00.000Z';
  const res = await svc.checkOut(dto({ captureAt }), 'u1');
  expect(res.workDate).toBe('2026-10-22');
  expect((prisma as any).attendance.update.mock.calls[0][0].data.checkOutAt.toISOString()).toBe(captureAt);
  vi.useRealTimers();
});

it('check-out tanpa record terbuka menolak NO_OPEN_ATTENDANCE', async () => {
  (prisma as any).attendance.findFirst.mockResolvedValue(null);
  await expect(svc.checkOut(dto(), 'u1')).rejects.toMatchObject({
    response: { reason: 'NO_OPEN_ATTENDANCE' },
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/attendance/attendance.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasi `checkOut`**

Sama seperti check-in untuk idempotensi, waktu, consent, device, signature (action `'check-out'`), nonce (`let nonce` dideklarasikan sebelum `try`), dan integrity. Perbedaannya:

1. `await closeStaleOpen(employee.id, now)`.
2. `const capture = new Date(dto.captureAt); const captureWorkDate = hospitalWorkDate(capture, tz).date;`
3. `findFirst({ where: { employeeId, checkOutAt: null, staleAt: null, workDate: { gte: new Date(captureWorkDate.getTime() - 86400_000) } }, orderBy: { checkInAt: 'desc' }, include: { shift: true } })`; null → release + reject `NO_OPEN_ATTENDANCE`.
4. `const workKey = open.workDate.toISOString().slice(0, 10); const evalOut = evaluateCheckOut(capture, workKey, open.shift, tz);`
5. `update({ data: { checkOutAt: capture, captureAt: capture, syncedAt: now, offline: (open.offline ?? false) || time.offline, checkOutStatus: evalOut.status, riskScore: Math.max(open.riskScore ?? 0, verdict.score), riskCategory: worseCategory(open.riskCategory, time.offline ? worseCategory(verdict.category, 'MEDIUM') : verdict.category), needsReview: (open.needsReview ?? false) || time.offline || this.risk.needsReview(verdict.category), notes: time.offline ? appendNote(open.notes, 'OFFLINE_LATE_SYNC') : open.notes } })`.
6. Respons, audit `CHECK_OUT` (captureAt/syncedAt/offline), `idempotency.complete`, release-on-failure seperti check-in.

- [ ] **Step 4: Tambahkan e2e shift malam**

Di `attendance.e2e-spec.ts`: buat schedule `workDate` kemarin dengan shift overnight; check-in dengan `captureAt` kemarin 23:00 (offline, `queuedAt` sekarang), lalu check-out `captureAt` hari ini 06:30; assert `workDate` tetap tanggal kemarin dan satu baris.

- [ ] **Step 5: Jalankan test**

Run: `cd backend; npx vitest run src/attendance; npm run test:e2e -- attendance`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/attendance backend/test/attendance.e2e-spec.ts
git commit -m "feat(attendance): support overnight and late checkout semantics"
```

---

### Task 8: Re-autentikasi saat mengganti template wajah

**Files:**
- Modify: `backend/src/face/dto.ts`
- Modify: `backend/src/face/face.service.ts`
- Modify: `backend/src/face/face.controller.ts`
- Create: `backend/src/face/face.service.spec.ts`
- Modify: `backend/test/face.e2e-spec.ts`

**Interfaces:**
- Produces: `RegisterFaceDto.currentPassword?: string`; `FaceService.register` menolak `403 REAUTH_FAILED` bila template sudah ada dan password tidak valid.

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('menolak ganti template tanpa currentPassword', async () => {
  await expect(svc.register(dto(), 'u1')).rejects.toMatchObject({
    response: { reason: 'REAUTH_FAILED' },
  });
});

it('menolak currentPassword salah', async () => {
  await expect(
    svc.register({ ...dto(), currentPassword: 'salah' }, 'u1'),
  ).rejects.toMatchObject({ response: { reason: 'REAUTH_FAILED' } });
});

it('mengizinkan ganti template dengan password benar dan menaikkan versi', async () => {
  const res = await svc.register({ ...dto(), currentPassword: 'Benar123!' }, 'u1', { deviceId: 'd1' });
  expect(res.version).toBe(2);
  expect(audit.log).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'FACE_UPDATED',
      metadata: expect.objectContaining({ similarity: expect.any(Number), deviceId: 'd1' }),
    }),
  );
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/face/face.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

- DTO: `@IsOptional() @IsString() @MinLength(1) @MaxLength(256) currentPassword?: string`.
- Service: impor `argon2`, `ForbiddenException`, `cosineSimilarity` dari `attendance/helpers.js`.
- Pindahkan `const existing = await this.prisma.faceTemplate.findUnique(...)` ke **sebelum** `Float32Array.from`/`crypto.encrypt`, agar password diperiksa sebelum template baru dienkripsi.
- Sebelum menulis template, bila `existing`:
  - `const ok = dto.currentPassword ? await argon2.verify(user.passwordHash, dto.currentPassword) : false;` `user` diambil dari `prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })`.
  - `!ok` → `throw new ForbiddenException({ reason: 'REAUTH_FAILED', message: 'Kata sandi diperlukan untuk mengganti wajah' })`.
  - Hitung similarity: dekripsi `existing.templateCipher` dengan `this.crypto.decrypt(Buffer.from(...), employee.id)`, ubah ke `Float32Array`, `cosineSimilarity(old, dto.template)`.
- Audit `FACE_UPDATED` metadata: `{ version, qualityScore, similarity: round3(similarity ?? 0), deviceId: meta.deviceId }`; `FACE_REGISTERED` tetap.
- `face.controller.ts`: ubah throttle `POST /face/register` menjadi `{ limit: 5, ttl: 60_000 }`; teruskan `deviceId: req.headers['x-device-id'] as string | undefined` ke `face.register(dto, userId, { ip: req.ip, deviceId })`.
- `RegisterFaceDto` tetap; controller tidak butuh DTO baru.
- Test: registrasi kedua dengan `meta.deviceId='d1'` menghasilkan audit `FACE_UPDATED` dengan `similarity` angka dan `deviceId='d1'`.

- [ ] **Step 4: Perbarui e2e**

`face.e2e-spec.ts`: registrasi kedua harus menyertakan `currentPassword`; tambah kasus 403 tanpa password.

- [ ] **Step 5: Jalankan**

Run: `cd backend; npx vitest run src/face; npm run test:e2e -- face`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/face backend/test/face.e2e-spec.ts
git commit -m "feat(face): require password re-auth before replacing template"
```

---

### Task 9: Layanan email SMTP

**Files:**
- Create: `backend/src/email/email.service.ts`
- Create: `backend/src/email/email.module.ts`
- Create: `backend/src/email/email.service.spec.ts`
- Modify: `backend/package.json` (+ lockfile)
- Modify: `backend/src/config-validation.ts`, `backend/src/security.ts`, `backend/scripts/env-check.mjs`, `backend/.env.example`
- Modify: `backend/src/security.spec.ts`

**Interfaces:**
- Produces: `class EmailService { sendVerificationCode(to: string, code: string): Promise<void> }`
- Env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `DEV_EMAIL_LOG_CODES`, `EMAIL_CODE_SECRET`.

- [ ] **Step 1: Install dependency**

Run: `cd backend; npm install nodemailer; npm install -D @types/nodemailer`
Expected: `package.json` memuat `nodemailer`.

- [ ] **Step 2: Tulis test yang gagal**

```ts
it('dev fallback menulis kode ke log, bukan mengirim', async () => {
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const svc = new EmailService(config({ NODE_ENV: 'development', DEV_EMAIL_LOG_CODES: 'true' }));
  await svc.sendVerificationCode('a@rs.test', '123456');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('123456'));
});

it('produksi tanpa SMTP menolak mengirim', async () => {
  const svc = new EmailService(config({ NODE_ENV: 'production' }));
  await expect(svc.sendVerificationCode('a@rs.test', '123456')).rejects.toThrow('SMTP belum dikonfigurasi');
});
```

- [ ] **Step 3: Implementasi**

- `EmailService` membuat transporter hanya jika `SMTP_HOST` ada: `nodemailer.createTransport({ host, port: Number(SMTP_PORT ?? 587), secure: SMTP_SECURE === 'true', auth: SMTP_USER ? { user, pass } : undefined })`.
- `sendVerificationCode`: bila transporter ada → `sendMail({ from: SMTP_FROM, to, subject: 'Kode verifikasi FACEabsen', text: 'Kode Anda: <code>. Berlaku 15 menit.' })`.
- Bila tidak ada transporter: izinkan hanya jika `NODE_ENV !== 'production'` **dan** `DEV_EMAIL_LOG_CODES === 'true'`; `logger.warn('[email] kode verifikasi untuk <to>: <code>')`. Selain itu `throw new Error('SMTP belum dikonfigurasi')`.
- `EmailModule` menyediakan dan mengekspor `EmailService`.
- `config-validation.ts`: `SMTP_PORT` 1–65535 bila ada; di production wajib `SMTP_HOST`, `SMTP_FROM`, `EMAIL_CODE_SECRET` (>=32 karakter).
- `security.ts`: tambahkan `SMTP_HOST`, `SMTP_FROM`, `EMAIL_CODE_SECRET` ke `EnvLike`; `assertProductionEnv` menolak boot bila salah satu kosong/placeholder atau `EMAIL_CODE_SECRET.length < 32`. Tambahkan test di `security.spec.ts`.
- `scripts/env-check.mjs`: tambahkan ketiga key itu ke daftar `need`, plus cek panjang `EMAIL_CODE_SECRET`.
- `.env.example`: tambahkan blok SMTP + `DEV_EMAIL_LOG_CODES=false` + placeholder `EMAIL_CODE_SECRET`.

- [ ] **Step 4: Jalankan**

Run: `cd backend; npx vitest run src/email`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/email backend/package.json backend/package-lock.json backend/src/config-validation.ts backend/scripts/env-check.mjs backend/.env.example
git commit -m "feat(email): add SMTP verification code delivery"
```

---

### Task 10: Registrasi berverifikasi email dan gerbang login

**Files:**
- Create: `backend/src/auth/email-verification.service.ts`
- Create: `backend/src/auth/email-verification.service.spec.ts`
- Modify: `backend/src/auth/dto.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`
- Modify: `backend/test/auth.e2e-spec.ts`, `backend/test/login-db.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `class EmailVerificationService { issue(userId: string, email: string): Promise<void>; verify(email: string, code: string): Promise<{ userId: string }> }`
  - `AuthService.register(dto, meta): Promise<{ status: 'VERIFICATION_SENT' }>`
  - `AuthService.verifyEmail(dto, meta): Promise<{ status: 'PENDING_APPROVAL' }>`
  - `AuthService.resendVerification(dto, meta): Promise<{ status: 'VERIFICATION_SENT' }>`
  - `LoginDto` tidak berubah; error login memakai `reason: 'EMAIL_NOT_VERIFIED' | 'PENDING_APPROVAL'`.

- [ ] **Step 1: Tulis test yang gagal**

`email-verification.service.spec.ts`:

```ts
it('kode disimpan sebagai HMAC, bukan plaintext', async () => {
  await svc.issue('u1', 'a@rs.test');
  const row = [...codes.values()][0];
  expect(row.codeHash).not.toBe('123456');
  expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
  expect(mail.sendVerificationCode).toHaveBeenCalled();
});

it('kode kedaluwarsa ditolak', async () => {
  codes.set('c1', { ...row, expiresAt: new Date(Date.now() - 1000) });
  await expect(svc.verify('a@rs.test', '123456')).rejects.toMatchObject({ response: { reason: 'INVALID_CODE' } });
});

it('5 percobaan gagal mengunci kode', async () => {
  for (let i = 0; i < 5; i++) {
    await expect(svc.verify('a@rs.test', '000000')).rejects.toBeTruthy();
  }
  await expect(svc.verify('a@rs.test', '123456')).rejects.toMatchObject({ response: { reason: 'INVALID_CODE' } });
});
```

`auth.service.spec.ts`:

```ts
it('registrasi email baru tidak mengembalikan token', async () => {
  const res = await svc.register({ name: 'A', email: 'a@rs.test', password: 'Password123!' });
  expect(res).toEqual({ status: 'VERIFICATION_SENT' });
  expect((prisma as any).session.create).not.toHaveBeenCalled();
});

it('registrasi ulang email belum verifikasi tidak menimpa password/nama', async () => {
  await svc.register({ name: 'Baru', email: 'a@rs.test', password: 'Password999!' });
  expect((prisma as any).user.update).not.toHaveBeenCalled();
  expect((prisma as any).user.create).not.toHaveBeenCalled();
});

it('login menolak email belum verifikasi', async () => {
  await expect(svc.login({ email: 'a@rs.test', password: 'Password123!' })).rejects.toMatchObject({
    response: { reason: 'EMAIL_NOT_VERIFIED' },
  });
});

it('login menolak akun belum approved', async () => {
  user.emailVerifiedAt = new Date();
  user.isActive = false;
  await expect(svc.login({ email: 'a@rs.test', password: 'Password123!' })).rejects.toMatchObject({
    response: { reason: 'PENDING_APPROVAL' },
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/auth`
Expected: FAIL.

- [ ] **Step 3: Implementasi `EmailVerificationService`**

- `issue`: `randomInt(0, 1_000_000).toString().padStart(6,'0')`; `codeHash = createHmac('sha256', secret).update(code).digest('hex')`; `updateMany` semua kode lama user `consumedAt: new Date()`; `create` kode baru dengan `expiresAt = now + 15 menit`; `email.sendVerificationCode(email, code)`.
- `verify`: cari user by email; tidak ada → `BadRequestException({ reason:'INVALID_CODE' })`. Ambil kode terbaru `consumedAt: null`. Tolak bila tidak ada, `expiresAt < now`, atau `attempts >= 5`. Bandingkan hash dengan `timingSafeEqual`, beda → increment `attempts`, throw `INVALID_CODE`. Cocok → update `consumedAt`, `user.emailVerifiedAt = now`; audit `EMAIL_VERIFIED`.
- `AuthModule` imports `EmailModule`, providers `EmailVerificationService` + `AuthService`.

- [ ] **Step 4: Ubah `AuthService.register`**

- Normalisasi email; validasi password.
- `const existing = await user.findUnique({ where: { email } })`.
- Bila `existing`: bila `!existing.emailVerifiedAt` panggil `emailVerification.issue(existing.id, email)`; **tidak** menyentuh password/nama/unit. Return `{ status: 'VERIFICATION_SENT' }`.
- Bila `employeeClash` tanpa user: return `{ status: 'VERIFICATION_SENT' }` tanpa membuat/mengubah apa pun.
- Buat User dengan `isActive: false`, Employee + role EMPLOYEE dalam transaksi (seperti sekarang), lalu `emailVerification.issue(user.id, email)`, audit `ACCOUNT_REGISTERED`, return `{ status: 'VERIFICATION_SENT' }`.

- [ ] **Step 5: Ubah gerbang login dan refresh**

Setelah password valid:
```ts
if (!user.emailVerifiedAt) throw new ForbiddenException({ reason: 'EMAIL_NOT_VERIFIED', message: 'Verifikasi email terlebih dahulu' });
if (!user.isActive) throw new ForbiddenException({ reason: 'PENDING_APPROVAL', message: 'Akun menunggu persetujuan admin' });
```
Audit `LOGIN_FAILED` dengan reason yang sama. `refresh` juga menolak bila `!prev.user.emailVerifiedAt`.

- [ ] **Step 6: Endpoint controller**

- `POST /auth/register` → `@HttpCode(202)`; throttle 5/jam.
- `POST /auth/verify-email` body `{ email, code }` → 200.
- `POST /auth/resend-verification` body `{ email }` → 202; throttle 3/15 menit.
- DTO baru `VerifyEmailDto` (`@IsEmail`, `@Matches(/^\d{6}$/)`) dan `ResendVerificationDto`.

- [ ] **Step 7: Perbarui test yang membuat `AuthService` langsung**

Cari dengan `rg "new AuthService\\(" backend/src backend/test`; tambahkan argumen `emailVerification` stub pada setiap konstruksi.

- [ ] **Step 8: Jalankan**

Run: `cd backend; npx vitest run src/auth; npm run test:e2e -- auth login`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/auth backend/src/app.module.ts backend/test/auth.e2e-spec.ts backend/test/login-db.e2e-spec.ts
git commit -m "feat(auth): add email verification and pending-approval login gates"
```

---

### Task 11: Approval admin, override email, dan seed permission

**Files:**
- Modify: `backend/src/users/dto.ts`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.controller.ts`
- Modify: `backend/src/users/users.module.ts` (bila perlu AuditModule)
- Create: `backend/src/users/users.service.spec.ts`
- Modify: `backend/prisma/seed.mjs`
- Modify: `docs/guides/DEPLOY.md`

**Interfaces:**
- Produces:
  - `POST /users/:id/approve`
  - `POST /users/:id/verify-email-override` body `{ reason: string }`
  - `PATCH /users/:id` menerima `email?: string` hanya bila `emailVerifiedAt === null`.
  - `UsersService.approve(id, actorId, meta)`, `UsersService.verifyEmailOverride(id, reason, actorId, meta)`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('approve menolak akun yang belum verifikasi email', async () => {
  await expect(svc.approve('u1', 'admin')).rejects.toMatchObject({
    response: { reason: 'EMAIL_NOT_VERIFIED' },
  });
});

it('approve mengaktifkan akun terverifikasi', async () => {
  const res = await svc.approve('u1', 'admin');
  expect(res.isActive).toBe(true);
  expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_APPROVED' }));
});

it('tidak boleh mengubah email yang sudah terverifikasi', async () => {
  await expect(
    svc.updateUser('u1', { email: 'baru@rs.test' }, 'admin'),
  ).rejects.toMatchObject({ response: { reason: 'EMAIL_ALREADY_VERIFIED' } });
});

it('override wajib alasan minimal 10 karakter', async () => {
  await expect(
    svc.verifyEmailOverride('u1', 'pendek', 'admin'),
  ).rejects.toMatchObject({ response: { reason: 'REASON_REQUIRED' } });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/users`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

- `UpdateUserDto.email?` (`@IsEmail`, `@MaxLength(255)`), normalisasi lowercase.
- `loadManageable`: perluas `select` menjadi `{ id, email, isActive, emailVerifiedAt, approvedAt }` agar guard email bisa membaca status verifikasi tanpa cast.
- `updateUser`: bila `dto.email` → `loadManageable`, `target.emailVerifiedAt` harus null; cek `user.findUnique({ where: { email } })` bentrok → `ConflictException('Email sudah dipakai')`; update `email` + `updatedAt`; audit `USER_EMAIL_CHANGED`.
- `approve`: `loadManageable`; ambil user lengkap; bila `!emailVerifiedAt` → `UnprocessableEntityException({ reason: 'EMAIL_NOT_VERIFIED' })`; set `approvedAt`, `approvedById`, `isActive: true`, reset lockout; audit `USER_APPROVED`.
- `verifyEmailOverride`: `loadManageable`; `reason.trim().length < 10` → `BadRequestException({ reason: 'REASON_REQUIRED' })`; set `emailVerifiedAt: now`; audit `USER_EMAIL_OVERRIDDEN` dengan reason.
- Controller routes dengan `@Roles('SUPER_ADMIN') @RequirePermissions('user:manage')`.
- `seed.mjs`: tambahkan `'user:manage'` ke `SUPER_ADMIN`; guard di awal `if (process.env.NODE_ENV === 'production') throw new Error('seed.mjs hanya untuk development');`. Pada upsert demo user, set `emailVerifiedAt: new Date()`, `approvedAt: new Date()`, `isActive: true` di **kedua** cabang (`create` dan `update`) agar akun demo tidak terkunci gerbang Task 10.
- Tambahkan smoke test seed: setelah `npm run seed` (dev), login salah satu demo user berhasil.
- Verifikasi `seed.prod.mjs` sudah memuat `user:manage` untuk `SUPER_ADMIN`; bila belum, tambahkan. Seed produksi tidak boleh membuat password demo.
- `DEPLOY.md`: ganti `npx prisma db seed` menjadi `node prisma/seed.prod.mjs` dan jelaskan seed dev dilarang di produksi.

- [ ] **Step 4: Jalankan**

Run: `cd backend; npx vitest run src/users; npm run test:e2e -- users`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/users backend/prisma/seed.mjs docs/guides/DEPLOY.md
git commit -m "feat(users): add approval flow and harden seed"
```

### Task 12: Larangan self-approval

**Files:**
- Modify: `backend/src/corrections/corrections.service.ts`
- Modify: `backend/src/leaves/leaves.service.ts`
- Modify: `backend/src/attendance/attendance.service.ts`
- Modify: `backend/src/corrections/corrections.service.spec.ts` (bila ada; jika tidak, tambah kasus di e2e)
- Modify: `backend/src/leaves/leaves.service.spec.ts` (idem)
- Modify: `backend/src/attendance/attendance.service.spec.ts`

**Interfaces:**
- Consumes: `resolveHospitalScope`, `satisfiesRole`.
- Produces: `403 SELF_APPROVAL_FORBIDDEN` untuk reviewer yang employee-nya sama dengan target, termasuk SUPER_ADMIN.

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('supervisor tidak bisa menyetujui koreksi sendiri', async () => {
  await expect(
    svc.approve('c1', 'u-self', ['SUPERVISOR'], 'APPROVE'),
  ).rejects.toMatchObject({ response: { reason: 'SELF_APPROVAL_FORBIDDEN' } });
});

it('SUPER_ADMIN juga tidak bisa menyetujui pengajuan sendiri', async () => {
  await expect(
    svc.approve('c1', 'u-self', ['SUPER_ADMIN'], 'APPROVE'),
  ).rejects.toMatchObject({ response: { reason: 'SELF_APPROVAL_FORBIDDEN' } });
});

it('attendance review sendiri ditolak', async () => {
  (prisma as any).attendance.findUnique.mockResolvedValue({
    id: 'a1',
    employeeId: 'e1',
    employee: { id: 'e1', supervisorId: 'e1', department: { hospitalId: 'h1' } },
  });
  await expect(svc.review('a1', { decision: 'APPROVE' }, 'u1', ['SUPERVISOR'])).rejects.toMatchObject({
    response: { reason: 'SELF_APPROVAL_FORBIDDEN' },
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/corrections src/leaves src/attendance`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

- Di `assertCanReview` (corrections & leaves), paling awal:
```ts
const reviewer = await this.prisma.employee.findUnique({
  where: { userId: reviewerId },
  select: { id: true },
});
if (reviewer?.id === employeeId) {
  throw new ForbiddenException({ reason: 'SELF_APPROVAL_FORBIDDEN', message: 'Tidak dapat menyetujui pengajuan sendiri' });
}
```
Gunakan `reviewer` yang sama untuk cabang supervisor (hindari query ganda).
- Di `AttendanceService.review`, setelah `requireReviewScope`:
```ts
const reviewer = await this.prisma.employee.findUnique({ where: { userId }, select: { id: true } });
if (reviewer?.id === row.employeeId) {
  throw new ForbiddenException({ reason: 'SELF_APPROVAL_FORBIDDEN', message: 'Tidak dapat mereview presensi sendiri' });
}
```
- Audit percobaan dengan `*_SELF_APPROVAL_BLOCKED` (metadata `{ targetEmployeeId, actorUserId }`).

- [ ] **Step 4: Jalankan**

Run: `cd backend; npx vitest run src/corrections src/leaves src/attendance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/corrections backend/src/leaves backend/src/attendance
git commit -m "fix(security): block self-approval in all review flows"
```

---

### Task 13: Isolasi tenant laporan, hospital, dan handover

**Files:**
- Modify: `backend/src/reports/reports.service.ts`
- Modify: `backend/src/employees/employees.service.ts`
- Modify: `backend/src/employees/hospitals.controller.ts`
- Modify: `backend/src/handovers/handovers.service.ts`
- Modify: `backend/test/reports.e2e-spec.ts`
- Create: `backend/src/handovers/handovers.service.spec.ts`

**Interfaces:**
- Produces: `EmployeesService.listHospitals(userId: string, roles: string[])`; handover `create` memvalidasi target satu hospital; `findOne`/`list` menangani `SUPER_ADMIN` dan memakai `handover.hospitalId`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// reports
it('ADMIN RS A mendapat 404 untuk laporan karyawan RS B', async () => {
  await expect(
    svc.employee('e-rs-b', '2026-10-01', '2026-10-31', 'u-admin-a', ['ADMIN']),
  ).rejects.toMatchObject({ response: { statusCode: 404 } });
});

// handovers
it('menolak handover ke karyawan rumah sakit lain', async () => {
  await expect(
    svc.create({ toEmployeeId: 'e-lain', title: 'Operan' }, 'u1'),
  ).rejects.toMatchObject({ response: { reason: 'HANDOVER_TARGET_INVALID' } });
});

it('SUPER_ADMIN dapat membaca handover lintas RS', async () => {
  await expect(svc.findOne('h1', 'u-super', ['SUPER_ADMIN'])).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/handovers; npm run test:e2e -- reports`
Expected: FAIL.

- [ ] **Step 3: Implementasi laporan**

`reports.employee`:
```ts
const scope = await resolveHospitalScope(this.prisma, userId, roles);
const isSuper = satisfiesRole(roles, 'SUPER_ADMIN');
const sameHospital =
  scope.kind === 'hospital' &&
  target.department?.hospitalId === scope.hospitalId;
const isOwner = me?.id === id;
const isSupervisor = target.supervisorId === me?.id;
const sameHospitalAdmin = satisfiesRole(roles, 'ADMIN') && sameHospital;
if (!isSuper && (!sameHospital || !(isOwner || isSupervisor || sameHospitalAdmin))) {
  throw new NotFoundException('Employee not found');
}
```
Dengan aturan ini, supervisor dari RS A tidak bisa membaca laporan karyawan RS B meskipun `supervisorId` menunjuk ke dirinya (data lama/kotor), dan ADMIN tetap hanya RS-nya.

- [ ] **Step 4: Implementasi hospital list**

`EmployeesService.listHospitals(userId, roles)`: SUPER_ADMIN → semua; selain itu `resolveHospitalScope`; `none` → `[]`; `hospital` → `findMany({ where: { id: scope.hospitalId } })`. Controller meneruskan `user.userId, user.roles`.

- [ ] **Step 5: Implementasi handover**

- `create`: bila `dto.toEmployeeId`, ambil target + `department.hospitalId`; bila target tidak ada atau hospital beda → `BadRequestException({ reason: 'HANDOVER_TARGET_INVALID' })`.
- `findOne`: `SUPER_ADMIN` → return; `SUPERVISOR` → resolve `me`, ambil handover dengan `fromEmployee.supervisorId`/`toEmployee.supervisorId`, izinkan hanya bila `handover.hospitalId === scope.hospitalId` **dan** salah satu employee di-supervisi `me`; selain itu 404; non-supervisor → ambil employee `me`, return hanya bila (`fromEmployeeId === me.id` atau `toEmployeeId === me.id`) **dan** `handover.hospitalId === me.department.hospitalId`; selain itu 404.
- `list`: `SUPER_ADMIN` → semua (opsional `status`); `SUPERVISOR` → `hospitalId: scope.hospitalId` **dan** `OR: [{ fromEmployee: { supervisorId: me.id } }, { toEmployee: { supervisorId: me.id } }]`; selain itu peserta dengan filter `OR: [{ fromEmployeeId: me.id }, { toEmployeeId: me.id }]` **dan** `hospitalId: me.department.hospitalId`.
- `acknowledge`: tetap `SUPERVISOR`; `findOne` sudah menegakkan scope.

- [ ] **Step 6: Jalankan**

Run: `cd backend; npx vitest run src/handovers; npm run test:e2e -- reports`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/reports backend/src/employees backend/src/handovers backend/test/reports.e2e-spec.ts
git commit -m "fix(security): enforce hospital tenant scope"
```

---

### Task 14: Device PENDING dan batas device aktif

**Files:**
- Modify: `backend/src/devices/devices.service.ts`
- Modify: `backend/src/devices/devices.module.ts` (ConfigModule bila belum)
- Create: `backend/src/devices/devices.service.spec.ts`
- Modify: `backend/test/devices.e2e-spec.ts`
- Modify: `backend/.env.example`, `backend/src/config-validation.ts`

**Interfaces:**
- Produces: `register` memilih `ACTIVE` bila belum ada device aktif, selain itu `PENDING`; `activate` menolak `409 DEVICE_LIMIT_REACHED` bila batas tercapai.
- Config: `MAX_ACTIVE_DEVICES_PER_EMPLOYEE=2`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('device kedua terdaftar PENDING', async () => {
  (prisma as any).device.count.mockResolvedValue(1);
  const res = await svc.register(dto(), 'u1');
  expect(res.status).toBe('PENDING');
});

it('aktivasi device ke-3 ditolak saat batas 2', async () => {
  (prisma as any).device.count.mockResolvedValue(2);
  await expect(svc.activate('d3', 'admin', ['SUPER_ADMIN'])).rejects.toMatchObject({
    response: { reason: 'DEVICE_LIMIT_REACHED' },
  });
});

it('device pertama ACTIVE', async () => {
  (prisma as any).device.count.mockResolvedValue(0);
  const res = await svc.register(dto(), 'u1');
  expect(res.status).toBe('ACTIVE');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/devices/devices.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

- Constructor `DevicesService` tambah `config: ConfigService`; `this.maxActive = Number(config.get('MAX_ACTIVE_DEVICES_PER_EMPLOYEE', 2))`.
- `register`: bungkus `count` + `create` dalam `this.prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })`; `status: active === 0 ? 'ACTIVE' : 'PENDING'`. Retry sekali bila Prisma melempar `P2034` (serialization conflict), lalu lempar `409 DEVICE_REGISTRATION_CONFLICT`.
- `activate`: bungkus `count` + `update` dalam transaksi `Serializable` yang sama; `const active = await tx.device.count({ where: { employeeId: device.employeeId, status: 'ACTIVE', NOT: { id } } }); if (active >= this.maxActive) throw new ConflictException({ reason: 'DEVICE_LIMIT_REACHED', message: 'Cabut salah satu device aktif terlebih dahulu' });` Retry `P2034` sekali.
- Audit `DEVICE_REGISTERED` metadata memuat status; `DEVICE_ACTIVATED` tetap.
- Config validation: `MAX_ACTIVE_DEVICES_PER_EMPLOYEE` 1–5; `.env.example` tambahkan.
- E2E: sesuaikan ekspektasi device kedua menjadi `PENDING`; tambah kasus aktivasi melebihi batas.

- [ ] **Step 4: Jalankan**

Run: `cd backend; npx vitest run src/devices; npm run test:e2e -- devices`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/devices backend/test/devices.e2e-spec.ts backend/src/config-validation.ts backend/.env.example
git commit -m "feat(devices): require approval for additional devices"
```

---

### Task 15: Mobile — tanda tangan v1 dan nonce pool

**Files:**
- Create: `mobile/lib/features/attendance/data/signature_v1.dart`
- Create: `mobile/test/attendance_signature_v1_test.dart`
- Modify: `mobile/lib/core/storage/secure_store.dart`
- Modify: `mobile/lib/features/attendance/data/attendance_repository.dart`
- Modify: `mobile/test/attendance_outbox_flush_test.dart`, `mobile/test/fakes.dart` (bila perlu)

**Interfaces:**
- Produces:
  - `class SignatureV1 { static String canonicalEmbedding(List<double> values); static String canonicalLiveness(Map<String, Object?> liveness); static Future<String> sha256Hex(String value); static Future<String> message({required String action, required String deviceId, required String requestId, required String captureAt, String? queuedAt, required String nonce, required List<double> embedding, required Map<String, Object?> liveness}); }`
  - `class PreparedPunch { final PunchKind kind; final Map<String, Object?> payload; final String requestId; final DateTime captureAt; final DateTime? queuedAt; }`
  - `class AttendanceOffline implements Exception { final PreparedPunch? prepared; }`
  - `SecureStore.readNoncePool()/writeNoncePool(List<String>)/clearNoncePool()`
  - `AttendanceRepository.ensureNoncePool()`, `Future<PreparedPunch> preparePunch({required PunchKind kind, required List<double> embedding, required Map<String,Object> liveness, required String deviceId, required bool compromised, String? integrityToken, String? requestId, String? captureAt, String? queuedAt})`.

- [ ] **Step 1: Tulis test vektor yang gagal**

```dart
test('pesan v1 sama persis dengan backend', () async {
  final String msg = await SignatureV1.message(
    action: 'check-in',
    deviceId: 'd1',
    requestId: '11111111-2222-3333-4444-555555555555',
    captureAt: '2026-10-23T07:00:00.000Z',
    nonce: 'nonce-abc',
    embedding: <double>[0.1, -0.25, 0.3333333333],
    liveness: <String, Object?>{
      'passed': true,
      'mode': 'active',
      'completedAt': '2026-10-23T07:00:00.000Z',
      'score': 0.987654321,
      'padScore': 0.5,
      'challenges': <String>['blink', 'turn_left'],
    },
  );
  expect(
    msg,
    'v1|check-in|d1|11111111-2222-3333-4444-555555555555|2026-10-23T07:00:00.000Z||nonce-abc|666a0811ed27009b72350c48071862ff9228939118c89672bc349194caef88fb|b019db2a3f847f4fc92123aaf7f1b77be6e5dd9a1ef9f1311a02d30bd0cde14f',
  );
});
```

Test nonce pool:

```dart
test('ensureNoncePool mengambil batch saat stok < 3', () async {
  final Dio dio = Dio()..httpClientAdapter = _CapturingAdapter();
  final FakeStore store = FakeStore();
  await AttendanceRepository(dio: dio, store: store).ensureNoncePool();
  expect((await store.readNoncePool()).length, 10);
});

test('preparePunch mengonsumsi satu nonce', () async {
  await store.writeNoncePool(<String>['n1', 'n2', 'n3']);
  final PreparedPunch p = await repo.preparePunch(/* ... */);
  expect(await store.readNoncePool(), <String>['n2', 'n3']);
  expect(p.payload['queuedAt'], isNull);
});

test('gagal jaringan menandatangani ulang dengan queuedAt dan requestId sama', () async {
  await store.writeNoncePool(<String>['n1', 'n2', 'n3']);
  dio.httpClientAdapter = _NetworkFailAdapter();
  try {
    await repo.checkIn(/* ... */);
    fail('harus melempar AttendanceOffline');
  } on AttendanceOffline catch (e) {
    expect(e.prepared, isNotNull);
    expect(e.prepared!.payload['queuedAt'], isNotNull);
    expect(e.prepared!.requestId, isNotEmpty);
    expect(await store.readNoncePool(), <String>['n3']);
  }
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd mobile; flutter test test/attendance_signature_v1_test.dart`
Expected: FAIL (file/API belum ada).

- [ ] **Step 3: Implementasi `SignatureV1`**

Gunakan `package:cryptography/cryptography.dart`:
```dart
static Future<String> sha256Hex(String value) async {
  final Hash hash = await Sha256().hash(utf8.encode(value));
  return hash.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}
```
`canonicalLiveness` harus identik dengan backend: `mode`, `passed`, `completedAt`, `score`, `padScore`, `challenges`; angka `toStringAsFixed(6)`; default mode `active`, score `0`, padScore `0`, challenges `[]`.

- [ ] **Step 4: Implementasi nonce pool**

- `SecureStore`: key `attendance_nonce_pool_<sub>` (memakai `_deviceScope()` seperti device id), method baca/tulis/hapus. Format JSON `List<String>`.
- `AttendanceRepository.ensureNoncePool`: baca pool; bila `length >= 3` return; POST `/attendance/challenge` body `{ 'deviceId': await store.readDeviceId() }`; simpan `(data['nonces'] as List).cast<String>()`; bila gagal jaringan, biarkan pool apa adanya.
- `_takeNonce`: ambil elemen pertama pool, tulis sisanya; bila kosong throw `StateError('NONCE_POOL_EMPTY')`.
- `preparePunch`: gunakan `requestId ?? Uuid().v4()`, `captureAt ?? DateTime.now().toUtc().toIso8601String()`, `queuedAt` apa adanya (null untuk percobaan online pertama), `nonce = await _takeNonce()`; bangun `payload` (deviceId, embedding, liveness, `requestId`, `captureAt`, `queuedAt` bila ada, `challengeNonce`, `signatureVersion:'v1'`, `signature`, `deviceCompromised`, opsional `integrityToken`); return `PreparedPunch` (belum menyentuh `OutboxEntry`).
- `checkIn`/`checkOut`: `ensureNoncePool()`; bila `pool.length < 2` → lempar `NoncePoolLow` dengan pesan `Sambungkan internet untuk memuat sesi presensi` (capture diblokir sebelum scan). Lalu `let prepared = await preparePunch(...)`; POST `prepared.payload`.
- Bila jaringan/5xx/429 → **tanda tangani ulang** payload queued: `prepared = await preparePunch(same kind/embedding/liveness/deviceId/compromised, requestId: prepared.requestId, captureAt: prepared.captureAt, queuedAt: DateTime.now().toUtc().toIso8601String())`; `throw AttendanceOffline(prepared: prepared)`. RequestId dan captureAt tetap sama sehingga replay server tetap idempoten; nonce baru dipakai karena nonce pertama belum tentu sampai server.
- Bila `preparePunch` gagal karena pool kosong saat re-sign, lempar `AttendanceOffline(prepared: null)` dengan pesan `Sesi presensi habis; sambungkan internet` — UI wajib menampilkan ini, bukan membuang capture.
- `AttendanceOffline` yang lama diubah dari `AttendanceOffline([this.cause])` menjadi `AttendanceOffline({this.prepared, this.cause})`; perbarui semua `catch` di presentation.

- [ ] **Step 5: Perbarui test flush yang ada**

`attendance_outbox_flush_test.dart` tetap harus lulus dengan entry.payload; sesuaikan helper jika signature test vector mengharuskan nonce pool diisi (`store.writeNoncePool(List.generate(10, (i) => 'n$i'))`). Hapus assertion lama `idB != idA` dan ganti menjadi `idB == idA` (retry memakai requestId yang sama); assert `captureAt` dan `signature` tidak berubah. Cari `requestTimestamp` di seluruh `mobile/test` (`attendance_cancel_test.dart`, `attendance_retry_test.dart`, `attendance_liveness_payload_test.dart`) dan ganti dengan `captureAt`/`challengeNonce`; test yang memalsukan `AttendanceRepository` harus menyediakan nonce pool.

- [ ] **Step 6: Jalankan**

Run: `cd mobile; flutter test test/attendance_signature_v1_test.dart test/attendance_outbox_flush_test.dart`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/features/attendance mobile/lib/core/storage/secure_store.dart mobile/test
git commit -m "feat(mobile): sign v1 payloads with nonce pool"
```

---

### Task 16: Mobile — outbox tahan lama dan klasifikasi flush

**Files:**
- Modify: `mobile/lib/features/attendance/data/outbox_repository.dart`
- Modify: `mobile/lib/features/attendance/data/attendance_repository.dart`
- Modify: `mobile/test/outbox_repository_test.dart`
- Modify: `mobile/test/attendance_outbox_flush_test.dart`

**Interfaces:**
- Produces:
  - `class OutboxEntry { PunchKind kind; Map<String, Object?> payload; String requestId; DateTime captureAt; DateTime queuedAt; int attempts; String? lastError; bool needsAction; }` + `factory OutboxEntry.fromPrepared(PreparedPunch p)`.
  - `OutboxRepository.maxEntries = 50`; `save` melempar `OutboxFullException` saat penuh.
  - `FlushResult` menambah `needsAction`; entri tidak pernah dihapus diam-diam.

- [ ] **Step 1: Tulis test yang gagal**

```dart
test('tidak membuang entri lama saat penuh', () async {
  for (var i = 0; i < 50; i++) {
    await box.save(_entry(requestId: 'r$i'));
  }
  expect(() => box.save(_entry(requestId: 'r50')), throwsA(isA<OutboxFullException>()));
  expect(await box.count(), 50);
  expect((await box.load()).first.requestId, 'r0');
});

test('entri lama tanpa payload menjadi needsAction, tidak dikirim', () async {
  await store.writeOutbox(jsonEncode(<Object?>[
    {'kind': 'checkIn', 'embedding': <double>[0.1], 'liveness': {'passed': true}, 'deviceId': 'd1', 'compromised': false, 'queuedAt': '2026-10-07T07:05:00.000Z'},
  ]));
  final List<OutboxEntry> loaded = await box.load();
  expect(loaded.single.needsAction, isTrue);
  expect(loaded.single.lastError, 'LEGACY_ENTRY');
});

test('flush berhenti pada 401 dan mempertahankan entri', () async {
  dio.httpClientAdapter = _StatusAdapter(401, 'UNAUTHORIZED');
  final FlushResult res = await repo.flushOutbox(outbox: box);
  expect(res.sent, 0);
  expect(await box.count(), 1);
});

test('flush mengirim ulang payload tersimpan dengan requestId yang sama', () async {
  final OutboxEntry entry = _entry(requestId: 'r-keep');
  await box.save(entry);
  await repo.flushOutbox(outbox: box);
  final Map<String, dynamic> body = adapter.bodies.single;
  expect(body['requestId'], 'r-keep');
  expect(body['signatureVersion'], 'v1');
  expect(body['signature'], entry.payload['signature']);
  expect(body.containsKey('requestTimestamp'), isFalse);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd mobile; flutter test test/outbox_repository_test.dart test/attendance_outbox_flush_test.dart`
Expected: FAIL.

- [ ] **Step 3: Implementasi model**

- `toJson` memuat semua field; `fromJson` mengembalikan `null` hanya untuk data yang tidak bisa dipulihkan (bukan Map). Entri legacy (tanpa `payload`/`requestId`/`captureAt`) dikembalikan dengan `needsAction: true`, `lastError: 'LEGACY_ENTRY'`, `payload: const {}`.
- Factory `OutboxEntry.fromPrepared(PreparedPunch p)` menyalin `payload`, `requestId`, `captureAt`, `queuedAt` (fallback `DateTime.now().toUtc()`), `kind`, `attempts: 0`, `needsAction: false`; dipakai UI saat menangkap `AttendanceOffline.prepared`.
- `save`: `if (entries.length >= maxEntries) throw OutboxFullException();` lalu append. Hapus loop eviction.
- `replaceAll`: tidak memotong; bila > maxEntries throw.
- `SecureStore` outbox key per `sub`; `readOutbox` membaca key baru, bila kosong baca key lama `attendance_outbox_v1` lalu migrasikan.

- [ ] **Step 4: Implementasi flush**

Untuk setiap entri FIFO:
1. Bila `needsAction` → lewati, hitung.
2. POST `entry.kind == checkIn ? '/attendance/check-in' : '/attendance/check-out'` dengan `entry.payload`.
3. Sukses → buang dari antrean (hanya ini yang boleh menghapus).
4. `401`/`403` → hentikan loop, simpan entri dan sisanya; set `lastError` bila 403.
5. Jaringan/5xx/429 → hentikan loop, `attempts++`; bila `attempts >= 5` → `needsAction = true`, `lastError = 'MAX_ATTEMPTS'`.
6. Penolakan definitif (whitelist Global Constraints) → `needsAction = true`, `lastError = reason`; jangan dihapus.
7. `replaceAll(kept)` sekali di akhir; `FlushResult(sent, needsAction, pending, dropReasons)`.

- [ ] **Step 5: Jalankan**

Run: `cd mobile; flutter test test/outbox_repository_test.dart test/attendance_outbox_flush_test.dart`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/attendance mobile/lib/core/storage/secure_store.dart mobile/test
git commit -m "fix(mobile): make outbox durable and classify flush failures"
```

---

### Task 17: Mobile — verifikasi email, approval, dan device pending

**Files:**
- Create: `mobile/lib/features/auth/presentation/verify_email_screen.dart`
- Modify: `mobile/lib/features/auth/data/auth_repository.dart`
- Modify: `mobile/lib/features/auth/presentation/register_screen.dart`
- Modify: `mobile/lib/features/auth/presentation/login_screen.dart`
- Modify: `mobile/lib/features/attendance/presentation/attendance_screen.dart`
- Modify: `mobile/test/fakes.dart`
- Create/Modify: `mobile/test/verify_email_screen_test.dart`, `mobile/test/register_screen_test.dart`, `mobile/test/login_screen_test.dart`

**Interfaces:**
- Produces:
  - `AuthRepository.register(...) -> Future<void>` (tidak menyimpan token)
  - `AuthRepository.verifyEmail({required String email, required String code}) -> Future<void>`
  - `AuthRepository.resendVerification(String email) -> Future<void>`
  - `LoginScreen` memetakan `EMAIL_NOT_VERIFIED`/`PENDING_APPROVAL`.

- [ ] **Step 1: Tulis test yang gagal**

```dart
testWidgets('register mengarah ke layar verifikasi, bukan home', (tester) async {
  await tester.pumpWidget(appWith(FakeAuthRepository()));
  await fillRegisterForm(tester);
  await tester.tap(find.text('Daftar'));
  await tester.pumpAndSettle();
  expect(find.byType(VerifyEmailScreen), findsOneWidget);
  expect(find.text('Kode verifikasi'), findsOneWidget);
});

testWidgets('login menampilkan pesan menunggu approval', (tester) async {
  await tester.pumpWidget(appWith(FakeAuthRepository(pendingApproval: true)));
  await fillLoginForm(tester);
  await tester.tap(find.text('Masuk'));
  await tester.pumpAndSettle();
  expect(find.textContaining('menunggu persetujuan'), findsOneWidget);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd mobile; flutter test test/register_screen_test.dart test/login_screen_test.dart`
Expected: FAIL.

- [ ] **Step 3: Implementasi repository**

- `register`: POST, tidak memanggil `_storeSession`; return.
- `verifyEmail`: POST `/auth/verify-email`; `resendVerification`: POST `/auth/resend-verification`.
- `_storeSession` tetap dipakai login/TOTP.
- `logout`: panggil `clearOutbox()` dan `clearNoncePool()` **sebelum** `clearTokens()` (key outbox/nonce di-scope oleh `sub`; setelah token dihapus scope menjadi `anon`).
- `home_shell.dart`: pada `initState`, `didChangeAppLifecycleState(resumed)`, dan setelah login sukses panggil `ensureNoncePool()` lalu `flushOutbox()` secara fire-and-forget (jangan memblokir UI). Tampilkan jumlah entri `needsAction` di dashboard.
- Bila consent dicabut (aksi yang ada di `home_dashboard.dart`), panggil `clearOutbox()` + `clearNoncePool()` sebelum logout agar data biometrik tertunda tidak tersisa.

- [ ] **Step 4: Implementasi UI**

- `VerifyEmailScreen`: field 6 digit, tombol Verifikasi, tombol Kirim Ulang (cooldown 60 detik), pesan sukses `Akun menunggu persetujuan admin`, tombol kembali ke login.
- `RegisterScreen._submit`: hapus `widget.devices.register()` dan navigasi `pop(true)`; setelah register sukses push `VerifyEmailScreen(email: ...)`.
- `LoginScreen`: tangkap `DioException` 403; `response.data['reason']`:
  - `EMAIL_NOT_VERIFIED` → tampilkan pesan + tombol ke verifikasi.
  - `PENDING_APPROVAL` → pesan menunggu approval.
- `AttendanceScreen`: bila `DEVICE_NOT_ACTIVE`, tampilkan banner `Perangkat menunggu aktivasi admin`; jangan arahkan ke scan.
- `AttendanceScreen` catch `AttendanceOffline`: bila `e.prepared != null`, `await outbox.save(OutboxEntry.fromPrepared(e.prepared!))` dan tampilkan `Presensi tersimpan, akan dikirim saat online`; bila `prepared == null`, tampilkan error sesi habis dan **jangan** menutup layar seolah sukses.
- `AttendanceScreen`: sebelum memulai scan, panggil `ensureNoncePool()`; bila pool < 2 tampilkan pesan `Sambungkan internet untuk memuat sesi presensi` dan nonaktifkan tombol scan.

- [ ] **Step 5: Perbarui fakes dan test**

`FakeAuthRepository.register` tidak mengembalikan token; tambah flag `pendingApproval`/`unverified`; method `verifyEmail`/`resendVerification`.

- [ ] **Step 6: Jalankan**

Run: `cd mobile; flutter test test/register_screen_test.dart test/login_screen_test.dart test/verify_email_screen_test.dart`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/lib/features/auth mobile/lib/features/attendance/presentation mobile/test
git commit -m "feat(mobile): add email verification and pending approval UX"
```

---

### Task 18: Hapus klaim integritas yang belum terbukti

**Files:**
- Modify: `backend/src/integrity/integrity.service.ts`
- Modify: `backend/src/attendance/attendance.service.ts`
- Modify: `backend/src/integrity/integrity.service.spec.ts`
- Modify: `backend/src/attendance/attendance.service.spec.ts`
- Modify: `README.md`, `docs/guides/DEPLOY.md` (klaim root/jailbreak)

**Interfaces:**
- Produces: `deviceCompromised` tidak pernah memberi poin integritas; tanpa token terverifikasi `integrityOk=false` dan alasan `UNVERIFIED`; presensi tidak diblokir hanya karena belum ada attestation (kecuali `INTEGRITY_STRICT=true`).

- [ ] **Step 1: Tulis test yang gagal**

```ts
it('tanpa token, integrity tidak memberi poin', () => {
  const res = svc.resolveSignal({ deviceCompromised: false, platform: 'ANDROID' });
  expect(res.ok).toBe(false);
  expect(res.verdict).toBeNull();
});

it('deviceCompromised tidak menaikkan risk score', async () => {
  const res = await attendance.checkIn(dto({ deviceCompromised: true }), 'u1');
  expect(res.risk.score).toBeLessThan(90);
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend; npx vitest run src/integrity src/attendance`
Expected: FAIL.

- [ ] **Step 3: Implementasi**

- `resolveSignal` tanpa token: `return { ok: false, verdict: null };` (hapus `!opts.deviceCompromised`).
- `AttendanceService.applyIntegrity`: bila `!this.integrity` atau `resolved.verdict === null` → `risk.integrityOk = false; __integrityReason = 'UNVERIFIED'`.
- `rejectIfBadIntegrity`: bila `reason === 'UNVERIFIED' && !strict` → `return;` (informational, tidak memblokir); alasan lain tetap reject.
- Perbarui test integritas lama yang mengharapkan `ok=true` tanpa token.
- Perbarui `attendance.service.spec.ts` yang mengharapkan skor 96/82: hitung ulang tanpa bobot integrity (hanya signature/device/liveness/face) dan ganti dengan nilai eksak baru; jangan melemahkan assertion menjadi `toBeGreaterThan`.
- Dokumentasi: ganti klaim "root/jailbreak terdeteksi = aman" menjadi "sinyal risiko yang belum diverifikasi; verifikasi server menyusul fase 2". Jangan hapus fitur deteksi; hanya turunkan klaim.

- [ ] **Step 4: Jalankan**

Run: `cd backend; npx vitest run src/integrity src/attendance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrity backend/src/attendance README.md docs/guides/DEPLOY.md
git commit -m "fix(security): stop granting integrity credit without attestation"
```

---

### Task 19: Verifikasi penuh dan smoke test

**Files:**
- No source changes; perbaiki hanya bila ada kegagalan.

- [ ] **Step 1: Backend unit**

Run: `cd backend; npm test`
Expected: semua suite PASS, 0 failure.

- [ ] **Step 2: Backend e2e**

Run: `cd backend; npm run test:e2e`
Expected: semua suite PASS.

- [ ] **Step 3: Lint dan build**

Run: `cd backend; npm run lint; npm run build`
Expected: 0 error.

- [ ] **Step 4: Mobile**

Run: `cd mobile; flutter analyze; flutter test`
Expected: 0 error analyze (info lama boleh), semua test PASS.

- [ ] **Step 5: Smoke manual (catat hasil di PR/commit)**

1. Register email baru → 202, tidak ada token, email/log kode muncul.
2. Verifikasi kode → status `PENDING_APPROVAL`.
3. Login sebelum approval → pesan menunggu approval.
4. Approve via SUPER_ADMIN → login berhasil.
5. Device pertama ACTIVE; device kedua PENDING; presensi ditolak sampai aktivasi.
6. Check-in online → satu baris, `offline=false`.
7. Check-in offline (matikan jaringan setelah capture) → outbox bertambah; nyalakan → terkirim, `offline=true`, `needsReview=true`.
8. Check-out shift malam → `workDate` tetap tanggal check-in.
9. Ganti wajah tanpa password → 403; dengan password → versi naik.
10. Self-approval koreksi/leave/review → 403.
11. Laporan karyawan RS lain → 404.
12. Replay requestId sama → respons identik, satu baris.

- [ ] **Step 6: Commit perbaikan terakhir (bila ada)**

```bash
git add -A
git commit -m "test: verify security phase 1 end to end"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| 5.1 signature + nonce pool | 2, 4, 6, 15 |
| 5.2 face re-auth | 8 |
| 5.3 registrasi + email + approval | 9, 10, 11, 17 |
| 5.4 self-approval | 12 |
| 5.5 tenant scope | 13 |
| 5.6 device policy | 1, 14 |
| 5.7 offline + idempotency + outbox | 1, 3, 5, 6, 7, 16 |
| 5.8 klaim integritas | 18 |
| Rollout/migrasi | 1, 19 |

**Type consistency:** `captureAt`/`syncedAt`/`offline`/`staleAt`, `signatureVersion:v1`, `challengeNonce`, `requestId` konsisten antara Task 1–7 dan 15–16. `buildSignMessageV1` (Task 2) dipakai Task 6/7; `OutboxEntry.payload` (Task 16) dipakai Task 15/17.

**Proportion:** rencana ini memuat signature, nilai konfigurasi, dan test; body implementasi hanya ditulis untuk algoritma kanonik dan urutan keamanan yang tidak bisa ditebak.

