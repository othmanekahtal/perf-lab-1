import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LiveVisitors } from '@/components/dashboard/live-visitors';
import { ActivitySection, ChartsSection, Greeting, KpiSection, RecentOrdersSection, RecommendedSection } from '@/components/dashboard/sections';
import { ActivitySkeleton, ChartsSkeleton, GreetingSkeleton, KpiSkeleton, RecentOrdersSkeleton, RecommendedSkeleton } from '@/components/dashboard/skeletons';

export const metadata: Metadata = { title: 'Dashboard' };

// Each section loads its own data and streams in independently; skeletons keep the layout stable.
export default function DashboardPage() {
  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Suspense fallback={<GreetingSkeleton />}>
            <Greeting />
          </Suspense>
          <p className="muted text-sm">Here is what happened in your store over the last 30 days.</p>
        </div>
        <LiveVisitors />
      </div>
      <Suspense fallback={<KpiSkeleton />}>
        <KpiSection />
      </Suspense>
      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Suspense fallback={<RecentOrdersSkeleton />}>
            <RecentOrdersSection />
          </Suspense>
        </div>
        <Suspense fallback={<RecommendedSkeleton />}>
          <RecommendedSection />
        </Suspense>
      </div>
      <Suspense fallback={<ActivitySkeleton />}>
        <ActivitySection />
      </Suspense>
    </div>
  );
}
