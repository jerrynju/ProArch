import { useEffect, useRef } from 'react';

/**
 * Reports live layout height of the attached element via ResizeObserver.
 * Used to size scroll-content padding against a floating overlay (e.g. the
 * bottom toolbar) whose height changes with its own expand/collapse state —
 * a fixed padding guess drifts out of sync and the overlay ends up hiding
 * the last card (spec: card content must never be obscured by chrome).
 */
export function useMeasuredHeight<T extends HTMLElement>(onChange: (height: number) => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onChange(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
