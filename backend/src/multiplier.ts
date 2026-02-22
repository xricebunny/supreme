/**
 * Same multiplier formula as frontend/lib/multiplier.ts.
 * Must stay in sync — backend computes this for bet co-signing.
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
