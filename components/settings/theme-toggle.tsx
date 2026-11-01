'use client';

import { useState, useTransition } from 'react';
import { setTheme } from '@/app/actions/settings';
import { Icon } from '@/components/icon';

export function ThemeToggle({ initial }: { initial: 'light' | 'dark' }) {
  const [theme, setLocal] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Theme">
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          disabled={pending}
          onClick={() => startTransition(async () => {
            await setTheme(t);
            document.documentElement.dataset.theme = t;
            setLocal(t);
          })}
          className={`btn-ghost capitalize ${theme === t ? 'border-brand-500 text-brand-700' : ''}`}
          data-testid={`theme-${t}`}
        >
          <Icon name={t === 'light' ? 'white-balance-sunny' : 'weather-night'} /> {t}
        </button>
      ))}
    </div>
  );
}
