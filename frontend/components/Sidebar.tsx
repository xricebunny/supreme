"use client";

import { useState } from "react";
import { TradeIcon, TrophyIcon, ProfileIcon, SettingsIcon, MusicIcon } from "./Icons";

const navItems = [
  { icon: TradeIcon, label: "Trade", active: true },
  { icon: TrophyIcon, label: "Leaderboard", active: false, tooltip: "Coming Soon" },
  { icon: ProfileIcon, label: "Profile", active: false, tooltip: "Coming Soon" },
];

export default function Sidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className="flex-shrink-0 flex flex-col"
      style={{
        width: 200,
        background: "#0a0f0d",
        borderRight: "1px solid #1e3329",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-8">
        <h1
          className="text-xl font-bold tracking-tight"
          style={{
            color: "#00ff88",
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "-0.5px",
          }}
        >
          SUPREME
        </h1>
        <div className="text-xs mt-1" style={{ color: "#4a7a66" }}>
          FLOW Predictions
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => item.tooltip && setHoveredItem(item.label)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors"
              style={{
                background: item.active ? "#111a16" : "transparent",
                color: item.active ? "#ffffff" : "#4a7a66",
                border: "none",
                cursor: item.active ? "pointer" : "default",
                fontSize: 14,
                fontWeight: item.active ? 600 : 400,
              }}
            >
              <item.icon size={18} color={item.active ? "#00ff88" : "#4a7a66"} />
              <span>{item.label}</span>
            </button>
            {item.tooltip && hoveredItem === item.label && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  transform: "translateX(-50%)",
                  zIndex: 10,
                  background: "#1a2b23",
                  color: "#8ac4a7",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  border: "1px solid #2a4a3a",
                  pointerEvents: "none",
                }}
              >
                {item.tooltip}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom icons */}
      <div className="flex items-center gap-2 px-5 pb-6">
        <button
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <SettingsIcon size={18} color="#4a7a66" />
        </button>
        <button
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <MusicIcon size={18} color="#4a7a66" />
        </button>
      </div>
    </aside>
  );
}
