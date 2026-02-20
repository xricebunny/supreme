"use client";

import { formatBalance } from "@/lib/formatters";

const BET_SIZES = [5, 10, 25, 50, 75, 100];

interface BottomBarProps {
  balance: number;
  betSize: number;
  onBetSizeChange: (size: number) => void;
}

export default function BottomBar({
  balance,
  betSize,
  onBetSizeChange,
}: BottomBarProps) {
  const currentIndex = BET_SIZES.indexOf(betSize);

  const cycleBetSize = (direction: 1 | -1) => {
    const nextIndex =
      (currentIndex + direction + BET_SIZES.length) % BET_SIZES.length;
    onBetSizeChange(BET_SIZES[nextIndex]);
  };

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-6 py-3"
      style={{
        background: "#0a0f0d",
        borderTop: "1px solid #1e3329",
      }}
    >
      {/* Balance */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: "#111a16" }}
        >
          <span className="text-sm">💰</span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: "#ffffff" }}
          >
            {formatBalance(balance)}
          </span>
        </div>
      </div>

      {/* Bet size selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => cycleBetSize(-1)}
          className="flex items-center justify-center rounded-full transition-colors"
          style={{
            width: 32,
            height: 32,
            background: "#111a16",
            border: "1px solid #1e3329",
            color: "#4a7a66",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          −
        </button>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "#111a16",
            border: "1px solid #1e3329",
          }}
        >
          <span className="text-sm">🏁</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "#ffffff" }}
          >
            ${betSize}
          </span>
        </div>
        <button
          onClick={() => cycleBetSize(1)}
          className="flex items-center justify-center rounded-full transition-colors"
          style={{
            width: 32,
            height: 32,
            background: "#111a16",
            border: "1px solid #1e3329",
            color: "#4a7a66",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
