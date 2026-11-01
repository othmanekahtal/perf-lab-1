// `pnpm build`: production build; with ANALYZE=true also opens the Turbopack bundle analyzer.
import { spawnSync } from 'node:child_process';

const run = (args: string[]) => {
  const r = spawnSync('pnpm', ['exec', 'next', ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(['build']);
if (process.env.ANALYZE === 'true') run(['analyze']);
