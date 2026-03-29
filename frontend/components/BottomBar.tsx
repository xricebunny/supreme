"use client";

import { useState } from "react";
import { formatBalance } from "@/lib/formatters";
import { CoinsIcon, ChipIcon } from "./Icons";
import { useAuth } from "@/contexts/AuthProvider";

const BET_SIZES = [5, 10, 25, 50, 75, 100];
const FUND_THRESHOLD = 50;
const FUND_AMOUNT = 1000;

interface BottomBarProps {
  betSize: number;
  onBetSizeChange: (size: number) => void;
  onLoginClick: () => void;
  pyusdBalance?: number;
  onFundDemo?: (amount: number) => Promise<void>;
  fundingLoading?: boolean;
  isMobile?: boolean;
}

export default function BottomBar({
  betSize,
  onBetSizeChange,
  onLoginClick,
  pyusdBalance,
  onFundDemo,
  fundingLoading,
  isMobile,
}: BottomBarProps) {
  const { isLoggedIn, balance } = useAuth();
  const currentIndex = BET_SIZES.indexOf(betSize);
  const [fundMessage, setFundMessage] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  const cycleBetSize = (direction: 1 | -1) => {
    const nextIndex =
      (currentIndex + direction + BET_SIZES.length) % BET_SIZES.length;
    onBetSizeChange(BET_SIZES[nextIndex]);
  };

  const handleFundDemo = async () => {
    if (!onFundDemo || funding || fundingLoading) return;
    if (pyusdBalance !== undefined && pyusdBalance >= FUND_THRESHOLD) {
      setFundMessage("Balance above $50 — no top-up needed");
      setTimeout(() => setFundMessage(null), 3000);
      return;
    }
    setFunding(true);
    setFundMessage(null);
    try {
      await onFundDemo(FUND_AMOUNT);
      setFundMessage("Funded $1,000 PYUSD!");
      setTimeout(() => setFundMessage(null), 3000);
    } catch (err: any) {
      setFundMessage("Funding failed — try again");
      setTimeout(() => setFundMessage(null), 4000);
      // fund demo failed
    } finally {
      setFunding(false);
    }
  };

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-between ${isMobile ? "px-3 py-2 gap-2" : "px-6 py-3"}`}
      style={{
        background: "#0a0f0d",
        borderTop: "1px solid #1e3329",
      }}
    >
      {/* Balance + Fund Demo */}
      <div className={`flex items-center ${isMobile ? "gap-2" : "gap-3"} min-w-0`}>
        {isLoggedIn ? (
          <>
            <div
              className={`flex items-center gap-2 ${isMobile ? "px-2.5 py-1.5" : "px-4 py-2"} rounded-full`}
              style={{ background: "#111a16" }}
            >
              <CoinsIcon size={isMobile ? 14 : 16} color="#00ff88" />
              <span
                className={`${isMobile ? "text-xs" : "text-sm"} font-semibold tabular-nums`}
                style={{ color: "#ffffff" }}
              >
                {pyusdBalance !== undefined ? `$${pyusdBalance.toFixed(isMobile ? 0 : 2)}` : "..."}
              </span>
              {!isMobile && (
                <span
                  className="text-xs"
                  style={{ color: "#4a7a66" }}
                >
                  PYUSD
                </span>
              )}
            </div>
            {(pyusdBalance === undefined || pyusdBalance < FUND_THRESHOLD) && (
              <button
                onClick={handleFundDemo}
                disabled={funding || fundingLoading}
                className={`flex items-center gap-1.5 ${isMobile ? "px-2 py-1.5" : "px-3 py-2"} rounded-full transition-colors`}
                style={{
                  background: funding ? "#1a2721" : "#111a16",
                  border: "1px solid #1e3329",
                  color: funding ? "#4a7a66" : "#00ff88",
                  cursor: funding ? "wait" : "pointer",
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  opacity: funding ? 0.7 : 1,
                }}
              >
                {funding ? "..." : "Fund"}
              </button>
            )}
            {fundMessage && !isMobile && (
              <span
                className="text-xs font-medium"
                style={{
                  color: fundMessage.includes("failed")
                    ? "#f59e0b"
                    : "#00ff88",
                }}
              >
                {fundMessage}
              </span>
            )}
            {!isMobile && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-full"
                style={{ background: "#111a16" }}
              >
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: "#8ac4a7" }}
                >
                  {balance !== null ? formatBalance(balance) : "..."}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "#3d5c4d" }}
                >
                  FLOW
                </span>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className={`flex items-center gap-2 ${isMobile ? "px-3 py-1.5" : "px-4 py-2"} rounded-full`}
            style={{
              background: "#111a16",
              border: "1px solid #1e3329",
              color: "#4a7a66",
              cursor: "pointer",
              fontSize: isMobile ? 12 : 13,
            }}
          >
            Login to bet
          </button>
        )}
      </div>

      {/* Bet size selector */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => cycleBetSize(-1)}
          className="flex items-center justify-center rounded-full transition-colors"
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
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
          className={`flex items-center gap-2 ${isMobile ? "px-3 py-1.5" : "px-4 py-2"} rounded-full`}
          style={{
            background: "#111a16",
            border: "1px solid #1e3329",
          }}
        >
          <ChipIcon size={isMobile ? 14 : 16} color="#00ff88" />
          <span
            className={`${isMobile ? "text-xs" : "text-sm"} font-bold tabular-nums`}
            style={{ color: "#ffffff" }}
          >
            ${betSize}
          </span>
        </div>
        <button
          onClick={() => cycleBetSize(1)}
          className="flex items-center justify-center rounded-full transition-colors"
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
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
