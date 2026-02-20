"use client";

import { useMemo } from "react";
import { formatPayout, formatTime } from "@/lib/formatters";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";
import { useAnimationTime } from "@/hooks/useAnimationTime";

const GRID_ROWS = 10;
const GRID_COLS = 21;
const CELL_WIDTH = 72;
const CELL_HEIGHT = 56;
const PRICE_STEP = 0.00005;
const CURRENT_TIME_COL = 5;
const CLIP_FRACTION = 0.33;
const SLOT_DURATION_MS = 5000;

interface GameGridProps {
  currentPrice: number;
  tickIndex: number;
  betSize: number;
  timeSlot: number;
}

export default function GameGrid({
  currentPrice,
  betSize,
  timeSlot,
}: GameGridProps) {
  // rAF-driven elapsed time for smooth 60fps pan.
  // This is the only correct way to get truly infinite scrolling:
  // panX goes 0→72px over exactly 5000ms, and at 72px the grid lines
  // are visually identical to 0px (they tile at CELL_WIDTH), so the
  // reset is completely seamless with no snap-back.
  const elapsedMs = useAnimationTime();
  const slotProgress = (elapsedMs % SLOT_DURATION_MS) / SLOT_DURATION_MS;
  // localTimeSlot updates at the exact same moment panX resets to 0
  const localTimeSlot = Math.floor(elapsedMs / SLOT_DURATION_MS);

  const gridWidth = GRID_COLS * CELL_WIDTH;
  const gridHeight = GRID_ROWS * CELL_HEIGHT;
  const clipTop = CELL_HEIGHT * CLIP_FRACTION;
  const visibleHeight = gridHeight - clipTop * 2;

  // Horizontal pan: 0 → CELL_WIDTH over SLOT_DURATION_MS, then seamless reset
  const panX = slotProgress * CELL_WIDTH;

  // Vertical pan: fractional row offset based on current price
  const priceInRowUnits = currentPrice / PRICE_STEP;
  const fractionalRow = priceInRowUnits % 1;
  const panY = fractionalRow * CELL_HEIGHT;

  const centerRow = Math.floor(GRID_ROWS / 2);

  const rowPrices = useMemo(() => {
    const prices: number[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      prices.push(currentPrice + (centerRow - r) * PRICE_STEP);
    }
    return prices;
  }, [currentPrice, centerRow]);

  // Labels regenerate each slot. localTimeSlot changes at the exact frame
  // where panX resets, so label positions stay in sync with the grid.
  const timeLabels = useMemo(() => {
    const labels: (string | null)[] = [];
    const now = new Date();
    for (let c = 0; c < GRID_COLS; c++) {
      const secondsOffset = (c - CURRENT_TIME_COL) * 5;
      const time = new Date(now.getTime() + secondsOffset * 1000);
      labels.push(c % 2 === 0 ? formatTime(time) : null);
    }
    return labels;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTimeSlot]);

  // Cells recompute every frame (slotProgress changes at 60fps).
  // effectiveColDist shrinks toward 0 as the slot progresses, so rewards
  // displayed in each cell decay in real-time as those cells approach "now".
  const cells = useMemo(() => {
    const result: {
      row: number;
      col: number;
      isPast: boolean;
      isCurrentTime: boolean;
      colDist: number;
      payout: number;
    }[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const colDist = c - CURRENT_TIME_COL;
        const isPast = colDist < 0;
        const isCurrentTime = colDist === 0;
        const rowDist = Math.abs(r - centerRow);

        // The effective future distance shrinks as we progress through the slot
        const effectiveColDist = colDist - slotProgress;

        let payout = 0;
        if (effectiveColDist > 0) {
          payout = getCellPayout(betSize, rowDist, effectiveColDist);
        }

        result.push({ row: r, col: c, isPast, isCurrentTime, colDist, payout });
      }
    }
    return result;
  }, [betSize, centerRow, slotProgress]);

  return (
    <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      <div className="relative w-full h-full" style={{ overflow: "hidden" }}>

        {/* Panning container — no CSS transition, rAF handles smoothness */}
        <div
          className="relative"
          style={{
            width: gridWidth,
            height: gridHeight,
            transform: `translate(${-panX}px, ${-clipTop + panY}px)`,
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
              backgroundSize: `${CELL_WIDTH}px ${CELL_HEIGHT}px`,
            }}
          />

          {/* Current price row highlight */}
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: centerRow * CELL_HEIGHT,
              height: CELL_HEIGHT,
              background: "rgba(0, 255, 136, 0.06)",
              borderTop: "1px solid rgba(0, 255, 136, 0.2)",
              borderBottom: "1px solid rgba(0, 255, 136, 0.2)",
            }}
          />

          {/* Current time column separator */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: CURRENT_TIME_COL * CELL_WIDTH + CELL_WIDTH,
              width: 2,
              background:
                "linear-gradient(to bottom, transparent, rgba(0, 255, 136, 0.4), transparent)",
            }}
          />

          {/* Past overlay */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: 0,
              width: (CURRENT_TIME_COL + 1) * CELL_WIDTH,
              background:
                "linear-gradient(to right, rgba(10, 15, 13, 0.7), rgba(10, 15, 13, 0.3))",
            }}
          />

          {/* Grid cells */}
          <div
            className="absolute inset-0"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_WIDTH}px)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_HEIGHT}px)`,
            }}
          >
            {cells.map((cell) => (
              <div
                key={`${cell.row}-${cell.col}`}
                className="grid-cell"
                style={{
                  opacity: cell.isPast ? 0.3 : cell.isCurrentTime ? 0.5 : 1,
                }}
              >
                {cell.colDist > 0 && cell.payout > 0 && (
                  <span className="cell-payout">
                    {formatPayout(cell.payout)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Y-axis price labels — only smooth Y transition, no X */}
        <div
          className="absolute top-0 bottom-0 flex flex-col z-20"
          style={{
            right: 0,
            width: 80,
            transform: `translateY(${-clipTop + panY}px)`,
            transition: "transform 0.3s ease-out",
          }}
        >
          {rowPrices.map((price, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-3 text-xs font-medium tabular-nums"
              style={{
                height: CELL_HEIGHT,
                color: i === centerRow ? "#00ff88" : "#3d5c4d",
              }}
            >
              ${price.toFixed(5)}
            </div>
          ))}

          {/* Current price badge */}
          <div
            className="absolute right-0 px-2 py-1 rounded-l-md text-xs font-bold tabular-nums"
            style={{
              top: centerRow * CELL_HEIGHT + CELL_HEIGHT / 2 - 12,
              background: "#00ff88",
              color: "#0a0f0d",
            }}
          >
            ${currentPrice.toFixed(5)}
          </div>
        </div>

        {/* X-axis time labels — driven by same panX, no transition */}
        <div
          className="absolute bottom-0 left-0 flex z-20"
          style={{
            height: 28,
            transform: `translateX(${-panX}px)`,
          }}
        >
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-xs tabular-nums"
              style={{
                width: CELL_WIDTH,
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
