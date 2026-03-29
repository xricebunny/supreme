"use client";

import { useState, useRef, useEffect } from "react";
import { formatPrice } from "@/lib/formatters";
import type { TokenSymbol } from "@/hooks/useBinancePrice";
import { TOKEN_LABELS } from "@/hooks/useTokenSelector";

const AVAILABLE_TOKENS: TokenSymbol[] = ["btc", "flow"];

interface PriceDisplayProps {
  price: number;
  symbol: TokenSymbol;
  onSymbolChange: (symbol: TokenSymbol) => void;
}

export default function PriceDisplay({ price, symbol, onSymbolChange }: PriceDisplayProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer select-none"
        style={{ background: "#111a16" }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "#4a7a66" }}
        >
          {TOKEN_LABELS[symbol]}
        </span>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: "var(--neon-primary)" }}
        >
          {formatPrice(price)}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color: "#4a7a66",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <path
            d="M3 5L6 8L9 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-50"
          style={{
            background: "#111a16",
            border: "1px solid #1e3329",
            minWidth: 120,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {AVAILABLE_TOKENS.map((t) => (
            <button
              key={t}
              className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2"
              style={{
                color: t === symbol ? "var(--neon-primary)" : "#8ac4a7",
                background: t === symbol ? "rgba(var(--neon-rgb),0.08)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (t !== symbol) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(var(--neon-rgb),0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (t !== symbol) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
              onClick={() => {
                onSymbolChange(t);
                setOpen(false);
              }}
            >
              {TOKEN_LABELS[t]}
              {t === symbol && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="var(--neon-primary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
