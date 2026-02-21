"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { flushSync } from "react-dom";

const SLOT_MS = 5000; // 5 seconds per time slot
const PRICE_STEP = 0.00005;
const GRID_ROWS = 10;
const CLIP_FRACTION = 0.33;
const LERP_SPEED = 0.1; // exponential approach factor per frame (~60fps)

/**
 * Drives smooth horizontal AND vertical scrolling via requestAnimationFrame.
 *
 * Horizontal: translateX on gridRef / xAxisRef (wall-clock driven).
 * Vertical:   lerp-interpolated price → translateY on verticalRef / yAxisRef /
 *             priceHighlightRef.  Row labels update only when the animated
 *             price crosses a PRICE_STEP boundary (via displayPrice state).
 */
export function useAnimationTime(
  cellWidth: number,
  cellHeight: number,
  targetPrice: number
): {
  timeSlot: number;
  baseTimeMs: number;
  displayPrice: number;
  gridRef: RefObject<HTMLDivElement>;
  xAxisRef: RefObject<HTMLDivElement>;
  verticalRef: RefObject<HTMLDivElement>;
  yAxisRef: RefObject<HTMLDivElement>;
  priceHighlightRef: RefObject<HTMLDivElement>;
} {
  const [timeSlot, setTimeSlot] = useState(0);
  const [displayPrice, setDisplayPrice] = useState(targetPrice);

  const baseTimeMsRef = useRef(Math.floor(Date.now() / SLOT_MS) * SLOT_MS);
  const gridRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<HTMLDivElement>(null);
  const verticalRef = useRef<HTMLDivElement>(null);
  const yAxisRef = useRef<HTMLDivElement>(null);
  const priceHighlightRef = useRef<HTMLDivElement>(null);

  // Mutable refs to avoid re-creating the rAF loop on prop changes
  const cellWidthRef = useRef(cellWidth);
  const cellHeightRef = useRef(cellHeight);
  const targetPriceRef = useRef(targetPrice);
  const animatedPriceRef = useRef(targetPrice);
  const prevAnimatedRowRef = useRef(Math.floor(targetPrice / PRICE_STEP));

  cellWidthRef.current = cellWidth;
  cellHeightRef.current = cellHeight;
  targetPriceRef.current = targetPrice;

  useEffect(() => {
    let raf: number;
    let prevSlot = 0;

    const animate = () => {
      // ── Horizontal panning (wall-clock driven) ──
      const elapsed = Date.now() - baseTimeMsRef.current;
      const slot = Math.floor(elapsed / SLOT_MS);
      const progress = (elapsed % SLOT_MS) / SLOT_MS;
      const panX = progress * cellWidthRef.current;

      if (gridRef.current) {
        gridRef.current.style.transform = `translateX(${-panX}px)`;
      }
      if (xAxisRef.current) {
        xAxisRef.current.style.transform = `translateX(${-panX}px)`;
      }

      if (slot !== prevSlot) {
        prevSlot = slot;
        flushSync(() => setTimeSlot(slot));
      }

      // ── Vertical panning (lerp toward target price) ──
      const target = targetPriceRef.current;
      const animated = animatedPriceRef.current;
      const diff = target - animated;

      if (Math.abs(diff) > 1e-8) {
        animatedPriceRef.current = animated + diff * LERP_SPEED;
      } else {
        animatedPriceRef.current = target;
      }

      const cH = cellHeightRef.current;
      const priceInRowUnits = animatedPriceRef.current / PRICE_STEP;
      // Ensure positive fractional part even for negative priceInRowUnits
      const fractionalRow = ((priceInRowUnits % 1) + 1) % 1;
      const panY = fractionalRow * cH;
      const clipTop = cH * CLIP_FRACTION;
      const centerRow = Math.floor(GRID_ROWS / 2);
      const translateY = -clipTop + panY;

      if (verticalRef.current) {
        verticalRef.current.style.transform = `translateY(${translateY}px)`;
      }
      if (yAxisRef.current) {
        yAxisRef.current.style.transform = `translateY(${translateY}px)`;
      }
      if (priceHighlightRef.current) {
        priceHighlightRef.current.style.top = `${centerRow * cH - clipTop + panY}px`;
      }

      // Row labels update only when the animated price crosses a row boundary.
      // Both this state change and the panY wrap happen in the same frame,
      // so the label shift and the panY wrap cancel out — no visible jump.
      const currentRow = Math.floor(priceInRowUnits);
      if (currentRow !== prevAnimatedRowRef.current) {
        prevAnimatedRowRef.current = currentRow;
        flushSync(() => setDisplayPrice(animatedPriceRef.current));
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    timeSlot,
    baseTimeMs: baseTimeMsRef.current,
    displayPrice,
    gridRef,
    xAxisRef,
    verticalRef,
    yAxisRef,
    priceHighlightRef,
  };
}
