import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const g = globalThis as unknown as { __shoplyDb?: DatabaseSync };

const INDEXES = `
  CREATE INDEX IF NOT EXISTS orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS orders_status_created_at ON orders(status, created_at);
  CREATE INDEX IF NOT EXISTS orders_customer_email ON orders(customer_email, total_cents);
  CREATE INDEX IF NOT EXISTS reviews_product_created_at ON reviews(product_id, created_at);
  CREATE INDEX IF NOT EXISTS products_category_rating ON products(category, rating);
`;

export function db(): DatabaseSync {
  if (!g.__shoplyDb) {
    const file = process.env.SHOPLY_DB ?? join(process.cwd(), 'data', 'shoply.db');
    const conn = new DatabaseSync(file);
    // Build workers open the database concurrently; wait for locks instead of failing.
    conn.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    conn.exec(INDEXES);
    g.__shoplyDb = conn;
  }
  return g.__shoplyDb;
}
