import { Icon } from '@/components/icon';
import type { Campaign } from '@/lib/types';

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section className="panel p-4" data-testid="campaigns">
      <h2 className="panel-title mb-2">Campaigns</h2>
      <ul className="space-y-2 text-sm">
        {campaigns.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span><Icon name="bullhorn-outline" className="me-1 text-brand-500" />{c.name}</span>
            <span className="muted text-xs">{c.start.slice(5)} → {c.end.slice(5)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
