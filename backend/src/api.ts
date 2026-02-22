import express from "express";
import cors from "cors";
import elliptic from "elliptic";
const EC = elliptic.ec;
import { SHA3 } from "sha3";
import * as t from "@onflow/types";
import { getMultiplier } from "./multiplier.js";
import { getLatestBinancePrice, getOracleHealth } from "./oracle-updater.js";
import { executeScript, sendTransaction, ADMIN_ADDRESS, fcl } from "./flow-client.js";

const ec = new EC("p256");
const ADMIN_PRIVATE_KEY = process.env.FLOW_ADMIN_PRIVATE_KEY!;

// ── Cadence Scripts ─────────────────────────────────────────────────────────

const GET_POSITIONS_CDC = `
import PredictionGame from 0xPredictionGame

access(all) fun main(address: Address): [PredictionGame.Position] {
    return PredictionGame.listUserPositions(address: address)
}
`;

const GET_HOUSE_BALANCE_CDC = `
import PredictionGame from 0xPredictionGame

access(all) fun main(): UFix64 {
    return PredictionGame.getHouseBalance()
}
`;

// ── Signing Helper ──────────────────────────────────────────────────────────

function signMessage(message: string): string {
  const key = ec.keyFromPrivate(Buffer.from(ADMIN_PRIVATE_KEY, "hex"));
  const sha3 = new SHA3(256);
  sha3.update(Buffer.from(message, "hex"));
  const digest = sha3.digest();
  const sig = key.sign(digest);
  const r = sig.r.toArrayLike(Buffer, "be", 32);
  const s = sig.s.toArrayLike(Buffer, "be", 32);
  return Buffer.concat([r, s]).toString("hex");
}

// ── Express App ─────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── POST /api/sign-bet ──────────────────────────────────────────────────
  // Frontend calls this before building the multi-auth transaction.
  // Returns the computed parameters the frontend needs.
  app.post("/api/sign-bet", (req, res) => {
    try {
      const { targetPrice, priceTop, priceBottom, aboveTarget, betSize, rowDist, colDist } = req.body;

      // Validate inputs
      if (!targetPrice || betSize === undefined || rowDist === undefined || colDist === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (betSize <= 0) {
        return res.status(400).json({ error: "betSize must be positive" });
      }
      if (targetPrice <= 0) {
        return res.status(400).json({ error: "targetPrice must be positive" });
      }

      // Get current Binance price as the entry price
      const entryPrice = getLatestBinancePrice();
      if (entryPrice === 0) {
        return res.status(503).json({ error: "Oracle not ready, no Binance price available" });
      }

      // Compute multiplier (same formula as frontend)
      const multiplier = getMultiplier(rowDist, colDist);

      // Convert column distance to duration in blocks
      // Each column = 5 seconds, each block ≈ 1.2 seconds
      const durationSeconds = colDist * 5;
      const durationBlocks = Math.ceil(durationSeconds / 1.2);
      const expiryTimestamp = Math.floor(Date.now() / 1000) + durationSeconds;

      return res.json({
        entryPrice,
        multiplier: Math.round(multiplier * 100) / 100, // Round to 2 decimals
        durationBlocks,
        expiryTimestamp,
        aboveTarget: aboveTarget ?? (targetPrice > entryPrice),
      });
    } catch (err: any) {
      console.error("[API] sign-bet error:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/sign ──────────────────────────────────────────────────────
  // Called by FCL's serverAuthorization function from the frontend.
  // Signs the transaction message with the admin private key.
  app.post("/api/sign", (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message" });
      }

      const signature = signMessage(message);

      return res.json({
        addr: fcl.withPrefix(ADMIN_ADDRESS),
        keyId: 0, // TODO: key rotation for multi-auth
        signature,
      });
    } catch (err: any) {
      console.error("[API] sign error:", err.message);
      return res.status(500).json({ error: "Signing failed" });
    }
  });

  // ── POST /api/fund-account ─────────────────────────────────────────────
  // Sends a small amount of FLOW to a user address so they have storage capacity.
  const fundedAccounts = new Set<string>();

  app.post("/api/fund-account", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: "Missing address" });
      }

      // Only fund each account once per backend session
      if (fundedAccounts.has(address)) {
        return res.json({ status: "already_funded" });
      }

      // Check if account already has enough FLOW for storage
      try {
        const account = await fcl.account(address);
        const balanceFlow = Number(account.balance) / 100_000_000;
        if (balanceFlow >= 10) {
          fundedAccounts.add(address);
          return res.json({ status: "already_funded", balance: balanceFlow });
        }
      } catch {
        // Account might not exist yet, try funding anyway
      }

      // Send 0.1 FLOW from admin to user
      const FUND_ACCOUNT_CDC = `
        transaction(recipient: Address, amount: UFix64) {
            prepare(signer: auth(BorrowValue) &Account) {
                let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
                    from: /storage/flowTokenVault
                ) ?? panic("Could not borrow FlowToken vault")
                let sentVault <- vaultRef.withdraw(amount: amount)
                let receiverRef = getAccount(recipient)
                    .capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
                    .borrow() ?? panic("Could not borrow receiver")
                receiverRef.deposit(from: <-sentVault)
            }
        }
        import FungibleToken from 0xFungibleToken
        import FlowToken from 0xFlowToken
      `;

      // Flow Cadence requires imports at the top — restructure
      const FUND_CDC = `
import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868

transaction(recipient: Address, amount: UFix64) {
    prepare(signer: auth(BorrowValue) &Account) {
        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("Could not borrow FlowToken vault")
        let sentVault <- vaultRef.withdraw(amount: amount)
        let receiverRef = getAccount(recipient)
            .capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            .borrow() ?? panic("Could not borrow receiver")
        receiverRef.deposit(from: <-sentVault)
    }
}
      `;

      console.log(`[API] Funding account ${address} with 100 FLOW...`);
      const result = await sendTransaction(
        FUND_CDC,
        (arg: typeof fcl.arg) => [
          arg(address, t.Address),
          arg("100.00000000", t.UFix64),
        ],
        { waitForKey: true }
      );

      fundedAccounts.add(address);
      console.log(`[API] Funded account ${address}, txId: ${result.txId}`);
      return res.json({ status: "funded", txId: result.txId });
    } catch (err: any) {
      console.error("[API] fund-account error:", err.message);
      return res.status(500).json({ error: "Failed to fund account" });
    }
  });

  // ── GET /api/price ──────────────────────────────────────────────────────
  app.get("/api/price", (_req, res) => {
    const health = getOracleHealth();
    return res.json({
      price: health.price,
      stale: health.stale,
      lastPushMs: health.lastPushMs,
    });
  });

  // ── GET /api/positions/:address ─────────────────────────────────────────
  app.get("/api/positions/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const positions = await executeScript(GET_POSITIONS_CDC, (arg: typeof fcl.arg, t: any) => [
        arg(address, t.Address),
      ]);
      return res.json({ positions: positions || [] });
    } catch (err: any) {
      console.error("[API] positions error:", err.message);
      return res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // ── GET /api/house-balance ──────────────────────────────────────────────
  app.get("/api/house-balance", async (_req, res) => {
    try {
      const balance = await executeScript(GET_HOUSE_BALANCE_CDC);
      return res.json({ balance });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch house balance" });
    }
  });

  // ── GET /api/health ─────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    const oracle = getOracleHealth();
    return res.json({
      status: oracle.stale ? "degraded" : "healthy",
      oracle,
      adminAddress: ADMIN_ADDRESS,
    });
  });

  return app;
}
