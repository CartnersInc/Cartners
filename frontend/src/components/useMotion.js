import { useLayoutEffect, useRef } from 'react';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easing = 'cubic-bezier(.16,1,.3,1)';

// State stays mounted; movement only explains a change the user just made.
export function useSurfaceMotion(value) {
  const ref = useRef(null);
  const previous = useRef(value);
  useLayoutEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    const node = ref.current;
    if (!node?.animate || reduceMotion()) return;
    const animation = node.animate([
      { opacity: .55, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 220, easing });
    return () => animation.cancel();
  }, [value]);
  return ref;
}

export function useListMotion(items) {
  const ref = useRef(null);
  const positions = useRef(new Map());
  const initialized = useRef(false);
  const signature = items.map(item => item.id).join('|');
  useLayoutEffect(() => {
    const list = ref.current;
    const next = new Map();
    if (!list) { positions.current = next; initialized.current = true; return; }
    const top = list.getBoundingClientRect().top;
    for (const row of list.querySelectorAll(':scope > [data-item-id]')) {
      const y = row.getBoundingClientRect().top - top;
      const before = positions.current.get(row.dataset.itemId);
      next.set(row.dataset.itemId, y);
      if (!initialized.current || !row.animate || reduceMotion()) continue;
      const delta = before === undefined ? 10 : before - y;
      if (!delta) continue;
      row.animate([
        { transform: `translateY(${delta}px)`, opacity: before === undefined ? .3 : 1 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 240, easing });
    }
    positions.current = next;
    initialized.current = true;
  }, [signature]);
  return ref;
}
