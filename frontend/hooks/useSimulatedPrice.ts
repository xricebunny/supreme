"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentPrice, getPriceHistory, TICK_INTERVAL_MS } from "@/lib/data";
import { PricePoint } from "@/types";

interface UseSimulatedPriceReturn {
  currentPrice: number;
  priceHistory: PricePoint[];
  tickIndex: number;
}

/**
 * Drives a simulated price tick every 200ms through data.ts prices.
 * Wraps around the 300-point dataset for continuous simulation.
 */
export function useSimulatedPrice(): UseSimulatedPriceReturn {
  const [tickIndex, setTickIndex] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setTickIndex(tickRef.current);
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const currentPrice = getCurrentPrice(tickIndex);
  const priceHistory = getPriceHistory(tickIndex, 150);

  return { currentPrice, priceHistory, tickIndex };
}
