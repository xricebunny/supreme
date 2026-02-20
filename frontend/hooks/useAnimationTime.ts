"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Returns elapsed milliseconds since mount, updated every animation frame.
 * Used to drive smooth continuous animations that don't depend on discrete
 * 1-second price ticks.
 */
export function useAnimationTime(): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      setElapsedMs(Date.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return elapsedMs;
}
