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
  priceTop: number;       // upper bound of the cell's price band
  priceBottom: number;    // lower bound of the cell's price band
  aboveTarget: boolean;
  multiplier: number;
  startTimestamp: number; // UNIX ms — start of the cell's time window
  expiryTimestamp: number; // UNIX ms — end of the cell's time window
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
    priceTop: number;
    priceBottom: number;
    aboveTarget: boolean;
    betSize: number;
    rowDist: number;
    colDist: number;
    row: number;
    col: number;
    colStartTimeMs: number;
    colEndTimeMs: number;
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

  // ── Expiry Resolution + Cleanup ─────────────────────────────────────────
  // Check active bets every 200ms to see if they've expired.
  // Uses functional state update to avoid race conditions with other setActiveBets calls.
  // Also cleans up resolved bets that have scrolled off the grid (>60s after expiry).
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const prices = priceHistoryRef.current;

      setActiveBets((prev) => {
        let changed = false;
        const updated = prev
          .filter((bet) => {
            // Remove resolved bets that have scrolled well off-screen
            if (bet.status !== "active" && now - (bet.startTimestamp + 5000) > 60000) {
              changed = true;
              return false;
            }
            return true;
          })
          .map((bet) => {
            if (bet.status !== "active") return bet;
            // Resolve when the grid column's right edge has passed
            // startTimestamp is the column's left edge (grid-aligned),
            // so startTimestamp + 5000 is the right edge
            const colEndMs = bet.startTimestamp + 5000;
            if (now < colEndMs) return bet;

            // Check if price entered the cell's price band during the column's time window
            // Use grid-aligned boundaries so the window matches exactly what the user sees
            const relevantPrices = prices.filter(
              (p) => p.timestamp >= bet.startTimestamp && p.timestamp <= colEndMs
            );

            let touched = false;
            for (const p of relevantPrices) {
              if (p.price >= bet.priceBottom && p.price <= bet.priceTop) {
                touched = true;
                break;
              }
            }

            changed = true;
            if (touched) {
              addBalanceRef.current(bet.payout);
              console.log(
                `[Bet] ✅ WON ${bet.id}: $${bet.betSize} → +$${bet.payout.toFixed(2)} | ` +
                `BTC in $${bet.priceBottom.toFixed(2)}–$${bet.priceTop.toFixed(2)} (${bet.multiplier.toFixed(2)}x) | ` +
                `${relevantPrices.length} prices checked`
              );
              return { ...bet, status: "won" as BetStatus };
            } else {
              console.log(
                `[Bet] ❌ LOST ${bet.id}: -$${bet.betSize} | ` +
                `BTC never in $${bet.priceBottom.toFixed(2)}–$${bet.priceTop.toFixed(2)} | ` +
                `${relevantPrices.length} prices checked, ` +
                `range: $${relevantPrices.length > 0 ? relevantPrices.reduce((min, p) => Math.min(min, p.price), Infinity).toFixed(2) : "?"} – ` +
                `$${relevantPrices.length > 0 ? relevantPrices.reduce((max, p) => Math.max(max, p.price), 0).toFixed(2) : "?"}`
              );
              return { ...bet, status: "lost" as BetStatus };
            }
          });

        return changed ? updated : prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []); // stable — reads prices and addBalance from refs

  // ── Place Bet ───────────────────────────────────────────────────────────
  const placeBet = useCallback(
    (params: {
      targetPrice: number;
      priceTop: number;
      priceBottom: number;
      aboveTarget: boolean;
      betSize: number;
      rowDist: number;
      colDist: number;
      row: number;
      col: number;
      colStartTimeMs: number;
      colEndTimeMs: number;
    }) => {
      if (!userAddress || !magicLinkAuthz) return;

      const betId = `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      // startTimestamp is grid-aligned — used for both column mapping AND resolution timing
      // Resolution fires when now >= startTimestamp + 5000 (column's right edge)
      const startMs = params.colStartTimeMs;
      const expiryMs = startMs + 5000;
      // Use client-side multiplier estimate for optimistic state
      const estimatedMultiplier = getMultiplier(params.rowDist, params.colDist);
      const payout = params.betSize * estimatedMultiplier;

      // Optimistic: add bet immediately
      const newBet: ActiveBet = {
        id: betId,
        targetPrice: params.targetPrice,
        priceTop: params.priceTop,
        priceBottom: params.priceBottom,
        aboveTarget: params.aboveTarget,
        multiplier: estimatedMultiplier,
        startTimestamp: startMs,
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
        `[Bet] PLACED ${betId}: $${params.betSize} on BTC in $${params.priceBottom.toFixed(2)}–$${params.priceTop.toFixed(2)} | ` +
        `${estimatedMultiplier.toFixed(2)}x → $${payout.toFixed(2)} payout | ` +
        `window ${((expiryMs - 5000 - now) / 1000).toFixed(0)}s–${((expiryMs - now) / 1000).toFixed(0)}s from now`
      );

      // Queue the on-chain transaction — Magic.link has a single key so
      // we must wait for each tx to seal before submitting the next one.
      // Optimistic UI is already showing; this runs in background.
      const submitTx = async () => {
        try {
          // 1. Get backend params
          const betParams = await signBet({
            targetPrice: params.targetPrice,
            priceTop: params.priceTop,
            priceBottom: params.priceBottom,
            aboveTarget: params.aboveTarget,
            betSize: params.betSize,
            rowDist: params.rowDist,
            colDist: params.colDist,
          });

          // Update bet with server-computed multiplier (only if still active —
          // the bet may have already resolved locally while queued)
          // Keep grid-aligned timestamps — only update multiplier/payout
          setActiveBets((prev) =>
            prev.map((b) =>
              b.id === betId && b.status === "active"
                ? {
                    ...b,
                    multiplier: betParams.multiplier,
                    payout: params.betSize * betParams.multiplier,
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
