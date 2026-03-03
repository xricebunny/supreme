import { sendTransaction, executeScript, fcl } from "./flow-client.js";
import * as t from "@onflow/types";
import type { AssetSymbol } from "./oracle-updater.js";

const CHECK_INTERVAL_MS = 60_000;
const LOW_BALANCE_THRESHOLD = 10_000;
const FUND_AMOUNT = 100_000;

// ── Per-asset state ─────────────────────────────────────────────────────────

interface HouseFunderState {
  interval: ReturnType<typeof setInterval> | null;
  isFunding: boolean;
}

const funders: Map<AssetSymbol, HouseFunderState> = new Map();

// ── Cadence Templates ───────────────────────────────────────────────────────

const TEMPLATES: Record<AssetSymbol, { getBalance: string; mintAndFund: string; label: string }> = {
  btc: {
    label: "BTC",
    getBalance: `
import PredictionGame from 0xPredictionGame

access(all) fun main(): UFix64 {
    return PredictionGame.getHouseBalance()
}
`,
    mintAndFund: `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD
import PredictionGame from 0xPredictionGame

transaction(amount: UFix64) {
    let admin: &PredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")
    }

    execute {
        let minted <- MockPYUSD.mint(amount: amount)
        self.admin.fundHouse(from: <-minted)
    }
}
`,
  },
  flow: {
    label: "FLOW",
    getBalance: `
import FlowPredictionGame from 0xFlowPredictionGame

access(all) fun main(): UFix64 {
    return FlowPredictionGame.getHouseBalance()
}
`,
    mintAndFund: `
import FungibleToken from 0xFungibleToken
import MockPYUSD from 0xMockPYUSD
import FlowPredictionGame from 0xFlowPredictionGame

transaction(amount: UFix64) {
    let admin: &FlowPredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&FlowPredictionGame.Admin>(
            from: FlowPredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow FlowPredictionGame Admin")
    }

    execute {
        let minted <- MockPYUSD.mint(amount: amount)
        self.admin.fundHouse(from: <-minted)
    }
}
`,
  },
};

// ── Funding Logic ───────────────────────────────────────────────────────────

async function checkAndFundHouse(symbol: AssetSymbol) {
  const state = funders.get(symbol);
  if (!state || state.isFunding) return;
  state.isFunding = true;

  const tmpl = TEMPLATES[symbol];

  try {
    const balanceStr = await executeScript(tmpl.getBalance);
    const balance = parseFloat(balanceStr);

    if (isNaN(balance)) {
      console.error(`[HouseFunder:${tmpl.label}] Could not parse house balance:`, balanceStr);
      return;
    }

    if (balance < LOW_BALANCE_THRESHOLD) {
      console.log(`[HouseFunder:${tmpl.label}] House balance low ($${balance.toFixed(2)}), minting $${FUND_AMOUNT} PYUSD...`);

      const result = await sendTransaction(
        tmpl.mintAndFund,
        (arg: typeof fcl.arg) => [
          arg(FUND_AMOUNT.toFixed(8), t.UFix64),
        ],
        { waitForKey: true }
      );

      console.log(`[HouseFunder:${tmpl.label}] Funded house with $${FUND_AMOUNT} (tx: ${result.txId.slice(0, 8)}...)`);
    }
  } catch (err: any) {
    console.error(`[HouseFunder:${tmpl.label}] Error: ${err.message.slice(0, 200)}`);
  } finally {
    state.isFunding = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startHouseFunder(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : ["btc", "flow"];
  for (const sym of symbols) {
    const label = TEMPLATES[sym].label;
    console.log(`[HouseFunder:${label}] Started, checking every ${CHECK_INTERVAL_MS / 1000}s (threshold: $${LOW_BALANCE_THRESHOLD})`);
    const state: HouseFunderState = { interval: null, isFunding: false };
    funders.set(sym, state);
    checkAndFundHouse(sym);
    state.interval = setInterval(() => checkAndFundHouse(sym), CHECK_INTERVAL_MS);
  }
}

export function stopHouseFunder(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : (Array.from(funders.keys()) as AssetSymbol[]);
  for (const sym of symbols) {
    const state = funders.get(sym);
    if (state?.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    funders.delete(sym);
  }
}
