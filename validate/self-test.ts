// Proves the validator works in both directions:
//   - the baseline fails every symptom (S*) and mystery (M*) check, while the correctness gates pass;
//   - the reference solution passes every check, in N consecutive full runs.
// pnpm validate:self-test [-- --runs 3] [--baseline baseline] [--reference reference-solution] [--only baseline|reference]
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../perf/lib/services.ts';

type Outcome = { id: string; symptom: string; pass: boolean; measured: number | null; threshold: number | null; note?: string };
type Validation = { score: string; commit: string; gates: Record<string, boolean>; outcomes: Outcome[] };

const args = process.argv.slice(2).filter((a) => a !== '--');
const value = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const runs = Number(value('runs') ?? 3);
const baselineRef = value('baseline') ?? 'baseline';
const referenceRef = value('reference') ?? 'reference-solution';
const only = value('only'); // 'baseline' or 'reference'
const WORK = join(ROOT, '.perf-tmp', 'self-test');

function checkout(ref: string) {
  const dir = join(WORK, ref.replace(/[^a-z0-9-]/gi, '_'));
  if (existsSync(dir)) execSync(`git worktree remove --force "${dir}"`, { cwd: ROOT, stdio: 'ignore' });
  mkdirSync(WORK, { recursive: true });
  execSync(`git worktree add --detach "${dir}" ${ref}`, { cwd: ROOT, stdio: 'ignore' });
  mkdirSync(join(dir, 'data'), { recursive: true });
  cpSync(join(ROOT, 'data', 'shoply.seed.db'), join(dir, 'data', 'shoply.seed.db'));
  cpSync(join(ROOT, 'public', 'products'), join(dir, 'public', 'products'), { recursive: true });
  execSync('pnpm install --frozen-lockfile --prefer-offline', { cwd: dir, stdio: 'ignore' });
  return dir;
}

function validate(dir: string, label: string): Validation {
  console.log(`\n▶ ${label}: pnpm validate (full)`);
  spawnSync('node', ['validate/cli.ts'], { cwd: dir, stdio: 'inherit' });
  const files = readdirSync(join(dir, 'validation-results')).filter((f) => /^\d{4}-.*\.json$/.test(f)).sort();
  return JSON.parse(readFileSync(join(dir, 'validation-results', files.at(-1)!), 'utf8')) as Validation;
}

const report: Record<string, unknown> = { date: new Date().toISOString(), runs };
const problems: string[] = [];

// Baseline: every S*/M* check must fail, every gate must pass.
const dirs: string[] = [];
let base: Validation = { score: '–', commit: '–', gates: {}, outcomes: [] };
if (only !== 'reference') {
  const baseDir = checkout(baselineRef);
  dirs.push(baseDir);
  base = validate(baseDir, `baseline (${baselineRef})`);
}
const shouldFail = base.outcomes.filter((o) => /^(S|M)\d/.test(o.symptom));
for (const o of shouldFail) if (o.pass) problems.push(`baseline: ${o.id} passes (measured ${o.measured}, threshold ${o.threshold})`);
for (const [g, ok] of Object.entries(base.gates)) if (!ok) problems.push(`baseline: gate ${g} fails`);
report.baseline = { ref: baselineRef, commit: base.commit, score: base.score, gates: base.gates, symptomAndMysteryChecks: shouldFail.length, passingThatShouldFail: shouldFail.filter((o) => o.pass).map((o) => o.id) };

// Reference: everything passes, N times in a row.
const refRuns = [];
const refDir = only === 'baseline' ? '' : checkout(referenceRef);
if (refDir) dirs.push(refDir);
for (let i = 1; refDir && i <= runs; i++) {
  const v = validate(refDir, `reference (${referenceRef}) run ${i}/${runs}`);
  const failing = v.outcomes.filter((o) => !o.pass);
  for (const o of failing) problems.push(`reference run ${i}: ${o.id} fails (measured ${o.measured}, threshold ${o.threshold}${o.note ? `, ${o.note}` : ''})`);
  refRuns.push({ commit: v.commit, score: v.score, gates: v.gates, failing: failing.map((o) => o.id) });
}
report.reference = { ref: referenceRef, runs: refRuns };
report.ok = problems.length === 0;
report.problems = problems;

mkdirSync(join(ROOT, 'validation-results'), { recursive: true });
const out = join(ROOT, 'validation-results', `self-test-${report.date as string}.json`.replace(/[:]/g, '-'));
writeFileSync(out, JSON.stringify(report, null, 1));
for (const dir of dirs) execSync(`git worktree remove --force "${dir}"`, { cwd: ROOT, stdio: 'ignore' });
rmSync(WORK, { recursive: true, force: true });

console.log('\n=== Validator self-test ===');
console.log(`Baseline  (${baselineRef}): score ${base.score}; ${shouldFail.length - shouldFail.filter((o) => o.pass).length}/${shouldFail.length} symptom+mystery checks fail as expected; gates ${Object.entries(base.gates).map(([g, ok]) => `${g}${ok ? '✅' : '❌'}`).join(' ')}`);
refRuns.forEach((r, i) => console.log(`Reference (${referenceRef}) run ${i + 1}: score ${r.score}; gates ${Object.entries(r.gates).map(([g, ok]) => `${g}${ok ? '✅' : '❌'}`).join(' ')}`));
console.log(problems.length ? `\n❌ ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}` : '\n✅ The validator separates the baseline from the reference solution.');
console.log(`Saved ${out.replace(ROOT, '')}`);
process.exit(problems.length ? 1 : 0);
