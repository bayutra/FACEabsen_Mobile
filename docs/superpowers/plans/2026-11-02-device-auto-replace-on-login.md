# Auto-replace Perangkat saat Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login di HP baru langsung memindahkan perangkat aktif akun: HP baru menjadi `ACTIVE`, HP lama `REVOKED` dan sesinya dicabut.

**Architecture:** Semua perubahan perilaku ada di `DevicesService.register()` (dipanggil setelah login dan saat presensi pertama). Satu transaksi Prisma mengaktifkan target, mencabut perangkat `ACTIVE`/`PENDING` lain, dan mencabut sesinya. Mobile tidak berubah selain copy UI; kontrak `409` tetap dipertahankan agar retry `clearDeviceIdentity()` yang sudah ada bekerja.

**Tech Stack:** NestJS 12, Prisma 6, Vitest 4, Flutter 3.22.

**Spec:** `docs/superpowers/specs/2026-11-02-device-auto-replace-on-login-design.md`

## Global Constraints

- Setelah `POST /devices/register`, tepat satu perangkat `ACTIVE` per karyawan.
- Kontrak `409` untuk clash yang tidak bisa dipakai ulang harus dipertahankan; mobile melakukan `clearDeviceIdentity()` lalu retry sekali (`device_repository.dart:43-53`).
- Bentuk respons `register()` tidak berubah (tetap objek `Device`).
- Alur admin `activate()`/`revoke()`/`maxActive` tidak diubah.
- Tidak ada migrasi database atau unique index baru.
- Copy UI memakai bahasa Indonesia dan menyatakan satu akun aktif di satu perangkat.

## Review Focus

- Login di HP kedua saat HP pertama masih login: HP baru `ACTIVE`, HP lama `REVOKED`, sesi HP lama `revokedAt` terisi (HP lama dipaksa logout).
- Login ulang di HP yang sudah dicabut admin: harus `409` supaya mobile membuat identitas baru, bukan memakai baris `REVOKED` selamanya.
- Baris `PENDING` lama dari HP yang sama: diaktifkan tanpa `create` baru (menghindari unique constraint `installationId`/`devicePublicKey`).
- Clash dengan perangkat milik karyawan lain (HP dipakai bergantian): `409`, dan perangkat milik akun lain tidak boleh dicabut.
- Clash `ACTIVE` milik sendiri saat masih ada perangkat `ACTIVE` lain (data lama): target dipertahankan, perangkat lain dicabut.

---

### Task 1: Auto-replace di `DevicesService.register()`

**Files:**
- Modify: `backend/src/devices/devices.service.ts:1-16` (import + constructor) dan `:118-179` (`register`)
- Test: `backend/src/devices/devices.service.spec.ts:23-44` (stub) dan `:56-144` (test register)
- Modify: `docs/superpowers/specs/2026-11-02-device-auto-replace-on-login-design.md` (klarifikasi clash `ACTIVE`)

**Interfaces:**
- Consumes: `PrismaService`, `AuditService.log(event)`, `PushService.notifyEmployee(employeeId, payload)`, `verifyRegistrationProof(dto, userId)`.
- Produces: `DevicesService.register(dto: RegisterDeviceDto, userId: string, meta?: { ip?: string }): Promise<Device>` — signature tidak berubah, perilaku baru.

- [ ] **Step 1: Siapkan stub Prisma agar transaksi bisa diuji**

Di `devices.service.spec.ts`, ubah `makePrisma` agar menyediakan `$transaction`, `device.updateMany`, dan `device.update` default. `$transaction` memanggil callback dengan objek stub yang sama.

