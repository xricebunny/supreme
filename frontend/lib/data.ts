import { PricePoint } from "@/types";

// Seeded random for reproducible price data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Tick interval in ms — each data point is 200ms apart */
export const TICK_INTERVAL_MS = 200;

/** Number of ticks per second */
const TICKS_PER_SECOND = 1000 / TICK_INTERVAL_MS; // 5

/** Total data points: 60 seconds × 5 ticks/sec = 300 */
const TOTAL_POINTS = 300;

// Generate 300 data points of simulated FLOW price data
// Start price: $0.03840, each point 200ms apart
// Realistic micro-movements scaled down for 200ms intervals
function generateFlowPriceData(): PricePoint[] {
  const rand = seededRandom(42);
  const startPrice = 0.0384;
  // Smaller step for 200ms intervals (was 0.00003 per 1s → ~0.000013 per 200ms)
  const stepSize = 0.000013;
  const points: PricePoint[] = [];

  const baseTimestamp = Date.now();
  let price = startPrice;

  for (let i = 0; i < TOTAL_POINTS; i++) {
    points.push({
      timestamp: baseTimestamp + i * TICK_INTERVAL_MS,
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
 * Get price at a given tick index.
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
export function getPriceHistory(tickIndex: number, count: number = 150): PricePoint[] {
  const history: PricePoint[] = [];
  for (let i = Math.max(0, tickIndex - count + 1); i <= tickIndex; i++) {
    const wrappedIndex = ((i % flowPriceData.length) + flowPriceData.length) % flowPriceData.length;
    history.push({
      timestamp: flowPriceData[wrappedIndex].timestamp + Math.floor(i / flowPriceData.length) * (TOTAL_POINTS * TICK_INTERVAL_MS),
      price: flowPriceData[wrappedIndex].price,
    });
  }
  return history;
}
