// pnpm validate [-- --symptom S4] [--quick] [--deterministic] [--runs n] [--skip-build] [--skip-e2e] [--from perf-results/x.json]
// Answers: "is this symptom fixed, and did I break anything?"
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect, gitInfo, type Collected, type ScenarioId } from '../perf/lib/collect.ts';
import { format, METRICS } from '../perf/lib/metrics.ts';
import { judge, loadHistory, VALIDATION_DIR } from '../perf/lib/report.ts';
import { ROOT } from '../perf/lib/services.ts';

type Check = { id: string; symptom: string; scenario: ScenarioId | 'build'; metric: string; op: '<=' | '>='; title: string; kind: 'timing' | 'deterministic' | null; threshold: number | null; reference: number | null };
type Budgets = { checks: Check[] };
type Outcome = { id: string; symptom: string; title: string; metric: string; measured: number | null; iqr: number | null; op: string; threshold: number | null; kind: string; pass: boolean; provisional: boolean; note?: string };

const args = process.argv.slice(2).filter((a) => a !== '--');
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const symptom = value('symptom')?.toUpperCase();
const quick = flag('quick');
const deterministic = flag('deterministic');
const mode = symptom ? `symptom ${symptom}${quick ? ' (quick)' : ''}` : deterministic ? 'deterministic' : quick ? 'quick' : 'full';
const runs = Number(value('runs') ?? (deterministic ? 2 : quick ? 3 : 7));

const budgets = JSON.parse(readFileSync(join(ROOT, 'perf-budgets.json'), 'utf8')) as Budgets;
for (const c of budgets.checks) c.kind = c.kind ?? METRICS[c.metric]?.kind ?? 'timing';

let selected = budgets.checks;
if (symptom) {
  selected = selected.filter((c) => c.symptom === symptom);
  if (!selected.length) {
    console.error(`No checks for symptom ${symptom}. Known: ${[...new Set(budgets.checks.map((c) => c.symptom))].join(', ')}`);
    process.exit(2);
  }
}
if (deterministic) selected = selected.filter((c) => c.kind === 'deterministic');

const scenarios = new Set<ScenarioId>(['F', 'G']);
for (const c of selected) if (c.scenario !== 'build') scenarios.add(c.scenario);

// --from re-evaluates the checks against a saved `pnpm perf` result instead of measuring (no e2e gate).
const from = value('from');
console.log(`Perf Lab validator · mode: ${mode} · ${from ? `from ${from}` : `${runs} run(s) · scenarios ${[...scenarios].sort().join('')}`}`);
const result: Collected = from ? (JSON.parse(readFileSync(from, 'utf8')) as Collected) : await collect({ runs, scenarios: [...scenarios], build: !flag('skip-build') });

// ---------- e2e gate ----------
let e2ePass: boolean | null = null;
if (!flag('skip-e2e') && !from) {
  console.log('\nRunning functional tests (pnpm test:e2e)…');
  const r = spawnSync('node', ['scripts/e2e.ts', '--reporter=dot'], { cwd: ROOT, env: { ...process.env, E2E_SKIP_BUILD: '1' }, encoding: 'utf8' });
  e2ePass = r.status === 0;
  const tail = `${r.stdout}${r.stderr}`.trim().split('\n').slice(-12).join('\n');
  console.log(e2ePass ? '  e2e: all tests passed' : `  e2e FAILED:\n${tail}`);
}

// ---------- evaluate ----------
const outcomes: Outcome[] = [];
for (const c of selected) {
  const s = result.metrics[c.metric];
  const measured = s ? s.median : null;
  const provisional = c.kind === 'timing' && (quick || runs < 5);
  let pass = false;
  let note: string | undefined;
  if (c.threshold === null) note = 'not calibrated';
  else if (measured === null || !Number.isFinite(measured)) note = 'not measured';
  else pass = c.op === '<=' ? measured <= c.threshold : measured >= c.threshold;
  outcomes.push({ id: c.id, symptom: c.symptom, title: c.title, metric: c.metric, measured, iqr: s ? s.iqr : null, op: c.op, threshold: c.threshold, kind: c.kind!, pass, provisional, note });
}

