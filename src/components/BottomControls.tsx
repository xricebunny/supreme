"use client";

import { User } from "@/types";

interface BottomControlsProps {
  user: User | null;
  balance: number;
  bidSize: number;
  onBidSizeChange: (value: number) => void;
  oracleStale: boolean;
  onConnectClick: () => void;
  onHistoryClick?: () => void;
  onLeaderboardClick?: () => void;
  hasHistory?: boolean;
}

const BID_OPTIONS = [5, 10, 25, 50, 100];

export default function BottomControls({
  user,
  balance,
  bidSize,
  onBidSizeChange,
  oracleStale,
  onConnectClick,
  onHistoryClick,
  onLeaderboardClick,
  hasHistory,
}: BottomControlsProps) {
  const cycleBid = () => {
    const idx = BID_OPTIONS.indexOf(bidSize);
    const next = (idx + 1) % BID_OPTIONS.length;
    onBidSizeChange(BID_OPTIONS[next]);
  };

  return (
    <div className="p-3" style={{ background: "#0a0f0d" }}>
      {/* Stale warning */}
      {oracleStale && (
        <div
          className="text-xs text-center mb-2 py-1 px-3 rounded"
          style={{ background: "#111a16", color: "#ef4444" }}
        >
          ⚠️ Oracle stale - betting paused
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between mb-3">
        {/* Balance */}
        <button className="btn-pill">
          <span>📁</span>
          <span>${balance.toFixed(2)}</span>
        </button>

        {/* Quick action */}
        <button className="btn-circle">⚡</button>

        {/* Bid size - tap to cycle */}
        <button
          className="btn-pill"
          onClick={cycleBid}
          disabled={oracleStale}
        >
          <span>${bidSize}</span>
          <span>🪙</span>
        </button>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around py-1">
        <button className="nav-btn active">
          <span>📈</span>
        </button>
        <button className="nav-btn" onClick={onLeaderboardClick}>
          <span>🏆</span>
        </button>
        <button
          className="nav-btn"
          onClick={onHistoryClick}
          style={{ position: "relative" }}
        >
          <span style={{ opacity: hasHistory ? 1 : 0.5 }}>📋</span>
          {hasHistory && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 20,
                width: 8,
                height: 8,
                background: "#22c55e",
                borderRadius: "50%",
              }}
            />
          )}
        </button>
        <button className="nav-btn" onClick={!user ? onConnectClick : undefined}>
          <span style={{ opacity: user ? 1 : 0.5 }}>👤</span>
        </button>
      </div>

      {/* Instructions */}
      <div
        className="flex justify-center gap-4 text-xs mt-2"
        style={{ color: "#4a7a66" }}
      >
        <span>👆 Tap to bet</span>
        <span>👇 Hold to cancel</span>
      </div>
    </div>
  );
}
