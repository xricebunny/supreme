"use client";

import { TrophyIcon } from "./Icons";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthProvider";

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPnl(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${prefix}$${(n / 1000).toFixed(1)}k`;
  return `${prefix}$${n.toFixed(0)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const gradients: Record<number, string> = {
      1: "linear-gradient(135deg, #ffd700, #b8860b)",
      2: "linear-gradient(135deg, #c0c0c0, #808080)",
      3: "linear-gradient(135deg, #cd7f32, #8b5a2b)",
    };
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: gradients[rank],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#0a0f0d",
        }}
      >
        {rank}
      </div>
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 500,
        color: "#4a7a66",
      }}
    >
      {rank}
    </div>
  );
}

interface LeaderboardProps {
  isMobile?: boolean;
}

export default function Leaderboard({ isMobile }: LeaderboardProps) {
  const { entries, loading, error, refetch } = useLeaderboard();
  const { address } = useAuth();

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{ background: "#0a0f0d" }}
    >
      {/* Header */}
      <div
        className={`flex-shrink-0 ${isMobile ? "px-4 pt-4 pb-3" : "px-6 pt-6 pb-4"}`}
        style={{
          borderBottom: "1px solid #1e3329",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrophyIcon size={isMobile ? 18 : 22} color="var(--neon-primary)" />
            <h2
              style={{
                fontSize: isMobile ? 17 : 20,
                fontWeight: 700,
                color: "#ffffff",
                margin: 0,
              }}
            >
              Leaderboard
            </h2>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #1e3329",
              background: "transparent",
              color: loading ? "#3d5c4d" : "#4a7a66",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "px-3 py-3" : "px-6 py-4"}`}>
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

        {entries.length === 0 && !loading ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-2"
          >
            <TrophyIcon size={36} color="#1e3329" />
            <div style={{ fontSize: 14, color: "#4a7a66", marginTop: 8 }}>
              No settled bets yet
            </div>
            <div style={{ fontSize: 12, color: "#3d5c4d" }}>
              The leaderboard will populate as bets are settled on-chain
            </div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              className={`flex items-center ${isMobile ? "gap-2 px-2 pb-2" : "gap-3 px-3 pb-3"} mb-2`}
              style={{
                borderBottom: "1px solid #1e3329",
                fontSize: isMobile ? 10 : 11,
                fontWeight: 600,
                color: "#4a7a66",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <div style={{ width: isMobile ? 32 : 40 }}>Rank</div>
              <div style={{ flex: 1 }}>Player</div>
              {!isMobile && <div style={{ width: 90, textAlign: "right" }}>Wagered</div>}
              {!isMobile && <div style={{ width: 90, textAlign: "right" }}>Payout</div>}
              <div style={{ width: isMobile ? 50 : 70, textAlign: "right" }}>W/L</div>
              <div style={{ width: isMobile ? 70 : 100, textAlign: "right" }}>Net P&L</div>
            </div>

            {/* Rows */}
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isCurrentUser = address && entry.address.toLowerCase() === address.toLowerCase();
              return (
                <div
                  key={entry.address}
                  className={`flex items-center ${isMobile ? "gap-2 px-2 py-2.5" : "gap-3 px-3 py-3"} rounded-lg transition-colors`}
                  style={{
                    background: isCurrentUser
                      ? "rgba(var(--neon-rgb), 0.08)"
                      : rank <= 3
                        ? "rgba(var(--neon-rgb), 0.03)"
                        : "transparent",
                    borderBottom: "1px solid rgba(30, 51, 41, 0.5)",
                    border: isCurrentUser ? "1px solid rgba(var(--neon-rgb), 0.2)" : undefined,
                    borderRadius: isCurrentUser ? 8 : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentUser) {
                      e.currentTarget.style.background = "rgba(var(--neon-rgb), 0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentUser) {
                      e.currentTarget.style.background =
                        rank <= 3 ? "rgba(var(--neon-rgb), 0.03)" : "transparent";
                    }
                  }}
                >
                  <div style={{ width: isMobile ? 32 : 40, display: "flex", justifyContent: "center" }}>
                    <RankBadge rank={rank} />
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: isMobile ? 11 : 13,
                        fontFamily: "monospace",
                        color: rank <= 3 ? "#8ac4a7" : "#6b9b84",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                    </span>
                    {isCurrentUser && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--neon-primary)",
                          background: "rgba(var(--neon-rgb), 0.15)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  {!isMobile && (
                    <div
                      style={{
                        width: 90,
                        textAlign: "right",
                        fontSize: 13,
                        color: "#8ac4a7",
                        fontWeight: 500,
                      }}
                    >
                      {formatUsd(entry.totalWagered)}
                    </div>
                  )}
                  {!isMobile && (
                    <div
                      style={{
                        width: 90,
                        textAlign: "right",
                        fontSize: 13,
                        color: "#8ac4a7",
                        fontWeight: 500,
                      }}
                    >
                      {formatUsd(entry.totalPayout)}
                    </div>
                  )}
                  <div
                    style={{
                      width: isMobile ? 50 : 70,
                      textAlign: "right",
                      fontSize: isMobile ? 11 : 12,
                      color: "#4a7a66",
                    }}
                  >
                    <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                    <span style={{ color: "#3d5c4d" }}>/</span>
                    <span style={{ color: "#ef4444" }}>{entry.losses}</span>
                  </div>
                  <div
                    style={{
                      width: isMobile ? 70 : 100,
                      textAlign: "right",
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 600,
                      color: entry.netPnl >= 0 ? "var(--neon-primary)" : "#ef4444",
                    }}
                  >
                    {formatPnl(entry.netPnl)}
                  </div>
                </div>
              );
            })}

            {/* Footer note */}
            <div
              className="text-center mt-6 pb-4"
              style={{ fontSize: 11, color: "#3d5c4d" }}
            >
              Rankings based on {entries.reduce((s, e) => s + e.wins + e.losses, 0)} settled on-chain positions
            </div>
          </>
        )}
      </div>
    </div>
  );
}