const gate = (id: string, title: string, pass: boolean | null, note?: string): Outcome => ({ id, symptom: 'gate', title, metric: '', measured: pass === null ? null : pass ? 1 : 0, iqr: null, op: '==', threshold: 1, kind: 'deterministic', pass: pass === true, provisional: false, note });
const failuresOf = (k: ScenarioId) => (result.raw[k] ?? []).flatMap((r) => (r.details.failures as string[] | undefined) ?? []);
const fresh = result.metrics.freshnessPass?.median;
const iso = result.metrics.isolationPass?.median;
outcomes.push(gate('F', 'Freshness: an order edit is visible on the dashboard and orders list within one navigation', fresh === undefined ? false : fresh >= 1, failuresOf('F').join('; ') || undefined));
outcomes.push(gate('G', 'Isolation: users never see each other’s personalised data', iso === undefined ? false : iso >= 1, failuresOf('G').join('; ') || undefined));
if (e2ePass !== null) outcomes.push(gate('E2E', 'Functional tests (pnpm test:e2e)', e2ePass));

// ---------- regression guard ----------
const prev = loadHistory().at(-1);
if (prev) {
  const regressions: string[] = [];
  // Guard the metrics the budgets care about; informational metrics (e.g. async JS) may trade off freely.
  const guarded = new Set(budgets.checks.map((c) => c.metric));
  for (const [key, s] of Object.entries(result.metrics)) {
    const def = METRICS[key];
    if (!def || def.unit === 'bool' || !guarded.has(key)) continue;
    if (deterministic && def.kind !== 'deterministic') continue;
    if (def.kind === 'timing' && (quick || runs < 5)) continue;
    const { verdict, delta } = judge(key, prev.metrics[key], { median: s.median, iqr: s.iqr });
    if (verdict === 'worse') regressions.push(`${def.label}: ${format(key, prev.metrics[key].median)} → ${format(key, s.median)} (${delta > 0 ? '+' : ''}${format(key, delta)})`);
  }
  const o = gate('REG', `No metric worse than the last PERF.md row ("${prev.label}") beyond noise`, regressions.length === 0, regressions.join('; ') || undefined);
  outcomes.push(o);
}

// ---------- report ----------
const scored = outcomes.filter((o) => o.symptom !== 'gate');
const gates = outcomes.filter((o) => o.symptom === 'gate');
const passed = scored.filter((o) => o.pass).length;
const score = `${passed} / ${scored.length}`;
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
const fmt = (o: Outcome, v: number | null) => (v === null ? '–' : o.metric ? format(o.metric, v) : v >= 1 ? 'pass' : 'fail');

console.log(`\n| Check | Symptom | Metric | Measured (IQR) | Threshold | Result |`);
console.log(`|---|---|---|---|---|---|`);
for (const o of outcomes) {
  const measured = o.measured === null ? '–' : `${fmt(o, o.measured)}${o.iqr && o.kind === 'timing' ? ` (±${format(o.metric, o.iqr).replace(/ (ms|KB|MB)$/, '')})` : ''}`;
  const threshold = o.metric && o.threshold !== null ? `${o.op} ${format(o.metric, o.threshold)}` : o.metric ? '–' : 'pass';
  const icon = o.pass ? '✅' : '❌';
  const flags = [o.provisional ? 'provisional' : '', o.note && !o.pass ? o.note : ''].filter(Boolean).join(' · ');
  console.log(`| ${o.id} | ${o.symptom} | ${pad(o.metric ? METRICS[o.metric].label : o.title, 60)} | ${measured} | ${threshold} | ${icon}${flags ? ` ${flags}` : ''} |`);
}
console.log(`\nScore: ${score} checks passing · gates: ${gates.map((g) => `${g.id} ${g.pass ? '✅' : '❌'}`).join(' ')}`);
if (quick || runs < 5) console.log('Timing results are provisional: run a full `pnpm validate` for the real verdict.');
const failedGates = gates.filter((o) => !o.pass);
for (const g of failedGates) console.log(`❌ ${g.title}${g.note ? `\n   ${g.note}` : ''}`);

mkdirSync(VALIDATION_DIR, { recursive: true });
const file = join(VALIDATION_DIR, `${result.meta.date.slice(0, 19).replace(/[:T]/g, '-')}.json`);
const git = gitInfo();
if (!from) writeFileSync(file, JSON.stringify({ date: result.meta.date, commit: git.commit + (git.dirty ? '+dirty' : ''), branch: git.branch, mode: mode === 'full' ? 'full' : mode, runs, score, passed, total: scored.length, gates: Object.fromEntries(gates.map((g) => [g.id, g.pass])), outcomes, environment: result.meta.environment, renderModes: result.renderModes }, null, 1));
if (!from) console.log(`\nSaved ${file.replace(ROOT, '')}`);
process.exit(outcomes.every((o) => o.pass) ? 0 : 1);
