// Threshold calibration for FACE_MATCH_THRESHOLD + risk impact.
// Usage: node backend/scripts/calibrate-thresholds.mjs --input pilot-scores.csv [--out calibration-report.json]
// Input CSV header: score,label   (score=cosine 0..1, label=match|nonmatch)
// Output: FAR/FRR per threshold 0.30..0.80 step 0.05 + EER suggestion + risk-table impact.
// No PII: file hanya berisi skor anonim + label.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const input = get('--input');
const out = get('--out') ?? 'calibration-report.json';
if (!input) {
  console.error('usage: node backend/scripts/calibrate-thresholds.mjs --input pilot-scores.csv [--out calibration-report.json]');
  process.exit(1);
}

const rows = readFileSync(input, 'utf8').trim().split('\n');
const header = rows.shift().trim().toLowerCase();
if (header !== 'score,label') {
  console.error('CSV header harus persis: score,label');
  process.exit(1);
}
const data = rows.filter(Boolean).map((r, i) => {
  const [s, l] = r.split(',');
  const score = Number(s);
  if (!Number.isFinite(score) || score < -1 || score > 1) throw new Error(`baris ${i + 2}: score tidak valid (${s})`);
  if (l !== 'match' && l !== 'nonmatch') throw new Error(`baris ${i + 2}: label harus match|nonmatch (${l})`);
  return { score, genuine: l === 'match' };
});
const gen = data.filter((d) => d.genuine).length;
const imp = data.length - gen;
if (gen < 10 || imp < 10) {
  console.error(`WARN: sampel kecil (genuine=${gen}, impostor=${imp}). Go-live minta ≥50+50 per kelas device.`);
}

const table = [];
for (let t = 0.3; t <= 0.8001; t += 0.05) {
  const th = Math.round(t * 100) / 100;
  const far = data.filter((d) => !d.genuine && d.score >= th).length / Math.max(1, imp);
  const frr = data.filter((d) => d.genuine && d.score < th).length / Math.max(1, gen);
  // Risk impact: face contributes score*30 of 100. Show resulting total for a
  // canonical "all other signals pass" attendance (70 pts non-face).
  const typicalGenuine = 0.9 * 30 + 70; // 97 LOW
  const atThreshold = th * 30 + 70; // boundary case
  table.push({ threshold: th, far: r3(far), frr: r3(frr), riskAtThreshold: Math.round(atThreshold), riskTypical: Math.round(typicalGenuine) });
}
// EER = threshold with min |FAR-FRR|.
const eer = table.reduce((a, b) => (Math.abs(b.far - b.frr) < Math.abs(a.far - a.frr) ? b : a));
const report = {
  generatedAt: new Date().toISOString(),
  samples: { total: data.length, genuine: gen, impostor: imp },
  table,
  suggestion: {
    threshold: eer.threshold,
    far: eer.far,
    frr: eer.frr,
    note: gen < 50 || imp < 50
      ? 'Sampel di bawah syarat go-live (50+50). Pakai ambang sementara 0.50 + review MEDIUM aktif, ulangi setelah pilot.'
      : `Kandidat EER=${eer.threshold} (FAR=${eer.far}, FRR=${eer.frr}). Tetapkan FACE_MATCH_THRESHOLD ini bila FRR operasional masih nyaman; bila antrean review membludak, turunkan 0.05 dan aktifkan RISK_MEDIUM_REVIEW=true.`,
  },
};
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`samples: ${data.length} (genuine=${gen}, impostor=${imp})`);
console.table(table.map((r) => ({ thr: r.threshold, FAR: r.far, FRR: r.frr, risk: r.riskAtThreshold })));
console.log(`saran EER: ${eer.threshold} (FAR=${eer.far} FRR=${eer.frr}) → ${out}`);

function r3(n) {
  return Math.round(n * 1000) / 1000;
}
