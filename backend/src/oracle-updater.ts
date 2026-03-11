import WebSocket from "ws";
import { sendTransaction, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetSymbol = "btc" | "flow";

interface OracleUpdaterState {
  latestPrice: number;
  lastPushTime: number;
  lastPriceUpdateTime: number;
  isPushing: boolean;
  pushStartTime: number;
  intervalHigh: number;
  intervalLow: number;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  watchdogTimer: ReturnType<typeof setInterval> | null;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
}

interface OracleConfig {
  symbol: AssetSymbol;
  wsUrl: string;
  pushCadence: string;
  label: string;
  staleWsMs: number; // per-asset watchdog timeout
}

// ── Constants ──────────────────────────────────────────────────────────────

const PUSH_INTERVAL_MS = 4000;
const PUSH_TIMEOUT_MS = 30000;
/** Re-push the last known price if no trade-triggered push has happened within this window.
 *  Keeps the oracle fresh for low-volume pairs like FLOW/USDT. */
const KEEP_ALIVE_PUSH_MS = 10000;

// ── Per-asset state ────────────────────────────────────────────────────────

const updaters: Map<AssetSymbol, OracleUpdaterState> = new Map();

// ── Cadence Templates ──────────────────────────────────────────────────────

const PUSH_PRICE_RANGE_BTC = `
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

const PUSH_PRICE_RANGE_FLOW = `
import FlowPriceOracle from 0xFlowPriceOracle
import FlowPriceRangeOracle from 0xFlowPriceRangeOracle

transaction(high: UFix64, low: UFix64, close: UFix64, timestamp: UFix64) {
    let oracleAdmin: &FlowPriceOracle.Admin
    let rangeAdmin: &FlowPriceRangeOracle.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.oracleAdmin = signer.storage.borrow<&FlowPriceOracle.Admin>(
            from: FlowPriceOracle.AdminStoragePath
        ) ?? panic("Could not borrow FlowPriceOracle Admin")

        self.rangeAdmin = signer.storage.borrow<&FlowPriceRangeOracle.Admin>(
            from: FlowPriceRangeOracle.AdminStoragePath
        ) ?? panic("Could not borrow FlowPriceRangeOracle Admin")
    }

    execute {
        self.oracleAdmin.pushPrice(price: close, timestamp: timestamp)
        self.rangeAdmin.pushRange(high: high, low: low)
    }
}
`;

const ASSET_CONFIGS: Record<AssetSymbol, OracleConfig> = {
  btc: {
    symbol: "btc",
    wsUrl: "wss://stream.binance.com:9443/ws/btcusdt@aggTrade",
    pushCadence: PUSH_PRICE_RANGE_BTC,
    label: "BTC",
    staleWsMs: 15000, // BTC trades every ~50ms, 15s means something is wrong
  },
  flow: {
    symbol: "flow",
    wsUrl: "wss://stream.binance.com:9443/ws/flowusdt@aggTrade",
    pushCadence: PUSH_PRICE_RANGE_FLOW,
    label: "FLOW",
    staleWsMs: 120000, // FLOW/USDT is low volume, trades can be minutes apart
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function toUFix64(value: number): string {
  return value.toFixed(8);
}

function createState(): OracleUpdaterState {
  return {
    latestPrice: 0,
    lastPushTime: 0,
    lastPriceUpdateTime: 0,
    isPushing: false,
    pushStartTime: 0,
    intervalHigh: 0,
    intervalLow: Infinity,
    ws: null,
    reconnectTimer: null,
    watchdogTimer: null,
    keepAliveTimer: null,
  };
}

function resetInterval(state: OracleUpdaterState) {
  state.intervalHigh = state.latestPrice;
  state.intervalLow = state.latestPrice;
}

function trackPrice(state: OracleUpdaterState, price: number) {
  if (price > state.intervalHigh) state.intervalHigh = price;
  if (price < state.intervalLow) state.intervalLow = price;
}

// ── Push Price Range to Oracle ──────────────────────────────────────────────

async function pushPriceRange(
  config: OracleConfig,
  state: OracleUpdaterState,
  high: number,
  low: number,
  close: number,
  timestamp: number
): Promise<void> {
  if (state.isPushing) {
    if (Date.now() - state.pushStartTime > PUSH_TIMEOUT_MS) {
      console.warn(`[Oracle:${config.label}] Push stuck for ${((Date.now() - state.pushStartTime) / 1000).toFixed(0)}s, force-resetting`);
      state.isPushing = false;
    } else {
      return;
    }
  }
  state.isPushing = true;
  state.pushStartTime = Date.now();

  try {
    const result = await sendTransaction(
      config.pushCadence,
      (arg: typeof fcl.arg) => [
        arg(toUFix64(high), t.UFix64),
        arg(toUFix64(low), t.UFix64),
        arg(toUFix64(close), t.UFix64),
        arg(toUFix64(timestamp), t.UFix64),
      ]
    );
    console.log(`[Oracle:${config.label}] Pushed H=$${high.toFixed(2)} L=$${low.toFixed(2)} C=$${close.toFixed(2)} (tx: ${result.txId.slice(0, 8)}...)`);
    state.lastPushTime = Date.now();
  } catch (err: any) {
    if (!err.message.includes("keys are busy")) {
      console.error(`[Oracle:${config.label}] Push failed: ${err.message.slice(0, 200)}`);
    }
  } finally {
    state.isPushing = false;
  }
}

// ── Binance WebSocket ───────────────────────────────────────────────────────

function connectBinance(config: OracleConfig, state: OracleUpdaterState) {
  if (state.ws) {
    try { state.ws.close(); } catch {}
    state.ws = null;
  }

  console.log(`[Oracle:${config.label}] Connecting to Binance WS...`);
  state.ws = new WebSocket(config.wsUrl);

  state.ws.on("open", () => {
    console.log(`[Oracle:${config.label}] Binance WS connected`);
    state.lastPriceUpdateTime = Date.now();
  });

  state.ws.on("message", (data: WebSocket.Data) => {
    try {
      const trade = JSON.parse(data.toString());
      const price = parseFloat(trade.p);
      state.latestPrice = price;
      state.lastPriceUpdateTime = Date.now();

      if (state.intervalHigh === 0) {
        state.intervalHigh = price;
        state.intervalLow = price;
      } else {
        trackPrice(state, price);
      }

      const now = Date.now();
      if (now - state.lastPushTime >= PUSH_INTERVAL_MS && !state.isPushing) {
        const timestamp = Math.floor(trade.T / 1000);
        const pushHigh = state.intervalHigh;
        const pushLow = state.intervalLow;
        const pushClose = price;
        resetInterval(state);
        pushPriceRange(config, state, pushHigh, pushLow, pushClose, timestamp);
      }
    } catch {}
  });

  state.ws.on("close", () => {
    console.log(`[Oracle:${config.label}] Binance WS disconnected, reconnecting in 3s...`);
    state.ws = null;
    scheduleReconnect(config, state);
  });

  state.ws.on("error", (err: Error) => {
    console.error(`[Oracle:${config.label}] WS error: ${err.message}`);
    try { state.ws?.close(); } catch {}
    state.ws = null;
    scheduleReconnect(config, state);
  });
}

function scheduleReconnect(config: OracleConfig, state: OracleUpdaterState) {
  if (state.reconnectTimer) return;
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connectBinance(config, state);
  }, 3000);
}

// ── Watchdog ────────────────────────────────────────────────────────────────

function startWatchdog(config: OracleConfig, state: OracleUpdaterState) {
  if (state.watchdogTimer) return;
  state.watchdogTimer = setInterval(() => {
    const now = Date.now();

    if (state.lastPriceUpdateTime > 0 && now - state.lastPriceUpdateTime > config.staleWsMs) {
      console.warn(`[Oracle:${config.label}] No WS message for ${((now - state.lastPriceUpdateTime) / 1000).toFixed(0)}s, forcing reconnect`);
      state.lastPriceUpdateTime = now;
      try { state.ws?.close(); } catch {}
      state.ws = null;
      scheduleReconnect(config, state);
    }

    if (state.isPushing && now - state.pushStartTime > PUSH_TIMEOUT_MS) {
      console.warn(`[Oracle:${config.label}] Watchdog: push stuck for ${((now - state.pushStartTime) / 1000).toFixed(0)}s, force-resetting`);
      state.isPushing = false;
    }
  }, 5000);
}

// ── Public API ──────────────────────────────────────────────────────────────

// ── Keep-Alive Push ─────────────────────────────────────────────────────
// For low-volume pairs, re-push the last known price so the oracle doesn't go stale.

function startKeepAlive(config: OracleConfig, state: OracleUpdaterState) {
  if (state.keepAliveTimer) return;
  state.keepAliveTimer = setInterval(() => {
    if (state.latestPrice === 0 || state.isPushing) return;
    const sincePush = Date.now() - state.lastPushTime;
    if (sincePush < KEEP_ALIVE_PUSH_MS) return;

    const price = state.latestPrice;
    const high = state.intervalHigh || price;
    const low = state.intervalLow === Infinity ? price : state.intervalLow;
    const timestamp = Math.floor(Date.now() / 1000);
    resetInterval(state);
    pushPriceRange(config, state, high, low, price, timestamp);
  }, KEEP_ALIVE_PUSH_MS);
}

export function startOracleUpdater(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : ["btc", "flow"];
  for (const sym of symbols) {
    const config = ASSET_CONFIGS[sym];
    const state = createState();
    updaters.set(sym, state);
    connectBinance(config, state);
    startWatchdog(config, state);
    startKeepAlive(config, state);
    console.log(`[Oracle:${config.label}] Updater started`);
  }
}

export function stopOracleUpdater(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : (Array.from(updaters.keys()) as AssetSymbol[]);
  for (const sym of symbols) {
    const state = updaters.get(sym);
    if (!state) continue;
    if (state.ws) {
      try { state.ws.close(); } catch {}
      state.ws = null;
    }
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.watchdogTimer) {
      clearInterval(state.watchdogTimer);
      state.watchdogTimer = null;
    }
    if (state.keepAliveTimer) {
      clearInterval(state.keepAliveTimer);
      state.keepAliveTimer = null;
    }
    updaters.delete(sym);
  }
}

export function getLatestPrice(symbol: AssetSymbol = "btc"): number {
  return updaters.get(symbol)?.latestPrice ?? 0;
}

export function getOracleHealth(symbol: AssetSymbol = "btc"): { price: number; lastPushMs: number; stale: boolean } {
  const state = updaters.get(symbol);
  if (!state) {
    return { price: 0, lastPushMs: 0, stale: true };
  }
  return {
    price: state.latestPrice,
    lastPushMs: Date.now() - state.lastPushTime,
    stale: Date.now() - state.lastPushTime > 30000,
  };
}

// Backward compat — kept for any code that still calls the old name
export function getLatestBinancePrice(): number {
  return getLatestPrice("btc");
}
