"use client";

import { useSimulatedPrice } from "@/hooks/useSimulatedPrice";
import { useGameState } from "@/hooks/useGameState";
import Sidebar from "@/components/Sidebar";
import PriceDisplay from "@/components/PriceDisplay";
import GameGrid from "@/components/GameGrid";
import BottomBar from "@/components/BottomBar";

export default function TradePage() {
  const { currentPrice, priceHistory, tickIndex } = useSimulatedPrice();
  const {
    betSize,
    setBetSize,
    timeSlot,
  } = useGameState(currentPrice, tickIndex);

  return (
    <div
      className="h-screen w-screen overflow-hidden relative"
      style={{ background: "#0a0f0d" }}
    >
      {/* Left sidebar - overlays the grid */}
      <Sidebar />

      {/* Top bar: price display - positioned right of sidebar */}
      <div
        className="fixed top-0 right-0 z-20 flex items-center justify-between px-4 py-3"
        style={{
          left: 200,
          background: "rgba(10, 15, 13, 0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #1e3329",
        }}
      >
        <PriceDisplay price={currentPrice} />
      </div>

      {/* Game grid - full width, extends under sidebar */}
      <div className="absolute inset-0">
        <GameGrid
          currentPrice={currentPrice}
          tickIndex={tickIndex}
          betSize={betSize}
          timeSlot={timeSlot}
        />
      </div>

      {/* Bottom bar */}
      <BottomBar
        balance={1842.5}
        betSize={betSize}
        onBetSizeChange={setBetSize}
      />
    </div>
  );
}
