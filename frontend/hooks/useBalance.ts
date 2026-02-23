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
  const [balance, setBalance] = useState(0);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const [loading, setLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const result = await fcl.query({
        cadence: GET_PYUSD_BALANCE,
        args: (arg: typeof fcl.arg) => [arg(address, t.Address)],
      });
      const newBalance = parseFloat(result);
      setBalance(newBalance);
      setOptimisticDelta(0); // Reset optimistic when we get real balance
    } catch (err) {
      console.error("[Balance] refresh failed:", err);
    }
  }, [address]);

  // Poll balance every 10s
  useEffect(() => {
    if (!address) return;
    refreshBalance();
    refreshTimerRef.current = setInterval(refreshBalance, 10000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [address, refreshBalance]);

  const deductOptimistic = useCallback((amount: number) => {
    setOptimisticDelta((prev) => prev - amount);
  }, []);

  const addOptimistic = useCallback((amount: number) => {
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
