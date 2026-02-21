"use client";

import { useMemo } from "react";
import { PricePoint } from "@/types";
import { SAMPLE_INTERVAL_MS } from "@/hooks/useBinancePrice";

interface PriceLineProps {
  priceHistory: PricePoint[];
  centerPrice: number;
  cellHeight: number;
  cellWidth: number;
  currentTimeCol: number;
  priceStep: number;
  /** The Y pixel position of the current price in the full grid coordinate system */
  centerPriceY: number;
  /** Progress within the current 5-second slot (0–1), used to offset X so the
   *  line doesn't jump when the slot boundary resets translateX */
  slotProgress: number;
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
  slotProgress,
}: PriceLineProps) {
  const { pathData, lastPoint, firstX, lastX } = useMemo(() => {
    if (priceHistory.length < 2)
      return { pathData: "", lastPoint: null, firstX: 0, lastX: 0 };

    const pixelsPerSecond = cellWidth / 5;
    const secondsPerTick = SAMPLE_INTERVAL_MS / 1000;
    const centerY = centerPriceY;
    const slotOffsetX = slotProgress * cellWidth;

    const points = priceHistory.map((point, i) => {
      const ticksFromEnd = priceHistory.length - 1 - i;
      const secondsFromEnd = ticksFromEnd * secondsPerTick;
      const x =
        (currentTimeCol + 0.5) * cellWidth + slotOffsetX - secondsFromEnd * pixelsPerSecond;
      const priceDiff = point.price - centerPrice;
      const rowOffset = priceDiff / priceStep;
      const y = centerY - rowOffset * cellHeight;
      return { x, y };
    });

    const d = catmullRomPath(points);
    const last = points[points.length - 1];
    const first = points[0];

    return { pathData: d, lastPoint: last, firstX: first.x, lastX: last.x };
  }, [
    priceHistory,
    centerPrice,
    cellHeight,
    cellWidth,
    centerPriceY,
    currentTimeCol,
    priceStep,
    slotProgress,
  ]);

  if (!pathData || !lastPoint) return null;

  const lineColor = "#00ff88";
  const gradientId = "priceLineBeamGrad";
  const glowGradientId = "priceLineGlowGrad";
  const beamGradientId = "priceLineBeamWhite";

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Glow blur filter */}
        <filter id="priceLineGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Intense beam glow at the tip */}
        <filter id="beamTipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Dot glow filter */}
        <filter id="priceDotGlow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Main line gradient: dim green → full green → white at tip */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={firstX} y1="0" x2={lastX} y2="0">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.1" />
          <stop offset="40%" stopColor={lineColor} stopOpacity="0.5" />
          <stop offset="75%" stopColor={lineColor} stopOpacity="0.9" />
          <stop offset="92%" stopColor="#80ffbb" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>

        {/* Glow gradient: same shape but for the blur layer */}
        <linearGradient id={glowGradientId} gradientUnits="userSpaceOnUse" x1={firstX} y1="0" x2={lastX} y2="0">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.05" />
          <stop offset="50%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="80%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="95%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
        </linearGradient>

        {/* Beam overlay gradient: transparent → white at the very tip */}
        <linearGradient id={beamGradientId} gradientUnits="userSpaceOnUse" x1={firstX} y1="0" x2={lastX} y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="85%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="95%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Layer 1: Wide soft glow */}
      <path
        d={pathData}
        fill="none"
        stroke={`url(#${glowGradientId})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#priceLineGlow)"
      />

      {/* Layer 2: Main line — continuous, green → white */}
      <path
        d={pathData}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Layer 3: White beam overlay at the tip */}
      <path
        d={pathData}
        fill="none"
        stroke={`url(#${beamGradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#beamTipGlow)"
      />

      {/* Pulse ring */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="8"
        fill="none"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth="2"
        className="price-dot-pulse"
      />

      {/* Tip glow halo — soft white light around the dot */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="10"
        fill="rgba(255, 255, 255, 0.12)"
        filter="url(#priceDotGlow)"
      />

      {/* Tip dot — bright white core */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="3"
        fill="#ffffff"
        filter="url(#priceDotGlow)"
      />

      {/* Tip dot — crisp center */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2"
        fill="#ffffff"
      />
    </svg>
  );
}
