'use client';

import { useEffect, useRef } from 'react';
import { money } from '@/lib/format';
import type { Order } from '@/lib/types';

type Item = Pick<Order, 'id' | 'number' | 'customer_name' | 'status' | 'total_cents' | 'channel' | 'created_at'>;

export function ActivityFeed({ items }: { items: Item[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // PERF-BUG #12: interleaves layout reads (getBoundingClientRect) and writes (style.paddingLeft) per row: one forced reflow per row per scroll event. Affects S6.
    const onScroll = () => {
      const list = listRef.current;
      if (!list) return;
      const rows = list.querySelectorAll<HTMLElement>('li');
      let seen = 0;
      rows.forEach((row) => {
        const rect = row.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        row.style.paddingLeft = inView ? '14px' : '10px';
        if (rect.top < window.innerHeight) seen++;
      });
      if (progressRef.current) progressRef.current.style.width = `${(seen / rows.length) * 100}%`;
    };
    // PERF-BUG #12: non-passive scroll/wheel/touch listeners. Affects S6.
    window.addEventListener('scroll', onScroll, { passive: false });
    window.addEventListener('wheel', onScroll, { passive: false });
    window.addEventListener('touchmove', onScroll, { passive: false });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
    };
  }, []);

  let lastDay = '';
  return (
    <section className="panel p-4" data-testid="activity">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">Activity</h2>
        <span className="muted text-xs">{items.length.toLocaleString('en-IE')} events</span>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
        <div ref={progressRef} className="h-1 bg-brand-500" style={{ width: 0 }} />
      </div>
      {/* PERF-BUG #12: 1,500 off-screen rows laid out and painted, no content-visibility. Affects S6. */}
      <ol ref={listRef} className="space-y-1 text-sm">
        {items.map((item) => {
          const day = item.created_at.slice(0, 10);
          const header = day !== lastDay;
          lastDay = day;
          return (
            <li key={item.id} className="rounded-md border-l-2 border-brand-100 py-1" style={{ paddingLeft: 10 }}>
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
