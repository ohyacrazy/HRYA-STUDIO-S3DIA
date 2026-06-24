import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1200, startFrom = 0): number {
  const [value, setValue] = useState(startFrom);
  const rafRef = useRef<number>();
  const startRef = useRef<number | null>(null);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (target === prevTarget.current && value === target) return;
    prevTarget.current = target;
    const from = startFrom;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(from + (target - from) * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, startFrom]);

  return value;
}
