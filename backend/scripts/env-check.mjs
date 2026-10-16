// Production env guard (host-side, pre-compose).
// Usage: node backend/scripts/env-check.mjs [--file .env.production]
// Fails closed with non-zero exit + Indonesian messages. No secrets printed.
import { readFileSync } from 'node:fs';

const file = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : '.env.production';

function parseEnv(src) {
  const out = {};
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

let env;
try {
  env = parseEnv(readFileSync(file, 'utf8'));
} catch {
  console.error(`FAIL  ${file} tidak ditemukan. Salin dari .env.production.example dulu.`);
  process.exit(1);
}

const problems = [];
const need = (k) => {
  if (!env[k] || env[k].includes('CHANGE-ME') || env[k].includes('change-me')) problems.push(`${k} belum diisi (masih placeholder/kosong)`);
};
['POSTGRES_USER', 'POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'JWT_ACCESS_SECRET', 'DATA_ENCRYPTION_KEY', 'CORS_ORIGIN'].forEach(need);
// DATABASE_URL/REDIS_URL dirakit docker-compose dari bagian-bagiannya —
// kalau diisi manual di file env, compose mengabaikannya. Tolak placeholder
// yang tertinggal agar tidak dikira dipakai.
for (const k of ['DATABASE_URL', 'REDIS_URL']) {
  if (env[k] && (env[k].includes('CHANGE-ME') || env[k].includes('change-me'))) {
    problems.push(`${k} masih placeholder — hapus barisnya, compose merakit dari bagian (lihat .env.production.example)`);
  }
}
// nginx + healthcheck mengasumsikan PORT=3000 dan API_PREFIX=api/v1.
if (env.PORT && env.PORT !== '3000') problems.push('PORT harus 3000 (nginx.conf + healthcheck docker-compose mengasumsikannya)');
if (env.API_PREFIX && env.API_PREFIX !== 'api/v1') problems.push('API_PREFIX harus api/v1 (nginx.conf + healthcheck docker-compose mengasumsikannya)');

if (env.JWT_ACCESS_SECRET && !env.JWT_ACCESS_SECRET.includes('CHANGE') && env.JWT_ACCESS_SECRET.length < 32) {
  problems.push('JWT_ACCESS_SECRET minimal 32 karakter acak');
}
try {
  const n = Buffer.from(env.DATA_ENCRYPTION_KEY || '', 'base64').length;
  if (n !== 32) problems.push('DATA_ENCRYPTION_KEY harus base64 dari 32 byte acak');
} catch {
  problems.push('DATA_ENCRYPTION_KEY bukan base64 valid');
}
if (env.CORS_ORIGIN && !env.CORS_ORIGIN.startsWith('https://')) {
  problems.push('CORS_ORIGIN produksi harus https://domain-asli (bukan localhost/http)');
}
const num = (k, dflt) => {
  const v = Number(env[k] ?? dflt);
  if (!Number.isFinite(v)) problems.push(`${k} harus angka`);
  return v;
};
const w = ['RISK_W_FACE', 'RISK_W_LIVENESS', 'RISK_W_DEVICE', 'RISK_W_INTEGRITY', 'RISK_W_GPS', 'RISK_W_GEOFENCE', 'RISK_W_SIGNATURE'].map((k) => num(k, NaN));
if (w.every(Number.isFinite)) {
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum !== 100) problems.push(`Jumlah bobot RISK_W_* harus 100 (sekarang ${sum})`);
}
const low = num('RISK_LOW_MIN', 90);
const med = num('RISK_MEDIUM_MIN', 70);
if (Number.isFinite(low) && Number.isFinite(med) && !(low > med)) {
  problems.push('RISK_LOW_MIN harus > RISK_MEDIUM_MIN');
}
const face = num('FACE_MATCH_THRESHOLD', 0.5);
if (Number.isFinite(face) && (face < 0.3 || face > 0.8)) {
  problems.push(`FACE_MATCH_THRESHOLD di luar rentang kalibrasi wajar 0.30–0.80 (sekarang ${face}) — isi dari docs/CALIBRATION.md`);
}
// Bootstrap admin (prod seed) — never demo/demo passwords.
if (env.BOOTSTRAP_ADMIN_EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.BOOTSTRAP_ADMIN_EMAIL)) {
  problems.push('BOOTSTRAP_ADMIN_EMAIL tidak valid');
}
if (env.BOOTSTRAP_ADMIN_PASSWORD && env.BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
  problems.push('BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter');
}
// Integrity mode must be explicit for go-live.
if (env.INTEGRITY_STRICT && !['true', 'false'].includes(String(env.INTEGRITY_STRICT).toLowerCase())) {
  problems.push('INTEGRITY_STRICT harus true/false');
}

if (problems.length > 0) {
  console.error(`FAIL  ${file}: ${problems.length} masalah:`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`OK  ${file}: secrets terisi, bobot risk=100, ambang konsisten.`);
