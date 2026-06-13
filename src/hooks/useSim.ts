import { useEffect, useRef, useState } from 'react';
import { sim } from '../state/sim';

/**
 * Re-render at a throttled cadence tied to the sim's tick stream. The engine
 * runs at 60fps but most numeric UI only needs a few updates per second.
 */
export function useSimTick(minIntervalMs = 120): number {
  const [, force] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    return sim.subscribe(() => {
      const now = performance.now();
      if (now - last.current >= minIntervalMs) {
        last.current = now;
        force((n) => n + 1);
      }
    });
  }, [minIntervalMs]);
  return last.current;
}

export function useValuation(minIntervalMs = 200) {
  useSimTick(minIntervalMs);
  return sim.getValuation();
}
