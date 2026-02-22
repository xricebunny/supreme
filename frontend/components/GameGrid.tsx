"use client";

import { useMemo, useRef, useCallback, RefObject } from "react";
import { formatPayout, formatTime, formatGridPrice } from "@/lib/formatters";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";
import { PricePoint } from "@/types";
import { ActiveBet } from "@/hooks/useBetManager";
import PriceLine from "@/components/PriceLine";

const VISIBLE_ROWS = 10;
const GRID_COLS = 21;
const RENDER_COLS = GRID_COLS + 2; // extra columns to fill the gap during panning
const CURRENT_TIME_COL = 5;

/** Total rows in the virtual price grid. Current price is always centered. */
const TOTAL_ROWS = 40;

interface GameGridProps {
  currentPrice: number;
  priceHistory: PricePoint[];
  betSize: number;
  timeSlot: number;
  baseTimeMs: number;
  slotProgress: number;
  gridRef: RefObject<HTMLDivElement>;
  xAxisRef: RefObject<HTMLDivElement>;
  cellWidth: number;
  cellHeight: number;
  activeBets?: ActiveBet[];
  onCellClick?: (params: {
    targetPrice: number;
    priceTop: number;
    priceBottom: number;
    aboveTarget: boolean;
    betSize: number;
    rowDist: number;
    colDist: number;
    row: number;
    col: number;
    colStartTimeMs: number;
    colEndTimeMs: number;
  }) => void;
}

