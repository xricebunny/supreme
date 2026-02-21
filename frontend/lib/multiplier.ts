/**
 * Calculate the multiplier for a cell based on its distance from the
 * current price row and current time column.
 *
 * @param rowDist - Absolute rows from current price row (0 = at price)
 * @param colDist - Columns to the right of current time column (1 = nearest future)
 */
export function getMultiplier(rowDist: number, colDist: number): number {
  const base = 1.4;
  const rowFactor = 0.55;
  const timePow = 0.3;
  const colDecay = 0.08;
  const cap = 100;

  if (colDist <= 0) return 1;

  const rowComponent = Math.exp(rowDist * rowFactor);
  const timeComponent =
    Math.pow(colDist, timePow) / Math.exp(rowDist * colDecay);

  return Math.min(cap, Math.max(1, base * rowComponent * timeComponent));
}

/**
 * Calculate the payout for a cell bet.
 * Returns the profit amount (not including the original bet).
 */
export function getCellPayout(
  betSize: number,
  rowDist: number,
  colDist: number
): number {
  return betSize * (getMultiplier(rowDist, colDist) - 1);
}
