import type { TokenSymbol } from "@/hooks/useBinancePrice";

export interface TokenTheme {
  /** Hex color, e.g. "#00ff88" */
  neonPrimary: string;
  /** RGB triplet for rgba() usage, e.g. "0, 255, 136" */
  neonRgb: string;
  /** Lighter midtone for gradients (price line tip) */
  neonMid: string;
}

export const TOKEN_THEMES: Record<TokenSymbol, TokenTheme> = {
  flow: {
    neonPrimary: "#00ff88",
    neonRgb: "0, 255, 136",
    neonMid: "#80ffbb",
  },
  btc: {
    neonPrimary: "#ff8800",
    neonRgb: "255, 136, 0",
    neonMid: "#ffbb80",
  },
};

/** Apply token theme to :root CSS variables */
export function applyTokenTheme(token: TokenSymbol) {
  const theme = TOKEN_THEMES[token];
  const root = document.documentElement;
  root.style.setProperty("--neon-primary", theme.neonPrimary);
  root.style.setProperty("--neon-rgb", theme.neonRgb);
  root.style.setProperty("--neon-glow", `rgba(${theme.neonRgb}, 0.5)`);
  root.style.setProperty("--neon-dim", `rgba(${theme.neonRgb}, 0.15)`);
  root.style.setProperty("--neon-mid", theme.neonMid);
}
