import WebSocket from "ws";
import { sendTransaction, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

let latestPrice = 0;
let lastPushTime = 0;
let lastPriceUpdateTime = 0; // Last time we received ANY price from Binance
let isPushing = false;
let pushStartTime = 0; // Track when push started (for timeout detection)
const PUSH_INTERVAL_MS = 4000; // Push every ~4 seconds
const PUSH_TIMEOUT_MS = 30000; // Force-reset isPushing after 30s
const STALE_WS_MS = 15000; // Reconnect if no WS message for 15s
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

// ── Interval High/Low Tracking ──────────────────────────────────────────────

let intervalHigh = 0;
let intervalLow = Infinity;

function resetInterval() {
  intervalHigh = latestPrice;
  intervalLow = latestPrice;
}

function trackPrice(price: number) {
  if (price > intervalHigh) intervalHigh = price;
  if (price < intervalLow) intervalLow = price;
}

// ── Cadence Templates ───────────────────────────────────────────────────────

const PUSH_PRICE_RANGE_CDC = `
import PriceOracle from 0xPriceOracle
import PriceRangeOracle from 0xPriceRangeOracle

transaction(high: UFix64, low: UFix64, close: UFix64, timestamp: UFix64) {
    let oracleAdmin: &PriceOracle.Admin
    let rangeAdmin: &PriceRangeOracle.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.oracleAdmin = signer.storage.borrow<&PriceOracle.Admin>(
            from: PriceOracle.AdminStoragePath
        ) ?? panic("Could not borrow PriceOracle Admin")

        self.rangeAdmin = signer.storage.borrow<&PriceRangeOracle.Admin>(
            from: PriceRangeOracle.AdminStoragePath
        ) ?? panic("Could not borrow PriceRangeOracle Admin")
    }

    execute {
        self.oracleAdmin.pushPrice(price: close, timestamp: timestamp)
        self.rangeAdmin.pushRange(high: high, low: low)
    }
}
`;

// ── Price Formatting ────────────────────────────────────────────────────────

/** Format a number as a Cadence UFix64 string (8 decimal places). */
function toUFix64(value: number): string {
  return value.toFixed(8);
}

// ── Push Price Range to Oracle ──────────────────────────────────────────────

async function pushPriceRange(high: number, low: number, close: number, timestamp: number): Promise<void> {
  if (isPushing) {
    // Check for stuck push — if it's been running longer than PUSH_TIMEOUT_MS, force-reset
    if (Date.now() - pushStartTime > PUSH_TIMEOUT_MS) {
      console.warn(`[Oracle] Push stuck for ${((Date.now() - pushStartTime) / 1000).toFixed(0)}s, force-resetting`);
      isPushing = false;
    } else {
      return;
    }
  }
  isPushing = true;
  pushStartTime = Date.now();

  try {
    const result = await sendTransaction(
      PUSH_PRICE_RANGE_CDC,
      (arg: typeof fcl.arg) => [
        arg(toUFix64(high), t.UFix64),
        arg(toUFix64(low), t.UFix64),
        arg(toUFix64(close), t.UFix64),
        arg(toUFix64(timestamp), t.UFix64),
      ]
    );
    console.log(`[Oracle] Pushed H=$${high.toFixed(2)} L=$${low.toFixed(2)} C=$${close.toFixed(2)} (tx: ${result.txId.slice(0, 8)}...)`);
    lastPushTime = Date.now();
  } catch (err: any) {
    // Only log meaningful errors, not "keys busy"
    if (!err.message.includes("keys are busy")) {
      console.error(`[Oracle] Push failed: ${err.message.slice(0, 200)}`);
    }
  } finally {
    isPushing = false;
  }
}

// ── Binance WebSocket ───────────────────────────────────────────────────────

function connectBinance() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  console.log("[Oracle] Connecting to Binance WS...");
  ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@aggTrade");

  ws.on("open", () => {
    console.log("[Oracle] Binance WS connected");
    lastPriceUpdateTime = Date.now();
  });

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const trade = JSON.parse(data.toString());
      const price = parseFloat(trade.p);
      latestPrice = price;
      lastPriceUpdateTime = Date.now();

      // Track high/low for this interval
      if (intervalHigh === 0) {
        // First price after reset or startup
        intervalHigh = price;
        intervalLow = price;
      } else {
        trackPrice(price);
      }

      // Push at interval, only if not already pushing
      const now = Date.now();
      if (now - lastPushTime >= PUSH_INTERVAL_MS && !isPushing) {
        const timestamp = Math.floor(trade.T / 1000);
        const pushHigh = intervalHigh;
        const pushLow = intervalLow;
        const pushClose = price;
        // Reset interval tracking for next window
        resetInterval();
        pushPriceRange(pushHigh, pushLow, pushClose, timestamp);
      }
    } catch {}
  });

  ws.on("close", () => {
    console.log("[Oracle] Binance WS disconnected, reconnecting in 3s...");
    ws = null;
    scheduleReconnect();
  });

  ws.on("error", (err: Error) => {
    console.error(`[Oracle] WS error: ${err.message}`);
    try { ws?.close(); } catch {}
    ws = null;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBinance();
  }, 3000);
}

// ── Watchdog ────────────────────────────────────────────────────────────────
// Periodically checks for stale state and auto-recovers.

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    const now = Date.now();

    // Check if WebSocket has gone silent (connected but no messages)
    if (lastPriceUpdateTime > 0 && now - lastPriceUpdateTime > STALE_WS_MS) {
      console.warn(`[Oracle] No WS message for ${((now - lastPriceUpdateTime) / 1000).toFixed(0)}s, forcing reconnect`);
      lastPriceUpdateTime = now; // Prevent spam
      try { ws?.close(); } catch {}
      ws = null;
      scheduleReconnect();
    }

    // Check if isPushing is stuck
    if (isPushing && now - pushStartTime > PUSH_TIMEOUT_MS) {
      console.warn(`[Oracle] Watchdog: push stuck for ${((now - pushStartTime) / 1000).toFixed(0)}s, force-resetting`);
      isPushing = false;
    }
  }, 5000);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startOracleUpdater() {
  connectBinance();
  startWatchdog();
}

export function stopOracleUpdater() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

export function getLatestBinancePrice(): number {
  return latestPrice;
}

export function getOracleHealth(): { price: number; lastPushMs: number; stale: boolean } {
  return {
    price: latestPrice,
    lastPushMs: Date.now() - lastPushTime,
    stale: Date.now() - lastPushTime > 30000,
  };
}
