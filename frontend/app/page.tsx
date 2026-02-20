"use client";

import { useSimulatedPrice } from "@/hooks/useSimulatedPrice";
import { useGameState } from "@/hooks/useGameState";
import { useAnimationTime } from "@/hooks/useAnimationTime";
import Sidebar from "@/components/Sidebar";
import PriceDisplay from "@/components/PriceDisplay";
import GameGrid from "@/components/GameGrid";
import BottomBar from "@/components/BottomBar";

export default function TradePage() {
  const { currentPrice } = useSimulatedPrice();
  const { betSize, setBetSize } = useGameState(currentPrice);
  const { timeSlot, gridRef, xAxisRef } = useAnimationTime();

  return (
    <div
      className="h-screen w-screen overflow-hidden relative"
      style={{ background: "#0a0f0d" }}
    >
      <Sidebar />

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

      <div className="absolute inset-0">
        <GameGrid
          currentPrice={currentPrice}
          betSize={betSize}
          timeSlot={timeSlot}
          gridRef={gridRef}
          xAxisRef={xAxisRef}
        />
      </div>

      <BottomBar
        balance={1842.5}
        betSize={betSize}
        onBetSizeChange={setBetSize}
      />
    </div>
  );
}
