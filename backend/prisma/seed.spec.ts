import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const seedFiles = ['seed.mjs', 'seed.prod.mjs'].map((file) =>
  fileURLToPath(new URL(`./${file}`, import.meta.url)),
);

describe('prisma seed scripts', () => {
  // Regression guard: `prisma/seed.mjs` once lost its `const ROLE_PERMISSIONS = {`
  // declaration while gaining the production guard, so `prisma db seed` failed
  // with a SyntaxError and existing databases silently kept stale seed data
  // (e.g. the old "RS Contoh" hospital name).
  it.each(seedFiles)('%s parses as valid ESM', (file) => {
    expect(() => execFileSync(process.execPath, ['--check', file])).not.toThrow();
  });
});
