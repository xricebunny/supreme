"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import { GET_PYUSD_BALANCE, MINT_PYUSD } from "@/lib/transactions";
import { fundAccount } from "@/lib/api";

interface UseBalanceReturn {
  balance: number;
  optimisticBalance: number;
  loading: boolean;
  refreshBalance: () => Promise<void>;
  deductOptimistic: (amount: number) => void;
  addOptimistic: (amount: number) => void;
  mintPYUSD: (amount: number) => Promise<void>;
}

export function useBalance(
  address: string | null,
  authz?: any,
  queueTx?: (fn: () => Promise<void>) => Promise<void>
): UseBalanceReturn {
  // On-chain balance (source of truth, updated by polls)
  const [balance, setBalance] = useState(0);
  // Optimistic adjustments not yet reflected on-chain
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const [loading, setLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previous on-chain balance and guard against concurrent refreshes
  const prevChainBalanceRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  // Track when the delta last changed, so we can decay stale deltas
  const deltaChangedAtRef = useRef(0);
  const DELTA_STALE_MS = 30000; // reset delta if chain hasn't absorbed it in 30s

  const refreshBalance = useCallback(async () => {
    if (!address || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const result = await fcl.query({
        cadence: GET_PYUSD_BALANCE,
        args: (arg: typeof fcl.arg) => [arg(address, t.Address)],
      });
      const newBalance = parseFloat(result);
      const prevBalance = prevChainBalanceRef.current;
      prevChainBalanceRef.current = newBalance;

      if (prevBalance === null) {
        // First load
        setBalance(newBalance);
        setOptimisticDelta(0);
        return;
      }

      const chainDelta = newBalance - prevBalance;
      setBalance(newBalance);
      if (chainDelta !== 0) {
        setOptimisticDelta((prev) => {
          const newDelta = prev - chainDelta;
          const final_ = Math.abs(newDelta) < 0.01 ? 0 : newDelta;
          if (final_ === 0) deltaChangedAtRef.current = 0;
          else deltaChangedAtRef.current = Date.now();
          return final_;
        });
      } else {
        // Chain unchanged — check if we have a stale optimistic delta
        // This handles cases where frontend thinks a bet won but chain settled it as lost
        setOptimisticDelta((prev) => {
          if (prev !== 0 && deltaChangedAtRef.current > 0 && Date.now() - deltaChangedAtRef.current > DELTA_STALE_MS) {
            deltaChangedAtRef.current = 0;
            return 0;
          }
          return prev;
        });
      }
    } catch {
      // refresh failed silently
    } finally {
      refreshingRef.current = false;
    }
  }, [address]);

  // Poll balance every 10s
  useEffect(() => {
    if (!address) return;
    prevChainBalanceRef.current = null;
    refreshBalance();
    refreshTimerRef.current = setInterval(refreshBalance, 10000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [address, refreshBalance]);

  const deductOptimistic = useCallback((amount: number) => {
    deltaChangedAtRef.current = Date.now();
    setOptimisticDelta((prev) => prev - amount);
  }, []);

  const addOptimistic = useCallback((amount: number) => {
    deltaChangedAtRef.current = Date.now();
    setOptimisticDelta((prev) => prev + amount);
  }, []);

  const mintPYUSD = useCallback(async (amount: number) => {
    if (!address) throw new Error("No address");
    if (!authz) throw new Error("No authorization available");
    setLoading(true);
    try {
      // Ensure user has FLOW for storage before minting
      await fundAccount(address);

      const doMint = async () => {
        const txId = await fcl.mutate({
          cadence: MINT_PYUSD,
          args: (arg: typeof fcl.arg) => [arg(amount.toFixed(8), t.UFix64)],
          limit: 9999,
          authorizations: [authz],
          payer: authz,
          proposer: authz,
        } as any);
        await fcl.tx(txId).onceSealed();
      };

      // Serialize with bet transactions to avoid sequence number conflicts
      if (queueTx) {
        await queueTx(doMint);
      } else {
        await doMint();
      }
      await refreshBalance();
    } finally {
      setLoading(false);
    }
  }, [address, authz, refreshBalance, queueTx]);

  return {
    balance,
    optimisticBalance: Math.max(0, balance + optimisticDelta),
    loading,
    refreshBalance,
    deductOptimistic,
    addOptimistic,
    mintPYUSD,
  };
}
