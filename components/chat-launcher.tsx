'use client';

import { useState } from 'react';

const VENDOR_ORIGIN = process.env.NEXT_PUBLIC_VENDOR_ORIGIN ?? 'http://localhost:4002';

/** Facade for the HelloDesk widget: its script (and its start-up work) loads only when someone wants to chat. */
export function ChatLauncher() {
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  if (state === 'ready') return null;
  const open = () => {
    setState('loading');
    const script = document.createElement('script');
    script.src = `${VENDOR_ORIGIN}/chat-widget.js`;
    script.async = true;
    script.onload = () => setState('ready');
    document.body.appendChild(script);
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={state === 'loading'}
      className="fixed right-4 bottom-4 z-50 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:bg-emerald-400"
      data-testid="chat-launcher"
    >
      {state === 'loading' ? 'Connecting…' : 'Chat with us'}
    </button>
  );
}
