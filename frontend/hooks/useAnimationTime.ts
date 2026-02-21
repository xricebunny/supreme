"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { flushSync } from "react-dom";

const SLOT_MS = 5000; // 5 seconds per time slot

/**
 * Drives smooth horizontal scrolling via requestAnimationFrame.
 * Sets translateX directly on DOM refs for 60fps panning.
 * Only triggers React re-renders when timeSlot changes (every 5s).
 */
export function useAnimationTime(cellWidth: number): {
  timeSlot: number;
  baseTimeMs: number;
  slotProgress: number;
  gridRef: RefObject<HTMLDivElement>;
  xAxisRef: RefObject<HTMLDivElement>;
} {
  const [timeSlot, setTimeSlot] = useState(0);
  const [slotProgress, setSlotProgress] = useState(0);
  // Wall-clock time floored to the nearest 5-second boundary at mount
  const baseTimeMsRef = useRef(Math.floor(Date.now() / SLOT_MS) * SLOT_MS);
  const gridRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<HTMLDivElement>(null);
  const cellWidthRef = useRef(cellWidth);
  cellWidthRef.current = cellWidth;

  useEffect(() => {
    let raf: number;
    let prevSlot = 0;

    const animate = () => {
      // Use wall-clock time so rAF panning and label boundaries stay in sync
      const elapsed = Date.now() - baseTimeMsRef.current;
      const slot = Math.floor(elapsed / SLOT_MS);
      const progress = (elapsed % SLOT_MS) / SLOT_MS;
      const panX = progress * cellWidthRef.current;

      // Direct DOM updates — no React re-render
      if (gridRef.current) {
        gridRef.current.style.transform = `translateX(${-panX}px)`;
      }
      if (xAxisRef.current) {
        xAxisRef.current.style.transform = `translateX(${-panX}px)`;
      }

      // React state update only on slot boundary (every 5s).
      // flushSync forces synchronous re-render so new labels paint
      // on the same frame as the transform reset — no flicker.
      if (slot !== prevSlot) {
        prevSlot = slot;
        flushSync(() => {
          setTimeSlot(slot);
        });
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Throttled progress updates (every 200ms) so cell payouts decay smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - baseTimeMsRef.current;
      setSlotProgress((elapsed % SLOT_MS) / SLOT_MS);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return { timeSlot, baseTimeMs: baseTimeMsRef.current, slotProgress, gridRef, xAxisRef };
}
