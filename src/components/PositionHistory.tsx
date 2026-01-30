"use client";

import { useState } from "react";
import { SettledPosition } from "@/types";

interface PositionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  positions: SettledPosition[];
  totalWins: number;
  totalLosses: number;
  netProfit: number;
}

type FilterType = "all" | "wins" | "losses";

export default function PositionHistory({
  isOpen,
  onClose,
  positions,
  totalWins,
  totalLosses,
  netProfit,
}: PositionHistoryProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  if (!isOpen) return null;

  const filteredPositions = positions.filter((p) => {
    if (filter === "all") return true;
    if (filter === "wins") return p.won;
    return !p.won;
  });

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="history-overlay" onClick={onClose}>
      <div
        className="history-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="history-header">
          <h2 className="history-title">Position History</h2>
          <button className="history-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Stats Summary */}
        <div className="history-stats">
          <div className="stat-item">
            <span className="stat-label">Wins</span>
            <span className="stat-value stat-win">{totalWins}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Losses</span>
            <span className="stat-value stat-loss">{totalLosses}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Net P/L</span>
            <span
              className={`stat-value ${netProfit >= 0 ? "stat-win" : "stat-loss"}`}
            >
              {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="history-filters">
          {(["all", "wins", "losses"] as FilterType[]).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Positions List */}
        <div className="history-list">
          {filteredPositions.length === 0 ? (
            <div className="history-empty">
              No {filter === "all" ? "positions" : filter} yet
            </div>
          ) : (
            filteredPositions.map((pos) => (
              <div
                key={pos.id}
                className={`history-item ${pos.won ? "item-win" : "item-loss"}`}
              >
                <div className="item-left">
                  <div className="item-outcome">
                    {pos.won ? "🎉 WIN" : "💔 LOSS"}
                  </div>
                  <div className="item-time">{formatTime(pos.settledAt)}</div>
                </div>
                <div className="item-center">
                  <div className="item-prices">
                    ${pos.entryPrice.toFixed(1)} → ${pos.exitPrice.toFixed(1)}
                  </div>
                  <div className="item-mult">{pos.multiplier}x</div>
                </div>
                <div className="item-right">
                  <div className={`item-payout ${pos.won ? "payout-win" : "payout-loss"}`}>
                    {pos.won ? "+" : "-"}${pos.won ? pos.payout.toFixed(2) : pos.stake.toFixed(2)}
                  </div>
                  <div className="item-stake">Stake: ${pos.stake.toFixed(2)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
