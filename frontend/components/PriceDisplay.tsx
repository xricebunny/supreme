"use client";

import { formatPrice } from "@/lib/formatters";

interface PriceDisplayProps {
  price: number;
}

export default function PriceDisplay({ price }: PriceDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg"
        style={{ background: "#111a16" }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: "#4a7a66" }}
        >
          BTC
        </span>
        <span
          className="text-lg font-semibold tabular-nums"
          style={{ color: "#00ff88" }}
        >
          {formatPrice(price)}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ color: "#4a7a66" }}
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
    </div>
  );
}