```ts
function makePrisma(over: Record<string, Record<string, unknown>> = {}) {
  const prisma = {
    employee: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        'userId' in a.where
          ? { id: 'e-adm', department: { hospitalId: 'h1' } }
          : { id: 'e1' },
      ),
      ...over.employee,
    },
    device: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(
        async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: a.where.id,
          ...a.data,
        }),
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
      ...over.device,
    },
    session: { updateMany: vi.fn(async () => ({ count: 0 })), ...over.session },
  } as Record<string, unknown>;
  prisma.$transaction = vi.fn(
    async (fn: (tx: Record<string, unknown>) => unknown) => fn(prisma),
  );
  return prisma as unknown as PrismaService;
}
```

- [ ] **Step 2: Tulis test yang gagal**

Ganti test `second device also ACTIVE (multi-perangkat)` dengan test auto-replace, lalu tambahkan empat test baru di `describe('DevicesService.register')`:

```ts
it('perangkat kedua menggantikan perangkat pertama', async () => {
  const create = vi.fn(async (a: { data: Record<string, unknown> }) => ({
    id: 'd2',
    ...a.data,
  }));
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const sessionUpdateMany = vi.fn(async () => ({ count: 1 }));
  const prisma = makePrisma({
    device: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ id: 'd1' }]),
      create,
      updateMany,
    },
    session: { updateMany: sessionUpdateMany },
  });
  const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

  const out = (await svc.register(dto(), 'u1')) as {
    id: string;
    status: string;
  };

  expect(out).toMatchObject({ id: 'd2', status: 'ACTIVE' });
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: { in: ['d1'] } },
    data: expect.objectContaining({
      status: 'REVOKED',
      revokeReason: 'auto-replaced-by:d2',
    }),
  });
  expect(sessionUpdateMany).toHaveBeenCalledWith({
    where: { deviceId: { in: ['d1'] }, revokedAt: null },
    data: { revokedAt: expect.any(Date) },
  });
  expect(auditStub.log).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'DEVICE_REVOKED', targetId: 'd1' }),
  );
});

it('clash PENDING diaktifkan tanpa membuat baris baru', async () => {
  const create = vi.fn();
  const update = vi.fn(
    async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: a.where.id,
      ...a.data,
    }),
  );
  const prisma = makePrisma({
    device: {
      findFirst: vi.fn(async () => ({
        id: 'd2',
        employeeId: 'e1',
        status: 'PENDING',
      })),
      findMany: vi.fn(async () => []),
      update,
      create,
    },
  });
  const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

  const out = (await svc.register(dto(), 'u1')) as {
    id: string;
    status: string;
  };

  expect(out).toMatchObject({ id: 'd2', status: 'ACTIVE' });
  expect(create).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith({
    where: { id: 'd2' },
    data: expect.objectContaining({ status: 'ACTIVE' }),
  });
});

it.each(['REVOKED', 'LOST', 'REPLACED'])(
  'clash %s milik sendiri -> 409 agar mobile daftar ulang',
  async (status) => {
    const prisma = makePrisma({
      device: {
        findFirst: vi.fn(async () => ({
          id: 'd1',
          employeeId: 'e1',
          status,
        })),
      },
    });
    const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

    await expect(svc.register(dto(), 'u1')).rejects.toThrow(
      'already registered',
    );
  },
);

it('clash ACTIVE milik sendiri tetap idempotent tapi mencabut aktif lain', async () => {
  const create = vi.fn();
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const prisma = makePrisma({
    device: {
      findFirst: vi.fn(async () => ({
        id: 'd1',
        employeeId: 'e1',
        status: 'ACTIVE',
      })),
      findMany: vi.fn(async () => [{ id: 'd2' }]),
      updateMany,
      create,
    },
  });
  const svc = new DevicesService(prisma, auditStub, jwtFor('u1'));

  await expect(svc.register(dto(), 'u1')).resolves.toMatchObject({
    id: 'd1',
    status: 'ACTIVE',
  });
  expect(create).not.toHaveBeenCalled();
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: ['d2'] } } }),
  );
});
```

Tambahkan juga assertion di test `duplicate installationId -> 409` bahwa perangkat akun lain tidak dicabut:

