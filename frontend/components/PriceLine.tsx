"use client";

import { useMemo } from "react";
import { PricePoint } from "@/types";

interface PriceLineProps {
  priceHistory: PricePoint[];
  centerPrice: number;
  cellHeight: number;
  cellWidth: number;
  currentTimeCol: number;
  priceStep: number;
  /** The Y pixel position of the current price in the full grid coordinate system */
  centerPriceY: number;
}

/**
 * Attempt a Catmull-Rom spline through data points for smooth organic curves.
 * Falls back to cubic Bézier if < 3 points.
 */
function catmullRomPath(points: { x: number; y: number }[], alpha = 0.5): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to cubic Bézier conversion
    const d1x = p2.x - p0.x;
    const d1y = p2.y - p0.y;
    const d2x = p3.x - p1.x;
    const d2y = p3.y - p1.y;

    const cp1x = p1.x + d1x / (6 * alpha);
    const cp1y = p1.y + d1y / (6 * alpha);
    const cp2x = p2.x - d2x / (6 * alpha);
    const cp2y = p2.y - d2y / (6 * alpha);

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export default function PriceLine({
  priceHistory,
  centerPrice,
  cellHeight,
  cellWidth,
  currentTimeCol,
  priceStep,
  centerPriceY,
}: PriceLineProps) {
  const { pathData, lastPoint, dashBreakX } = useMemo(() => {
    if (priceHistory.length < 2)
      return { pathData: "", lastPoint: null, dashBreakX: 0 };

    const pixelsPerSecond = cellWidth / 5;
    const secondsPerTick = 0.2; // each data point is 200ms apart
    const centerY = centerPriceY;

    const points = priceHistory.map((point, i) => {
      const ticksFromEnd = priceHistory.length - 1 - i;
      const secondsFromEnd = ticksFromEnd * secondsPerTick;
      const x =
        (currentTimeCol + 0.5) * cellWidth - secondsFromEnd * pixelsPerSecond;
      const priceDiff = point.price - centerPrice;
      const rowOffset = priceDiff / priceStep;
      const y = centerY - rowOffset * cellHeight;
      return { x, y };
    });

    // The last ~10 seconds are "recent" (solid), everything before is dashed
    const recentTicks = 50; // 10 seconds × 5 ticks/sec
    const breakIndex = Math.max(0, points.length - recentTicks);
    const breakX = points[breakIndex]?.x ?? points[0].x;

    const d = catmullRomPath(points);
    const last = points[points.length - 1];

    return { pathData: d, lastPoint: last, dashBreakX: breakX };
  }, [
    priceHistory,
    centerPrice,
    cellHeight,
    cellWidth,
    centerPriceY,
    currentTimeCol,
    priceStep,
  ]);

  if (!pathData || !lastPoint) return null;

  const lineColor = "#00ff88";
  const glowColor = "rgba(0, 255, 136, 0.25)";

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
        <filter id="priceDotGlow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient: transparent at far left → opaque at current price */}
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="50%" stopColor={lineColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.85" />
        </linearGradient>

        {/* Clip rect for the dashed (historical) portion */}
        <clipPath id="dashClip">
          <rect x="-9999" y="-9999" width={dashBreakX + 9999} height="99999" />
        </clipPath>
        {/* Clip rect for the solid (recent) portion */}
        <clipPath id="solidClip">
          <rect x={dashBreakX} y="-9999" width="99999" height="99999" />
        </clipPath>
      </defs>

      {/* Glow layer */}
      <path
        d={pathData}
        fill="none"
        stroke={glowColor}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#priceLineGlow)"
      />

      {/* Historical portion — dashed */}
      <path
        d={pathData}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
        clipPath="url(#dashClip)"
      />

      {/* Recent portion — solid */}
      <path
        d={pathData}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#solidClip)"
      />

      {/* Live price dot — outer pulse ring */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="8"
        fill="none"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="2"
        className="price-dot-pulse"
      />

      {/* Live price dot — glow */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="6"
        fill="rgba(255, 255, 255, 0.3)"
        filter="url(#priceDotGlow)"
      />

      {/* Live price dot — bright core */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="4"
        fill="#ffffff"
      />
    </svg>
  );
}
