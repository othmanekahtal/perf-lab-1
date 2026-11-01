// Runs the requested scenarios against a fresh production build and aggregates them (median + IQR).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { EMULATION, launchBrowser } from './browser.ts';
import { parseRenderModes, prerenderedCount, type RenderMode } from './build-output.ts';
import { METRICS } from './metrics.ts';
import { scenarioA, scenarioB, scenarioC, scenarioD, scenarioE, scenarioF, scenarioG, scenarioH, type Ctx, type RunResult } from './scenarios.ts';
import { ROOT, startServices } from './services.ts';
import { summarize, type Summary } from './stats.ts';

export const ALL_SCENARIOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type ScenarioId = (typeof ALL_SCENARIOS)[number];

export type Collected = {
  meta: {
    date: string;
    git: { commit: string; branch: string; dirty: boolean };
    environment: Record<string, string>;
    emulation: typeof EMULATION;
    runs: Partial<Record<ScenarioId, number>>;
    scenarios: ScenarioId[];
    durationSec: number;
  };
  renderModes: Record<string, RenderMode>;
  metrics: Record<string, Summary>;
  raw: Partial<Record<ScenarioId, RunResult[]>>;
};

function sh(cmd: string) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

export function gitInfo() {
  return { commit: sh('git rev-parse --short HEAD'), branch: sh('git rev-parse --abbrev-ref HEAD'), dirty: sh('git status --porcelain').length > 0 };
}

export async function collect(opts: { runs: number; scenarios: ScenarioId[]; build: boolean; log?: (msg: string) => void }): Promise<Collected> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const started = Date.now();
  const services = await startServices({ build: opts.build });
  const browser = await launchBrowser();
  const ctx: Ctx = { browser, appUrl: services.appUrl, upstreamUrl: services.upstreamUrl, vendorUrl: services.vendorUrl };
  const runsFor: Partial<Record<ScenarioId, number>> = {};
  for (const s of opts.scenarios) {
    runsFor[s] = s === 'E' ? (opts.runs >= 5 ? 3 : 1) : s === 'F' || s === 'G' || s === 'H' ? 1 : opts.runs;
  }
  const raw: Collected['raw'] = {};
  try {
    // Warm the server (JIT, module init) so run 1 is comparable with the others.
    for (const path of ['/login', '/', '/products', '/orders', '/settings']) {
      await fetch(`${services.appUrl}${path}`, { headers: { cookie: 'shoply_session=' + Buffer.from(JSON.stringify({ u: 'alice', v: 1 })).toString('base64url') } }).then((r) => r.arrayBuffer()).catch(() => {});
    }
    const order: ScenarioId[] = ['A', 'B', 'C', 'D', 'E', 'H', 'G', 'F'];
    for (const id of order.filter((s) => opts.scenarios.includes(s))) {
      raw[id] = [];
      for (let i = 0; i < runsFor[id]!; i++) {
        const t0 = Date.now();
        process.stdout.write(`  ${id} run ${i + 1}/${runsFor[id]} … `);
        const fn = { A: scenarioA, B: scenarioB, C: scenarioC, D: scenarioD, E: scenarioE, F: scenarioF, G: scenarioG, H: scenarioH }[id];
        try {
          raw[id]!.push(await fn(ctx, browser));
          console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
        } catch (e) {
          console.log('error');
          log(`    ${id} failed: ${(e as Error).message.split('\n')[0]}`);
          if (id === 'F') raw[id]!.push({ metrics: { freshnessPass: 0 }, details: { failures: [`scenario crashed: ${(e as Error).message}`] } });
          else if (id === 'G') raw[id]!.push({ metrics: { isolationPass: 0 }, details: { failures: [`scenario crashed: ${(e as Error).message}`] } });
        }
      }
    }
  } finally {
    await browser.close();
    await services.stop();
  }

  const renderModes = services.buildLog ? parseRenderModes(services.buildLog) : parseRenderModes(readLastBuildLog());
  const metrics: Record<string, Summary> = {};
  for (const runs of Object.values(raw)) {
    const keys = new Set(runs!.flatMap((r) => Object.keys(r.metrics)));
    for (const k of keys) metrics[k] = summarize(runs!.map((r) => r.metrics[k]).filter((v) => v !== undefined));
  }
  if (Object.keys(renderModes).length) metrics.prerenderedRoutes = summarize([prerenderedCount(renderModes)]);
  for (const k of Object.keys(metrics)) if (!METRICS[k]) delete metrics[k];

  return {
    meta: {
      date: new Date().toISOString(),
      git: gitInfo(),
      environment: environment(),
      emulation: EMULATION,
      runs: runsFor,
      scenarios: opts.scenarios,
      durationSec: Math.round((Date.now() - started) / 1000),
    },
    renderModes,
    metrics,
    raw,
  };
}

function readLastBuildLog() {
  try { return readFileSync(join(ROOT, '.perf-tmp', 'build.log'), 'utf8'); } catch { return ''; }
}

export function environment(): Record<string, string> {
  const pkg = (name: string) => {
    try { return (JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version; } catch { return '?'; }
  };
  let chrome = '?';
  try {
    const out = execSync(`node -e "import('@playwright/test').then(async ({chromium}) => { const b = await chromium.launch(); console.log(b.version()); await b.close(); })"`, { cwd: ROOT, encoding: 'utf8' });
    chrome = out.trim();
  } catch {}
  return {
    machine: `${os.cpus()[0]?.model ?? '?'} · ${os.cpus().length} cores · ${Math.round(os.totalmem() / 2 ** 30)} GB`,
    os: `${os.type()} ${os.release()} (${sh('sw_vers -productVersion') || os.platform()})`,
    node: process.version,
    chromium: chrome,
    next: pkg('next'),
    react: pkg('react'),
    playwright: pkg('@playwright/test'),
  };
}
