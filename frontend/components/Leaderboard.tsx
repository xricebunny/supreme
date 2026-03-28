"use client";

import { useState } from "react";
import { TrophyIcon } from "./Icons";

type TimeFilter = "24h" | "7d" | "30d" | "all";

interface LeaderboardEntry {
  rank: number;
  address: string;
  totalWagered: number;
  totalPayout: number;
  wins: number;
  losses: number;
  netPnl: number;
}

// Mock data — replace with real API call when backend leaderboard endpoint exists
const MOCK_DATA: LeaderboardEntry[] = [
  { rank: 1, address: "0x1a2b3c4d5e6f7890", totalWagered: 48250, totalPayout: 71880, wins: 312, losses: 198, netPnl: 23630 },
  { rank: 2, address: "0x9f8e7d6c5b4a3210", totalWagered: 35700, totalPayout: 49150, wins: 245, losses: 167, netPnl: 13450 },
  { rank: 3, address: "0x2468ace013579bdf", totalWagered: 29800, totalPayout: 39420, wins: 189, losses: 142, netPnl: 9620 },
  { rank: 4, address: "0xdeadbeef12345678", totalWagered: 22100, totalPayout: 28740, wins: 156, losses: 131, netPnl: 6640 },
  { rank: 5, address: "0xabcdef1234567890", totalWagered: 18950, totalPayout: 23810, wins: 134, losses: 112, netPnl: 4860 },
  { rank: 6, address: "0x1357924680abcdef", totalWagered: 15200, totalPayout: 18650, wins: 98, losses: 89, netPnl: 3450 },
  { rank: 7, address: "0xfedcba0987654321", totalWagered: 12800, totalPayout: 15370, wins: 87, losses: 76, netPnl: 2570 },
  { rank: 8, address: "0x0a1b2c3d4e5f6789", totalWagered: 10500, totalPayout: 12280, wins: 72, losses: 68, netPnl: 1780 },
  { rank: 9, address: "0x9876543210fedcba", totalWagered: 8900, totalPayout: 9940, wins: 61, losses: 59, netPnl: 1040 },
  { rank: 10, address: "0x5a4b3c2d1e0f9876", totalWagered: 7200, totalPayout: 7850, wins: 48, losses: 52, netPnl: 650 },
];

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPnl(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${prefix}$${(n / 1000).toFixed(1)}k`;
  return `${prefix}$${n.toFixed(0)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ffd700, #b8860b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#0a0f0d",
        }}
      >
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #c0c0c0, #808080)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#0a0f0d",
        }}
      >
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #cd7f32, #8b5a2b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#0a0f0d",
        }}
      >
        3
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

export default function Leaderboard() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");

  const filters: { label: string; value: TimeFilter }[] = [
    { label: "24H", value: "24h" },
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "All", value: "all" },
  ];

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{ background: "#0a0f0d" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 pt-6 pb-4"
        style={{
          borderBottom: "1px solid #1e3329",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <TrophyIcon size={22} color="#00ff88" />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Leaderboard
          </h2>
        </div>

        {/* Time filters */}
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTimeFilter(f.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor:
                  timeFilter === f.value ? "#00ff88" : "#1e3329",
                background:
                  timeFilter === f.value
                    ? "rgba(0, 255, 136, 0.1)"
                    : "transparent",
                color:
                  timeFilter === f.value ? "#00ff88" : "#4a7a66",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
          <div style={{ width: 40 }}>Rank</div>
          <div style={{ flex: 1 }}>Player</div>
          <div style={{ width: 90, textAlign: "right" }}>Wagered</div>
          <div style={{ width: 90, textAlign: "right" }}>Payout</div>
          <div style={{ width: 70, textAlign: "right" }}>W/L</div>
          <div style={{ width: 100, textAlign: "right" }}>Net P&L</div>
        </div>

        {/* Rows */}
        {MOCK_DATA.map((entry) => (
          <div
            key={entry.rank}
            className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors"
            style={{
              background:
                entry.rank <= 3
                  ? "rgba(0, 255, 136, 0.03)"
                  : "transparent",
              borderBottom: "1px solid rgba(30, 51, 41, 0.5)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 255, 136, 0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                entry.rank <= 3
                  ? "rgba(0, 255, 136, 0.03)"
                  : "transparent";
            }}
          >
            <div style={{ width: 40, display: "flex", justifyContent: "center" }}>
              <RankBadge rank={entry.rank} />
            </div>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: entry.rank <= 3 ? "#8ac4a7" : "#6b9b84",
                }}
              >
                {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
              </span>
            </div>
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
            <div
              style={{
                width: 70,
                textAlign: "right",
                fontSize: 12,
                color: "#4a7a66",
              }}
            >
              <span style={{ color: "#22c55e" }}>{entry.wins}</span>
              <span style={{ color: "#3d5c4d" }}>/</span>
              <span style={{ color: "#ef4444" }}>{entry.losses}</span>
            </div>
            <div
              style={{
                width: 100,
                textAlign: "right",
                fontSize: 13,
                fontWeight: 600,
                color: entry.netPnl >= 0 ? "#00ff88" : "#ef4444",
              }}
            >
              {formatPnl(entry.netPnl)}
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div
          className="text-center mt-6 pb-4"
          style={{ fontSize: 11, color: "#3d5c4d" }}
        >
          Leaderboard updates every 5 minutes
        </div>
      </div>
    </div>
  );
}
