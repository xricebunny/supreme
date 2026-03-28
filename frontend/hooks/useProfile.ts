"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getPositions } from "@/lib/api";

export interface OnChainPosition {
  id: string;
  owner: string;
  stake: string;       // UFix64 string
  entryPrice: string;
  targetPrice: string;
  aboveTarget: boolean;
  multiplier: string;  // UFix64 string
  entryBlock: string;
  expiryBlock: string;
  expiryTimestamp: string;
  settled: boolean;
  won: boolean | null;
  touchedAtBlock: string | null;
  touchedPrice: string | null;
  payout: string | null; // UFix64 string or null
}

export interface ProfilePosition {
  id: string;
  token: "BTC" | "FLOW";
  stake: number;
  multiplier: number;
  settled: boolean;
  won: boolean | null;
  payout: number;
  expiryTimestamp: number;
}

export interface ProfileStats {
  totalBets: number;
  wins: number;
  losses: number;
  unsettled: number;
  totalWagered: number;
  totalPayout: number;
  netPnl: number;
  winRate: number;
  bestMultiplier: number;
}

function parseUFix64(value: string | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value) || 0;
}

function computeStats(positions: ProfilePosition[]): ProfileStats {
  const settled = positions.filter((p) => p.settled);
  const wins = settled.filter((p) => p.won === true);
  const losses = settled.filter((p) => p.won === false);
  const unsettled = positions.filter((p) => !p.settled);

  const totalWagered = positions.reduce((sum, p) => sum + p.stake, 0);
  const totalPayout = wins.reduce((sum, p) => sum + p.payout, 0);
  const netPnl = totalPayout - totalWagered;
  const winRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;
  const bestMultiplier = positions.length > 0
    ? Math.max(...positions.map((p) => p.multiplier))
    : 0;

  return {
    totalBets: positions.length,
    wins: wins.length,
    losses: losses.length,
    unsettled: unsettled.length,
    totalWagered,
    totalPayout,
    netPnl,
    winRate,
    bestMultiplier,
  };
}

export function useProfile(address: string | null) {
  const [positions, setPositions] = useState<ProfilePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch BTC and FLOW positions in parallel
      const [btcRaw, flowRaw] = await Promise.all([
        getPositions(address, "btc").catch(() => []),
        getPositions(address, "flow").catch(() => []),
      ]);

      const mapPositions = (raw: any[], token: "BTC" | "FLOW"): ProfilePosition[] =>
        raw.map((p: OnChainPosition) => ({
          id: `${token}-${p.id}`,
          token,
          stake: parseUFix64(p.stake),
          multiplier: parseUFix64(p.multiplier),
          settled: p.settled,
          won: p.won,
          payout: parseUFix64(p.payout),
          expiryTimestamp: parseUFix64(p.expiryTimestamp) * 1000, // convert seconds to ms
        }));

      const all = [
        ...mapPositions(btcRaw, "BTC"),
        ...mapPositions(flowRaw, "FLOW"),
      ].sort((a, b) => b.expiryTimestamp - a.expiryTimestamp);

      setPositions(all);
    } catch (err: any) {
      console.error("[useProfile] Failed to fetch positions:", err);
      setError(err.message || "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Fetch on mount and when address changes
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const stats = useMemo(() => computeStats(positions), [positions]);

  return { positions, stats, loading, error, refetch: fetchPositions };
}
