'use client';

import { useEffect, useRef } from 'react';

/** Reading progress for the activity list, driven by IntersectionObserver (no layout reads on scroll). */
export function ActivityProgress({ listId }: { listId: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = document.getElementById(listId);
    if (!list) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const index = new Map(rows.map((row, i) => [row, i]));
    let furthest = 0;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        entry.target.toggleAttribute('data-in-view', entry.isIntersecting);
        if (entry.isIntersecting) furthest = Math.max(furthest, (index.get(entry.target as HTMLElement) ?? 0) + 1);
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${furthest / rows.length})`;
    });
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [listId]);
  return (
    <div className="mb-3 h-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
      <div ref={barRef} className="h-1 origin-left scale-x-0 bg-brand-500 transition-transform" />
    </div>
  );
}
