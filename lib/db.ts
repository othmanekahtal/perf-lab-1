import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const g = globalThis as unknown as { __shoplyDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__shoplyDb) {
    const file = process.env.SHOPLY_DB ?? join(process.cwd(), 'data', 'shoply.db');
    g.__shoplyDb = new DatabaseSync(file);
    g.__shoplyDb.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  }
  return g.__shoplyDb;
}
