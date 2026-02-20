"use client";

import { useState, useCallback } from "react";
import { getMultiplier, getCellPayout } from "@/lib/multiplier";

const GRID_ROWS = 10;
const PRICE_STEP = 0.00005;
const CURRENT_TIME_COL = 5;

interface UseGameStateReturn {
  currentPriceRow: number;
  currentTimeCol: number;
  gridOffsetY: number;
  subCellOffsetY: number;
  betSize: number;
  setBetSize: (size: number) => void;
  getMultiplierForCell: (row: number, col: number) => number;
  getPayoutForCell: (row: number, col: number) => number;
}

export function useGameState(
  currentPrice: number
): UseGameStateReturn {
  const [betSize, setBetSize] = useState(10);

  const currentTimeCol = CURRENT_TIME_COL;
  const centerRow = Math.floor(GRID_ROWS / 2);
  const currentPriceRow = centerRow;

  const priceInRowUnits = currentPrice / PRICE_STEP;
  const gridOffsetY = (priceInRowUnits % 1) * -1;
  const subCellOffsetY = priceInRowUnits % 1;

  const getMultiplierForCell = useCallback(
    (row: number, col: number): number => {
      const rowDist = Math.abs(row - currentPriceRow);
      const colDist = col - currentTimeCol;
      if (colDist <= 0) return 1;
      return getMultiplier(rowDist, colDist);
    },
    [currentPriceRow, currentTimeCol]
  );

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
  };
}
