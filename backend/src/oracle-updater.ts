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

// ── Cadence Templates ───────────────────────────────────────────────────────

const PUSH_PRICE_CDC = `
import PriceOracle from 0xPriceOracle

transaction(price: UFix64, timestamp: UFix64) {
    let admin: &PriceOracle.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PriceOracle.Admin>(
            from: PriceOracle.AdminStoragePath
        ) ?? panic("Could not borrow PriceOracle Admin")
    }

    execute {
        self.admin.pushPrice(price: price, timestamp: timestamp)
    }
}
`;

// ── Price Formatting ────────────────────────────────────────────────────────

/** Format a number as a Cadence UFix64 string (8 decimal places). */
function toUFix64(value: number): string {
  return value.toFixed(8);
}

// ── Push Price to Oracle ────────────────────────────────────────────────────

async function pushPrice(price: number, timestamp: number): Promise<void> {
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
      PUSH_PRICE_CDC,
      (arg: typeof fcl.arg) => [
        arg(toUFix64(price), t.UFix64),
        arg(toUFix64(timestamp), t.UFix64),
      ]
    );
    console.log(`[Oracle] Pushed $${price.toFixed(2)} (tx: ${result.txId.slice(0, 8)}...)`);
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
      latestPrice = parseFloat(trade.p);
      lastPriceUpdateTime = Date.now();

      // Push at interval, only if not already pushing
      const now = Date.now();
      if (now - lastPushTime >= PUSH_INTERVAL_MS && !isPushing) {
        const timestamp = Math.floor(trade.T / 1000);
        pushPrice(latestPrice, timestamp);
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
