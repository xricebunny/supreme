"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import { signBet } from "@/lib/api";
import { serverAuthorization } from "@/lib/serverSigner";
import { OPEN_POSITION, OPEN_FLOW_POSITION } from "@/lib/transactions";
import { getMultiplier } from "@/lib/multiplier";
import { PricePoint } from "@/types";
import type { TokenSymbol } from "./useBinancePrice";
import { TOKEN_LABELS } from "./useTokenSelector";

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
  resolvedAt?: number; // timestamp when won/lost was determined
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
  /** Queue an arbitrary async task onto the tx queue (serialized with bet txs). */
  queueTx: (fn: () => Promise<void>) => Promise<void>;
}

export function useBetManager(
  userAddress: string | null,
  magicLinkAuthz: any,
  priceHistory: PricePoint[],
  deductBalance: (amount: number) => void,
  addBalance: (amount: number) => void,
  token: TokenSymbol = "btc",
  refreshBalance?: () => Promise<void>
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

  const refreshBalanceRef = useRef(refreshBalance);
  useEffect(() => {
    refreshBalanceRef.current = refreshBalance;
  }, [refreshBalance]);

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // ── Expiry Resolution + Cleanup ─────────────────────────────────────────
  // Check active bets every 200ms to see if they've expired.
  // Side effects (addBalance) are collected during the pure state
  // updater and applied afterwards to avoid double-firing in React StrictMode.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const prices = priceHistoryRef.current;

      // Collect side effects outside the state updater
      const pendingEffects: Array<() => void> = [];

      // flushSync forces the state updater to run synchronously so that
      // pendingEffects is populated before we iterate it below.
      // Without this, React 18 defers the updater and effects never fire.
      flushSync(() => {
        setActiveBets((prev) => {
          // Clear effects from any previous StrictMode invocation of this updater
          pendingEffects.length = 0;
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

              // Resolution window matches the cell's grid-aligned time window.
              // The price line tip is drawn at the actual current timestamp
              // (no half-column offset), so no visual shift is needed.
              const visualStartMs = bet.startTimestamp;
              const visualEndMs = bet.expiryTimestamp;

              // Check all prices from visual start up to now (capped at visual end)
              const relevantPrices = prices.filter(
                (p) => p.timestamp >= visualStartMs && p.timestamp <= Math.min(now, visualEndMs)
              );

              let touched = false;
              for (const p of relevantPrices) {
                if (p.price >= bet.priceBottom && p.price <= bet.priceTop) {
                  touched = true;
                  break;
                }
              }

              // WIN: resolve immediately when price touches the cell
              if (touched) {
                changed = true;
                pendingEffects.push(() => {
                  addBalanceRef.current(bet.payout);
                });
                return { ...bet, status: "won" as BetStatus, resolvedAt: now };
              }

              // LOSE: wait until the visual window has fully passed
              if (now < visualEndMs) return bet;

              changed = true;
              return { ...bet, status: "lost" as BetStatus, resolvedAt: now };
            });

          return changed ? updated : prev;
        });
      });

      // Apply side effects once, outside the state updater
      for (const effect of pendingEffects) effect();
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

      const currentToken = tokenRef.current;
      const tokenLabel = TOKEN_LABELS[currentToken];

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
            symbol: currentToken,
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
          const cadenceTemplate = currentToken === "flow" ? OPEN_FLOW_POSITION : OPEN_POSITION;
          const txId = await fcl.mutate({
            cadence: cadenceTemplate,
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

          // Wait for seal before releasing the queue to the next tx
          await fcl.tx(txId).onceSealed();
        } catch {
          // Revert optimistic state — only refund if the bet is still active
          // (it may have already resolved as won/lost via Binance prices)
          flushSync(() => {
            setActiveBets((prev) => {
              const bet = prev.find((b) => b.id === betId);
              if (bet && bet.status === "active") {
                addBalance(params.betSize);
                return prev.map((b) =>
                  b.id === betId ? { ...b, status: "failed" as BetStatus } : b
                );
              }
              // Already resolved — don't refund or change status
              return prev;
            });
          });
        }
      };

      // Chain onto the queue — each tx waits for the previous to finish
      txQueueRef.current = txQueueRef.current.then(submitTx, submitTx);
    },
    [userAddress, magicLinkAuthz, deductBalance, addBalance]
  );

  // Queue an arbitrary async task (e.g. mint) onto the same tx queue
  // so it serializes with bet transactions and avoids sequence number conflicts.
  const queueTx = useCallback((fn: () => Promise<void>): Promise<void> => {
    const p = txQueueRef.current.then(fn, fn);
    txQueueRef.current = p;
    return p;
  }, []);

  return { activeBets, placeBet, queueTx };
}
