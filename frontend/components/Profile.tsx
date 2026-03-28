"use client";

import { ProfileIcon } from "./Icons";
import { useAuth } from "@/contexts/AuthProvider";

interface BetHistoryEntry {
  id: string;
  token: string;
  betSize: number;
  multiplier: number;
  payout: number;
  result: "won" | "lost";
  timestamp: number;
}

// Mock data — replace with real API call
const MOCK_HISTORY: BetHistoryEntry[] = [
  { id: "1", token: "BTC", betSize: 25, multiplier: 3.2, payout: 80, result: "won", timestamp: Date.now() - 120_000 },
  { id: "2", token: "BTC", betSize: 50, multiplier: 2.1, payout: 0, result: "lost", timestamp: Date.now() - 300_000 },
  { id: "3", token: "FLOW", betSize: 10, multiplier: 5.4, payout: 54, result: "won", timestamp: Date.now() - 480_000 },
  { id: "4", token: "BTC", betSize: 25, multiplier: 1.8, payout: 0, result: "lost", timestamp: Date.now() - 720_000 },
  { id: "5", token: "FLOW", betSize: 50, multiplier: 2.6, payout: 130, result: "won", timestamp: Date.now() - 900_000 },
  { id: "6", token: "BTC", betSize: 100, multiplier: 4.1, payout: 0, result: "lost", timestamp: Date.now() - 1_200_000 },
  { id: "7", token: "BTC", betSize: 25, multiplier: 1.9, payout: 47.5, result: "won", timestamp: Date.now() - 1_500_000 },
  { id: "8", token: "FLOW", betSize: 10, multiplier: 7.2, payout: 72, result: "won", timestamp: Date.now() - 1_800_000 },
];

const MOCK_STATS = {
  totalBets: 142,
  wins: 83,
  losses: 59,
  totalWagered: 8450,
  totalPayout: 11230,
  netPnl: 2780,
  winRate: 58.5,
  bestMultiplier: 12.4,
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

interface ProfileProps {
  pyusdBalance: number;
  onLoginClick: () => void;
}

export default function Profile({ pyusdBalance, onLoginClick }: ProfileProps) {
  const { isLoggedIn, email, address } = useAuth();

  if (!isLoggedIn) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-4"
        style={{ background: "#0a0f0d" }}
      >
        <ProfileIcon size={48} color="#1e3329" />
        <div style={{ fontSize: 16, color: "#4a7a66", fontWeight: 500 }}>
          Log in to view your profile
        </div>
        <button
          onClick={onLoginClick}
          style={{
            padding: "10px 24px",
            background: "#00ff88",
            color: "#0a0f0d",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{ background: "#0a0f0d" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{ borderBottom: "1px solid #1e3329" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <ProfileIcon size={22} color="#00ff88" />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Profile
          </h2>
        </div>

        {/* Account info */}
        <div className="flex items-center gap-4">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00ff88, #00b4d8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
              color: "#0a0f0d",
            }}
          >
            {(email?.[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, color: "#ffffff", fontWeight: 600 }}>
              {email}
            </div>
            {address && (
              <div
                style={{
                  fontSize: 12,
                  color: "#4a7a66",
                  fontFamily: "monospace",
                  marginTop: 2,
                }}
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
          </div>
          <div className="ml-auto">
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
                ${pyusdBalance.toFixed(2)}
              </span>
              <span className="text-[10px]" style={{ color: "#4a7a66" }}>
                PYUSD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderBottom: "1px solid #1e3329" }}
      >
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Win Rate", value: `${MOCK_STATS.winRate}%`, color: "#00ff88" },
            { label: "Total Bets", value: `${MOCK_STATS.totalBets}`, color: "#8ac4a7" },
            { label: "Net P&L", value: formatUsd(MOCK_STATS.netPnl), color: MOCK_STATS.netPnl >= 0 ? "#00ff88" : "#ef4444" },
            { label: "Best Multi", value: `${MOCK_STATS.bestMultiplier}x`, color: "#00e5ff" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "12px 14px",
                background: "#111a16",
                borderRadius: 10,
                border: "1px solid #1e3329",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#4a7a66",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 4,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* W/L bar */}
        <div className="mt-3 flex items-center gap-2">
          <span style={{ fontSize: 11, color: "#4a7a66", width: 24 }}>
            W/L
          </span>
          <div
            className="flex-1 flex rounded-full overflow-hidden"
            style={{ height: 6, background: "#1e3329" }}
          >
            <div
              style={{
                width: `${(MOCK_STATS.wins / MOCK_STATS.totalBets) * 100}%`,
                background: "#22c55e",
                borderRadius: "3px 0 0 3px",
              }}
            />
            <div
              style={{
                width: `${(MOCK_STATS.losses / MOCK_STATS.totalBets) * 100}%`,
                background: "#ef4444",
                borderRadius: "0 3px 3px 0",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "#4a7a66", minWidth: 50, textAlign: "right" }}>
            <span style={{ color: "#22c55e" }}>{MOCK_STATS.wins}</span>
            <span style={{ color: "#3d5c4d" }}>/</span>
            <span style={{ color: "#ef4444" }}>{MOCK_STATS.losses}</span>
          </span>
        </div>
      </div>

      {/* Bet history */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            marginBottom: 12,
          }}
        >
          Recent Bets
        </div>

        {/* Table header */}
        <div
          className="flex items-center gap-3 px-3 pb-3 mb-2"
          style={{
            borderBottom: "1px solid #1e3329",
            fontSize: 11,
            fontWeight: 600,
            color: "#4a7a66",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <div style={{ width: 50 }}>Token</div>
          <div style={{ width: 70, textAlign: "right" }}>Stake</div>
          <div style={{ width: 60, textAlign: "right" }}>Multi</div>
          <div style={{ flex: 1, textAlign: "right" }}>Result</div>
          <div style={{ width: 70, textAlign: "right" }}>Time</div>
        </div>

        {/* Rows */}
        {MOCK_HISTORY.map((bet) => (
          <div
            key={bet.id}
            className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors"
            style={{
              borderBottom: "1px solid rgba(30, 51, 41, 0.5)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 255, 136, 0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 50,
                fontSize: 12,
                fontWeight: 600,
                color: "#8ac4a7",
              }}
            >
              {bet.token}
            </div>
            <div
              style={{
                width: 70,
                textAlign: "right",
                fontSize: 13,
                color: "#8ac4a7",
              }}
            >
              ${bet.betSize}
            </div>
            <div
              style={{
                width: 60,
                textAlign: "right",
                fontSize: 13,
                color: "#4a7a66",
              }}
            >
              {bet.multiplier}x
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "right",
                fontSize: 13,
                fontWeight: 600,
                color: bet.result === "won" ? "#22c55e" : "#ef4444",
              }}
            >
              {bet.result === "won"
                ? `+$${bet.payout.toFixed(0)}`
                : `-$${bet.betSize}`}
            </div>
            <div
              style={{
                width: 70,
                textAlign: "right",
                fontSize: 11,
                color: "#3d5c4d",
              }}
            >
              {formatTimeAgo(bet.timestamp)}
            </div>
          </div>
        ))}

        <div
          className="text-center mt-6 pb-4"
          style={{ fontSize: 11, color: "#3d5c4d" }}
        >
          Showing recent bets from this session
        </div>
      </div>
    </div>
  );
}
