"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentPrice, getPriceHistory } from "@/lib/data";
import { PricePoint } from "@/types";

interface UseSimulatedPriceReturn {
  currentPrice: number;
  priceHistory: PricePoint[];
  tickIndex: number;
}

/**
 * Drives a simulated price tick every 1 second through data.ts prices.
 * Wraps around the 60-point dataset for continuous simulation.
 */
export function useSimulatedPrice(): UseSimulatedPriceReturn {
  const [tickIndex, setTickIndex] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setTickIndex(tickRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const currentPrice = getCurrentPrice(tickIndex);
  const priceHistory = getPriceHistory(tickIndex, 30);

  return { currentPrice, priceHistory, tickIndex };
}
