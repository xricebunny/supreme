import { sendTransaction, executeScript, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
let interval: ReturnType<typeof setInterval> | null = null;

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
  try {
    const positions = await executeScript(LIST_UNSETTLED_CDC);

    if (!positions || positions.length === 0) return;

    console.log(`[Settlement] Found ${positions.length} expired position(s) to settle`);

    // Settle in parallel (key rotation enables concurrent txs)
    const settlements = positions.map(async (pos: any) => {
      try {
        const posId = pos.id;
        const result = await sendTransaction(
          SETTLE_POSITION_CDC,
          (arg: typeof fcl.arg) => [arg(posId.toString(), t.UInt64)]
        );

        const settledEvent = result.events.find(
          (e: any) => e.type.includes("PositionSettled")
        );
        const won = settledEvent?.data?.won ?? "unknown";
        const payout = settledEvent?.data?.payout ?? "0";
        console.log(`[Settlement] Position ${posId}: won=${won}, payout=${payout}`);
      } catch (err: any) {
        console.error(`[Settlement] Failed to settle position ${pos.id}: ${err.message}`);
      }
    });

    await Promise.all(settlements);
  } catch (err: any) {
    console.error(`[Settlement] Poll error: ${err.message}`);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startSettlementBot() {
  console.log("[Settlement] Bot started, polling every 5s");
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
