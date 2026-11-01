'use client';

import { useState } from 'react';

const NOTIFICATIONS = [
  { id: 'orders', label: 'New orders', hint: 'A summary every hour' },
  { id: 'stock', label: 'Low stock alerts', hint: 'When a product drops below its reorder level' },
  { id: 'reviews', label: 'New reviews', hint: 'Daily digest of 1–2 star reviews' },
];

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ orders: true, stock: true, reviews: false });
  const [saved, setSaved] = useState(false);
  return (
    <>
      {NOTIFICATIONS.map((n) => (
        <label key={n.id} className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={prefs[n.id]} onChange={(e) => { setPrefs({ ...prefs, [n.id]: e.target.checked }); setSaved(false); }} />
          <span><span className="font-medium">{n.label}</span><br /><span className="muted">{n.hint}</span></span>
        </label>
      ))}
      <button className="btn-primary-sh" onClick={() => setSaved(true)} data-testid="settings-save">Save preferences</button>
      {saved && <p className="text-sm text-emerald-600" role="status">Preferences saved</p>}
    </>
  );
}
