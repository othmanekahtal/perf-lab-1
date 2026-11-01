import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotificationPrefs } from '@/components/settings/notification-prefs';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6" data-testid="settings">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Suspense fallback={<div className="panel h-72 animate-pulse" />}>
        <Account />
      </Suspense>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Notifications</h2>
        <NotificationPrefs />
      </section>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<input className="input mt-1" defaultValue={user.name} readOnly data-testid="settings-name" /></label>
          <label className="text-sm font-medium">Email<input className="input mt-1" defaultValue={user.email} readOnly /></label>
          <label className="text-sm font-medium">Role<input className="input mt-1 capitalize" defaultValue={user.role} readOnly /></label>
          <label className="text-sm font-medium">Region<input className="input mt-1" defaultValue={user.region} readOnly /></label>
        </div>
        <div className="flex flex-wrap gap-2 text-xs" data-testid="settings-permissions">
          {Object.entries(user.permissions).map(([k, v]) => (
            <span key={k} className={`chip ${v ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-400 line-through'}`}>{k}</span>
          ))}
        </div>
      </section>
      <section className="panel space-y-3 p-4">
        <h2 className="panel-title">Appearance</h2>
        <ThemeToggle initial={user.theme} />
      </section>
    </>
  );
}
