"use client";

import { useState } from "react";
import { TradeIcon, TrophyIcon, ProfileIcon } from "./Icons";
import { useAuth } from "@/contexts/AuthProvider";

export type Tab = "trade" | "leaderboard" | "profile";

const navItems: { icon: typeof TradeIcon; label: string; tab: Tab; tooltip?: string }[] = [
  { icon: TradeIcon, label: "Trade", tab: "trade" },
  { icon: TrophyIcon, label: "Leaderboard", tab: "leaderboard" },
  { icon: ProfileIcon, label: "Profile", tab: "profile" },
];

interface SidebarProps {
  onLoginClick: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isMobile?: boolean;
}

export default function Sidebar({ onLoginClick, activeTab, onTabChange, isMobile }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { isLoggedIn, isLoading, email, address, logout } = useAuth();

  /* ── Mobile: bottom tab bar ── */
  if (isMobile) {
    return (
      <nav
        className="flex-shrink-0 flex items-center justify-around"
        style={{
          background: "#0a0f0d",
          borderTop: "1px solid #1e3329",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map((item) => {
          const isActive = item.tab === activeTab;
          return (
            <button
              key={item.label}
              onClick={() => onTabChange(item.tab)}
              className="flex flex-col items-center gap-1 py-2 px-4"
              style={{
                background: "none",
                border: "none",
                color: isActive ? "#00ff88" : "#4a7a66",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                minWidth: 64,
              }}
            >
              <item.icon size={20} color={isActive ? "#00ff88" : "#4a7a66"} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {!isLoggedIn && !isLoading && (
          <button
            onClick={onLoginClick}
            className="flex flex-col items-center gap-1 py-2 px-4"
            style={{
              background: "none",
              border: "none",
              color: "#00ff88",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 600,
              minWidth: 64,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#00ff88",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#0a0f0d",
              }}
            >
              +
            </div>
            <span>Login</span>
          </button>
        )}
      </nav>
    );
  }

  /* ── Desktop: side nav ── */
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
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = item.tab === activeTab;
          const isDisabled = !!item.tooltip;
          return (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => item.tooltip && setHoveredItem(item.label)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => !isDisabled && onTabChange(item.tab)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors"
              style={{
                background: isActive ? "#111a16" : "transparent",
                color: isActive ? "#ffffff" : "#4a7a66",
                border: "none",
                cursor: isDisabled ? "default" : "pointer",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <item.icon size={18} color={isActive ? "#00ff88" : "#4a7a66"} />
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
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Login / Account section */}
      <div className="px-3 mb-4">
        {isLoading ? (
          <div
            style={{
              padding: "10px 16px",
              fontSize: 13,
              color: "#4a7a66",
              textAlign: "center",
            }}
          >
            Loading...
          </div>
        ) : isLoggedIn ? (
          <div
            style={{
              padding: "10px 12px",
              background: "#111a16",
              borderRadius: 8,
              border: "1px solid #1e3329",
            }}
          >
            <div style={{ fontSize: 11, color: "#4a7a66", marginBottom: 4 }}>
              Logged in
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email}
            </div>
            {address && (
              <div
                style={{
                  fontSize: 11,
                  color: "#4a7a66",
                  marginTop: 2,
                  fontFamily: "monospace",
                }}
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
            <button
              onClick={logout}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "6px",
                background: "transparent",
                border: "1px solid #1e3329",
                borderRadius: 6,
                color: "#4a7a66",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            style={{
              width: "100%",
              padding: "10px 16px",
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
        )}
      </div>

    </aside>
  );
}
