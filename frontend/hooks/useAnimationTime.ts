"use client";

import { useState, useEffect, useRef, RefObject } from "react";

const CELL_WIDTH = 72;
const SLOT_MS = 5000; // 5 seconds per time slot

/**
 * Drives smooth horizontal scrolling via requestAnimationFrame.
 * Sets translateX directly on DOM refs for 60fps panning.
 * Only triggers React re-renders when timeSlot changes (every 5s).
 */
export function useAnimationTime(): {
  timeSlot: number;
  gridRef: RefObject<HTMLDivElement>;
  xAxisRef: RefObject<HTMLDivElement>;
} {
  const [timeSlot, setTimeSlot] = useState(0);
  const startRef = useRef(performance.now());
  const gridRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let prevSlot = 0;

    const animate = () => {
      const elapsed = performance.now() - startRef.current;
      const slot = Math.floor(elapsed / SLOT_MS);
      const progress = (elapsed % SLOT_MS) / SLOT_MS;
      const panX = progress * CELL_WIDTH;

      // Direct DOM updates — no React re-render
      if (gridRef.current) {
        gridRef.current.style.transform = `translateX(${-panX}px)`;
      }
      if (xAxisRef.current) {
        xAxisRef.current.style.transform = `translateX(${-panX}px)`;
      }

      // React state update only on slot boundary (every 5s)
      if (slot !== prevSlot) {
        prevSlot = slot;
        setTimeSlot(slot);
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { timeSlot, gridRef, xAxisRef };
}
