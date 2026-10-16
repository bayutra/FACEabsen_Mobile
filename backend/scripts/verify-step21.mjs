// STEP 21 verification: migration 5 applies; consent uniqueness enforced.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new PGlite();
for (const m of ['20261005000000_init', '20261005000001_auth_lockout', '20261005000002_idempotency', '20261005000003_review_flag', '20261005000004_consents']) {
  await db.exec(readFileSync(`prisma/migrations/${m}/migration.sql`, 'utf8'));
}
check('migrations 1-5 apply cleanly in order', true);

await db.query(`INSERT INTO "hospitals"("id","code","name","latitude","longitude","created_at","updated_at") VALUES ('H1','RS-A','RS',0,0,now(),now())`);
await db.query(`INSERT INTO "employees"("id","employee_no","name","email","created_at","updated_at") VALUES ('E1','EMP-001','Siti','s@rs.test',now(),now())`);
await db.query(`INSERT INTO "consents"("id","employee_id","purpose","version") VALUES ('C1','E1','BIOMETRIC_ATTENDANCE','2026-10-01')`);
try {
  await db.query(`INSERT INTO "consents"("id","employee_id","purpose","version") VALUES ('C2','E1','BIOMETRIC_ATTENDANCE','2026-10-01')`);
  check('duplicate consent purpose rejected', false, 'insert succeeded');
} catch (e) {
  check('duplicate consent purpose rejected', e?.code === '23505', `code=${e?.code}`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
