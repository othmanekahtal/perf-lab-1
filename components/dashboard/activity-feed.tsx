import { money } from '@/lib/format';
import type { Order } from '@/lib/types';
import { ActivityProgress } from './activity-progress';

type Item = Pick<Order, 'id' | 'number' | 'customer_name' | 'status' | 'total_cents' | 'channel' | 'created_at'>;

export function ActivityFeed({ items }: { items: Item[] }) {
  let lastDay = '';
  return (
    <section className="panel p-4" data-testid="activity">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">Activity</h2>
        <span className="muted text-xs">Latest {items.length} events</span>
      </div>
      <ActivityProgress listId="activity-list" />
      <ol id="activity-list" className="space-y-1 text-sm">
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
