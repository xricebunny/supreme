import { sendTransaction, executeScript, fcl } from "./flow-client.js";
import * as t from "@onflow/types";

const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds
const LOW_BALANCE_THRESHOLD = 10_000; // Fund when below 10k PYUSD
const FUND_AMOUNT = 100_000; // Mint + deposit 100k PYUSD each time
let interval: ReturnType<typeof setInterval> | null = null;
let isFunding = false;

// ── Cadence Templates ───────────────────────────────────────────────────────

const GET_HOUSE_BALANCE_CDC = `
import PredictionGame from 0xPredictionGame

access(all) fun main(): UFix64 {
    return PredictionGame.getHouseBalance()
}
`;

const MINT_AND_FUND_HOUSE_CDC = `
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
`;

// ── Funding Logic ───────────────────────────────────────────────────────────

async function checkAndFundHouse() {
  if (isFunding) return;
  isFunding = true;

  try {
    const balanceStr = await executeScript(GET_HOUSE_BALANCE_CDC);
    const balance = parseFloat(balanceStr);

    if (isNaN(balance)) {
      console.error("[HouseFunder] Could not parse house balance:", balanceStr);
      return;
    }

    if (balance < LOW_BALANCE_THRESHOLD) {
      console.log(`[HouseFunder] House balance low ($${balance.toFixed(2)}), minting $${FUND_AMOUNT} PYUSD...`);

      const result = await sendTransaction(
        MINT_AND_FUND_HOUSE_CDC,
        (arg: typeof fcl.arg) => [
          arg(FUND_AMOUNT.toFixed(8), t.UFix64),
        ],
        { waitForKey: true }
      );

      console.log(`[HouseFunder] Funded house with $${FUND_AMOUNT} (tx: ${result.txId.slice(0, 8)}...)`);
    }
  } catch (err: any) {
    console.error(`[HouseFunder] Error: ${err.message.slice(0, 200)}`);
  } finally {
    isFunding = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function startHouseFunder() {
  console.log(`[HouseFunder] Started, checking every ${CHECK_INTERVAL_MS / 1000}s (threshold: $${LOW_BALANCE_THRESHOLD})`);
  checkAndFundHouse(); // Run immediately
  interval = setInterval(checkAndFundHouse, CHECK_INTERVAL_MS);
}

export function stopHouseFunder() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