```ts
const updateMany = (prisma as unknown as {
  device: { updateMany: ReturnType<typeof vi.fn> };
}).device.updateMany;
expect(updateMany).not.toHaveBeenCalled();
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run (workdir `backend/`): `npx vitest run src/devices/devices.service.spec.ts`
Expected: FAIL — test auto-replace/PENDING gagal karena `register()` masih membuat status `PENDING` dan belum mencabut perangkat lain.

- [ ] **Step 4: Implementasikan auto-replace**

Di `devices.service.ts`:

1. Tambahkan `Optional` ke import `@nestjs/common` dan import `PushService`:

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PushService } from '../push/push.service.js';
```

2. Tambahkan parameter opsional terakhir di constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
  private readonly jwt: JwtService = new JwtService({ secret: 'test-secret' }),
  private readonly config: ConfigService = {
    get: (_k: string, d: unknown) => d,
  } as ConfigService,
  @Optional() private readonly push?: PushService,
) {}
```

3. Ganti isi `register()` setelah `employee` ditemukan dengan alur berikut:

```ts
const clash = await this.prisma.device.findFirst({
  where: {
    OR: [
      { installationId: dto.installationId },
      { devicePublicKey: dto.devicePublicKey },
    ],
  },
});
if (clash && clash.employeeId !== employee.id) {
  throw new ConflictException('Device already registered');
}
if (
  clash &&
  (clash.status === 'REVOKED' ||
    clash.status === 'LOST' ||
    clash.status === 'REPLACED')
) {
  throw new ConflictException('Device already registered');
}

