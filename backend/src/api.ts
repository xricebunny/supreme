import express from "express";
import cors from "cors";
import elliptic from "elliptic";
const EC = elliptic.ec;
import { SHA3 } from "sha3";
import * as t from "@onflow/types";
import { getMultiplier } from "./multiplier.js";
import { getLatestPrice, getOracleHealth, type AssetSymbol } from "./oracle-updater.js";
import { executeScript, sendTransaction, ADMIN_ADDRESS, getTotalKeys, fcl } from "./flow-client.js";

const ec = new EC("p256");
const ADMIN_PRIVATE_KEY = process.env.FLOW_ADMIN_PRIVATE_KEY!;

// ── Validation Helpers ──────────────────────────────────────────────────────

const FLOW_ADDRESS_RE = /^0x[0-9a-fA-F]{16}$/;
const VALID_SYMBOLS = new Set<AssetSymbol>(["btc", "flow"]);

function isValidFlowAddress(addr: string): boolean {
  return typeof addr === "string" && FLOW_ADDRESS_RE.test(addr);
}

function isFinitePositive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function parseSymbol(raw: unknown): AssetSymbol {
  const s = (typeof raw === "string" ? raw.toLowerCase() : "btc") as AssetSymbol;
  return VALID_SYMBOLS.has(s) ? s : "btc";
}

// ── Cadence Scripts (per asset) ─────────────────────────────────────────────

const POSITIONS_CDC: Record<AssetSymbol, string> = {
  btc: `
import PredictionGame from 0xPredictionGame

access(all) fun main(address: Address): [PredictionGame.Position] {
    return PredictionGame.listUserPositions(address: address)
}
`,
  flow: `
import FlowPredictionGame from 0xFlowPredictionGame

access(all) fun main(address: Address): [FlowPredictionGame.Position] {
    return FlowPredictionGame.listUserPositions(address: address)
}
`,
};

const ALL_SETTLED_CDC: Record<AssetSymbol, string> = {
  btc: `
import PredictionGame from 0xPredictionGame

access(all) fun main(): [PredictionGame.Position] {
    let total = PredictionGame.getPositionCount()
    var settled: [PredictionGame.Position] = []
    var id: UInt64 = 1
    while id <= total {
        if let pos = PredictionGame.getPosition(positionId: id) {
            if pos.settled {
                settled.append(pos)
            }
        }
        id = id + 1
    }
    return settled
}
`,
  flow: `
import FlowPredictionGame from 0xFlowPredictionGame

access(all) fun main(): [FlowPredictionGame.Position] {
    let total = FlowPredictionGame.getPositionCount()
    var settled: [FlowPredictionGame.Position] = []
    var id: UInt64 = 1
    while id <= total {
        if let pos = FlowPredictionGame.getPosition(positionId: id) {
            if pos.settled {
                settled.append(pos)
            }
        }
        id = id + 1
    }
    return settled
}
`,
};

