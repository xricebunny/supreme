"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LocalBet, PricePoint, OracleSnapshot } from "@/types";

interface GameGridProps {
  bets: LocalBet[];
  priceHistory: PricePoint[];
  currentPrice: number;
  bidSize: number;
  balance: number;
  oracleSnapshot: OracleSnapshot | null;
  onPlaceBet: (row: number, col: number, amount: number) => Promise<void>;
  onCancelBet: (bet: LocalBet) => Promise<void>;
  onStackBet: (bet: LocalBet, additionalAmount: number) => Promise<void>;
}

const ROWS = 14;
const COLS = 6;
const CELL_W = 56;
const CELL_H = 38;
const HOLD_MS = 500;
const PRICE_STEP = 0.035;
const BASE_PRICE = 0.75;

export default function GameGrid({
  bets,
  priceHistory,
  currentPrice,
  bidSize,
  balance,
  oracleSnapshot,
  onPlaceBet,
  onCancelBet,
  onStackBet,
}: GameGridProps) {
  const [holdCell, setHoldCell] = useState<{ r: number; c: number } | null>(null);
  const [holdProg, setHoldProg] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);

  const cancelledRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);

  // Price levels for Y-axis
  const priceLevels = useMemo(() => {
    const levels: number[] = [];
    for (let i = 0; i < ROWS; i++) {
      levels.push(BASE_PRICE + (ROWS / 2 - i) * PRICE_STEP);
    }
    return levels;
  }, []);

  // Time labels
  useEffect(() => {
    const update = () => {
      const labels: string[] = [];
      const now = Date.now();
      for (let i = 0; i < COLS + 1; i++) {
        const t = new Date(now + i * 10000);
        const h = t.getHours() % 12 || 12;
        const m = t.getMinutes().toString().padStart(2, "0");
        const s = t.getSeconds().toString().padStart(2, "0");
        labels.push(`${h}:${m}:${s}`);
      }
      setTimeLabels(labels);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const getBet = useCallback(
    (r: number, c: number) => bets.find((b) => b.row === r && b.col === c),
    [bets]
  );

  // Current price row
  const priceRow = useMemo(() => {
    for (let i = 0; i < priceLevels.length; i++) {
      if (currentPrice >= priceLevels[i] - PRICE_STEP / 2) return i;
    }
    return priceLevels.length - 1;
  }, [currentPrice, priceLevels]);

  // Multiplier
  const getMult = useCallback(
    (r: number, c: number) => {
      const pd = Math.abs(r - priceRow);
      const td = COLS - c;
      return (1.0 + pd * 0.8 + td * 3.0 + pd * td * 0.35).toFixed(1);
    },
    [priceRow]
  );

  // Hold progress animation
  const animateHold = useCallback(() => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / HOLD_MS, 1);
    setHoldProg(p);
    if (p < 1) animRef.current = requestAnimationFrame(animateHold);
  }, []);

  const onDown = useCallback(
    (e: React.PointerEvent, r: number, c: number, bet: LocalBet | undefined) => {
      if (!bet || bet.status === "pending") return;
      cancelledRef.current = false;
      setHoldCell({ r, c });
      startRef.current = Date.now();
      animRef.current = requestAnimationFrame(animateHold);

      timerRef.current = setTimeout(async () => {
        const b = getBet(r, c);
        if (b && b.status === "confirmed") {
          setProcessing(`${r}-${c}`);
          try {
            await onCancelBet(b);
          } finally {
            setProcessing(null);
          }
        }
        cancelledRef.current = true;
        setHoldCell(null);
        setHoldProg(0);
        startRef.current = null;
      }, HOLD_MS);
    },
    [getBet, onCancelBet, animateHold]
  );

  const onUp = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setHoldCell(null);
    setHoldProg(0);
    startRef.current = null;
  }, []);

  const onClick = useCallback(
    async (r: number, c: number) => {
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      if (oracleSnapshot?.isStale) return;

      const bet = getBet(r, c);
      if (bet) {
        if (bet.status === "pending") return;
        if (balance >= bidSize) {
          setProcessing(`${r}-${c}`);
          try {
            await onStackBet(bet, bidSize);
          } finally {
            setProcessing(null);
          }
        }
      } else {
        if (balance >= bidSize) {
          setProcessing(`${r}-${c}`);
          try {
            await onPlaceBet(r, c, bidSize);
          } finally {
            setProcessing(null);
          }
        }
      }
    },
    [getBet, balance, bidSize, oracleSnapshot, onPlaceBet, onStackBet]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // SVG path for price line
  const linePath = useMemo(() => {
    if (priceHistory.length < 2) return "";
    const minP = priceLevels[priceLevels.length - 1];
    const maxP = priceLevels[0];
    const range = maxP - minP;
    const h = ROWS * CELL_H;

    return priceHistory.slice(-45).map((pt, i) => {
      const x = 42 + i * 6;
      const price = pt.y / 10 + 0.50; // Convert from scaled visual value back to price
      const y = h - ((price - minP) / range) * h;
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(" ");
  }, [priceHistory, priceLevels]);

  return (
    <div className="flex-1 relative overflow-hidden px-1">
      {/* Price line SVG */}
      <svg className="absolute inset-0 pointer-events-none z-10" style={{ overflow: "visible" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={linePath} className="price-line" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="flex">
        {/* Y-axis left - prices */}
        <div className="flex flex-col" style={{ width: 42 }}>
          {priceLevels.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-1 text-xs font-medium"
              style={{
                height: CELL_H,
                color: i === priceRow ? "#00ff88" : "#4a7a66",
              }}
            >
              {p.toFixed(1)}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL_H}px)`,
          }}
        >
          {/* Grid lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, #1e3329 1px, transparent 1px), linear-gradient(to bottom, #1e3329 1px, transparent 1px)`,
              backgroundSize: `${CELL_W}px ${CELL_H}px`,
            }}
          />

          {/* Price row highlight */}
          <div
            className="price-row-highlight"
            style={{ top: priceRow * CELL_H, height: CELL_H }}
          />

          {/* Cells */}
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const bet = getBet(r, c);
            const mult = getMult(r, c);
            const holding = holdCell?.r === r && holdCell?.c === c;
            const busy = processing === `${r}-${c}`;
            const pending = bet?.status === "pending";
            const hit = bet?.status === "hit";

            return (
              <div
                key={i}
                onClick={() => onClick(r, c)}
                onPointerDown={(e) => onDown(e, r, c, bet)}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                onPointerCancel={onUp}
                className={`grid-cell ${bet ? "bet-cell" : ""} ${pending ? "bet-cell-pending" : ""} ${hit ? "bet-cell-hit" : ""}`}
                style={{
                  width: CELL_W,
                  height: CELL_H,
                  transform: holding ? "scale(0.94)" : "scale(1)",
                  opacity: busy ? 0.5 : 1,
                  pointerEvents: busy ? "none" : "auto",
                }}
              >
                {holding && (
                  <div
                    className="cancel-overlay"
                    style={{ clipPath: `inset(${(1 - holdProg) * 100}% 0 0 0)` }}
                  />
                )}

                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded z-20">
                    <div className="spinner" />
                  </div>
                )}

                {bet ? (
                  <>
                    <span className="bet-amount z-10">${bet.amount}</span>
                    <span className="bet-mult z-10">{mult}x</span>
                    {pending && <span className="status-tx">TX</span>}
                  </>
                ) : (
                  <span className="mult-text">{mult}X</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Y-axis right - prices with badge */}
        <div className="flex flex-col relative" style={{ width: 52 }}>
          {priceLevels.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-start pl-1 text-xs"
              style={{ height: CELL_H, color: "#4b5563" }}
            >
              ${p.toFixed(1)}
            </div>
          ))}
          <div
            className="price-badge"
            style={{ top: priceRow * CELL_H + CELL_H / 2 - 10 }}
          >
            ${currentPrice.toFixed(1)}
          </div>
        </div>
      </div>

      {/* X-axis - time */}
      <div className="flex" style={{ marginLeft: 42, marginTop: 4 }}>
        {timeLabels.slice(0, COLS).map((t, i) => (
          <div key={i} className="text-xs text-center" style={{ width: CELL_W, color: "#4a7a66" }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
