"use client";

import { useState, useEffect, useCallback } from "react";
import { GameGrid, GameHeader, BottomControls, AuthModal, Confetti, PositionHistory } from "@/components";
import { useAuth, useGameState, useOracle } from "@/hooks";
import { logout } from "@/lib/magic";
import { initFCL, openPosition, cancelPosition } from "@/lib/flow";
import { LocalBet } from "@/types";

export default function Home() {
  const { user, loading: authLoading, checkAuth, setUser } = useAuth();
  const {
    priceHistory,
    currentPrice,
    bets,
    bidSize,
    setBidSize,
    balance,
    addLocalBet,
    confirmBet,
    failBet,
    stackBet,
    removeBet,
    history,
    historyStats,
    lastSettlement,
    clearLastSettlement,
  } = useGameState();
  const { snapshot: oracleSnapshot, loading: oracleLoading } = useOracle();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  // Screen shake on loss
  useEffect(() => {
    if (lastSettlement && !lastSettlement.won) {
      setScreenShake(true);
      const timer = setTimeout(() => setScreenShake(false), 400);
      return () => clearTimeout(timer);
    }
  }, [lastSettlement]);

  // Initialize FCL
  useEffect(() => {
    initFCL();
  }, []);

  // Mock user for demo
  useEffect(() => {
    if (!authLoading && !user) {
      setUser({
        address: "0x1234567890abcdef",
        email: "demo@emerpus.finance",
        balance: 30.93,
        isAuthenticated: true,
        isWalletConnected: true,
      });
    }
  }, [authLoading, user, setUser]);

  // Place bet handler
  const handlePlaceBet = useCallback(
    async (row: number, col: number, amount: number) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      if (oracleSnapshot?.isStale) {
        console.warn("Oracle stale - betting paused");
        return;
      }

      const localBet = addLocalBet(row, col, amount, currentPrice);

      try {
        const result = await openPosition(row, col, amount);

        if (result.status === 4) {
          const positionId = result.events.find(
            (e: any) => e.type.includes("PositionOpened")
          )?.data?.positionId || `pos-${Date.now()}`;
          confirmBet(localBet.id, positionId);
        } else {
          failBet(localBet.id);
        }
      } catch (error) {
        console.error("Failed to place bet:", error);
        failBet(localBet.id);
      }
    },
    [user, oracleSnapshot, addLocalBet, confirmBet, failBet, currentPrice]
  );

  // Stack bet handler
  const handleStackBet = useCallback(
    async (bet: LocalBet, additionalAmount: number) => {
      if (!user || !bet.positionId) return;
      if (oracleSnapshot?.isStale) return;

      stackBet(bet, additionalAmount);

      try {
        const result = await openPosition(bet.row, bet.col, additionalAmount);
        if (result.status !== 4) {
          removeBet(bet.id);
          addLocalBet(bet.row, bet.col, bet.amount - additionalAmount, currentPrice);
        }
      } catch (error) {
        console.error("Failed to stack:", error);
        removeBet(bet.id);
        addLocalBet(bet.row, bet.col, bet.amount - additionalAmount, currentPrice);
      }
    },
    [user, oracleSnapshot, stackBet, removeBet, addLocalBet, currentPrice]
  );

  // Cancel bet handler
  const handleCancelBet = useCallback(
    async (bet: LocalBet) => {
      if (!user || !bet.positionId) {
        removeBet(bet.id);
        return;
      }

      try {
        const result = await cancelPosition(bet.positionId);
        if (result.status === 4) {
          removeBet(bet.id);
        }
      } catch (error) {
        console.error("Failed to cancel:", error);
      }
    },
    [user, removeBet]
  );

  const handleAuthSuccess = useCallback(() => {
    checkAuth();
    setShowAuthModal(false);
  }, [checkAuth]);

  const handleConnectClick = useCallback(() => {
    setShowAuthModal(true);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a0a20" }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col select-none ${screenShake ? "screen-shake" : ""}`} style={{ background: "#1a0a20" }}>
      {/* Header */}
      <GameHeader
        user={user}
        currentPrice={currentPrice}
        oracleSnapshot={oracleSnapshot}
        oracleLoading={oracleLoading}
        onConnectClick={handleConnectClick}
        onSettingsClick={() => {}}
      />

      {/* Grid */}
      <GameGrid
        bets={bets}
        priceHistory={priceHistory}
        currentPrice={currentPrice}
        bidSize={bidSize}
        balance={balance}
        oracleSnapshot={oracleSnapshot}
        onPlaceBet={handlePlaceBet}
        onCancelBet={handleCancelBet}
        onStackBet={handleStackBet}
      />

      {/* Bottom */}
      <BottomControls
        user={user}
        balance={balance}
        bidSize={bidSize}
        onBidSizeChange={setBidSize}
        oracleStale={oracleSnapshot?.isStale || false}
        onConnectClick={handleConnectClick}
        onHistoryClick={() => setShowHistory(true)}
        hasHistory={history.length > 0}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Position History */}
      <PositionHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        positions={history}
        totalWins={historyStats.totalWins}
        totalLosses={historyStats.totalLosses}
        netProfit={historyStats.netProfit}
      />

      {/* Win Celebration */}
      <Confetti
        active={lastSettlement?.won === true}
        onComplete={clearLastSettlement}
      />

      {/* Settlement Toast */}
      {lastSettlement && (
        <div className={`settlement-toast ${lastSettlement.won ? "win" : "loss"}`}>
          {lastSettlement.won ? "YOU WON!" : "LOSS"}
          <span className="toast-amount">
            {lastSettlement.won ? "+" : "-"}$
            {lastSettlement.won
              ? lastSettlement.payout.toFixed(2)
              : "Bet Lost"}
          </span>
        </div>
      )}
    </div>
  );
}
