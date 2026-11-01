'use client';

import { useEffect } from 'react';

/** Keeps cards in the same row at the same height. */
export function useEqualHeights(selector: string) {
  useEffect(() => {
    const equalize = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(selector));
      for (const card of cards) {
        card.style.minHeight = '';
        const rowMates = cards.filter((c) => c.offsetTop === card.offsetTop);
        const tallest = Math.max(...rowMates.map((c) => c.offsetHeight));
        card.style.minHeight = `${tallest}px`;
      }
    };
    equalize();
    window.addEventListener('resize', equalize);
    window.addEventListener('scroll', equalize);
  }, [selector]);
}
