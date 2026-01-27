"use client";

import { useState, useEffect, useCallback } from "react";
import { User, LocalBet, PricePoint, OracleSnapshot, Position } from "@/types";
import { getUserInfo, isLoggedIn, getFlowAddress } from "@/lib/magic";

// Auth hook
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        const info = await getUserInfo();
        const address = await getFlowAddress();
        if (info && address) {
          setUser({
            address,
            email: info.email || undefined,
            balance: 30.93,
            isAuthenticated: true,
            isWalletConnected: true,
          });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, loading, checkAuth, setUser };
};

// Game state hook
export const useGameState = () => {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState(3820.63);
  const [bets, setBets] = useState<LocalBet[]>([]);
  const [bidSize, setBidSize] = useState(10);
  const [balance, setBalance] = useState(30.93);

  // Initialize price
  useEffect(() => {
    const pts: PricePoint[] = [];
    let p = 3821.2;
    for (let i = 0; i < 35; i++) {
      p += (Math.random() - 0.52) * 0.25;
      p = Math.max(3818.5, Math.min(3823.5, p));
      pts.push({ x: i, y: p - 3818 });
    }
    setPriceHistory(pts);
    setCurrentPrice(p);
  }, []);

  // Animate price
  useEffect(() => {
    const iv = setInterval(() => {
      setPriceHistory((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        let newP = last.y + 3818 + (Math.random() - 0.5) * 0.18;
        newP = Math.max(3818.5, Math.min(3823.5, newP));
        setCurrentPrice(newP);
        return [...prev.slice(-50), { x: last.x + 1, y: newP - 3818 }];
      });
    }, 180);
    return () => clearInterval(iv);
  }, []);

  // Hit detection
  useEffect(() => {
    const BASE = 3820.0;
    const STEP = 0.5;
    const ROWS = 14;

    let row = 0;
    for (let i = 0; i < ROWS; i++) {
      const priceAt = BASE + (ROWS / 2 - i) * STEP;
      if (currentPrice >= priceAt - STEP / 2) {
        row = i;
        break;
      }
    }

    setBets((prev) =>
      prev.map((b) =>
        b.status === "confirmed" && b.row === row
          ? { ...b, status: "hit" as const }
          : b
      )
    );
  }, [currentPrice]);

  const addLocalBet = useCallback((row: number, col: number, amount: number): LocalBet => {
    const bet: LocalBet = {
      id: `local-${Date.now()}`,
      row,
      col,
      amount,
      status: "pending",
      positionId: undefined,
      placedAt: Date.now(),
    };
    setBets((p) => [...p, bet]);
    setBalance((b) => b - amount);
    return bet;
  }, []);

  const confirmBet = useCallback((localId: string, positionId: string) => {
    setBets((p) =>
      p.map((b) =>
        b.id === localId ? { ...b, status: "confirmed" as const, positionId } : b
      )
    );
  }, []);

  const failBet = useCallback((localId: string) => {
    setBets((p) => {
      const bet = p.find((b) => b.id === localId);
      if (bet) setBalance((bal) => bal + bet.amount);
      return p.filter((b) => b.id !== localId);
    });
  }, []);

  const stackBet = useCallback((bet: LocalBet, add: number) => {
    setBets((p) =>
      p.map((b) => (b.id === bet.id ? { ...b, amount: b.amount + add } : b))
    );
    setBalance((b) => b - add);
  }, []);

  const removeBet = useCallback((betId: string) => {
    setBets((p) => {
      const bet = p.find((b) => b.id === betId);
      if (bet) setBalance((bal) => bal + bet.amount);
      return p.filter((b) => b.id !== betId);
    });
  }, []);

  const settleBet = useCallback((betId: string, won: boolean, payout: number) => {
    setBets((p) =>
      p.map((b) => (b.id === betId ? { ...b, status: "settled" as const } : b))
    );
    if (won) setBalance((b) => b + payout);
  }, []);

  return {
    priceHistory,
    currentPrice,
    bets,
    bidSize,
    setBidSize,
    balance,
    setBalance,
    addLocalBet,
    confirmBet,
    failBet,
    stackBet,
    removeBet,
    settleBet,
  };
};

// Oracle hook
export const useOracle = (pollInterval = 5000) => {
  const [snapshot, setSnapshot] = useState<OracleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const mock: OracleSnapshot = {
        price: 3820.5 + Math.random() * 2,
        updatedAtBlock: 1000000,
        currentBlock: 1000000 + Math.floor(Math.random() * 30),
        isStale: false,
      };
      mock.isStale = mock.currentBlock - mock.updatedAtBlock > 50;
      setSnapshot(mock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, pollInterval);
    return () => clearInterval(iv);
  }, [fetch, pollInterval]);

  return { snapshot, loading, refresh: fetch };
};

// Positions hook
export const usePositions = (userAddress: string | null) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    try {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { positions, loading, refresh: fetch };
};
