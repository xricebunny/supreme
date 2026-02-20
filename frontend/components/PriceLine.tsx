"use client";

import { useMemo } from "react";
import { PricePoint } from "@/types";

interface PriceLineProps {
  priceHistory: PricePoint[];
  /** The price at the center of the grid (current price) */
  centerPrice: number;
  /** Height of each cell in pixels */
  cellHeight: number;
  /** Width of each cell in pixels */
  cellWidth: number;
  /** Total grid height in pixels */
  gridHeight: number;
  /** The column index that represents "current time" */
  currentTimeCol: number;
  /** Number of visible rows */
  visibleRows: number;
  /** Price increment per row */
  priceStep: number;
}

export default function PriceLine({
  priceHistory,
  centerPrice,
  cellHeight,
  cellWidth,
  gridHeight,
  currentTimeCol,
  visibleRows,
  priceStep,
}: PriceLineProps) {
  const pathData = useMemo(() => {
    if (priceHistory.length < 2) return "";

    // Map each price point to an x,y coordinate
    // X: each price point is 1 second apart, each column is 5 seconds
    // So price points are spaced cellWidth/5 apart
    const pixelsPerSecond = cellWidth / 5;
    const centerY = gridHeight / 2;

    const points = priceHistory.map((point, i) => {
      // X position: spread across past columns, ending at current time column
      const secondsFromEnd = priceHistory.length - 1 - i;
      const x =
        (currentTimeCol + 0.5) * cellWidth - secondsFromEnd * pixelsPerSecond;

      // Y position: offset from center based on price difference
      const priceDiff = point.price - centerPrice;
      const rowOffset = priceDiff / priceStep;
      const y = centerY - rowOffset * cellHeight;

      return { x, y };
    });

    // Build SVG path
    if (points.length === 0) return "";

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Use smooth curves for a nicer line
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return d;
  }, [
    priceHistory,
    centerPrice,
    cellHeight,
    cellWidth,
    gridHeight,
    currentTimeCol,
    priceStep,
  ]);

  if (!pathData) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="priceLineGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#00ff88" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Glow layer */}
      <path
        d={pathData}
        fill="none"
        stroke="rgba(0, 255, 136, 0.3)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#priceLineGlow)"
      />

      {/* Main line */}
      <path
        d={pathData}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current price dot */}
      {priceHistory.length > 0 && (
        <>
          <circle
            cx={(currentTimeCol + 0.5) * cellWidth}
            cy={gridHeight / 2}
            r="5"
            fill="#00ff88"
            filter="url(#priceLineGlow)"
          />
          <circle
            cx={(currentTimeCol + 0.5) * cellWidth}
            cy={gridHeight / 2}
            r="3"
            fill="#ffffff"
          />
        </>
      )}
    </svg>
  );
}
