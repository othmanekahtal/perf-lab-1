'use client';

import { useEffect, useState } from 'react';

// PERF-BUG #13: unbounded module-level history. Affects S9.
const samples: { at: number; visitors: number; pages: string[] }[] = [];

export function LiveVisitors() {
  const [visitors, setVisitors] = useState<number | null>(null);
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/live');
      const data = (await res.json()) as { visitors: number; pages: string[] };
      samples.push({ at: Date.now(), ...data });
      setVisitors(data.visitors);
    };
    poll();
    // PERF-BUG #13: interval and focus listener are never cleared; every dashboard visit adds another poller. Affects S9 (and S10).
    setInterval(poll, 2000);
    window.addEventListener('focus', poll);
  }, []);
  // PERF-BUG #5: renders nothing until the first client fetch resolves, then pushes the page down. Affects S4.
  if (visitors === null) return null;
  return (
    <div className="panel flex items-center gap-3 px-3 py-2" data-testid="live-visitors">
      <span className="live-dot inline-block rounded-full bg-emerald-500" style={{ width: 8, height: 8 }} />
      <span className="text-sm"><b className="tabular-nums">{visitors}</b> visitors right now</span>
      <div className="live-bar w-16 rounded bg-slate-100 dark:bg-slate-800"><span /></div>
    </div>
  );
}
