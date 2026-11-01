'use client';

import { useEffect, useState, useTransition } from 'react';
import { setTheme } from '@/app/actions/settings';
import type { User } from '@/lib/types';

const NOTIFICATIONS = [
  { id: 'orders', label: 'New orders', hint: 'A summary every hour' },
  { id: 'stock', label: 'Low stock alerts', hint: 'When a product drops below its reorder level' },
  { id: 'reviews', label: 'New reviews', hint: 'Daily digest of 1–2 star reviews' },
];

// PERF-BUG #5: a whole page made a client component that fetches its data in useEffect (client waterfall) although it could render on the server. Affects S1, S12.
export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ orders: true, stock: true, reviews: false });
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.title = 'Settings · Shoply Admin';
    fetch('/api/me').then((r) => r.json()).then(setUser);
  }, []);

  if (!user) return <p className="muted text-sm">Loading settings…</p>;

  return (
    <div className="max-w-2xl space-y-6" data-testid="settings">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<input className="input mt-1" value={user.name} readOnly data-testid="settings-name" /></label>
          <label className="text-sm font-medium">Email<input className="input mt-1" value={user.email} readOnly /></label>
          <label className="text-sm font-medium">Role<input className="input mt-1 capitalize" value={user.role} readOnly /></label>
          <label className="text-sm font-medium">Region<input className="input mt-1" value={user.region} readOnly /></label>
        </div>
        <div className="flex flex-wrap gap-2 text-xs" data-testid="settings-permissions">
          {Object.entries(user.permissions).map(([k, v]) => (
            <span key={k} className={`chip ${v ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-400 line-through'}`}>{k}</span>
          ))}
        </div>
      </section>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Appearance</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Theme">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={user.theme === t}
              disabled={pending}
              onClick={() => startTransition(async () => { await setTheme(t); setUser({ ...user, theme: t }); })}
              className={`btn-ghost capitalize ${user.theme === t ? 'border-brand-500 text-brand-700' : ''}`}
              data-testid={`theme-${t}`}
            >
              <i className={`mdi ${t === 'light' ? 'mdi-white-balance-sunny' : 'mdi-weather-night'}`} /> {t}
            </button>
          ))}
        </div>
      </section>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Notifications</h2>
        {NOTIFICATIONS.map((n) => (
          <label key={n.id} className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={prefs[n.id]} onChange={(e) => { setPrefs({ ...prefs, [n.id]: e.target.checked }); setSaved(false); }} />
            <span><span className="font-medium">{n.label}</span><br /><span className="muted">{n.hint}</span></span>
          </label>
        ))}
        <button className="btn-primary-sh" onClick={() => setSaved(true)} data-testid="settings-save">Save preferences</button>
        {saved && <p className="text-sm text-emerald-600" role="status">Preferences saved</p>}
      </section>
    </div>
  );
}
