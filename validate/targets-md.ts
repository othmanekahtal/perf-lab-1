// Renders the "Final targets" and "All checks" tables of PERF.md from perf-budgets.json.
// node validate/targets-md.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, METRICS } from '../perf/lib/metrics.ts';
import { ROOT } from '../perf/lib/services.ts';

type Check = { id: string; symptom: string; scenario: string; metric: string; op: string; title: string; kind: string; threshold: number | null; reference: number | null; margin?: string };
const budgets = JSON.parse(readFileSync(join(ROOT, 'perf-budgets.json'), 'utf8')) as { checks: Check[]; margins: Record<string, string> };

const row = (c: Check) => {
  const label = c.symptom.startsWith('M') ? `${c.title}: ${METRICS[c.metric].label}` : c.symptom === 'global' ? METRICS[c.metric].label : c.title;
  return `| ${c.id} | ${label} | ${c.scenario} | ${c.kind} | ${c.reference === null ? '–' : format(c.metric, c.reference)} | ${c.margin ?? '–'} | ${c.op} ${c.threshold === null ? '–' : format(c.metric, c.threshold)} |`;
};
const header = '| Check | Measures | Scenario | Kind | Reference value | Margin | Threshold |\n|---|---|---|---|---:|---|---:|';

const targets = [header, ...budgets.checks.filter((c) => c.symptom === 'global').map(row)].join('\n');
const all = [header, ...budgets.checks.filter((c) => c.symptom !== 'global').map(row)].join('\n');
const margins = Object.entries(budgets.margins).map(([k, v]) => `- **${k}**: ${v.replace(/^[a-z ()/,]+: /, '')}`).join('\n');

const path = join(ROOT, 'PERF.md');
let md = readFileSync(path, 'utf8');
const put = (name: string, body: string) => {
  md = md.replace(new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`), `<!-- ${name}:start -->\n${body}\n<!-- ${name}:end -->`);
};
put('targets', targets);
put('checks', all);
put('margins', margins);
writeFileSync(path, md);
console.log('PERF.md targets updated');
