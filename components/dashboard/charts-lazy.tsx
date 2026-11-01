'use client';

import dynamic from 'next/dynamic';
import type { ChartsProps } from './charts';

const bar = 'animate-pulse rounded bg-slate-100 dark:bg-slate-800';

/** Same footprint as the loaded charts. */
export function ChartPanelsPlaceholder() {
  return (
    <>
      <div className="panel p-4 lg:col-span-3"><div className="panel-title mb-2">Revenue · last 30 days and 30-day forecast</div><div className={`${bar} h-[260px]`} /></div>
      <div className="panel p-4"><div className="panel-title mb-2">Items by order status</div><div className={`${bar} h-[220px]`} /></div>
      <div className="panel p-4"><div className="panel-title mb-2">Revenue by channel · 30 days</div><div className={`${bar} h-[220px]`} /><div className="mt-2 h-5" /></div>
    </>
  );
}

// The chart library is only needed once the page is interactive.
export const LazyCharts = dynamic<ChartsProps>(() => import('./charts'), { ssr: false, loading: () => <ChartPanelsPlaceholder /> });
