import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;

    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    prevTarget.current = target;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}
