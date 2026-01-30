"use client";

import { useMemo } from "react";
import { SettledPosition } from "@/types";

interface StatsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  positions: SettledPosition[];
}

interface Stats {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalWagered: number;
  totalPayout: number;
  netProfit: number;
  bestWin: number;
  worstLoss: number;
  currentStreak: number;
  bestStreak: number;
  avgMultiplier: number;
}

export default function StatsDashboard({
  isOpen,
  onClose,
  positions,
}: StatsDashboardProps) {
  const stats = useMemo<Stats>(() => {
    if (positions.length === 0) {
      return {
        totalBets: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalWagered: 0,
        totalPayout: 0,
        netProfit: 0,
        bestWin: 0,
        worstLoss: 0,
        currentStreak: 0,
        bestStreak: 0,
        avgMultiplier: 0,
      };
    }

    const wins = positions.filter((p) => p.won).length;
    const losses = positions.length - wins;
    const totalWagered = positions.reduce((sum, p) => sum + p.stake, 0);
    const totalPayout = positions.filter((p) => p.won).reduce((sum, p) => sum + p.payout, 0);
    const netProfit = totalPayout - totalWagered;

    // Best win (highest payout)
    const bestWin = Math.max(...positions.filter((p) => p.won).map((p) => p.payout - p.stake), 0);

    // Worst loss (highest stake lost)
    const worstLoss = Math.max(...positions.filter((p) => !p.won).map((p) => p.stake), 0);

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const sortedPositions = [...positions].sort((a, b) => b.settledAt - a.settledAt);

    // Current streak (from most recent)
    for (const pos of sortedPositions) {
      if (pos.won) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Best win streak
    for (const pos of sortedPositions) {
      if (pos.won) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Average multiplier
    const avgMultiplier =
      positions.reduce((sum, p) => sum + parseFloat(p.multiplier), 0) / positions.length;

    return {
      totalBets: positions.length,
      wins,
      losses,
      winRate: (wins / positions.length) * 100,
      totalWagered,
      totalPayout,
      netProfit,
      bestWin,
      worstLoss,
      currentStreak,
      bestStreak,
      avgMultiplier,
    };
  }, [positions]);

  if (!isOpen) return null;

  const StatCard = ({
    label,
    value,
    subValue,
    color,
    icon,
  }: {
    label: string;
    value: string;
    subValue?: string;
    color?: string;
    icon?: string;
  }) => (
    <div className="stat-card">
      {icon && <span className="stat-card-icon">{icon}</span>}
      <div className="stat-card-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-card-label">{label}</div>
      {subValue && <div className="stat-card-sub">{subValue}</div>}
    </div>
  );

  return (
    <div className="stats-overlay" onClick={onClose}>
      <div className="stats-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="stats-header">
          <h2 className="stats-title">Your Stats</h2>
          <button className="stats-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {positions.length === 0 ? (
          <div className="stats-empty">
            <span className="stats-empty-icon">📊</span>
            <p>No betting history yet</p>
            <p className="stats-empty-sub">Place some bets to see your stats!</p>
          </div>
        ) : (
          <div className="stats-content">
            {/* Main stats grid */}
            <div className="stats-grid">
              <StatCard
                icon="🎯"
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                subValue={`${stats.wins}W / ${stats.losses}L`}
                color={stats.winRate >= 50 ? "#22c55e" : "#ef4444"}
              />
              <StatCard
                icon="💰"
                label="Net Profit"
                value={`${stats.netProfit >= 0 ? "+" : ""}$${stats.netProfit.toFixed(2)}`}
                color={stats.netProfit >= 0 ? "#22c55e" : "#ef4444"}
              />
              <StatCard
                icon="🔥"
                label="Best Streak"
                value={`${stats.bestStreak}`}
                subValue={stats.currentStreak > 0 ? `Current: ${stats.currentStreak}` : undefined}
                color="#f97316"
              />
              <StatCard
                icon="⚡"
                label="Avg Multiplier"
                value={`${stats.avgMultiplier.toFixed(2)}x`}
                color="#a78bfa"
              />
            </div>

            {/* Detailed stats */}
            <div className="stats-details">
              <h3 className="stats-section-title">Performance</h3>
              <div className="stats-detail-row">
                <span>Total Bets</span>
                <span>{stats.totalBets}</span>
              </div>
              <div className="stats-detail-row">
                <span>Total Wagered</span>
                <span>${stats.totalWagered.toFixed(2)}</span>
              </div>
              <div className="stats-detail-row">
                <span>Total Payouts</span>
                <span className="text-green">${stats.totalPayout.toFixed(2)}</span>
              </div>
              <div className="stats-detail-row">
                <span>Best Win</span>
                <span className="text-green">+${stats.bestWin.toFixed(2)}</span>
              </div>
              <div className="stats-detail-row">
                <span>Worst Loss</span>
                <span className="text-red">-${stats.worstLoss.toFixed(2)}</span>
              </div>
            </div>

            {/* Win rate bar */}
            <div className="stats-winrate-bar">
              <div className="winrate-labels">
                <span className="text-green">{stats.wins} Wins</span>
                <span className="text-red">{stats.losses} Losses</span>
              </div>
              <div className="winrate-track">
                <div
                  className="winrate-fill"
                  style={{ width: `${stats.winRate}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
