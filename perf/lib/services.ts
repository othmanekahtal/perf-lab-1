// Starts/stops everything a measurement needs: upstream API, third-party vendors and `next start`.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const TMP = join(ROOT, '.perf-tmp');

export const PORTS = {
  app: Number(process.env.APP_PORT ?? 3100),
  upstream: Number(process.env.UPSTREAM_PORT ?? 4001),
  thirdparty: Number(process.env.THIRDPARTY_PORT ?? 4002),
};

export type Services = {
  appUrl: string;
  upstreamUrl: string;
  vendorUrl: string;
  buildLog: string | null;
  appPid: number;
  stop: () => Promise<void>;
};

function portFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port);
  });
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${url}`);
}

function launch(name: string, cmd: string, args: string[], env: Record<string, string>, log: boolean): ChildProcess {
  mkdirSync(TMP, { recursive: true });
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const out: Buffer[] = [];
  child.stdout?.on('data', (d: Buffer) => { out.push(d); if (log) process.stdout.write(`[${name}] ${d}`); });
  child.stderr?.on('data', (d: Buffer) => { out.push(d); if (log) process.stderr.write(`[${name}] ${d}`); });
  child.on('exit', () => writeFileSync(join(TMP, `${name}.log`), Buffer.concat(out)));
  return child;
}

function kill(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || !child.pid) return resolve();
    child.once('exit', () => resolve());
    try { process.kill(-child.pid, 'SIGTERM'); } catch { resolve(); }
    setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} resolve(); }, 5000);
  });
}

export async function startServices(opts: { build: boolean; log?: boolean }): Promise<Services> {
  for (const [name, port] of Object.entries(PORTS)) {
    if (!(await portFree(port))) throw new Error(`port ${port} (${name}) is already in use; stop whatever is running there first`);
  }
  if (!existsSync(join(ROOT, 'data', 'shoply.seed.db'))) {
    console.log('No seed database found, running `pnpm seed`…');
    if (spawnSync('node', ['scripts/seed.ts'], { cwd: ROOT, stdio: 'inherit' }).status !== 0) throw new Error('seed failed');
  }
  if (spawnSync('node', ['scripts/reset-db.ts'], { cwd: ROOT, stdio: 'inherit' }).status !== 0) throw new Error('db reset failed');

  const upstreamUrl = `http://localhost:${PORTS.upstream}`;
  const vendorUrl = `http://localhost:${PORTS.thirdparty}`;
  const appUrl = `http://localhost:${PORTS.app}`;
  const env = {
    UPSTREAM_URL: upstreamUrl,
    NEXT_PUBLIC_VENDOR_ORIGIN: vendorUrl,
    NEXT_TELEMETRY_DISABLED: '1',
    UPSTREAM_PORT: String(PORTS.upstream),
    THIRDPARTY_PORT: String(PORTS.thirdparty),
  };
  const children: ChildProcess[] = [];
  const stop = async () => { await Promise.all(children.reverse().map(kill)); };

  try {
    children.push(launch('upstream', 'node', ['servers/upstream.ts'], env, false));
    children.push(launch('thirdparty', 'node', ['servers/thirdparty.ts'], env, false));
    await waitFor(`${upstreamUrl}/health`, 15_000);
    await waitFor(`${vendorUrl}/analytics.js`, 15_000);

    let buildLog: string | null = null;
    if (opts.build) {
      process.stdout.write('Building (next build)… ');
      const t0 = Date.now();
      const r = spawnSync('pnpm', ['exec', 'next', 'build'], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      buildLog = `${r.stdout}\n${r.stderr}`;
      writeFileSync(join(TMP, 'build.log'), buildLog);
      if (r.status !== 0) {
        console.error(buildLog);
        throw new Error('next build failed');
      }
      console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      // Prerendering may have hit the upstream API; start the measurement from a clean counter.
      await fetch(`${upstreamUrl}/__reset`, { method: 'POST' });
    }

    const app = launch('app', 'pnpm', ['exec', 'next', 'start', '-p', String(PORTS.app)], env, Boolean(opts.log));
    children.push(app);
    await waitFor(`${appUrl}/login`, 60_000);
    return { appUrl, upstreamUrl, vendorUrl, buildLog, appPid: app.pid!, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}

export async function upstreamStats(upstreamUrl: string): Promise<{ total: number; byEndpoint: Record<string, number> }> {
  return (await fetch(`${upstreamUrl}/__stats`)).json() as Promise<{ total: number; byEndpoint: Record<string, number> }>;
}

export async function resetUpstream(upstreamUrl: string) {
  await fetch(`${upstreamUrl}/__reset`, { method: 'POST' });
}
