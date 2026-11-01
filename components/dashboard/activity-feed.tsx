'use client';

import { useEffect, useRef } from 'react';
import { money } from '@/lib/format';
import type { Order } from '@/lib/types';

type Item = Pick<Order, 'id' | 'number' | 'customer_name' | 'status' | 'total_cents' | 'channel' | 'created_at'>;

export function ActivityFeed({ items }: { items: Item[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const index = new Map(rows.map((row, i) => [row, i]));
    let furthest = 0;
    // The browser tells us which rows are on screen; no layout reads on scroll.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        entry.target.toggleAttribute('data-in-view', entry.isIntersecting);
        if (entry.isIntersecting) furthest = Math.max(furthest, (index.get(entry.target as HTMLElement) ?? 0) + 1);
      }
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${furthest / rows.length})`;
    });
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [items]);

  let lastDay = '';
  return (
    <section className="panel p-4" data-testid="activity">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">Activity</h2>
        <span className="muted text-xs">{items.length.toLocaleString('en-IE')} events</span>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
        <div ref={progressRef} className="h-1 origin-left scale-x-0 bg-brand-500 transition-transform" />
      </div>
      <ol ref={listRef} className="space-y-1 text-sm">
        {items.map((item) => {
          const day = item.created_at.slice(0, 10);
          const header = day !== lastDay;
          lastDay = day;
          return (
            <li
              key={item.id}
              className="rounded-md border-l-2 border-brand-100 py-1 ps-2.5 transition-transform [contain-intrinsic-size:auto_28px] [content-visibility:auto] data-[in-view]:translate-x-1"
            >
              {header && <div className="muted mb-1 text-xs font-semibold">{day}</div>}
              <span className="font-medium">{item.customer_name}</span> placed <span className="font-medium">{item.number}</span> via {item.channel} ·{' '}
              <span className="tabular-nums">{money(item.total_cents)}</span> <span className="muted capitalize">({item.status})</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
