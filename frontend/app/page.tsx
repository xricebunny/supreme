"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useBinancePrice } from "@/hooks/useBinancePrice";
import { useGameState } from "@/hooks/useGameState";
import { useAnimationTime } from "@/hooks/useAnimationTime";
import Sidebar from "@/components/Sidebar";
import PriceDisplay from "@/components/PriceDisplay";
import GameGrid from "@/components/GameGrid";
import BottomBar from "@/components/BottomBar";
import LoginModal from "@/components/LoginModal";

const GRID_ROWS = 10;
const BASE_CELL_WIDTH = 72;
const BASE_CELL_HEIGHT = 56;

export default function TradePage() {
  const { currentPrice, priceHistory, connected, timedOut } = useBinancePrice();
  const { betSize, setBetSize } = useGameState(currentPrice);

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
            />
          )}
        </div>

        <BottomBar
          betSize={betSize}
          onBetSizeChange={setBetSize}
          onLoginClick={openLogin}
        />
      </div>

      <LoginModal isOpen={showLoginModal} onClose={closeLogin} />
    </div>
  );
}