const HOUSE_BALANCE_CDC: Record<AssetSymbol, string> = {
  btc: `
import PredictionGame from 0xPredictionGame

access(all) fun main(): UFix64 {
    return PredictionGame.getHouseBalance()
}
`,
  flow: `
import FlowPredictionGame from 0xFlowPredictionGame

access(all) fun main(): UFix64 {
    return FlowPredictionGame.getHouseBalance()
}
`,
};

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
      const { targetPrice, priceTop, priceBottom, aboveTarget, betSize, rowDist, colDist, symbol: rawSymbol } = req.body;
      const symbol = parseSymbol(rawSymbol);

      // ── Type & presence checks ──
      if (!isFinitePositive(targetPrice)) {
        return res.status(400).json({ error: "targetPrice must be a positive number" });
      }
      if (!isFinitePositive(betSize)) {
        return res.status(400).json({ error: "betSize must be a positive number" });
      }
      if (typeof rowDist !== "number" || !Number.isFinite(rowDist) || rowDist < 0) {
        return res.status(400).json({ error: "rowDist must be a non-negative number" });
      }
      if (typeof colDist !== "number" || !Number.isInteger(colDist) || colDist < 1) {
        return res.status(400).json({ error: "colDist must be a positive integer" });
      }
      if (aboveTarget !== undefined && typeof aboveTarget !== "boolean") {
        return res.status(400).json({ error: "aboveTarget must be a boolean" });
      }

      // ── Range bounds ──
      if (betSize > 10_000) {
        return res.status(400).json({ error: "betSize cannot exceed 10,000" });
      }
      if (colDist > 60) {
        return res.status(400).json({ error: "colDist cannot exceed 60 (5 minutes)" });
      }
      if (rowDist > 20) {
        return res.status(400).json({ error: "rowDist cannot exceed 20" });
      }

      // Get current Binance price for the requested asset
      const entryPrice = getLatestPrice(symbol);
      if (entryPrice === 0) {
        return res.status(503).json({ error: `Oracle not ready, no Binance price available for ${symbol.toUpperCase()}` });
      }

      // Sanity: targetPrice shouldn't be wildly far from current price (>50% away)
      const priceDiffPct = Math.abs(targetPrice - entryPrice) / entryPrice;
      if (priceDiffPct > 0.5) {
        return res.status(400).json({ error: "targetPrice too far from current price" });
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
        multiplier: Math.round(multiplier * 100) / 100,
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
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Missing or invalid message" });
      }
      if (!/^[0-9a-fA-F]+$/.test(message)) {
        return res.status(400).json({ error: "Message must be hex-encoded" });
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
  const fundedAccounts = new Set<string>();

  app.post("/api/fund-account", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address || !isValidFlowAddress(address)) {
        return res.status(400).json({ error: "Missing or invalid Flow address (expected 0x + 16 hex chars)" });
      }

      if (fundedAccounts.has(address)) {
        return res.json({ status: "already_funded" });
      }

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
  app.get("/api/price", (req, res) => {
    const symbol = parseSymbol(req.query.symbol);
    const health = getOracleHealth(symbol);
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
      const symbol = parseSymbol(req.query.symbol);
      if (!isValidFlowAddress(address)) {
        return res.status(400).json({ error: "Invalid Flow address" });
      }
      const positions = await executeScript(POSITIONS_CDC[symbol], (arg: typeof fcl.arg, t: any) => [
        arg(address, t.Address),
      ]);
      return res.json({ positions: positions || [] });
    } catch (err: any) {
      console.error("[API] positions error:", err.message);
      return res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // ── GET /api/house-balance ──────────────────────────────────────────────
  app.get("/api/house-balance", async (req, res) => {
    try {
      const symbol = parseSymbol(req.query.symbol);
      const balance = await executeScript(HOUSE_BALANCE_CDC[symbol]);
      return res.json({ balance });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch house balance" });
    }
  });

  // ── GET /api/health ─────────────────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    const symbol = parseSymbol(req.query.symbol);
    const oracle = getOracleHealth(symbol);

    // Also return the other oracle's health for the full picture
    const otherSymbol: AssetSymbol = symbol === "btc" ? "flow" : "btc";
    const otherOracle = getOracleHealth(otherSymbol);

    return res.json({
      status: oracle.stale ? "degraded" : "healthy",
      oracle,
      oracles: {
        btc: symbol === "btc" ? oracle : otherOracle,
        flow: symbol === "flow" ? oracle : otherOracle,
      },
      adminAddress: ADMIN_ADDRESS,
      keys: getTotalKeys(),
    });
  });

  // ── GET /api/leaderboard ──────────────────────────────────────────────
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      // Fetch all settled positions from both contracts in parallel
      const [btcPositions, flowPositions] = await Promise.all([
        executeScript(ALL_SETTLED_CDC.btc).catch(() => []),
        executeScript(ALL_SETTLED_CDC.flow).catch(() => []),
      ]);

      const allPositions = [...(btcPositions || []), ...(flowPositions || [])];

      // Aggregate by owner address
      const userMap: Record<string, {
        address: string;
        totalWagered: number;
        totalPayout: number;
        wins: number;
        losses: number;
      }> = {};

      for (const pos of allPositions) {
        const owner = pos.owner as string;
        if (!userMap[owner]) {
          userMap[owner] = { address: owner, totalWagered: 0, totalPayout: 0, wins: 0, losses: 0 };
        }
        const entry = userMap[owner];
        const stake = parseFloat(pos.stake) || 0;
        const payout = parseFloat(pos.payout) || 0;
        entry.totalWagered += stake;
        if (pos.won === true) {
          entry.wins += 1;
          entry.totalPayout += payout;
        } else {
          entry.losses += 1;
        }
      }

      // Sort by net P&L descending
      const leaderboard = Object.values(userMap)
        .map((u) => ({
          ...u,
          netPnl: u.totalPayout - u.totalWagered,
        }))
        .sort((a, b) => b.netPnl - a.netPnl);

      return res.json({ leaderboard });
    } catch (err: any) {
      console.error("[API] leaderboard error:", err.message);
      return res.status(500).json({ error: "Failed to build leaderboard" });
    }
  });

  return app;
}
