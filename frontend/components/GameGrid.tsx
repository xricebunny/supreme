"use client";

import { useMemo } from "react";
import { formatPayout, formatTime } from "@/lib/formatters";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";
import PriceLine from "./PriceLine";

const GRID_ROWS = 10;
const GRID_COLS = 21;
const CELL_WIDTH = 72;
const CELL_HEIGHT = 56;
const PRICE_STEP = 0.00005;
const CURRENT_TIME_COL = 5; // pinned at column 6 (0-indexed)
const CLIP_FRACTION = 0.33; // top/bottom rows clipped by ~1/3

interface GameGridProps {
  currentPrice: number;
  tickIndex: number;
  betSize: number;
  priceHistory: { timestamp: number; price: number }[];
  timeSlot: number;
  timeSlotProgress: number;
}

export default function GameGrid({
  currentPrice,
  tickIndex,
  betSize,
  priceHistory,
  timeSlot,
  timeSlotProgress,
}: GameGridProps) {
  // Grid dimensions
  const gridWidth = GRID_COLS * CELL_WIDTH;
  const gridHeight = GRID_ROWS * CELL_HEIGHT;

  // Visible area clips top/bottom rows
  const clipTop = CELL_HEIGHT * CLIP_FRACTION;
  const clipBottom = CELL_HEIGHT * CLIP_FRACTION;
  const visibleHeight = gridHeight - clipTop - clipBottom;

  // Horizontal pan: smooth transition within each 5-second slot
  const panX = timeSlotProgress * CELL_WIDTH;

  // Vertical pan: smooth as price moves between row boundaries
  const priceInRowUnits = currentPrice / PRICE_STEP;
  const fractionalRow = priceInRowUnits % 1;
  const panY = fractionalRow * CELL_HEIGHT;

  // Price for each row (current price is centered at row GRID_ROWS/2)
  const centerRow = Math.floor(GRID_ROWS / 2);
  const rowPrices = useMemo(() => {
    const prices: number[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      // Row 0 is highest price, row 9 is lowest
      const rowOffset = centerRow - r;
      prices.push(currentPrice + rowOffset * PRICE_STEP);
    }
    return prices;
  }, [currentPrice, centerRow]);

  // Time labels: every OTHER column, starting from first visible
  const timeLabels = useMemo(() => {
    const labels: (string | null)[] = [];
    const now = new Date();
    // Current time is at CURRENT_TIME_COL
    for (let c = 0; c < GRID_COLS; c++) {
      const colOffset = c - CURRENT_TIME_COL;
      const secondsOffset = colOffset * 5;
      const time = new Date(now.getTime() + secondsOffset * 1000);
      // Label every other column (even columns)
      if (c % 2 === 0) {
        labels.push(formatTime(time));
      } else {
        labels.push(null);
      }
    }
    return labels;
    // Re-derive labels on each time slot change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSlot]);

  // Generate cell data
  const cells = useMemo(() => {
    const result: {
      row: number;
      col: number;
      isPast: boolean;
      isCurrentTime: boolean;
      isCurrentPrice: boolean;
      rowDist: number;
      colDist: number;
      multiplier: number;
      payout: number;
    }[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isPast = c < CURRENT_TIME_COL;
        const isCurrentTime = c === CURRENT_TIME_COL;
        const isCurrentPrice = r === centerRow;
        const rowDist = Math.abs(r - centerRow);
        const colDist = c - CURRENT_TIME_COL;

        let multiplier = 1;
        let payout = 0;
        if (colDist > 0) {
          multiplier = getMultiplier(rowDist, colDist);
          payout = getCellPayout(betSize, rowDist, colDist);
        }

        result.push({
          row: r,
          col: c,
          isPast,
          isCurrentTime,
          isCurrentPrice,
          rowDist,
          colDist,
          multiplier,
          payout,
        });
      }
    }
    return result;
  }, [betSize, centerRow]);

  return (
    <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* Container for the grid with clipping */}
      <div
        className="relative w-full h-full"
        style={{
          overflow: "hidden",
        }}
      >
        {/* Panning container */}
        <div
          className="relative"
          style={{
            width: gridWidth,
            height: gridHeight,
            transform: `translate(${-panX}px, ${-clipTop + panY}px)`,
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

          {/* Past overlay - dim left columns */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: 0,
              width: (CURRENT_TIME_COL + 1) * CELL_WIDTH,
              background:
                "linear-gradient(to right, rgba(10, 15, 13, 0.7), rgba(10, 15, 13, 0.3))",
            }}
          />

          {/* Price line */}
          <PriceLine
            priceHistory={priceHistory}
            centerPrice={currentPrice}
            cellHeight={CELL_HEIGHT}
            cellWidth={CELL_WIDTH}
            gridHeight={gridHeight}
            currentTimeCol={CURRENT_TIME_COL}
            visibleRows={GRID_ROWS}
            priceStep={PRICE_STEP}
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
                  {isFuture && cell.payout > 0 && (
                    <span className="cell-payout">
                      {formatPayout(cell.payout)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Y-axis price labels - RIGHT side, fixed position */}
        <div
          className="absolute top-0 bottom-0 flex flex-col z-20"
          style={{
            right: 0,
            width: 80,
            paddingTop: 0,
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

        {/* X-axis time labels - BOTTOM, fixed position */}
        <div
          className="absolute bottom-0 left-0 flex z-20"
          style={{
            height: 28,
            transform: `translateX(${-panX}px)`,
            transition: "transform 0.3s ease-out",
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
