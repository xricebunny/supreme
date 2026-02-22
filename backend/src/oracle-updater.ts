import WebSocket from "ws";
import { sendTransaction, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

let latestPrice = 0;
let lastPushTime = 0;
let isPushing = false; // Guard against concurrent pushes
const PUSH_INTERVAL_MS = 4000; // Push every ~4 seconds
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (isPushing) return; // Skip if already pushing
  isPushing = true;

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
  }

  console.log("[Oracle] Connecting to Binance WS...");
  ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@aggTrade");

  ws.on("open", () => {
    console.log("[Oracle] Binance WS connected");
  });

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const trade = JSON.parse(data.toString());
      latestPrice = parseFloat(trade.p);

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
    scheduleReconnect();
  });

  ws.on("error", (err: Error) => {
    console.error(`[Oracle] WS error: ${err.message}`);
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

// ── Public API ──────────────────────────────────────────────────────────────

export function startOracleUpdater() {
  connectBinance();
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
