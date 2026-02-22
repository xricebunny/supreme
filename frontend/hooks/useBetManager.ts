"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import { signBet } from "@/lib/api";
import { serverAuthorization } from "@/lib/serverSigner";
import { OPEN_POSITION } from "@/lib/transactions";
import { getMultiplier } from "@/lib/multiplier";
import { PricePoint } from "@/types";

export type BetStatus = "active" | "won" | "lost" | "failed";

export interface ActiveBet {
  id: string;
  targetPrice: number;
  aboveTarget: boolean;
  multiplier: number;
  expiryTimestamp: number; // UNIX ms
  betSize: number;
  status: BetStatus;
  row: number;
  col: number;
  payout: number;
}

interface UseBetManagerReturn {
  activeBets: ActiveBet[];
  placeBet: (params: {
    targetPrice: number;
    aboveTarget: boolean;
    betSize: number;
    rowDist: number;
    colDist: number;
    row: number;
    col: number;
  }) => void;
}

export function useBetManager(
  userAddress: string | null,
  magicLinkAuthz: any,
  priceHistory: PricePoint[],
  deductBalance: (amount: number) => void,
  addBalance: (amount: number) => void
): UseBetManagerReturn {
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const betsRef = useRef<ActiveBet[]>([]);

  // Transaction queue — Magic.link has a single key, so only one tx can be
  // in-flight at a time. The optimistic UI is instant; chain submissions serialize.
  const txQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Keep refs in sync — priceHistory changes on every Binance tick (~50ms),
  // so we use a ref to avoid tearing down the resolution interval constantly.
  const priceHistoryRef = useRef<PricePoint[]>(priceHistory);
  useEffect(() => {
    priceHistoryRef.current = priceHistory;
  }, [priceHistory]);

  const addBalanceRef = useRef(addBalance);
  useEffect(() => {
    addBalanceRef.current = addBalance;
  }, [addBalance]);

  useEffect(() => {
    betsRef.current = activeBets;
  }, [activeBets]);

  // ── Expiry Resolution ───────────────────────────────────────────────────
  // Check active bets every 200ms to see if they've expired.
  // Uses Binance price history (via ref) to determine win/loss.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const prices = priceHistoryRef.current;

      const updated = betsRef.current.map((bet) => {
        if (bet.status !== "active") return bet;
        if (now < bet.expiryTimestamp) return bet;

        // Bet has expired — check if price touched target during bet window
        const betStartMs = bet.expiryTimestamp - (bet.col - 5) * 5000; // approximate start
        const relevantPrices = prices.filter(
          (p) => p.timestamp >= betStartMs && p.timestamp <= bet.expiryTimestamp
        );

        let touched = false;
        for (const p of relevantPrices) {
          if (bet.aboveTarget && p.price >= bet.targetPrice) {
            touched = true;
            break;
          }
          if (!bet.aboveTarget && p.price <= bet.targetPrice) {
            touched = true;
            break;
          }
        }

        changed = true;
        if (touched) {
          addBalanceRef.current(bet.payout);
          console.log(
            `[Bet] ✅ WON ${bet.id}: $${bet.betSize} → +$${bet.payout.toFixed(2)} | ` +
            `BTC ${bet.aboveTarget ? "≥" : "≤"} $${bet.targetPrice.toFixed(2)} (${bet.multiplier.toFixed(2)}x) | ` +
            `${relevantPrices.length} prices checked`
          );
          return { ...bet, status: "won" as BetStatus };
        } else {
          console.log(
            `[Bet] ❌ LOST ${bet.id}: -$${bet.betSize} | ` +
            `BTC never ${bet.aboveTarget ? "reached" : "dropped to"} $${bet.targetPrice.toFixed(2)} | ` +
            `${relevantPrices.length} prices checked, ` +
            `range: $${relevantPrices.length > 0 ? relevantPrices.reduce((min, p) => Math.min(min, p.price), Infinity).toFixed(2) : "?"} – ` +
            `$${relevantPrices.length > 0 ? relevantPrices.reduce((max, p) => Math.max(max, p.price), 0).toFixed(2) : "?"}`
          );
          return { ...bet, status: "lost" as BetStatus };
        }
      });

      if (changed) {
        setActiveBets(updated);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []); // stable — reads everything from refs

  // Clean up resolved bets after 8 seconds (keep visible on grid)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBets((prev) =>
        prev.filter(
          (bet) =>
            bet.status === "active" ||
            Date.now() - bet.expiryTimestamp < 8000
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Place Bet ───────────────────────────────────────────────────────────
  const placeBet = useCallback(
    (params: {
      targetPrice: number;
      aboveTarget: boolean;
      betSize: number;
      rowDist: number;
      colDist: number;
      row: number;
      col: number;
    }) => {
      if (!userAddress || !magicLinkAuthz) return;

      const betId = `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const expiryMs = Date.now() + params.colDist * 5000;
      // Use client-side multiplier estimate for optimistic state
      const estimatedMultiplier = getMultiplier(params.rowDist, params.colDist);
      const payout = params.betSize * estimatedMultiplier;

      // Optimistic: add bet immediately
      const newBet: ActiveBet = {
        id: betId,
        targetPrice: params.targetPrice,
        aboveTarget: params.aboveTarget,
        multiplier: estimatedMultiplier,
        expiryTimestamp: expiryMs,
        betSize: params.betSize,
        status: "active",
        row: params.row,
        col: params.col,
        payout: payout,
      };

      setActiveBets((prev) => [...prev, newBet]);
      deductBalance(params.betSize);

      console.log(
        `[Bet] PLACED ${betId}: $${params.betSize} on BTC ${params.aboveTarget ? "≥" : "≤"} $${params.targetPrice.toFixed(2)} | ` +
        `${estimatedMultiplier.toFixed(2)}x → $${payout.toFixed(2)} payout | ` +
        `expires in ${params.colDist * 5}s`
      );

      // Queue the on-chain transaction — Magic.link has a single key so
      // we must wait for each tx to seal before submitting the next one.
      // Optimistic UI is already showing; this runs in background.
      const submitTx = async () => {
        try {
          // 1. Get backend params
          const betParams = await signBet({
            targetPrice: params.targetPrice,
            aboveTarget: params.aboveTarget,
            betSize: params.betSize,
            rowDist: params.rowDist,
            colDist: params.colDist,
          });

          // Update bet with server-computed multiplier (only if still active —
          // the bet may have already resolved locally while queued)
          setActiveBets((prev) =>
            prev.map((b) =>
              b.id === betId && b.status === "active"
                ? {
                    ...b,
                    multiplier: betParams.multiplier,
                    payout: params.betSize * betParams.multiplier,
                    expiryTimestamp: betParams.expiryTimestamp * 1000, // server returns seconds
                  }
                : b
            )
          );

          // 2. Build and submit multi-auth transaction
          const txId = await fcl.mutate({
            cadence: OPEN_POSITION,
            args: (arg: typeof fcl.arg) => [
              arg(params.betSize.toFixed(8), t.UFix64),
              arg(params.targetPrice.toFixed(8), t.UFix64),
              arg(betParams.aboveTarget, t.Bool),
              arg(betParams.multiplier.toFixed(8), t.UFix64),
              arg(betParams.entryPrice.toFixed(8), t.UFix64),
              arg(betParams.durationBlocks.toString(), t.UInt64),
              arg(betParams.expiryTimestamp.toFixed(8), t.UFix64),
            ],
            limit: 9999,
            authorizations: [magicLinkAuthz, serverAuthorization()],
            payer: serverAuthorization() as any,
            proposer: magicLinkAuthz,
          });

          console.log(`[Bet] Submitted tx: ${txId} for ${betId}`);

          // Wait for seal before releasing the queue to the next tx
          const result: any = await fcl.tx(txId).onceSealed();
          const events = result.events || [];
          const positionEvent = events.find((e: any) => e.type.includes("PositionOpened"));
          if (positionEvent) {
            console.log(
              `[Chain] ✅ Position opened on-chain: ${JSON.stringify(positionEvent.data)} | tx: ${txId}`
            );
          } else {
            console.log(`[Chain] ✅ Tx sealed (${events.length} events) | tx: ${txId}`);
          }
        } catch (err: any) {
          console.error("[Bet] Failed:", err.message);
          // Revert optimistic state
          setActiveBets((prev) =>
            prev.map((b) =>
              b.id === betId ? { ...b, status: "failed" as BetStatus } : b
            )
          );
          addBalance(params.betSize);
        }
      };

      // Chain onto the queue — each tx waits for the previous to finish
      txQueueRef.current = txQueueRef.current.then(submitTx, submitTx);
    },
    [userAddress, magicLinkAuthz, deductBalance, addBalance]
  );

  return { activeBets, placeBet };
}
