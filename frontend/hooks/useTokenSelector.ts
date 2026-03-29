"use client";

import { useState, useCallback } from "react";
import type { TokenSymbol } from "./useBinancePrice";

export const TOKEN_LABELS: Record<TokenSymbol, string> = {
  btc: "BTC",
  flow: "FLOW",
};

export const TOKEN_PAIRS: Record<TokenSymbol, string> = {
  btc: "BTC / USDT",
  flow: "FLOW / USDT",
};

const STORAGE_KEY = "supreme:token";
const VALID_TOKENS: TokenSymbol[] = ["btc", "flow"];

function loadToken(fallback: TokenSymbol): TokenSymbol {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && VALID_TOKENS.includes(stored as TokenSymbol)
    ? (stored as TokenSymbol)
    : fallback;
}

interface UseTokenSelectorReturn {
  token: TokenSymbol;
  setToken: (token: TokenSymbol) => void;
  tokenLabel: string;
  tokenPair: string;
}

export function useTokenSelector(initial: TokenSymbol = "flow"): UseTokenSelectorReturn {
  const [token, setTokenState] = useState<TokenSymbol>(() => loadToken(initial));

  const setToken = useCallback((t: TokenSymbol) => {
    setTokenState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return {
    token,
    setToken,
    tokenLabel: TOKEN_LABELS[token],
    tokenPair: TOKEN_PAIRS[token],
  };
}
