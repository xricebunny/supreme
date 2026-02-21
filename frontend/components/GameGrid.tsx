"use client";

import { useMemo, RefObject } from "react";
import { formatPayout, formatTime } from "@/lib/formatters";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";

const GRID_ROWS = 10;
const GRID_COLS = 21;
const RENDER_COLS = GRID_COLS + 2; // extra columns to fill the gap during panning
const PRICE_STEP = 0.00005;
const CURRENT_TIME_COL = 5;
const CLIP_FRACTION = 0.33;

interface GameGridProps {
  currentPrice: number;
  betSize: number;
  timeSlot: number;
  baseTimeMs: number;
  slotProgress: number;
  gridRef: RefObject<HTMLDivElement>;
  xAxisRef: RefObject<HTMLDivElement>;
  cellWidth: number;
  cellHeight: number;
}

export default function GameGrid({
  currentPrice,
  betSize,
  timeSlot,
  baseTimeMs,
  slotProgress,
  gridRef,
  xAxisRef,
  cellWidth,
  cellHeight,
}: GameGridProps) {
  const gridWidth = RENDER_COLS * cellWidth;
  const gridHeight = GRID_ROWS * cellHeight;
  const clipTop = cellHeight * CLIP_FRACTION;

  // Vertical pan: smooth as price moves between row boundaries
  const priceInRowUnits = currentPrice / PRICE_STEP;
  const fractionalRow = priceInRowUnits % 1;
  const panY = fractionalRow * cellHeight;

  const centerRow = Math.floor(GRID_ROWS / 2);

  // Snap to PRICE_STEP floor for fixed-interval y-axis border labels
  const snappedBorderPrice = Math.floor(currentPrice / PRICE_STEP) * PRICE_STEP;

  // Border prices at each row boundary (+1 extra above and below for smooth scrolling)
  const borderPrices = useMemo(() => {
    const prices: number[] = [];
    for (let r = -1; r <= GRID_ROWS; r++) {
      const rowOffset = centerRow - r;
      prices.push(snappedBorderPrice + (rowOffset + 1) * PRICE_STEP);
    }
    return prices;
  }, [snappedBorderPrice, centerRow]);

  // Time labels — pinned to absolute 5-second wall-clock boundaries
  const timeLabels = useMemo(() => {
    const labels: (string | null)[] = [];
    const slotBaseMs = baseTimeMs + timeSlot * 5000;
    for (let c = 0; c < RENDER_COLS; c++) {
      const colTimeMs = slotBaseMs + (c - CURRENT_TIME_COL) * 5000;
      if ((timeSlot + c) % 2 === 0) {
        labels.push(formatTime(new Date(colTimeMs)));
      } else {
        labels.push(null);
      }
    }
    return labels;
  }, [timeSlot, baseTimeMs]);

  // Cell data
  const cells = useMemo(() => {
    const result: {
      row: number;
      col: number;
      isPast: boolean;
      isCurrentTime: boolean;
      isCurrentPrice: boolean;
      rowDist: number;
      colDist: number;
      effectiveColDist: number;
      multiplier: number;
      payout: number;
    }[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < RENDER_COLS; c++) {
        const isPast = c < CURRENT_TIME_COL;
        const isCurrentTime = c === CURRENT_TIME_COL;
        const isCurrentPrice = r === centerRow;
        const rowDist = Math.abs(r - centerRow);
        const colDist = c - CURRENT_TIME_COL;
        // Fractional colDist: decreases as slotProgress approaches 1,
        // so payouts decay smoothly as each time slot nears expiry
        const effectiveColDist = colDist - slotProgress;

        let multiplier = 1;
        let payout = 0;
        if (effectiveColDist > 0) {
          multiplier = getMultiplier(rowDist, effectiveColDist);
          payout = getCellPayout(betSize, rowDist, effectiveColDist);
        }

        result.push({
          row: r,
          col: c,
          isPast,
          isCurrentTime,
          isCurrentPrice,
          rowDist,
          colDist,
          effectiveColDist,
          multiplier,
          payout,
        });
      }
    }
    return result;
  }, [betSize, centerRow, slotProgress]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="relative w-full h-full"
        style={{ overflow: "hidden" }}
      >
        {/* ── Horizontal panning layer (rAF-driven via ref, NO transition) ── */}
        <div
          ref={gridRef}
          className="relative"
          style={{
            width: gridWidth,
            height: gridHeight,
            willChange: "transform",
          }}
        >
          {/* Vertical panning sublayer (React-driven, smooth transition) */}
          <div
            className="relative"
            style={{
              width: gridWidth,
              height: gridHeight,
              transform: `translateY(${-clipTop + panY}px)`,
              transition: "transform 0.3s ease-out",
            }}
          >
            {/* Grid background lines */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #1e3329 1px, transparent 1px),
                  linear-gradient(to bottom, #1e3329 1px, transparent 1px)
                `,
                backgroundSize: `${cellWidth}px ${cellHeight}px`,
              }}
            />

            {/* Grid cells */}
            <div
              className="absolute inset-0"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${RENDER_COLS}, ${cellWidth}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${cellHeight}px)`,
              }}
            >
              {cells.map((cell) => {
                const isFuture = cell.colDist > 0;
                return (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    className="grid-cell"
                    style={{
                      opacity: cell.isPast ? 0.3 : cell.isCurrentTime ? 0.5 : 1,
                    }}
                  >
                    {isFuture && cell.effectiveColDist > 0 && (
                      <span className="cell-payout">
                        {formatPayout(cell.payout)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Fixed overlays (outside panning container, don't scroll) ── */}

        {/* Past overlay — dims columns left of "now" */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: 0,
            width: (CURRENT_TIME_COL + 1) * cellWidth,
            background:
              "linear-gradient(to right, rgba(10, 15, 13, 0.7), rgba(10, 15, 13, 0.3))",
            zIndex: 10,
          }}
        />

        {/* Current time separator — fixed vertical line */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: (CURRENT_TIME_COL + 1) * cellWidth,
            width: 2,
            background:
              "linear-gradient(to bottom, transparent, rgba(0, 255, 136, 0.4), transparent)",
            zIndex: 10,
          }}
        />


        {/* ── Y-axis price labels (right side, Y panning only) ── */}
        <div
          className="absolute flex flex-col z-20"
          style={{
            right: 0,
            width: 80,
            top: -cellHeight * 1.5,
            transform: `translateY(${-clipTop + panY}px)`,
            transition: "transform 0.3s ease-out",
          }}
        >
          {borderPrices.map((price, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-3 text-xs font-medium tabular-nums"
              style={{
                height: cellHeight,
                color: "#3d5c4d",
              }}
            >
              ${price.toFixed(5)}
            </div>
          ))}
        </div>

        {/* Current price badge — overlays y-axis at exact price position */}
        <div
          className="absolute right-0 px-2 py-1 rounded-l-md text-xs font-bold tabular-nums"
          style={{
            top: centerRow * cellHeight - clipTop + cellHeight / 2 - 12,
            background: "#00ff88",
            color: "#0a0f0d",
            zIndex: 30,
          }}
        >
          ${currentPrice.toFixed(5)}
        </div>

        {/* ── X-axis time labels (bottom, rAF-driven via ref) ── */}
        <div
          ref={xAxisRef}
          className="absolute bottom-0 left-0 flex z-20"
          style={{
            height: 28,
            willChange: "transform",
          }}
        >
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-xs tabular-nums"
              style={{
                width: cellWidth,
                color: label ? "#4a7a66" : "#1e3329",
              }}
            >
              {label || "·"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
