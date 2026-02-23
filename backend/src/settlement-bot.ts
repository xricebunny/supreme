import { sendTransaction, executeScript, getTotalKeys, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

const POLL_INTERVAL_MS = 10000; // Check every 10 seconds
let interval: ReturnType<typeof setInterval> | null = null;
let isSettling = false; // Prevent overlapping cycles

// ── Cadence Templates ───────────────────────────────────────────────────────

const LIST_UNSETTLED_CDC = `
import PredictionGame from 0xPredictionGame

access(all) fun main(): [PredictionGame.Position] {
    let currentBlock = getCurrentBlock().height
    let totalPositions = PredictionGame.getPositionCount()
    var expired: [PredictionGame.Position] = []

    var id: UInt64 = 1
    while id <= totalPositions {
        if let position = PredictionGame.getPosition(positionId: id) {
            if !position.settled && currentBlock >= position.expiryBlock {
                expired.append(position)
            }
        }
        id = id + 1
    }

    return expired
}
`;

const SETTLE_POSITION_CDC = `
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
`;

// ── Settlement Logic ────────────────────────────────────────────────────────

async function settleExpiredPositions() {
  if (isSettling) return; // Previous cycle still running
  isSettling = true;

  try {
    const positions = await executeScript(LIST_UNSETTLED_CDC);

    if (!positions || positions.length === 0) return;

    // Reserve half the keys for settlement, leave the rest for oracle + bet signing
    const maxParallel = Math.max(1, Math.floor(getTotalKeys() / 2));
    const batch = positions.slice(0, maxParallel);

    console.log(`[Settlement] Found ${positions.length} expired, settling ${batch.length} in parallel (${maxParallel} slots)`);

    // Settle in parallel — key rotation pool handles assignment
    const settlements = batch.map(async (pos: any) => {
      try {
        const posId = pos.id;
        const result = await sendTransaction(
          SETTLE_POSITION_CDC,
          (arg: typeof fcl.arg) => [arg(posId.toString(), t.UInt64)],
          { waitForKey: true }
        );

        const settledEvent = result.events.find(
          (e: any) => e.type.includes("PositionSettled")
        );
        if (settledEvent?.data) {
          const d = settledEvent.data;
          const wonStr = d.won ? "WON" : "LOST";
          console.log(
            `[Settlement] #${posId} ${wonStr} | ` +
            `owner=${d.owner} stake=$${d.stake} payout=$${d.payout} ` +
            `multiplier=${d.multiplier}x | ` +
            `entry=$${d.entryPrice} target=$${d.targetPrice} ` +
            `above=${d.aboveTarget} touched=$${d.touchedPrice ?? "none"} | ` +
            `blocks=${d.entryBlock}-${d.expiryBlock} oraclePrices=${d.oraclePriceCount}`
          );
        } else {
          console.log(`[Settlement] Position ${posId}: settled (no event data)`);
        }
      } catch (err: any) {
        console.error(`[Settlement] Failed position ${pos.id}: ${err.message.slice(0, 150)}`);
      }
    });

    await Promise.all(settlements);
  } catch (err: any) {
    console.error(`[Settlement] Poll error: ${err.message.slice(0, 150)}`);
  } finally {
    isSettling = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startSettlementBot() {
  console.log("[Settlement] Bot started, polling every 10s");
  // Run immediately once
  settleExpiredPositions();
  interval = setInterval(settleExpiredPositions, POLL_INTERVAL_MS);
}

export function stopSettlementBot() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
