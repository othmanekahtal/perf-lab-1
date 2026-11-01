// Markdown rows, PERF.md updates, results history and run-to-run comparison.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Collected } from './collect.ts';
import { format, METRICS } from './metrics.ts';
import { ROOT } from './services.ts';

export const RESULTS_DIR = join(ROOT, 'perf-results');
export const HISTORY_FILE = join(RESULTS_DIR, 'history.json');
export const PERF_MD = join(ROOT, 'PERF.md');
export const VALIDATION_DIR = join(ROOT, 'validation-results');

export type Point = { median: number; iqr: number };
export type HistoryEntry = {
  week: number | null;
  label: string;
  date: string;
  file: string;
  commit: string;
  score: string | null;
  freshness: boolean | null;
  isolation: boolean | null;
  metrics: Record<string, Point>;
};

export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  return JSON.parse(readFileSync(HISTORY_FILE, 'utf8')) as HistoryEntry[];
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'run';
}

export function saveRaw(result: Collected, label: string) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = `${result.meta.date.slice(0, 19).replace(/[:T]/g, '-')}-${slug(label)}.json`;
  writeFileSync(join(RESULTS_DIR, file), JSON.stringify({ label, ...result }, null, 1));
  return file;
}

export function toEntry(result: Collected, label: string, week: number | null, file: string, score: string | null): HistoryEntry {
  const pass = (k: string) => (result.metrics[k] ? result.metrics[k].median >= 1 : null);
  return {
    week, label, date: result.meta.date, file, commit: result.meta.git.commit + (result.meta.git.dirty ? '+dirty' : ''), score,
    freshness: pass('freshnessPass'), isolation: pass('isolationPass'),
    metrics: Object.fromEntries(Object.entries(result.metrics).map(([k, v]) => [k, { median: v.median, iqr: v.iqr }])),
  };
}

/** Latest validator score recorded for this exact commit, if any. */
export function scoreForCommit(commit: string): string | null {
  if (!existsSync(VALIDATION_DIR)) return null;
  const files = readdirSync(VALIDATION_DIR).filter((f) => f.endsWith('.json')).sort().reverse();
  for (const f of files) {
    const v = JSON.parse(readFileSync(join(VALIDATION_DIR, f), 'utf8')) as { commit?: string; score?: string; mode?: string };
    if (v.commit === commit && v.mode === 'full') return v.score ?? null;
  }
  return null;
}

// ---------- comparison ----------

export type Verdict = 'better' | 'worse' | 'noise' | 'n/a';

export function judge(key: string, prev: Point | undefined, cur: Point | undefined): { verdict: Verdict; delta: number; noise: number } {
  const def = METRICS[key];
  if (!def || !prev || !cur || !Number.isFinite(prev.median) || !Number.isFinite(cur.median)) return { verdict: 'n/a', delta: NaN, noise: NaN };
  const delta = cur.median - prev.median;
  // Medians drift between sessions more than the IQR within one session shows, so allow a relative tolerance too:
  // 10% for timing metrics, 50% for the single 10 s load test (scenario H), 2% for deterministic metrics.
  const relative = def.kind === 'deterministic' ? 0.02 : def.scenario === 'H' ? 0.5 : 0.1;
  const noise = Math.max(prev.iqr || 0, cur.iqr || 0, def.floor, relative * Math.abs(prev.median));
  if (Math.abs(delta) <= noise) return { verdict: 'noise', delta, noise };
  const improved = def.better === 'lower' ? delta < 0 : delta > 0;
  return { verdict: improved ? 'better' : 'worse', delta, noise };
}

export function comparisonTable(prev: HistoryEntry, cur: HistoryEntry) {
  const lines = [`Compared with "${prev.label}" (${prev.date.slice(0, 10)}, ${prev.commit}):`, '', '| Metric | Before | Now | Δ | |', '|---|---:|---:|---:|---|'];
  for (const key of Object.keys(METRICS)) {
    const p = prev.metrics[key], c = cur.metrics[key];
    if (!p || !c) continue;
    const { verdict, delta } = judge(key, p, c);
    const icon = verdict === 'better' ? '✅' : verdict === 'worse' ? '❌' : verdict === 'noise' ? 'within noise' : '';
    const pct = p.median ? ` (${delta >= 0 ? '+' : ''}${((delta / Math.abs(p.median)) * 100).toFixed(0)}%)` : '';
    lines.push(`| ${METRICS[key].label} | ${format(key, p.median)} | ${format(key, c.median)} | ${delta >= 0 ? '+' : ''}${format(key, Math.abs(delta)).replace(/^/, delta < 0 ? '−' : '')}${pct} | ${icon} |`);
  }
  return lines.join('\n');
}

