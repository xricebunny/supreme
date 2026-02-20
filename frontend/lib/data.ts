import { PricePoint } from "@/types";

// Seeded random for reproducible price data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Generate 60 data points of simulated FLOW price data
// Start price: $0.03840, each point 1 second apart
// Realistic micro-movements: ±$0.00003 per second random walk
function generateFlowPriceData(): PricePoint[] {
  const rand = seededRandom(42);
  const startPrice = 0.0384;
  const stepSize = 0.00003;
  const points: PricePoint[] = [];

  // Use a fixed base timestamp (doesn't matter, we index by offset)
  const baseTimestamp = Date.now();
  let price = startPrice;

  for (let i = 0; i < 60; i++) {
    points.push({
      timestamp: baseTimestamp + i * 1000,
      price: Math.round(price * 100000) / 100000,
    });

    // Random walk: slight upward bias for interest
    const direction = rand() < 0.52 ? 1 : -1;
    const magnitude = rand() * stepSize * 2;
    price += direction * magnitude;

    // Clamp to reasonable range
    price = Math.max(0.03800, Math.min(0.03900, price));
  }

  return points;
}

export const flowPriceData: PricePoint[] = generateFlowPriceData();

/**
 * Get interpolated price at a given tick index (0-59).
 * Wraps around for continuous simulation.
 */
export function getCurrentPrice(tickIndex: number): number {
  const wrappedIndex = ((tickIndex % flowPriceData.length) + flowPriceData.length) % flowPriceData.length;
  return flowPriceData[wrappedIndex].price;
}

/**
 * Get a slice of price history up to the given tick index.
 * Returns the last `count` prices.
 */
export function getPriceHistory(tickIndex: number, count: number = 30): PricePoint[] {
  const history: PricePoint[] = [];
  for (let i = Math.max(0, tickIndex - count + 1); i <= tickIndex; i++) {
    const wrappedIndex = ((i % flowPriceData.length) + flowPriceData.length) % flowPriceData.length;
    history.push({
      timestamp: flowPriceData[wrappedIndex].timestamp + Math.floor(i / flowPriceData.length) * 60000,
      price: flowPriceData[wrappedIndex].price,
    });
  }
  return history;
}
