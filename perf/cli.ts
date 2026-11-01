// pnpm perf -- --label "..." [--week n] [--append] [--runs n] [--scenarios A,B,...] [--skip-build]
import { ALL_SCENARIOS, collect, type ScenarioId } from './lib/collect.ts';
import { appendToPerfMd, comparisonTable, loadHistory, markdownRow, saveRaw, scoreForCommit, tableHeader, toEntry } from './lib/report.ts';

function parseArgs(argv: string[]) {
  const args = argv.filter((a) => a !== '--');
  const get = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    label: get('label'),
    week: get('week') !== undefined ? Number(get('week')) : null,
    append: args.includes('--append'),
    runs: Number(get('runs') ?? 7),
    scenarios: (get('scenarios')?.split(',').map((s) => s.trim().toUpperCase()) ?? [...ALL_SCENARIOS]) as ScenarioId[],
    build: !args.includes('--skip-build'),
  };
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.label) {
  console.error('Usage: pnpm perf -- --label "what changed" [--week n] [--append] [--runs 7] [--scenarios A,B,C,D,E,F,G,H] [--skip-build]');
  process.exit(2);
}
for (const s of opts.scenarios) if (!ALL_SCENARIOS.includes(s)) { console.error(`Unknown scenario ${s}`); process.exit(2); }

console.log(`Perf Lab · "${opts.label}" · scenarios ${opts.scenarios.join('')} · ${opts.runs} runs`);
const result = await collect({ runs: opts.runs, scenarios: opts.scenarios, build: opts.build });
const file = saveRaw(result, opts.label);
const entry = toEntry(result, opts.label, opts.week, file, scoreForCommit(result.meta.git.commit));

console.log(`\nRaw results: perf-results/${file} (${result.meta.durationSec}s)\n`);
console.log(tableHeader());
console.log(markdownRow(entry));

const prev = loadHistory().at(-1);
if (prev) console.log(`\n${comparisonTable(prev, entry)}`);

const failures: string[] = [];
for (const [k, name] of [['F', 'freshness'], ['G', 'isolation']] as const) {
  const runs = result.raw[k];
  const details = runs?.flatMap((r) => (r.details.failures as string[] | undefined) ?? []) ?? [];
  if (details.length) failures.push(...details.map((d) => `${name}: ${d}`));
}
if (failures.length) {
  console.log(`\n❌ Correctness failures:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
}

if (opts.append) {
  const missing = (['F', 'G'] as const).filter((s) => !opts.scenarios.includes(s));
  if (failures.length) {
    console.error('\nRefusing to append: freshness/isolation must pass before a row is recorded.');
    process.exit(1);
  }
  if (missing.length) {
    console.error(`\nRefusing to append: scenarios ${missing.join(', ')} (correctness gates) were not run.`);
    process.exit(1);
  }
  appendToPerfMd(entry);
  console.log('\nAppended to PERF.md and perf-results/history.json');
}
process.exit(failures.length ? 1 : 0);
