"use client";

import { useMemo } from "react";
import { ProfileIcon } from "./Icons";
import { useAuth } from "@/contexts/AuthProvider";
import { useProfile } from "@/hooks/useProfile";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return "pending";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPnl(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${prefix}$${(n / 1000).toFixed(1)}k`;
  return `${prefix}$${n.toFixed(0)}`;
}

interface ProfileProps {
  pyusdBalance: number;
  onLoginClick: () => void;
}

export default function Profile({ pyusdBalance, onLoginClick }: ProfileProps) {
  const { isLoggedIn, email, address } = useAuth();
  const { positions, stats, loading, error, refetch } = useProfile(address);

  // Compute running P&L for each position (positions are newest-first)
  const runningPnl = useMemo(() => {
    const pnl: number[] = new Array(positions.length);
    let cumulative = 0;
    for (let i = positions.length - 1; i >= 0; i--) {
      const p = positions[i];
      if (p.settled) {
        cumulative += p.won ? (p.payout - p.stake) : -p.stake;
      }
      pnl[i] = cumulative;
    }
    return pnl;
  }, [positions]);

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
        {loading && positions.length === 0 ? (
          <div style={{ fontSize: 13, color: "#4a7a66", textAlign: "center", padding: "12px 0" }}>
            Loading stats...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Win Rate", value: stats.totalBets > 0 ? `${stats.winRate.toFixed(1)}%` : "—", color: "#00ff88" },
                { label: "Total Bets", value: `${stats.totalBets}`, color: "#8ac4a7" },
                { label: "Net P&L", value: stats.totalBets > 0 ? formatPnl(stats.netPnl) : "—", color: stats.netPnl >= 0 ? "#00ff88" : "#ef4444" },
                { label: "Best Multi", value: stats.bestMultiplier > 0 ? `${stats.bestMultiplier.toFixed(1)}x` : "—", color: "#00e5ff" },
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
            {stats.totalBets > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span style={{ fontSize: 11, color: "#4a7a66", width: 24 }}>
                  W/L
                </span>
                <div
                  className="flex-1 flex rounded-full overflow-hidden"
                  style={{ height: 6, background: "#1e3329" }}
                >
                  {stats.wins > 0 && (
                    <div
                      style={{
                        width: `${(stats.wins / (stats.wins + stats.losses)) * 100}%`,
                        background: "#22c55e",
                        borderRadius: "3px 0 0 3px",
                      }}
                    />
                  )}
                  {stats.losses > 0 && (
                    <div
                      style={{
                        width: `${(stats.losses / (stats.wins + stats.losses)) * 100}%`,
                        background: "#ef4444",
                        borderRadius: "0 3px 3px 0",
                      }}
                    />
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#4a7a66", minWidth: 50, textAlign: "right" }}>
                  <span style={{ color: "#22c55e" }}>{stats.wins}</span>
                  <span style={{ color: "#3d5c4d" }}>/</span>
                  <span style={{ color: "#ef4444" }}>{stats.losses}</span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bet history */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            Bet History
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #1e3329",
              background: "transparent",
              color: loading ? "#3d5c4d" : "#4a7a66",
              fontSize: 11,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {positions.length === 0 && !loading ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
          >
            <div style={{ fontSize: 14, color: "#4a7a66" }}>
              No bets yet
            </div>
            <div style={{ fontSize: 12, color: "#3d5c4d" }}>
              Place your first bet on the Trade tab
            </div>
          </div>
        ) : (
          <>
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
              <div style={{ width: 80, textAlign: "right" }}>Run. P&L</div>
              <div style={{ width: 70, textAlign: "right" }}>Time</div>
            </div>

            {/* Rows */}
            {positions.map((pos, idx) => (
              <div
                key={pos.id}
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
                  {pos.token}
                </div>
                <div
                  style={{
                    width: 70,
                    textAlign: "right",
                    fontSize: 13,
                    color: "#8ac4a7",
                  }}
                >
                  ${pos.stake.toFixed(0)}
                </div>
                <div
                  style={{
                    width: 60,
                    textAlign: "right",
                    fontSize: 13,
                    color: "#4a7a66",
                  }}
                >
                  {pos.multiplier.toFixed(1)}x
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 600,
                    color: !pos.settled
                      ? "#f59e0b"
                      : pos.won
                        ? "#22c55e"
                        : "#ef4444",
                  }}
                >
                  {!pos.settled
                    ? "Pending"
                    : pos.won
                      ? `+${formatUsd(pos.payout - pos.stake)}`
                      : `-${formatUsd(pos.stake)}`}
                </div>
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "monospace",
                    color: runningPnl[idx] >= 0 ? "#00ff88" : "#ef4444",
                  }}
                >
                  {formatPnl(runningPnl[idx])}
                </div>
                <div
                  style={{
                    width: 70,
                    textAlign: "right",
                    fontSize: 11,
                    color: "#3d5c4d",
                  }}
                >
                  {formatTimeAgo(pos.expiryTimestamp)}
                </div>
              </div>
            ))}

            <div
              className="text-center mt-6 pb-4"
              style={{ fontSize: 11, color: "#3d5c4d" }}
            >
              Showing all {positions.length} on-chain positions
            </div>
          </>
        )}
      </div>
    </div>
  );
}
