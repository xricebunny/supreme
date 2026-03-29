const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ngrok free tier requires this header to skip the browser warning interstitial
const defaultHeaders: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
};

export interface SignBetResponse {
  entryPrice: number;
  multiplier: number;
  durationBlocks: number;
  expiryTimestamp: number;
  aboveTarget: boolean;
}

export interface SignResponse {
  addr: string;
  keyId: number;
  signature: string;
}

export async function signBet(params: {
  targetPrice: number;
  priceTop?: number;
  priceBottom?: number;
  aboveTarget: boolean;
  betSize: number;
  rowDist: number;
  colDist: number;
  symbol?: string;
}): Promise<SignBetResponse> {
  const res = await fetch(`${API_BASE}/api/sign-bet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...defaultHeaders },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to sign bet");
  return res.json();
}

export async function signTransaction(message: string): Promise<SignResponse> {
  const res = await fetch(`${API_BASE}/api/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...defaultHeaders },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to sign transaction");
  return res.json();
}

export async function fundAccount(address: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/fund-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...defaultHeaders },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to fund account");
  return res.json();
}

export async function getPrice(symbol: string = "btc"): Promise<{ price: number; stale: boolean }> {
  const res = await fetch(`${API_BASE}/api/price?symbol=${symbol}`, { headers: defaultHeaders });
  return res.json();
}

export async function getPositions(address: string, symbol: string = "btc"): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/positions/${address}?symbol=${symbol}`, { headers: defaultHeaders });
  const data = await res.json();
  return data.positions || [];
}

export interface LeaderboardEntry {
  address: string;
  totalWagered: number;
  totalPayout: number;
  wins: number;
  losses: number;
  netPnl: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/leaderboard`, { headers: defaultHeaders });
  const data = await res.json();
  return data.leaderboard || [];
}
