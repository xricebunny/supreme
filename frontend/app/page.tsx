"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { useBinancePrice } from "@/hooks/useBinancePrice";
import { useGameState } from "@/hooks/useGameState";
import { useAnimationTime } from "@/hooks/useAnimationTime";
import { useBalance } from "@/hooks/useBalance";
import { useBetManager } from "@/hooks/useBetManager";
import Sidebar from "@/components/Sidebar";
import PriceDisplay from "@/components/PriceDisplay";
import GameGrid from "@/components/GameGrid";
import BottomBar from "@/components/BottomBar";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/contexts/AuthProvider";
import { useMagic } from "@/contexts/MagicProvider";

const GRID_ROWS = 10;
const BASE_CELL_WIDTH = 72;
const BASE_CELL_HEIGHT = 56;

export default function TradePage() {
  const { address } = useAuth();
  const { magic } = useMagic();
  const { currentPrice, priceHistory, connected, timedOut } = useBinancePrice();
  const { betSize, setBetSize } = useGameState(currentPrice);

  // Magic.link authorization function for FCL
  const magicLinkAuthz = magic?.flow?.authorization;

  // PYUSD balance management (needs authz for minting)
  const {
    optimisticBalance,
    loading: balanceLoading,
    deductOptimistic,
    addOptimistic,
    mintPYUSD,
  } = useBalance(address, magicLinkAuthz);

  // Bet manager
  const { activeBets, placeBet } = useBetManager(
    address,
    magicLinkAuthz,
    priceHistory,
    deductOptimistic,
    addOptimistic
  );

  const gridAreaRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = gridAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute cell dimensions to fill available space
  const cellHeight =
    containerSize.height > 0
      ? containerSize.height / GRID_ROWS
      : BASE_CELL_HEIGHT;
  const cellWidth =
    containerSize.height > 0
      ? cellHeight * (BASE_CELL_WIDTH / BASE_CELL_HEIGHT)
      : BASE_CELL_WIDTH;

  const { timeSlot, baseTimeMs, slotProgress, gridRef, xAxisRef } = useAnimationTime(cellWidth);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const openLogin = useCallback(() => setShowLoginModal(true), []);
  const closeLogin = useCallback(() => setShowLoginModal(false), []);

  // Cell click handler — places a bet
  const handleCellClick = useCallback(
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
    }) => {
      if (!address || !magicLinkAuthz) {
        openLogin();
        return;
      }
      if (optimisticBalance < params.betSize) {
        return;
      }
      placeBet(params);
    },
    [address, magicLinkAuthz, optimisticBalance, placeBet, openLogin]
  );

  return (
    <div
      className="h-screen w-screen overflow-hidden flex"
      style={{ background: "#0a0f0d" }}
    >
      <Sidebar onLoginClick={openLogin} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-3"
          style={{
            background: "rgba(10, 15, 13, 0.9)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid #1e3329",
          }}
        >
          <PriceDisplay price={currentPrice} />
          <div className="flex items-center gap-3">
            {address && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: "#111a16",
                  border: "1px solid #1e3329",
                }}
              >
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: "#00ff88" }}
                >
                  ${optimisticBalance.toFixed(2)}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "#4a7a66" }}
                >
                  PYUSD
                </span>
              </div>
            )}
            {address && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: "#111a16",
                  border: "1px solid #1e3329",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00ff88",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-xs font-mono"
                  style={{ color: "#8ac4a7" }}
                >
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Grid area — fills remaining space */}
        <div
          ref={gridAreaRef}
          className="flex-1 relative overflow-hidden min-h-0"
        >
          {currentPrice === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div
                  className="text-sm font-medium mb-2"
                  style={{ color: timedOut ? "#ef4444" : "#00ff88" }}
                >
                  {timedOut
                    ? "Can't reach Binance — check your connection"
                    : connected
                      ? "Waiting for first trade..."
                      : "Connecting to Binance..."}
                </div>
                <div className="text-xs" style={{ color: "#4a7a66" }}>
                  BTC / USDT
                </div>
              </div>
            </div>
          ) : (
            <GameGrid
              currentPrice={currentPrice}
              priceHistory={priceHistory}
              betSize={betSize}
              timeSlot={timeSlot}
              baseTimeMs={baseTimeMs}
              slotProgress={slotProgress}
              gridRef={gridRef}
              xAxisRef={xAxisRef}
              cellWidth={cellWidth}
              cellHeight={cellHeight}
              activeBets={activeBets}
              onCellClick={handleCellClick}
            />
          )}
        </div>

        <BottomBar
          betSize={betSize}
          onBetSizeChange={setBetSize}
          onLoginClick={openLogin}
          pyusdBalance={optimisticBalance}
          onFundDemo={mintPYUSD}
          fundingLoading={balanceLoading}
        />
      </div>

      <LoginModal isOpen={showLoginModal} onClose={closeLogin} />
    </div>
  );
}
