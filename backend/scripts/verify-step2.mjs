// STEP 2 verification: applies prisma migration SQL to a real PostgreSQL
// engine (PGlite, WASM build) and asserts tables, relations, constraints,
// indexes + behavioral checks (partial unique ACTIVE device, CHECKs, enums).
// Run: node scripts/verify-step2.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const expectErr = async (name, fn, code) => {
  try {
    await fn();
    check(name, false, 'expected error, insert succeeded');
  } catch (e) {
    check(name, e?.code === code, `code=${e?.code} (want ${code})`);
  }
};

const db = new PGlite();
const sql = readFileSync(
  'prisma/migrations/20261005000000_init/migration.sql',
  'utf8',
);
await db.exec(sql);
check('migration applies cleanly', true);

// 1. tables
const t = await db.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`,
);
const names = t.rows.map((r) => r.tablename);
const expected = [
  'attendance', 'audit_logs', 'correction_requests', 'departments',
  'device_change_requests', 'devices', 'employee_schedules', 'employees',
  'face_templates', 'hospitals', 'leave_requests', 'permissions',
  'role_permissions', 'roles', 'sessions', 'shifts', 'user_roles', 'users',
];
check(
  '18 domain tables created',
  expected.every((x) => names.includes(x)),
  `${names.length} tables`,
);

// 2. FK count (relations)
const fk = await db.query(
  `SELECT COUNT(*)::int AS c FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY'`,
);
check('foreign keys present', fk.rows[0].c >= 30, `${fk.rows[0].c} FKs`);

// 3. partial unique index for single ACTIVE device
const pi = await db.query(
  `SELECT indexname FROM pg_indexes WHERE indexname='devices_one_active_per_employee'`,
);
check('partial unique index devices_one_active_per_employee', pi.rows.length === 1);

// 4. CHECK constraints
const ck = await db.query(
  `SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_type='CHECK' AND constraint_name IN ('hospitals_radius_positive','attendance_risk_range','leave_dates_order','shifts_positive_windows')`,
);
check('custom CHECK constraints', ck.rows.length === 4, `${ck.rows.length}/4`);

// 5. behavioral: master data
await db.query(
  `INSERT INTO "hospitals"("id","code","name","latitude","longitude","radius_meters","created_at","updated_at") VALUES ('H1','RS-A','RS Contoh',-7.65,112.23,100,now(),now())`,
);
await db.query(
  `INSERT INTO "departments"("id","hospital_id","name","created_at","updated_at") VALUES ('D1','H1','IGD',now(),now())`,
);
await db.query(
  `INSERT INTO "users"("id","email","password_hash","created_at","updated_at") VALUES ('U1','admin@rs.test','argon2id$test',now(),now())`,
);
await db.query(`INSERT INTO "roles"("id","name") VALUES ('R1','ADMIN')`);
await db.query(`INSERT INTO "permissions"("id","key") VALUES ('P1','device:revoke')`);
await db.query(`INSERT INTO "role_permissions"("role_id","permission_id") VALUES ('R1','P1')`);
await db.query(`INSERT INTO "user_roles"("user_id","role_id") VALUES ('U1','R1')`);
await db.query(
  `INSERT INTO "employees"("id","user_id","employee_no","name","email","department_id","status","created_at","updated_at") VALUES ('E1','U1','EMP-001','Siti','siti@rs.test','D1','ACTIVE',now(),now())`,
);
check('master data inserts', true);

// 6. one ACTIVE device rule
await db.query(
  `INSERT INTO "devices"("id","employee_id","device_public_key","installation_id","platform","status","registered_at") VALUES ('DEV1','E1','PK1','INST1','ANDROID','ACTIVE',now())`,
);
await expectErr(
  'second ACTIVE device rejected',
  () =>
    db.query(
      `INSERT INTO "devices"("id","employee_id","device_public_key","installation_id","platform","status","registered_at") VALUES ('DEV2','E1','PK2','INST2','ANDROID','ACTIVE',now())`,
    ),
  '23505',
);
await db.query(
  `INSERT INTO "devices"("id","employee_id","device_public_key","installation_id","platform","status","registered_at") VALUES ('DEV2','E1','PK2','INST2','ANDROID','REVOKED',now())`,
);
check('REVOKED device alongside ACTIVE allowed', true);

// 7. enum + checks enforced by DB
await expectErr(
  'invalid device status rejected',
  () =>
    db.query(
      `INSERT INTO "devices"("id","employee_id","device_public_key","installation_id","platform","status","registered_at") VALUES ('DEVX','E1','PKX','INSTX','ANDROID','HACKED',now())`,
    ),
  '22P02',
);
await expectErr(
  'negative geofence radius rejected',
  () =>
    db.query(
      `INSERT INTO "hospitals"("id","code","name","latitude","longitude","radius_meters","created_at","updated_at") VALUES ('HX','RS-X','X',0,0,-5,now(),now())`,
    ),
  '23514',
);

// 8. shift/schedule/attendance + risk range
await db.query(
  `INSERT INTO "shifts"("id","hospital_id","name","start_time","end_time","overnight","created_at","updated_at") VALUES ('S1','H1','MALAM','23:00','07:00',true,now(),now())`,
);
await db.query(
  `INSERT INTO "employee_schedules"("id","employee_id","shift_id","work_date","created_at") VALUES ('SCH1','E1','S1','2026-10-05',now())`,
);
await db.query(
  `INSERT INTO "attendance"("id","employee_id","shift_id","schedule_id","work_date","check_in_at","check_in_status","risk_score","risk_category","device_id","check_in_lat","check_in_lon","geofence_pass","created_at","updated_at") VALUES ('A1','E1','S1','SCH1','2026-10-05',now(),'ON_TIME',95,'LOW','DEV1',-7.65,112.23,true,now(),now())`,
);
check('night-shift attendance insert', true);
await expectErr(
  'risk_score > 100 rejected',
  () =>
    db.query(
      `INSERT INTO "attendance"("id","employee_id","shift_id","work_date","risk_score","created_at","updated_at") VALUES ('A2','E1','S1','2026-10-06',150,now(),now())`,
    ),
  '23514',
);

// 9. face template (encrypted blob) + audit + session + leave/correction
await db.query(
  `INSERT INTO "face_templates"("id","employee_id","template_cipher","created_at","updated_at") VALUES ('F1','E1','\\x0102030405',now(),now())`,
);
await expectErr(
  'second face template for same employee rejected',
  () =>
    db.query(
      `INSERT INTO "face_templates"("id","employee_id","template_cipher","created_at","updated_at") VALUES ('F2','E1','\\x06',now(),now())`,
    ),
  '23505',
);
await db.query(
  `INSERT INTO "audit_logs"("id","actor_id","action","target_type","target_id","device_id","result") VALUES ('L1','U1','CHECK_IN','attendance','A1','DEV1','SUCCESS')`,
);
await db.query(
  `INSERT INTO "sessions"("id","user_id","device_id","refresh_token_hash","expires_at") VALUES ('SE1','U1','DEV1','hash-1',now() + interval '7 days')`,
);
await expectErr(
  'leave end_date < start_date rejected',
  () =>
    db.query(
      `INSERT INTO "leave_requests"("id","employee_id","type","start_date","end_date","reason") VALUES ('LV1','E1','CUTI','2026-10-10','2026-10-05','x')`,
    ),
  '23514',
);
await db.query(
  `INSERT INTO "correction_requests"("id","employee_id","attendance_id","type","reason") VALUES ('C1','E1','A1','MISSED_CHECK_OUT','lupa')`,
);
check('face/audit/session/leave/correction flows', true);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
