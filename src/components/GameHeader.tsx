"use client";

import { User, OracleSnapshot } from "@/types";

interface GameHeaderProps {
  user: User | null;
  currentPrice: number;
  oracleSnapshot: OracleSnapshot | null;
  oracleLoading: boolean;
  onConnectClick: () => void;
  onSettingsClick: () => void;
  soundEnabled?: boolean;
}

export default function GameHeader({
  user,
  currentPrice,
  oracleSnapshot,
  oracleLoading,
  onConnectClick,
  onSettingsClick,
  soundEnabled = true,
}: GameHeaderProps) {
  return (
    <div style={{ background: "#1a0a20" }}>
      {/* Brand */}
      <div className="px-4 pt-3 pb-1">
        <h1
          className="text-2xl font-bold"
          style={{
            color: "#fff",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            letterSpacing: "-0.5px",
          }}
        >
          Supreme
        </h1>
      </div>

      {/* Price row */}
      <div className="flex items-center justify-between px-3 pb-3">
        {/* Current price pill */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: "#2d1f3d" }}
        >
          <span style={{ color: "#a78bfa", fontSize: 16 }}>◆</span>
          <span className="text-lg font-semibold text-white">
            {currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Oracle status */}
          {oracleLoading ? (
            <div className="spinner" />
          ) : oracleSnapshot ? (
            <div
              className={`text-xs px-2 py-1 rounded-full ${
                oracleSnapshot.isStale ? "oracle-stale" : "oracle-live"
              }`}
              style={{ background: "#2d1f3d" }}
            >
              {oracleSnapshot.isStale ? "⚠️ Stale" : "✓ Live"}
            </div>
          ) : null}

          {/* Sound toggle */}
          <button onClick={onSettingsClick} className="btn-circle">
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </div>
    </div>
  );
}
