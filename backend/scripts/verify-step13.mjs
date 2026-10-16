// STEP 13 verification: migration 4 applies; needsReview defaults false.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const db = new PGlite();
for (const m of ['20261005000000_init', '20261005000001_auth_lockout', '20261005000002_idempotency', '20261005000003_review_flag']) {
  await db.exec(readFileSync(`prisma/migrations/${m}/migration.sql`, 'utf8'));
}
check('migrations 1-4 apply cleanly in order', true);

const c = await db.query(
  `SELECT column_name, column_default FROM information_schema.columns WHERE table_name='attendance' AND column_name='needs_review'`,
);
check('needs_review column exists with default false', c.rows.length === 1 && c.rows[0].column_default === 'false');

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
