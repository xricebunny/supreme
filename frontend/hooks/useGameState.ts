"use client";

import { useState, useMemo, useCallback } from "react";
import { GameState, PricePoint } from "@/types";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";

const GRID_ROWS = 10;
const GRID_COLS = 21;
const PRICE_STEP = 0.00005; // $0.00005 per row
const TIME_STEP = 5; // 5 seconds per column
const CURRENT_TIME_COL = 5; // Column 6 (0-indexed = 5) is current time

interface UseGameStateReturn {
  currentPriceRow: number;
  currentTimeCol: number;
  gridOffsetY: number;
  subCellOffsetY: number;
  betSize: number;
  setBetSize: (size: number) => void;
  getMultiplierForCell: (row: number, col: number) => number;
  getPayoutForCell: (row: number, col: number) => number;
  /** Which 5-second "slot" are we in (increments every 5 ticks) */
  timeSlot: number;
  /** 0-1 progress within current 5-second slot */
  timeSlotProgress: number;
}

/**
 * Derives the grid state from the current price and tick index.
 * - currentPriceRow: which row the price sits on (always centered)
 * - gridOffsetY: smooth Y offset for price centering
 * - timeSlot: which 5-second column group we're in
 */
export function useGameState(
  currentPrice: number,
  tickIndex: number
): UseGameStateReturn {
  const [betSize, setBetSize] = useState(10);

  // The current time column is always pinned at column 6 (index 5)
  const currentTimeCol = CURRENT_TIME_COL;

  // Time slot: every 5 ticks (seconds) we advance one column
  const timeSlot = Math.floor(tickIndex / TIME_STEP);
  const timeSlotProgress = (tickIndex % TIME_STEP) / TIME_STEP;

  // Price row: the center row represents the current price
  // We calculate how many rows the price is offset from a reference
  const centerRow = Math.floor(GRID_ROWS / 2); // Row 5 (middle of 10 rows)
  const currentPriceRow = centerRow;

  // Smooth Y offset: as price moves between row boundaries,
  // shift the grid fractionally for smooth animation
  const priceInRowUnits = currentPrice / PRICE_STEP;
  const gridOffsetY = (priceInRowUnits % 1) * -1; // fractional offset
  const subCellOffsetY = priceInRowUnits % 1;

  // Get multiplier for a given cell (row, col are grid coordinates)
  const getMultiplierForCell = useCallback(
    (row: number, col: number): number => {
      const rowDist = Math.abs(row - currentPriceRow);
      const colDist = col - currentTimeCol;
      if (colDist <= 0) return 1; // past columns
      return getMultiplier(rowDist, colDist);
    },
    [currentPriceRow, currentTimeCol]
  );

  // Get payout for a given cell
  const getPayoutForCell = useCallback(
    (row: number, col: number): number => {
      const rowDist = Math.abs(row - currentPriceRow);
      const colDist = col - currentTimeCol;
      if (colDist <= 0) return 0;
      return getCellPayout(betSize, rowDist, colDist);
    },
    [currentPriceRow, currentTimeCol, betSize]
  );

  return {
    currentPriceRow,
    currentTimeCol,
    gridOffsetY,
    subCellOffsetY,
    betSize,
    setBetSize,
    getMultiplierForCell,
    getPayoutForCell,
    timeSlot,
    timeSlotProgress,
  };
}
