"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, LocalBet, PricePoint, OracleSnapshot, Position, SettledPosition } from "@/types";
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
  const [history, setHistory] = useState<SettledPosition[]>([]);
  const [lastSettlement, setLastSettlement] = useState<{ won: boolean; payout: number } | null>(null);
  const settlementTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Calculate multiplier
  const getMult = useCallback((r: number, c: number, priceRow: number) => {
    const COLS = 6;
    const pd = Math.abs(r - priceRow);
    const td = COLS - c;
    return (1.0 + pd * 0.8 + td * 3.0 + pd * td * 0.35).toFixed(1);
  }, []);

  // Hit detection and auto-settlement
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

    setBets((prev) => {
      const updated = prev.map((b) => {
        // Mark confirmed bets at current price row as hit
        if (b.status === "confirmed" && b.row === row) {
          return {
            ...b,
            status: "hit" as const,
            entryPrice: b.entryPrice || currentPrice,
            multiplier: b.multiplier || getMult(b.row, b.col, row)
          };
        }
        return b;
      });
      return updated;
    });
  }, [currentPrice, getMult]);

  // Auto-settle hit bets after delay
  useEffect(() => {
    const hitBets = bets.filter((b) => b.status === "hit");

    hitBets.forEach((bet) => {
      // Settle after 1.5 seconds of being hit
      setTimeout(() => {
        setBets((prev) => {
          const current = prev.find((b) => b.id === bet.id);
          if (!current || current.status !== "hit") return prev;

          // 60% win rate for demo (makes it more engaging)
          const won = Math.random() < 0.6;
          const mult = parseFloat(current.multiplier || "1.5");
          const payout = won ? current.amount * mult : 0;

          // Add to history
          const settledPosition: SettledPosition = {
            id: current.id,
            stake: current.amount,
            row: current.row,
            col: current.col,
            multiplier: current.multiplier || "1.5",
            entryPrice: current.entryPrice || 3820.5,
            exitPrice: currentPrice,
            won,
            payout,
            settledAt: Date.now(),
          };

          setHistory((h) => [settledPosition, ...h].slice(0, 50)); // Keep last 50

          // Update balance if won
          if (won) {
            setBalance((b) => b + payout);
          }

          // Trigger celebration/loss animation
          setLastSettlement({ won, payout });
          if (settlementTimeoutRef.current) {
            clearTimeout(settlementTimeoutRef.current);
          }
          settlementTimeoutRef.current = setTimeout(() => {
            setLastSettlement(null);
          }, 2500);

          // Remove the bet
          return prev.filter((b) => b.id !== bet.id);
        });
      }, 1500);
    });
  }, [bets, currentPrice]);

  const addLocalBet = useCallback((row: number, col: number, amount: number, price: number): LocalBet => {
    const BASE = 3820.0;
    const STEP = 0.5;
    const ROWS = 14;
    let priceRow = 0;
    for (let i = 0; i < ROWS; i++) {
      const priceAt = BASE + (ROWS / 2 - i) * STEP;
      if (price >= priceAt - STEP / 2) {
        priceRow = i;
        break;
      }
    }

    const bet: LocalBet = {
      id: `local-${Date.now()}`,
      row,
      col,
      amount,
      status: "pending",
      positionId: undefined,
      placedAt: Date.now(),
      entryPrice: price,
      multiplier: getMult(row, col, priceRow),
    };
    setBets((p) => [...p, bet]);
    setBalance((b) => b - amount);
    return bet;
  }, [getMult]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (settlementTimeoutRef.current) {
        clearTimeout(settlementTimeoutRef.current);
      }
    };
  }, []);

  // Calculate history stats
  const historyStats = {
    totalWins: history.filter((p) => p.won).length,
    totalLosses: history.filter((p) => !p.won).length,
    netProfit: history.reduce((acc, p) => acc + (p.won ? p.payout - p.stake : -p.stake), 0),
  };

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
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
    history,
    historyStats,
    lastSettlement,
    clearLastSettlement: () => setLastSettlement(null),
    clearHistory,
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
