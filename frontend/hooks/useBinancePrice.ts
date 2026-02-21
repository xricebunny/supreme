"use client";

import { useState, useEffect, useRef } from "react";
import { PricePoint } from "@/types";

/** Sampling interval in ms — each history point is this far apart */
export const SAMPLE_INTERVAL_MS = 200;

/** How many sampled points to keep in the rolling history buffer */
const HISTORY_SIZE = 150;

/** Binance aggTrade WebSocket URL for BTC/USDT */
const WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@aggTrade";

/** If no trade arrives within this many ms after connecting, show timeout warning */
const TRADE_TIMEOUT_MS = 10000;

interface UseBinancePriceReturn {
  currentPrice: number;
  priceHistory: PricePoint[];
  connected: boolean;
  /** True if WebSocket connected but no trade has arrived within TRADE_TIMEOUT_MS */
  timedOut: boolean;
}

/**
 * Connects to the Binance aggTrade WebSocket for BTC/USDT.
 *
 * Trades arrive at irregular intervals, so we sample at a fixed 200ms rate
 * into a rolling buffer of 150 points (30 seconds of history). This keeps
 * the same interface as the old useSimulatedPrice — consumers (GameGrid,
 * PriceLine) don't need to change.
 *
 * Reconnects automatically on disconnect.
 */
export function useBinancePrice(): UseBinancePriceReturn {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Latest price from WebSocket (updated on every trade, no React re-render)
  const latestPriceRef = useRef(0);
  // Rolling history buffer — mutated in the sampling interval, flushed to state
  const historyRef = useRef<PricePoint[]>([]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let sampleTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let tradeTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let receivedFirstTrade = false;

    function connect() {
      if (disposed) return;

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (disposed) {
          ws?.close();
          return;
        }
        setConnected(true);
        setTimedOut(false);

        // Start timeout — if no trade arrives within 10s, flag it
        tradeTimeoutTimer = setTimeout(() => {
          if (!receivedFirstTrade && !disposed) {
            setTimedOut(true);
          }
        }, TRADE_TIMEOUT_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const price = parseFloat(data.p);
          if (!isNaN(price) && price > 0) {
            latestPriceRef.current = price;
            if (!receivedFirstTrade) {
              receivedFirstTrade = true;
              setTimedOut(false);
              if (tradeTimeoutTimer) clearTimeout(tradeTimeoutTimer);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        if (tradeTimeoutTimer) clearTimeout(tradeTimeoutTimer);
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, triggering reconnect
      };
    }

    connect();

    // Sample the latest price at a fixed 200ms interval into the history buffer
    sampleTimer = setInterval(() => {
      const price = latestPriceRef.current;
      if (price === 0) return; // No price received yet

      const now = Date.now();
      const buf = historyRef.current;

      buf.push({ timestamp: now, price });
      if (buf.length > HISTORY_SIZE) {
        buf.splice(0, buf.length - HISTORY_SIZE);
      }

      setCurrentPrice(price);
      setPriceHistory([...buf]);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      disposed = true;
      ws?.close();
      if (sampleTimer) clearInterval(sampleTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (tradeTimeoutTimer) clearTimeout(tradeTimeoutTimer);
    };
  }, []);

  return { currentPrice, priceHistory, connected, timedOut };
}