// ---------- PERF.md row ----------

const m = (e: HistoryEntry, k: string) => e.metrics[k];
const v = (e: HistoryEntry, k: string) => {
  const p = m(e, k);
  if (!p) return '–';
  const iqr = METRICS[k]?.kind === 'timing' && p.iqr > 0 ? ` ±${format(k, p.iqr).replace(/ (ms|KB|MB)$/, '')}` : '';
  return format(k, p.median) + iqr;
};

export const COLUMNS: [string, (e: HistoryEntry) => string][] = [
  ['Week', (e) => (e.week === null ? '–' : String(e.week))],
  ['Label', (e) => e.label],
  ['Date', (e) => e.date.slice(0, 10)],
  ['Commit', (e) => e.commit],
  ['Validator', (e) => e.score ?? '–'],
  ['TTFB', (e) => v(e, 'ttfb')],
  ['FCP', (e) => v(e, 'fcp')],
  ['LCP', (e) => v(e, 'lcp')],
  ['CLS', (e) => v(e, 'cls')],
  ['INP', (e) => v(e, 'inp')],
  ['TBT', (e) => v(e, 'tbt')],
  ['Time to interactive', (e) => v(e, 'interactiveMs')],
  ['Long tasks >200ms', (e) => v(e, 'longTasksOver200')],
  ['Forced reflows', (e) => v(e, 'forcedReflows')],
  ['HTML', (e) => v(e, 'htmlKB')],
  ['RSC (dash / products nav)', (e) => `${v(e, 'rscInlineKB')} / ${v(e, 'rscNavProductsKB')}`],
  ['CSS (render-blocking)', (e) => `${v(e, 'cssKB')} (${v(e, 'renderBlockingCount')})`],
  ['JS initial / async', (e) => `${v(e, 'jsInitialKB')} / ${v(e, 'jsAsyncKB')}`],
  ['3P bytes / main thread', (e) => `${v(e, 'thirdPartyKB')} / ${v(e, 'thirdPartyMainThreadMs')}`],
  ['Warm transfer', (e) => v(e, 'warmTransferKB')],
  ['Upstream calls cold / warm', (e) => `${v(e, 'upstreamCallsCold')} / ${v(e, 'upstreamCallsWarm')}`],
  ['Soft nav total', (e) => v(e, 'navTotalMs')],
  ['Heap growth', (e) => v(e, 'heapGrowthMB')],
  ['Server / req/s · p95', (e) => `${v(e, 'rps_dashboard')} · ${v(e, 'p95_dashboard')}`],
  ['F', (e) => (e.freshness === null ? '–' : e.freshness ? '✅' : '❌')],
  ['G', (e) => (e.isolation === null ? '–' : e.isolation ? '✅' : '❌')],
  ['Raw', (e) => `[json](perf-results/${e.file})`],
];

export function tableHeader() {
  return `| ${COLUMNS.map((c) => c[0]).join(' | ')} |\n|${COLUMNS.map(() => '---').join('|')}|`;
}

export function markdownRow(e: HistoryEntry) {
  return `| ${COLUMNS.map((c) => c[1](e).replace(/\|/g, '/')).join(' | ')} |`;
}

const START = '<!-- results:start -->';
const END = '<!-- results:end -->';

export function appendToPerfMd(e: HistoryEntry) {
  const history = loadHistory();
  history.push(e);
  writePerfMd(history);
}

/** Rewrites the results table of PERF.md (and history.json) from the given history. */
export function writePerfMd(history: HistoryEntry[]) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 1));
  const md = existsSync(PERF_MD) ? readFileSync(PERF_MD, 'utf8') : `# Performance log\n\n${START}\n${END}\n`;
  const rows = history.map(markdownRow).join('\n');
  const block = `${START}\n${tableHeader()}\n${rows}\n${END}`;
  const next = md.includes(START) ? md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block) : `${md.trim()}\n\n${block}\n`;
  writeFileSync(PERF_MD, next);
}
