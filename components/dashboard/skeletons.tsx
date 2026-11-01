// Placeholders with the same footprint as the content they stand in for, so streaming in causes no layout shift.

const bar = 'animate-pulse rounded bg-slate-200 dark:bg-slate-800';

export function GreetingSkeleton() {
  return <div className={`${bar} h-8 w-64`} />;
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="panel p-3 sm:p-4">
          <div className={`${bar} h-4 w-20`} />
          <div className={`${bar} mt-2 h-7 w-28 sm:h-8`} />
          <div className={`${bar} mt-1 h-4 w-24`} />
          <div className={`${bar} mt-1 h-4 w-20`} />
        </div>
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="panel p-4 lg:col-span-3"><div className={`${bar} mb-2 h-5 w-64`} /><div className={`${bar} h-[260px]`} /></div>
      <div className="panel p-4"><div className={`${bar} mb-2 h-5 w-40`} /><div className={`${bar} h-[220px]`} /></div>
      <div className="panel p-4"><div className={`${bar} mb-2 h-5 w-48`} /><div className={`${bar} h-[248px]`} /></div>
      <div className="panel p-4"><div className={`${bar} mb-2 h-5 w-32`} /><div className={`${bar} h-24`} /></div>
    </div>
  );
}

export function RecentOrdersSkeleton() {
  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3"><div className={`${bar} h-5 w-32`} /></div>
      <div className="h-8 bg-slate-50 dark:bg-slate-800/50" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-[57px] items-center gap-4 border-t border-slate-100 px-4 dark:border-slate-800">
          <div className={`${bar} h-4 w-24`} /><div className={`${bar} h-4 w-28`} /><div className={`${bar} ms-auto h-4 w-16`} />
        </div>
      ))}
    </section>
  );
}

export function RecommendedSkeleton() {
  return (
    <section className="panel p-4">
      <div className={`${bar} mb-3 h-5 w-44`} />
      <ul className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}><div className={`${bar} aspect-square w-full`} /><div className={`${bar} mt-1 h-4 w-3/4`} /><div className={`${bar} mt-1 h-4 w-1/3`} /></li>
        ))}
      </ul>
    </section>
  );
}

export function ActivitySkeleton() {
  return <section className="panel h-96 p-4"><div className={`${bar} h-5 w-24`} /></section>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} h-4 w-64`} />
      <div className="panel h-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className={`${bar} aspect-square`} />)}
      </div>
    </div>
  );
}
