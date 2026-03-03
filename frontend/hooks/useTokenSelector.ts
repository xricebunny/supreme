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

interface UseTokenSelectorReturn {
  token: TokenSymbol;
  setToken: (token: TokenSymbol) => void;
  tokenLabel: string;
  tokenPair: string;
}

export function useTokenSelector(initial: TokenSymbol = "btc"): UseTokenSelectorReturn {
  const [token, setTokenState] = useState<TokenSymbol>(initial);

  const setToken = useCallback((t: TokenSymbol) => {
    setTokenState(t);
  }, []);

  return {
    token,
    setToken,
    tokenLabel: TOKEN_LABELS[token],
    tokenPair: TOKEN_PAIRS[token],
  };
}
