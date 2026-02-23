import "dotenv/config";
import { configureFCL, detectKeyCount } from "./flow-client.js";
import { startOracleUpdater } from "./oracle-updater.js";
import { startSettlementBot } from "./settlement-bot.js";
import { createApp } from "./api.js";

const PORT = parseInt(process.env.PORT || "3001");

// ── Crash Protection ─────────────────────────────────────────────────────────
// Prevent the process from dying on unhandled errors.

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception (keeping process alive):", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection (keeping process alive):", reason);
});

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Supreme Backend ===");

  // Configure FCL for testnet
  configureFCL();
  console.log("[Init] FCL configured for testnet");

  // Detect available keys for parallel tx submission
  await detectKeyCount();

  // Start oracle updater (Binance WS → on-chain price pushes)
  startOracleUpdater();
  console.log("[Init] Oracle updater started");

  // Start settlement bot (poll expired positions → settle)
  startSettlementBot();
  console.log("[Init] Settlement bot started");

  // Start API server
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[Init] API server listening on port ${PORT}`);
    console.log(`[Init] Health: http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
