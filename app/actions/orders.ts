'use server';

import { updateTag } from 'next/cache';
import { getOrder, saveOrder, TAGS } from '@/lib/data';
import { requireUser } from '@/lib/session';
import { ORDER_STATUSES, type OrderItem, type OrderStatus } from '@/lib/types';

export type SaveState = { ok?: boolean; error?: string; savedAt?: string };

export async function updateOrder(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireUser();
  const id = Number(formData.get('id'));
  const order = getOrder(id);
  if (!order) return { error: 'Order not found' };

  const status = String(formData.get('status')) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { error: 'Invalid status' };
  const shipping = String(formData.get('shipping_address') ?? '').trim();
  if (shipping.length < 5) return { error: 'Shipping address is too short' };
  const notes = String(formData.get('notes') ?? '').slice(0, 2000);

  const items = (JSON.parse(order.items) as OrderItem[]).map((item, i) => ({
    ...item,
    qty: Math.max(0, Math.min(99, Number(formData.get(`qty_${i}`) ?? item.qty) || 0)),
  }));
  const kept = items.filter((i) => i.qty > 0);
  if (!kept.length) return { error: 'An order needs at least one item' };
  const total = kept.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);

  saveOrder(id, { status, shipping_address: shipping, notes, items: JSON.stringify(kept), total_cents: total });
  // Read-your-own-writes for exactly what depends on orders; FX, forecast, catalogue and recommendations stay cached.
  updateTag(TAGS.orders);
  updateTag(TAGS.order(id));
  return { ok: true, savedAt: new Date().toISOString() };
}
