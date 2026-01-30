"use client";

import { useState, useEffect } from "react";
import { LeaderboardEntry } from "@/types";

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress?: string;
}

// Mock leaderboard data - would come from backend in production
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "CryptoWhale", balance: 2847.50, color: "#FFD700" },
  { rank: 2, name: "FlowMaster", balance: 1923.25, color: "#C0C0C0" },
  { rank: 3, name: "GridKing", balance: 1456.80, color: "#CD7F32" },
  { rank: 4, name: "BetQueen", balance: 987.45, color: "#00ff88" },
  { rank: 5, name: "LuckyTrader", balance: 756.20, color: "#00e5ff" },
  { rank: 6, name: "PriceHunter", balance: 623.15, color: "#00ffaa" },
  { rank: 7, name: "GridNinja", balance: 498.90, color: "#40efff" },
  { rank: 8, name: "FlowRider", balance: 412.35, color: "#88ffcc" },
  { rank: 9, name: "BullRunner", balance: 345.60, color: "#00ff88" },
  { rank: 10, name: "ChartMaster", balance: 287.25, color: "#00e5ff" },
];

type TimeFilter = "daily" | "weekly" | "allTime";

export default function Leaderboard({
  isOpen,
  onClose,
  currentUserAddress,
}: LeaderboardProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulate loading leaderboard data
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const timer = setTimeout(() => {
      // Randomize balances slightly based on filter to simulate different data
      const multiplier = timeFilter === "daily" ? 0.1 : timeFilter === "weekly" ? 0.5 : 1;
      const data: LeaderboardEntry[] = MOCK_LEADERBOARD.map((entry, i) => ({
        ...entry,
        balance: Math.round(entry.balance * multiplier * (1 + Math.random() * 0.2) * 100) / 100,
        isCurrentUser: !!(currentUserAddress && i === 7), // Simulate current user at rank 8
      }));
      setEntries(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, timeFilter, currentUserAddress]);

  if (!isOpen) return null;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${rank}`;
    }
  };

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div
        className="leaderboard-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="leaderboard-header">
          <h2 className="leaderboard-title">Leaderboard</h2>
          <button className="leaderboard-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Time filter tabs */}
        <div className="leaderboard-filters">
          {(["daily", "weekly", "allTime"] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              className={`lb-filter-btn ${timeFilter === filter ? "active" : ""}`}
              onClick={() => setTimeFilter(filter)}
            >
              {filter === "allTime" ? "All Time" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Leaderboard list */}
        <div className="leaderboard-list">
          {loading ? (
            <div className="leaderboard-loading">
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.rank}
                className={`leaderboard-item ${entry.isCurrentUser ? "current-user" : ""} ${entry.rank <= 3 ? "top-three" : ""}`}
              >
                <div className="lb-rank" style={{ color: entry.rank <= 3 ? entry.color : undefined }}>
                  {getRankIcon(entry.rank)}
                </div>
                <div className="lb-info">
                  <div className="lb-name" style={{ color: entry.isCurrentUser ? "#00ff88" : undefined }}>
                    {entry.name}
                    {entry.isCurrentUser && <span className="lb-you-badge">YOU</span>}
                  </div>
                  <div className="lb-stats">
                    {entry.rank <= 3 && "🔥 Top Player"}
                  </div>
                </div>
                <div className="lb-balance">
                  ${entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Current user summary */}
        {currentUserAddress && (
          <div className="leaderboard-footer">
            <span className="footer-label">Your Rank</span>
            <span className="footer-value">#8 of 1,247 players</span>
          </div>
        )}
      </div>
    </div>
  );
}