try {
  const { device, revokedIds } = await this.prisma.$transaction(
    async (tx) => {
      const target = clash
        ? await tx.device.update({
            where: { id: clash.id },
            data: {
              status: 'ACTIVE',
              deviceName: dto.deviceName,
              appVersion: dto.appVersion,
            },
          })
        : await tx.device.create({
            data: {
              employeeId: employee.id,
              installationId: dto.installationId,
              platform: dto.platform,
              deviceName: dto.deviceName,
              appVersion: dto.appVersion,
              devicePublicKey: dto.devicePublicKey,
              status: 'ACTIVE',
            },
          });

      const others = await tx.device.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['ACTIVE', 'PENDING'] },
          id: { not: target.id },
        },
        select: { id: true },
      });
      const revokedIds = others.map((row) => row.id);
      if (revokedIds.length > 0) {
        await tx.device.updateMany({
          where: { id: { in: revokedIds } },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokeReason: `auto-replaced-by:${target.id}`,
          },
        });
        await tx.session.updateMany({
          where: { deviceId: { in: revokedIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return { device: target, revokedIds };
    },
  );

  await this.audit.log({
    actorId: userId,
    action: 'DEVICE_REGISTERED',
    targetType: 'device',
    targetId: device.id,
    ipAddress: meta.ip,
    metadata: {
      status: device.status,
      platform: dto.platform,
      replacedDeviceIds: revokedIds,
    },
  });
  for (const id of revokedIds) {
    await this.audit.log({
      actorId: userId,
      action: 'DEVICE_REVOKED',
      targetType: 'device',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { reason: `auto-replaced-by:${device.id}` },
    });
  }
  this.push?.notifyEmployee(employee.id, {
    title: 'Perangkat aktif dipindahkan',
    body: 'Akun Anda kini aktif di perangkat baru. Perangkat lama otomatis dinonaktifkan.',
    data: { type: 'device', id: device.id, status: 'ACTIVE' },
  });
  return device;
} catch (e) {
  if (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  ) {
    throw new ConflictException('Device already registered');
  }
  throw e;
}
```

Catatan: `device.updateMany`/`session.updateMany` sengaja memakai `new Date()` terpisah; nilainya boleh berbeda beberapa milidetik.

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run (workdir `backend/`): `npx vitest run src/devices/devices.service.spec.ts`
Expected: PASS — semua test register lulus.

- [ ] **Step 6: Jalankan seluruh test backend + lint**

Run (workdir `backend/`): `npm test`
Expected: PASS (tidak ada regresi di modul lain).

Run (workdir `backend/`): `npm run lint`
Expected: PASS tanpa error baru.

- [ ] **Step 7: Perjelas design doc**

Di `docs/superpowers/specs/2026-11-02-device-auto-replace-on-login-design.md`, ubah baris:

```md
- milik karyawan ini dan status `ACTIVE` → kembalikan baris itu
  (idempotent, tidak ada perubahan);
```

menjadi:

```md
- milik karyawan ini dan status `ACTIVE` → jadikan target, tetapi perangkat
  `ACTIVE`/`PENDING` lain tetap dicabut (menjaga invariant satu perangkat aktif);
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/devices/devices.service.ts backend/src/devices/devices.service.spec.ts docs/superpowers/specs/2026-11-02-device-auto-replace-on-login-design.md
git commit -m "feat(devices): auto-replace active device on login"
```

---

### Task 2: Copy UI satu-perangkat

**Files:**
- Modify: `mobile/lib/features/device/presentation/device_register_screen.dart:92-95`
- Modify: `mobile/lib/features/device/presentation/device_screen.dart:74-79`
- Modify: `mobile/lib/features/device/presentation/device_sections.dart:381-387`

**Interfaces:**
- Consumes: tidak ada API baru.
- Produces: teks kebijakan yang sesuai perilaku baru; tidak ada perubahan logika.

- [ ] **Step 1: Ganti copy di layar registrasi**

Ganti isi `InfoBanner` menjadi:

```dart
const InfoBanner(
  'Satu akun aktif di satu perangkat. Saat Anda masuk di HP baru, '
  'perangkat lama otomatis dilepas dan tidak bisa dipakai presensi lagi.',
  title: 'Kebijakan Satu Perangkat',
),
```

- [ ] **Step 2: Ganti copy di layar Perangkat Saya**

Ganti isi `InfoBanner` menjadi:

```dart
const InfoBanner(
  'Satu akun aktif di satu perangkat. Saat Anda masuk di HP baru, '
  'perangkat lama otomatis dilepas. Perangkat yang hilang juga dapat '
  'dicabut oleh Admin IT.',
  title: 'Perangkat Saya',
),
```

- [ ] **Step 3: Ganti copy di kartu kebijakan integritas**

Ganti teks `'Presensi kehadiran dan verifikasi biometrik sah dilakukan dari perangkat yang terdaftar pada akun SIMRS Anda. Lebih dari satu perangkat diperbolehkan.'` menjadi:

```dart
'Presensi kehadiran dan verifikasi biometrik sah dilakukan dari perangkat '
'yang terdaftar pada akun SIMRS Anda. Satu akun hanya aktif di satu '
'perangkat; masuk di HP baru memindahkan perangkat aktif.',
```

- [ ] **Step 4: Jalankan analyzer**

Run (workdir `mobile/`): `flutter analyze`
Expected: `No issues found!` (atau hanya warning lama yang tidak terkait).

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/features/device/presentation/device_register_screen.dart mobile/lib/features/device/presentation/device_screen.dart mobile/lib/features/device/presentation/device_sections.dart
git commit -m "docs(mobile): update device policy copy for auto-replace"
```

---

## Final Verification

- [ ] `cd backend && npm test` → PASS.
- [ ] `cd backend && npm run lint` → PASS.
- [ ] `cd mobile && flutter analyze` → PASS.
- [ ] Manual: login akun yang sudah punya perangkat `ACTIVE` di HP kedua → respons `register` berstatus `ACTIVE`, perangkat lama `REVOKED`, presensi dari HP kedua berhasil, HP lama mendapat `401` saat refresh.
- [ ] Manual: login ulang di HP yang perangkatnya sudah `REVOKED` → mobile membersihkan identitas dan mendaftar sebagai perangkat baru yang `ACTIVE`.
