// `pnpm test:e2e`: builds the app (skip with E2E_SKIP_BUILD=1) and runs the Playwright suite against `next start`.
import { spawnSync } from 'node:child_process';
import { startServices } from '../perf/lib/services.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const services = await startServices({ build: process.env.E2E_SKIP_BUILD !== '1', log: true });
let status = 1;
try {
  status = spawnSync('pnpm', ['exec', 'playwright', 'test', ...args], { stdio: 'inherit', env: { ...process.env, BASE_URL: services.appUrl } }).status ?? 1;
} finally {
  await services.stop();
}
process.exit(status);
