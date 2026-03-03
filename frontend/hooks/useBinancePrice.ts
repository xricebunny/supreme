"use client";

import { useState, useEffect, useRef } from "react";
import { PricePoint } from "@/types";
import { getPrice } from "@/lib/api";

/** Sampling interval in ms — each history point is this far apart */
export const SAMPLE_INTERVAL_MS = 200;

/** How many sampled points to keep in the rolling history buffer */
const HISTORY_SIZE = 150;

/** If no trade arrives within this many ms after connecting, show timeout warning */
const TRADE_TIMEOUT_MS = 10000;

export type TokenSymbol = "btc" | "flow";

/** Build the Binance aggTrade WebSocket URL for a given symbol */
function buildWsUrl(symbol: TokenSymbol): string {
  return `wss://stream.binance.com:9443/ws/${symbol}usdt@aggTrade`;
}

interface UseBinancePriceReturn {
  currentPrice: number;
  priceHistory: PricePoint[];
  connected: boolean;
  /** True if WebSocket connected but no trade has arrived within TRADE_TIMEOUT_MS */
  timedOut: boolean;
}

/**
 * Connects to the Binance aggTrade WebSocket for the given symbol.
 *
 * Trades arrive at irregular intervals, so we sample at a fixed 200ms rate
 * into a rolling buffer of 150 points (30 seconds of history).
 *
 * Reconnects automatically on disconnect.
 * Reconnects and clears history when the symbol changes.
 */
export function useBinancePrice(symbol: TokenSymbol = "btc"): UseBinancePriceReturn {
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

    // Reset state on symbol change
    latestPriceRef.current = 0;
    historyRef.current = [];
    setCurrentPrice(0);
    setPriceHistory([]);
    setConnected(false);
    setTimedOut(false);

    const wsUrl = buildWsUrl(symbol);

    function connect() {
      if (disposed) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (disposed) {
          ws?.close();
          return;
        }
        setConnected(true);
        setTimedOut(false);

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
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, triggering reconnect
      };
    }

    connect();

    // Seed initial price from backend for low-volume pairs (FLOW)
    // so the grid renders immediately instead of waiting for the first WS trade.
    // Skip for BTC — WS trades arrive in <100ms so seeding would just add a stale-price blip.
    if (symbol !== "btc") {
      getPrice(symbol)
        .then(({ price }) => {
          if (disposed || price <= 0) return;
          if (latestPriceRef.current === 0) {
            latestPriceRef.current = price;
          }
        })
        .catch(() => {});
    }

    // Sample the latest price at a fixed 200ms interval into the history buffer
    sampleTimer = setInterval(() => {
      const price = latestPriceRef.current;
      if (price === 0) return;

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
  }, [symbol]); // Reconnect when symbol changes

  return { currentPrice, priceHistory, connected, timedOut };
}
