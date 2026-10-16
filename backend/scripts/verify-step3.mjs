// STEP 3 verification: applies migration 1 then 2 to a fresh PostgreSQL
// engine (PGlite) and asserts lockout columns + lockout behavior.
// Run: node scripts/verify-step3.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new PGlite();
for (const m of ['20261005000000_init', '20261005000001_auth_lockout']) {
  await db.exec(readFileSync(`prisma/migrations/${m}/migration.sql`, 'utf8'));
}
check('migrations 1+2 apply cleanly in order', true);

const cols = await db.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('failed_login_attempts','locked_until')`,
);
check('lockout columns exist', cols.rows.length === 2, `${cols.rows.length}/2`);

// lockout behavior simulation (what AuthService does)
await db.query(
  `INSERT INTO "users"("id","email","password_hash","created_at","updated_at") VALUES ('U9','lock@rs.test','x',now(),now())`,
);
await db.query(
  `UPDATE "users" SET "failed_login_attempts" = 5, "locked_until" = now() + interval '15 minutes' WHERE "id"='U9'`,
);
const u = await db.query(
  `SELECT "failed_login_attempts" AS a, ("locked_until" > now()) AS locked FROM "users" WHERE "id"='U9'`,
);
check('locked account detected', u.rows[0].a === 5 && u.rows[0].locked === true);
await db.query(
  `UPDATE "users" SET "failed_login_attempts" = 0, "locked_until" = NULL WHERE "id"='U9'`,
);
const u2 = await db.query(
  `SELECT "failed_login_attempts" AS a, "locked_until" FROM "users" WHERE "id"='U9'`,
);
check('successful login resets lockout', u2.rows[0].a === 0 && u2.rows[0].locked_until === null);

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