export default function GameGrid({
  currentPrice,
  priceHistory,
  betSize,
  timeSlot,
  baseTimeMs,
  slotProgress,
  gridRef,
  xAxisRef,
  cellWidth,
  cellHeight,
  activeBets = [],
  onCellClick,
}: GameGridProps) {
  const gridWidth = RENDER_COLS * cellWidth;
  const totalGridHeight = TOTAL_ROWS * cellHeight;
  const visibleHeight = VISIBLE_ROWS * cellHeight;

  // Dynamic price step using 1-2-5 "nice number" series.
  // Target: price / 10,000 → gives $10 for BTC ($96k), $0.20 for ETH ($2.7k), etc.
  const rawStep = currentPrice > 0 ? currentPrice / 10000 : 0.00005;
  const stepExp = Math.floor(Math.log10(rawStep));
  const stepFrac = rawStep / Math.pow(10, stepExp);
  const niceMultiplier = stepFrac < 1.5 ? 1 : stepFrac < 3.5 ? 2 : 10;
  const priceStep = niceMultiplier * Math.pow(10, stepExp);

  // Stable grid anchor — set once on first price, then only re-anchor when price
  // drifts more than 10 rows away (to prevent the grid origin from shifting every frame,
  // which would pin the price line to a border instead of floating between rows).
  const anchorRef = useRef(0);
  if (anchorRef.current === 0 || Math.abs(currentPrice - anchorRef.current) > priceStep * 10) {
    anchorRef.current = Math.round(currentPrice / priceStep) * priceStep;
  }
  const priceMax = anchorRef.current + (TOTAL_ROWS / 2) * priceStep;

  // Which row does the current price fall in?
  // Row 0 = top = highest price, Row N = bottom = lowest price
  const priceRowExact = (priceMax - currentPrice) / priceStep;
  const currentPriceRow = Math.floor(priceRowExact);
  const fractionInRow = priceRowExact - currentPriceRow; // 0 = at top border, 1 = at bottom border

  // Translate so the current price is vertically centered in the visible area
  // The current price sits at pixel position: (currentPriceRow + fractionInRow) * cellHeight from top of full grid
  // We want that to be at visibleHeight / 2
  const translateY = -(currentPriceRow + fractionInRow) * cellHeight + visibleHeight / 2;

  // Determine which rows are visible (with buffer)
  const buffer = 3;
  const firstVisibleRow = Math.max(0, Math.floor(-translateY / cellHeight) - buffer);
  const lastVisibleRow = Math.min(
    TOTAL_ROWS - 1,
    Math.floor((-translateY + visibleHeight) / cellHeight) + buffer
  );

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

  // Cell data — only for visible rows
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

    for (let r = firstVisibleRow; r <= lastVisibleRow; r++) {
      const isCurrentPrice = r === currentPriceRow;
      const rowDist = Math.abs(r - currentPriceRow);

      for (let c = 0; c < RENDER_COLS; c++) {
        const isPast = c < CURRENT_TIME_COL;
        const isCurrentTime = c === CURRENT_TIME_COL;
        const colDist = c - CURRENT_TIME_COL;
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
  }, [betSize, currentPriceRow, slotProgress, firstVisibleRow, lastVisibleRow]);

  // Precompute bet positions from absolute data (targetPrice + expiryTimestamp)
  // so they track correctly as the grid scrolls
  const betPositions = useMemo(() => {
    const map = new Map<string, ActiveBet>();
    const slotBaseMs = baseTimeMs + timeSlot * 5000;

    for (const bet of activeBets) {
      // Row from priceTop (top border of the cell's price band)
      const betRow = Math.round((priceMax - bet.priceTop) / priceStep);
      // Col from startTimestamp (left edge of cell's time window)
      // Using startTimestamp avoids rounding errors — it's grid-aligned
      const betCol = Math.round(
        CURRENT_TIME_COL + (bet.startTimestamp - slotBaseMs) / 5000
      );

      if (betRow >= 0 && betRow < TOTAL_ROWS && betCol >= 0 && betCol < RENDER_COLS) {
        map.set(`${betRow}-${betCol}`, bet);
      }
    }
    return map;
  }, [activeBets, baseTimeMs, timeSlot, priceMax, priceStep]);

  // Price labels at row borders — these are the horizontal grid lines
  // Border i sits between row i-1 (above) and row i (below)
  // Price at border i = priceMax - i * priceStep
  // We show labels for borders within/near the visible range
  const borderLabels = useMemo(() => {
    const labels: { borderIndex: number; price: number }[] = [];
    for (let b = firstVisibleRow; b <= lastVisibleRow + 1; b++) {
      const price = priceMax - b * priceStep;
      labels.push({ borderIndex: b, price });
    }
    return labels;
  }, [firstVisibleRow, lastVisibleRow, priceMax, priceStep]);

  // Current price badge vertical position (relative to the visible viewport)
  // The price sits at pixel (currentPriceRow + fractionInRow) * cellHeight in full grid coords
  // After translateY, in viewport coords: (currentPriceRow + fractionInRow) * cellHeight + translateY
  // Which simplifies to visibleHeight / 2 (by definition of translateY)
  const priceBadgeTop = visibleHeight / 2 - 12; // -12 to center the ~24px badge

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
            height: visibleHeight,
            willChange: "transform",
          }}
        >
          {/* Vertical panning sublayer — translates the full grid so current price is centered */}
          <div
            className="relative"
            style={{
              width: gridWidth,
              height: totalGridHeight,
              transform: `translateY(${translateY}px)`,
              transition: "transform 0.3s ease-out",
            }}
          >
            {/* Grid background lines — cover full grid */}
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

            {/* Grid cells — only render visible rows, positioned absolutely */}
            <div className="absolute inset-0">
              {cells.map((cell) => {
                const isFuture = cell.colDist > 0;
                const isClickable = isFuture && cell.effectiveColDist > 0 && !!onCellClick;

                // Check if this cell has an active bet (using precomputed positions)
                const cellBet = betPositions.get(`${cell.row}-${cell.col}`);

                const betClass = cellBet
                  ? cellBet.status === "won"
                    ? "bet-cell-won"
                    : cellBet.status === "lost"
                    ? "bet-cell-lost"
                    : cellBet.status === "active"
                    ? "bet-cell-active"
                    : ""
                  : "";

                return (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    className={`grid-cell ${betClass} ${isClickable ? "cursor-pointer hover:bg-[#00ff8810]" : ""}`}
                    style={{
                      position: "absolute",
                      left: cell.col * cellWidth,
                      top: cell.row * cellHeight,
                      width: cellWidth,
                      height: cellHeight,
                      opacity: cellBet ? 1 : cell.isPast ? 0.3 : cell.isCurrentTime ? 0.5 : 1,
                      background: cellBet && cellBet.status === "active"
                        ? "rgba(0, 200, 255, 0.15)"
                        : undefined,
                    }}
                    onClick={
                      isClickable
                        ? () => {
                            // Cell row spans price band: top border → bottom border
                            const priceTop = priceMax - cell.row * priceStep;
                            const priceBottom = priceMax - (cell.row + 1) * priceStep;
                            const targetPrice = (priceTop + priceBottom) / 2; // midpoint for backend
                            const aboveTarget = cell.row < currentPriceRow;
                            // Compute exact wall-clock timestamps for this column
                            // to avoid rounding errors when mapping bet back to cell
                            const slotBase = baseTimeMs + timeSlot * 5000;
                            const colStartTimeMs = slotBase + (cell.col - CURRENT_TIME_COL) * 5000;
                            const colEndTimeMs = colStartTimeMs + 5000;
                            onCellClick!({
                              targetPrice,
                              priceTop,
                              priceBottom,
                              aboveTarget,
                              betSize,
                              rowDist: cell.rowDist,
                              colDist: Math.max(1, Math.round(cell.effectiveColDist)),
                              row: cell.row,
                              col: cell.col,
                              colStartTimeMs,
                              colEndTimeMs,
                            });
                          }
                        : undefined
                    }
                  >
                    {cellBet && cellBet.status === "active" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center animate-pulse">
                        <span className="text-xs font-bold text-cyan-400">${cellBet.betSize}</span>
                        <span className="text-[9px] text-cyan-300 opacity-70">{cellBet.multiplier.toFixed(1)}x</span>
                      </span>
                    )}
                    {cellBet && cellBet.status === "won" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-semibold text-green-300 uppercase">Won</span>
                        <span className="text-sm font-bold text-green-400">+${cellBet.payout.toFixed(0)}</span>
                      </span>
                    )}
                    {cellBet && cellBet.status === "lost" && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-semibold text-red-300 uppercase">Lost</span>
                        <span className="text-sm font-bold text-red-400">-${cellBet.betSize}</span>
                      </span>
                    )}
                    {!cellBet && isFuture && cell.effectiveColDist > 0 && (
                      <span className="cell-payout">
                        {formatPayout(cell.payout)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Price line — inside panning layers so it scrolls at 60fps */}
            <PriceLine
              priceHistory={priceHistory}
              centerPrice={currentPrice}
              cellHeight={cellHeight}
              cellWidth={cellWidth}
              currentTimeCol={CURRENT_TIME_COL}
              priceStep={priceStep}
              centerPriceY={(currentPriceRow + fractionInRow) * cellHeight}
              slotProgress={slotProgress}
            />
          </div>
        </div>

        {/* ── Fixed overlays (outside panning container, don't scroll) ── */}

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

        {/* ── Y-axis price labels at row BORDERS (right side, pans with grid) ── */}
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            right: 0,
            width: 80,
            top: 0,
            height: visibleHeight,
            overflow: "visible",
          }}
        >
          {borderLabels.map(({ borderIndex, price }) => {
            // Border position in viewport coords:
            // In full grid coords, border i is at y = borderIndex * cellHeight
            // In viewport: borderIndex * cellHeight + translateY
            const yPos = borderIndex * cellHeight + translateY;
            return (
              <div
                key={borderIndex}
                className="absolute flex items-center justify-end pr-3 text-xs font-medium tabular-nums"
                style={{
                  right: 0,
                  width: 80,
                  top: yPos - 8, // center the ~16px text on the border line
                  height: 16,
                  color: "#3d5c4d",
                  transition: "top 0.3s ease-out",
                }}
              >
                {formatGridPrice(price, priceStep)}
              </div>
            );
          })}
        </div>

        {/* Current price badge — always vertically centered */}
        <div
          className="absolute right-0 px-2 py-1 rounded-l-md text-xs font-bold tabular-nums"
          style={{
            top: priceBadgeTop,
            background: "#00ff88",
            color: "#0a0f0d",
            zIndex: 30,
          }}
        >
          {formatGridPrice(currentPrice, priceStep)}
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
