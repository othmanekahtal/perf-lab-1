// Derives perf-budgets.json thresholds from reference measurements.
// node validate/derive.ts perf-results/a.json perf-results/b.json perf-results/c.json
// For each metric: reference = worst median across the given runs; threshold = reference + margin (see MARGINS).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { METRICS, type MetricDef } from '../perf/lib/metrics.ts';
import { ROOT } from '../perf/lib/services.ts';

type Run = { meta: { git: { commit: string; branch: string }; date: string }; metrics: Record<string, { median: number }> };

/** Documented safety margins. "worse" means larger for lower-is-better metrics, smaller for higher-is-better. */
export const MARGINS: Record<string, { describe: string; apply: (ref: number, def: MetricDef) => number }> = {
  timing: { describe: 'timing: ×1.5 of the reference, plus an absolute allowance (100 ms; 0.05 CLS; 1 long task; 2 layouts/s); throughput: ÷1.5', apply: (ref, def) => {
    if (def.better === 'higher') return ref / 1.5;
    const abs = def.unit === 'ms' ? 100 : def.unit === 'count' ? 1 : def.unit === '' && def.floor === 0.01 ? 0.05 : def.unit === '' ? 2 : 0;
    return ref * 1.5 + abs;
  } },
  bytes: { describe: 'bytes: +10% of the reference + 5 KB', apply: (ref) => ref * 1.1 + 5 },
  count: { describe: 'counts (upstream calls, requests): reference + 1', apply: (ref, def) => (def.better === 'higher' ? Math.max(0, ref - 1) : ref + 1) },
  heap: { describe: 'heap: ×1.25 of the reference + 3 MB', apply: (ref) => ref * 1.25 + 3 },
  ratio: { describe: 'ratios: reference − 0.02', apply: (ref) => ref - 0.02 },
  exact: { describe: 'route rendering modes: exact', apply: (ref) => ref },
};

export function marginFor(metric: string): keyof typeof MARGINS {
  const def = METRICS[metric];
  if (metric === 'prerenderedRoutes') return 'exact';
  if (def.kind === 'timing') return 'timing';
  if (def.unit === 'KB') return 'bytes';
  if (def.unit === 'MB') return 'heap';
  if (def.unit === 'ratio') return 'ratio';
  return 'count';
}

const files = process.argv.slice(2).filter((a) => a !== '--');
if (!files.length) {
  console.error('usage: node validate/derive.ts <perf-results/*.json> [...]');
  process.exit(2);
}
const runs = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Run);
const budgetsPath = join(ROOT, 'perf-budgets.json');
const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8')) as { checks: { metric: string; op: string; kind: string | null; threshold: number | null; reference: number | null; margin?: string }[]; margins: Record<string, string>; reference: unknown };

for (const c of budgets.checks) {
  const def = METRICS[c.metric];
  const values = runs.map((r) => r.metrics[c.metric]?.median).filter((v): v is number => Number.isFinite(v));
  if (!values.length) { console.warn(`no reference value for ${c.metric}`); continue; }
  const worst = def.better === 'lower' ? Math.max(...values) : Math.min(...values);
  const margin = marginFor(c.metric);
  let threshold = MARGINS[margin].apply(worst, def);
  threshold = def.unit === 'count' || margin === 'exact' ? Math.round(threshold * 100) / 100 : Math.round(threshold * 1000) / 1000;
  c.kind = def.kind;
  c.reference = Math.round(worst * 1000) / 1000;
  c.threshold = threshold;
  c.margin = margin;
}
budgets.margins = Object.fromEntries(Object.entries(MARGINS).map(([k, v]) => [k, v.describe]));
budgets.reference = runs.map((r, i) => ({ file: files[i].replace(`${ROOT}`, ''), commit: r.meta.git.commit, branch: r.meta.git.branch, date: r.meta.date }));
writeFileSync(budgetsPath, JSON.stringify(budgets, null, 2) + '\n');
console.log(`Updated ${budgets.checks.length} thresholds from ${runs.length} reference run(s).`);
