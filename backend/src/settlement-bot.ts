import { sendTransaction, executeScript, getTotalKeys, fcl } from "./flow-client.js";
import * as t from "@onflow/types";
import type { AssetSymbol } from "./oracle-updater.js";

const POLL_INTERVAL_MS = 10000;

// ── Per-asset state ─────────────────────────────────────────────────────────

interface SettlementBotState {
  interval: ReturnType<typeof setInterval> | null;
  isSettling: boolean;
  consecutiveFailures: number;
}

const bots: Map<AssetSymbol, SettlementBotState> = new Map();

// ── Cadence Templates ───────────────────────────────────────────────────────

const TEMPLATES: Record<AssetSymbol, { listUnsettled: string; settle: string; label: string }> = {
  btc: {
    label: "BTC",
    listUnsettled: `
import PredictionGame from 0xPredictionGame

access(all) fun main(): [PredictionGame.Position] {
    let currentBlock = getCurrentBlock().height
    let totalPositions = PredictionGame.getPositionCount()
    var expired: [PredictionGame.Position] = []

    var id: UInt64 = 1
    while id <= totalPositions {
        if let position = PredictionGame.getPosition(positionId: id) {
            if !position.settled && currentBlock >= position.expiryBlock + 30 {
                expired.append(position)
            }
        }
        id = id + 1
    }

    return expired
}
`,
    settle: `
import PredictionGame from 0xPredictionGame

transaction(positionId: UInt64) {
    let admin: &PredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&PredictionGame.Admin>(
            from: PredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow PredictionGame Admin")
    }

    execute {
        self.admin.settlePosition(positionId: positionId)
    }
}
`,
  },
  flow: {
    label: "FLOW",
    listUnsettled: `
import FlowPredictionGame from 0xFlowPredictionGame

access(all) fun main(): [FlowPredictionGame.Position] {
    let currentBlock = getCurrentBlock().height
    let totalPositions = FlowPredictionGame.getPositionCount()
    var expired: [FlowPredictionGame.Position] = []

    var id: UInt64 = 1
    while id <= totalPositions {
        if let position = FlowPredictionGame.getPosition(positionId: id) {
            if !position.settled && currentBlock >= position.expiryBlock + 30 {
                expired.append(position)
            }
        }
        id = id + 1
    }

    return expired
}
`,
    settle: `
import FlowPredictionGame from 0xFlowPredictionGame

transaction(positionId: UInt64) {
    let admin: &FlowPredictionGame.Admin

    prepare(signer: auth(BorrowValue) &Account) {
        self.admin = signer.storage.borrow<&FlowPredictionGame.Admin>(
            from: FlowPredictionGame.AdminStoragePath
        ) ?? panic("Could not borrow FlowPredictionGame Admin")
    }

    execute {
        self.admin.settlePosition(positionId: positionId)
    }
}
`,
  },
};

// ── Settlement Logic ────────────────────────────────────────────────────────

async function settleExpiredPositions(symbol: AssetSymbol) {
  const state = bots.get(symbol);
  if (!state || state.isSettling) return;

  // Back off when keys are consistently busy — skip every other poll per failure streak
  if (state.consecutiveFailures > 0) {
    const skipChance = Math.min(state.consecutiveFailures, 5);
    // Skip this poll with increasing probability: 1/2, 2/3, 3/4, 4/5, 5/6
    if (Math.random() < skipChance / (skipChance + 1)) return;
  }

  state.isSettling = true;

  const tmpl = TEMPLATES[symbol];

  try {
    const positions = await executeScript(tmpl.listUnsettled);

    if (!positions || positions.length === 0) return;

    // Reserve keys for oracle pushes — each settlement bot gets a smaller slice
    // so they don't starve each other or the oracle updaters.
    const numBots = bots.size || 1;
    const maxParallel = Math.max(1, Math.floor(getTotalKeys() / (numBots + 2)));
    const batch = positions.slice(0, maxParallel);

    console.log(`[Settlement:${tmpl.label}] Found ${positions.length} expired, settling ${batch.length} in parallel (${maxParallel} slots)`);

    let anySuccess = false;
    const settlements = batch.map(async (pos: any) => {
      try {
        const posId = pos.id;
        const result = await sendTransaction(
          tmpl.settle,
          (arg: typeof fcl.arg) => [arg(posId.toString(), t.UInt64)],
          { waitForKey: true }
        );

        anySuccess = true;
        const settledEvent = result.events.find(
          (e: any) => e.type.includes("PositionSettled")
        );
        if (settledEvent?.data) {
          const d = settledEvent.data;
          const wonStr = d.won ? "WON" : "LOST";
          console.log(
            `[Settlement:${tmpl.label}] #${posId} ${wonStr} | ` +
            `owner=${d.owner} stake=$${d.stake} payout=$${d.payout} ` +
            `multiplier=${d.multiplier}x | ` +
            `entry=$${d.entryPrice} target=$${d.targetPrice} ` +
            `above=${d.aboveTarget} touched=$${d.touchedPrice ?? "none"} | ` +
            `blocks=${d.entryBlock}-${d.expiryBlock} oraclePrices=${d.oraclePriceCount}`
          );
        } else {
          console.log(`[Settlement:${tmpl.label}] Position ${posId}: settled (no event data)`);
        }
      } catch (err: any) {
        console.error(`[Settlement:${tmpl.label}] Failed position ${pos.id}: ${err.message.slice(0, 150)}`);
      }
    });

    await Promise.all(settlements);
    if (anySuccess) {
      state.consecutiveFailures = 0;
    } else {
      state.consecutiveFailures++;
    }
  } catch (err: any) {
    console.error(`[Settlement:${tmpl.label}] Poll error: ${err.message.slice(0, 150)}`);
  } finally {
    state.isSettling = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startSettlementBot(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : ["btc", "flow"];
  for (const sym of symbols) {
    const label = TEMPLATES[sym].label;
    console.log(`[Settlement:${label}] Bot started, polling every 10s`);
    const state: SettlementBotState = { interval: null, isSettling: false, consecutiveFailures: 0 };
    bots.set(sym, state);
    settleExpiredPositions(sym);
    state.interval = setInterval(() => settleExpiredPositions(sym), POLL_INTERVAL_MS);
  }
}

export function stopSettlementBot(symbol?: AssetSymbol) {
  const symbols: AssetSymbol[] = symbol ? [symbol] : (Array.from(bots.keys()) as AssetSymbol[]);
  for (const sym of symbols) {
    const state = bots.get(sym);
    if (state?.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    bots.delete(sym);
  }
}
