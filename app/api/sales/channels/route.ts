import { db } from '@/lib/db';
import { STORE_TODAY } from '@/lib/format';

export async function GET() {
  const since = new Date(Date.parse(STORE_TODAY) - 30 * 86_400_000).toISOString();
  const channels = db()
    .prepare(`SELECT channel, SUM(total_cents) AS revenueCents FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','refunded') GROUP BY channel ORDER BY revenueCents DESC`)
    .all(since);
  return Response.json({ channels }, { headers: { 'Cache-Control': 'no-store' } });
}
