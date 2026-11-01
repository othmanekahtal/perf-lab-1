// Restores data/shoply.db from the pristine seed snapshot so every run starts from the same data.
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(new URL('..', import.meta.url).pathname, 'data');
const seed = join(DATA, 'shoply.seed.db');
if (!existsSync(seed)) {
  console.error('data/shoply.seed.db is missing, run `pnpm seed` first');
  process.exit(1);
}
for (const f of ['shoply.db-wal', 'shoply.db-shm']) if (existsSync(join(DATA, f))) rmSync(join(DATA, f));
copyFileSync(seed, join(DATA, 'shoply.db'));
