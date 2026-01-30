"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GameGrid,
  GameHeader,
  BottomControls,
  AuthModal,
  Confetti,
  PositionHistory,
  Leaderboard,
  Onboarding,
  Settings,
  StatsDashboard,
} from "@/components";
import { useAuth, useGameState, useOracle } from "@/hooks";
import { logout } from "@/lib/magic";
import { initFCL, openPosition, cancelPosition } from "@/lib/flow";
import { haptics } from "@/lib/haptics";
import { sounds } from "@/lib/sounds";
import { LocalBet } from "@/types";

const ONBOARDING_KEY = "supreme_onboarding_completed";
const SOUND_KEY = "supreme_sound_enabled";
const HAPTICS_KEY = "supreme_haptics_enabled";

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
    clearHistory,
  } = useGameState();
  const { snapshot: oracleSnapshot, loading: oracleLoading } = useOracle();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const onboardingCompleted = localStorage.getItem(ONBOARDING_KEY);
      if (!onboardingCompleted) {
        setShowOnboarding(true);
      }

      const savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound !== null) {
        const enabled = savedSound === "true";
        setSoundEnabled(enabled);
        sounds.setEnabled(enabled);
      }

      const savedHaptics = localStorage.getItem(HAPTICS_KEY);
      if (savedHaptics !== null) {
        setHapticsEnabled(savedHaptics === "true");
      }
    }
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("SW registration failed:", err);
      });
    }
  }, []);

  // Play sounds on settlement
  useEffect(() => {
    if (lastSettlement) {
      if (lastSettlement.won) {
        sounds.win();
        if (hapticsEnabled) haptics.success();
      } else {
        sounds.loss();
        if (hapticsEnabled) haptics.error();
        setScreenShake(true);
        const timer = setTimeout(() => setScreenShake(false), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [lastSettlement, hapticsEnabled]);

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

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
  }, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const newValue = !prev;
      sounds.setEnabled(newValue);
      if (typeof window !== "undefined") {
        localStorage.setItem(SOUND_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  // Toggle haptics
  const toggleHaptics = useCallback(() => {
    setHapticsEnabled((prev) => {
      const newValue = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(HAPTICS_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  // Reset onboarding
  const resetOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_KEY);
    }
    setShowSettings(false);
    setShowOnboarding(true);
  }, []);

  // Place bet handler
  const handlePlaceBet = useCallback(
    async (row: number, col: number, amount: number) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      if (oracleSnapshot?.isStale) {
        console.warn("Oracle stale - betting paused");
        if (hapticsEnabled) haptics.warning();
        return;
      }

      // Feedback
      if (hapticsEnabled) haptics.tap();
      sounds.bet();

      const localBet = addLocalBet(row, col, amount, currentPrice);

      try {
        const result = await openPosition(row, col, amount);

        if (result.status === 4) {
          const positionId = result.events.find(
            (e: any) => e.type.includes("PositionOpened")
          )?.data?.positionId || `pos-${Date.now()}`;
          confirmBet(localBet.id, positionId);
          sounds.coin();
        } else {
          failBet(localBet.id);
          if (hapticsEnabled) haptics.error();
        }
      } catch (error) {
        console.error("Failed to place bet:", error);
        failBet(localBet.id);
        if (hapticsEnabled) haptics.error();
      }
    },
    [user, oracleSnapshot, addLocalBet, confirmBet, failBet, currentPrice, hapticsEnabled]
  );

  // Stack bet handler
  const handleStackBet = useCallback(
    async (bet: LocalBet, additionalAmount: number) => {
      if (!user || !bet.positionId) return;
      if (oracleSnapshot?.isStale) return;

      if (hapticsEnabled) haptics.tap();
      sounds.coin();
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
    [user, oracleSnapshot, stackBet, removeBet, addLocalBet, currentPrice, hapticsEnabled]
  );

  // Cancel bet handler
  const handleCancelBet = useCallback(
    async (bet: LocalBet) => {
      if (hapticsEnabled) haptics.press();
      sounds.cancel();

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
    [user, removeBet, hapticsEnabled]
  );

  const handleAuthSuccess = useCallback(() => {
    checkAuth();
    setShowAuthModal(false);
  }, [checkAuth]);

  const handleConnectClick = useCallback(() => {
    if (hapticsEnabled) haptics.tap();
    sounds.click();
    setShowAuthModal(true);
  }, [hapticsEnabled]);

  const handleBidSizeChange = useCallback((size: number) => {
    if (hapticsEnabled) haptics.tap();
    sounds.click();
    setBidSize(size);
  }, [setBidSize, hapticsEnabled]);

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
        onSettingsClick={() => {
          if (hapticsEnabled) haptics.tap();
          sounds.click();
          setShowSettings(true);
        }}
        soundEnabled={soundEnabled}
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
        onBidSizeChange={handleBidSizeChange}
        oracleStale={oracleSnapshot?.isStale || false}
        onConnectClick={handleConnectClick}
        onHistoryClick={() => {
          if (hapticsEnabled) haptics.tap();
          sounds.click();
          setShowStats(true);
        }}
        onLeaderboardClick={() => {
          if (hapticsEnabled) haptics.tap();
          sounds.click();
          setShowLeaderboard(true);
        }}
        hasHistory={history.length > 0}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Stats Dashboard (replaces simple history) */}
      <StatsDashboard
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        positions={history}
      />

      {/* Leaderboard */}
      <Leaderboard
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        currentUserAddress={user?.address}
      />

      {/* Settings */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        soundEnabled={soundEnabled}
        onSoundToggle={toggleSound}
        hapticsEnabled={hapticsEnabled}
        onHapticsToggle={toggleHaptics}
        onResetOnboarding={resetOnboarding}
        onResetHistory={() => {
          clearHistory?.();
          setShowSettings(false);
        }}
      />

      {/* Onboarding Tutorial */}
      <Onboarding
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
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
