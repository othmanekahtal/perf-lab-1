'use client';

import { useEffect, useState } from 'react';

export function LiveVisitors() {
  const [visitors, setVisitors] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch('/api/live', { signal: controller.signal });
        const data = (await res.json()) as { visitors: number };
        setVisitors(data.visitors);
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 2000);
    window.addEventListener('focus', poll);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', poll);
    };
  }, []);
  return (
    <div className="panel flex items-center gap-3 px-3 py-2" data-testid="live-visitors">
      <span className="live-dot inline-block rounded-full bg-emerald-500" style={{ width: 8, height: 8 }} />
      <span className="text-sm"><b className="inline-block min-w-[3ch] tabular-nums">{visitors ?? '–'}</b> visitors right now</span>
      <div className="live-bar w-16 rounded bg-slate-100 dark:bg-slate-800"><span /></div>
    </div>
  );
}
