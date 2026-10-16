// STEP 12 verification: migration 3 applies + idempotency PK enforced.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new PGlite();
for (const m of ['20261005000000_init', '20261005000001_auth_lockout', '20261005000002_idempotency']) {
  await db.exec(readFileSync(`prisma/migrations/${m}/migration.sql`, 'utf8'));
}
check('migrations 1-3 apply cleanly in order', true);

const t = await db.query(`SELECT COUNT(*)::int AS c FROM pg_tables WHERE schemaname='public' AND tablename='idempotency_keys'`);
check('idempotency_keys table exists', t.rows[0].c === 1);

await db.query(`INSERT INTO "idempotency_keys"("key") VALUES ('req-1')`);
try {
  await db.query(`INSERT INTO "idempotency_keys"("key") VALUES ('req-1')`);
  check('duplicate request key rejected', false, 'insert succeeded');
} catch (e) {
  check('duplicate request key rejected', e?.code === '23505', `code=${e?.code}`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
