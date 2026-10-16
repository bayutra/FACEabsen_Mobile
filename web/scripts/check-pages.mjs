/**
 * Authenticated visual smoke check for the web app.
 *
 * Walks every role-gated page as SUPER_ADMIN and reports the HTTP status plus
 * a few design-token markers, so a broken route or a half-applied theme shows
 * up here instead of in a screenshot.
 *
 *   node scripts/check-pages.mjs
 *
 * Against the DEPLOYED stack (through nginx — the only topology that caught
 * the /api vs /api/v1 split):
 *
 *   WEB_ORIGIN=https://absen.rumahsakit.example API_ORIGIN=https://absen.rumahsakit.example/api/v1 node scripts/check-pages.mjs
 *
 * Set CHECK_NGINX=1 on a deployed run to additionally assert the reverse-proxy
 * split: /api/* must hit the Next.js BFF while /api/v1/* must reach Nest
 * directly (regression guard for the Tahap 1 routing fix).
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:3001';
const API = process.env.API_ORIGIN ?? 'http://localhost:3000/api/v1';
const EMAIL = process.env.CHECK_EMAIL ?? 'superadmin@rs.test';
const PASSWORD = process.env.CHECK_PASSWORD ?? 'Password123!';
const OUT = join(process.cwd(), '.visual-check');

const PAGES = [
  ['/login', 'login'],
  ['/dashboard', 'dashboard'],
  ['/admin', 'admin'],
  ['/attendance', 'attendance'],
  ['/audit', 'audit'],
  ['/employees', 'employees'],
  ['/departments', 'departments'],
  ['/shifts', 'shifts'],
  ['/schedules', 'schedules'],
  ['/devices', 'devices'],
  ['/devices/replacements', 'device-replacements'],
  ['/corrections', 'corrections'],
  ['/leaves', 'leaves'],
  ['/reports', 'reports'],
  ['/security', 'security'],
  ['/settings', 'settings'],
  ['/team', 'team'],
  ['/team/attendance', 'team-attendance'],
  ['/team/reports', 'team-reports'],
  ['/team/leaves', 'team-leaves'],
  ['/team/corrections', 'team-corrections'],
];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) {
  console.error(`login failed: ${login.status}`);
  process.exit(1);
}
const { accessToken } = await login.json();
const cookie = `access_token=${accessToken}; Path=/; HttpOnly`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/**
 * Tokens that must survive in the served CSS for the design to be applied.
 * Built as regexes because the minifier inserts spaces after the colon.
 */
const MARKERS = {
  primary: /--color-primary:\s*#005c55/i,
  surfaceLowest: /--color-surface-container-lowest:\s*#fff\b/i,
  onSurface: /--color-on-surface:\s*#0b1c30/i,
  outlineVariant: /--color-outline-variant:\s*#bdc9c6/i,
  headlineXl: /--text-headline-xl:\s*2rem/i,
  tabular: /\.tabular\s*\{/,
};

/**
 * Copy that only ever appears in the `[...slug]` catch-all. A page still
 * serving it means the route was never implemented, whatever its status code —
 * a 200 with a placeholder is the failure mode this check exists to catch.
 */
const PLACEHOLDER = /menyusul di\s*STEP|modul\s+\w+\s+menyusul/i;

/**
 * Loads every stylesheet the page references, not just the first one — Next
 * splits CSS per route group, so a single fetch can miss the chunk that
 * actually carries the tokens.
 */
async function loadCss() {
  const seen = new Set();
  let merged = '';
  const html = await (await fetch(`${WEB}/login`)).text();
  for (const [, href] of html.matchAll(/<link[^>]*href="([^"]*\.css)"[^>]*>/g)) {
    const url = href.startsWith('http') ? href : `${WEB}${href}`;
    if (seen.has(url)) continue;
    seen.add(url);
    merged += await (await fetch(url)).text();
  }
  return { css: merged, count: seen.size };
}

const { css, count: cssCount } = await loadCss();
let failures = 0;

for (const [path, name] of PAGES) {
  const res = await fetch(`${WEB}${path}`, {
    headers: { cookie },
    redirect: 'manual',
  });

  if (res.status >= 300 && res.status < 400) {
    console.log(`${String(res.status).padEnd(4)} ${path}  -> redirect ${res.headers.get('location')}`);
    continue;
  }
  if (!res.ok) {
    console.log(`${String(res.status).padEnd(4)} ${path}  !! HTTP ERROR`);
    failures++;
    continue;
  }

  const html = await res.text();
  writeFileSync(join(OUT, `${name}.html`), html, 'utf8');

  const missing = Object.entries(MARKERS)
    .filter(([, re]) => !re.test(css))
    .map(([k]) => k);
  if (missing.length) {
    console.log(`${String(res.status).padEnd(4)} ${path}  !! CSS missing tokens: ${missing.join(', ')}`);
    failures++;
    continue;
  }

  if (PLACEHOLDER.test(html)) {
    console.log(`${String(res.status).padEnd(4)} ${path}  !! STILL A PLACEHOLDER (catch-all route)`);
    failures++;
    continue;
  }

  const leaks = ['bg-zinc-', 'text-zinc-', 'border-zinc-', 'dark:bg-', 'dark:text-'].filter((t) =>
    html.includes(t),
  );
  if (leaks.length) failures++;
  const flag = leaks.length ? `  !! legacy classes: ${leaks.join(', ')}` : '';

  console.log(`${String(res.status).padEnd(4)} ${path}  ok${flag}`);
}

console.log(`\ncss verified: ${Object.keys(MARKERS).length} markers across ${cssCount} stylesheet(s)`);

// Reverse-proxy split check (nginx): the BFF must answer /api/* while the
// mobile prefix /api/v1/* must reach the backend directly. Only meaningful
// through nginx, so it runs when CHECK_NGINX=1 (see header).
if (process.env.CHECK_NGINX === '1') {
  const bff = await fetch(`${WEB}/api/health`, { headers: { cookie } });
  if (bff.ok) {
    console.log(`200  /api/health  ok (BFF)`);
  } else {
    console.log(`${bff.status}  /api/health  !! BFF UNREACHABLE (nginx /api/ misrouted?)`);
    failures++;
  }
  const direct = await fetch(`${API}/health`);
  if (direct.ok) {
    console.log(`200  /api/v1/health  ok (backend direct)`);
  } else {
    console.log(`${direct.status}  /api/v1/health  !! BACKEND UNREACHABLE (nginx /api/v1/ misrouted?)`);
    failures++;
  }
}

console.log(failures === 0 ? 'ALL PAGES OK' : `${failures} problem(s)`);
console.log(`html dumped to ${OUT}`);
process.exit(failures === 0 ? 0 : 1);
