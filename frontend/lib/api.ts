const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
}): Promise<SignBetResponse> {
  const res = await fetch(`${API_BASE}/api/sign-bet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to sign bet");
  return res.json();
}

export async function signTransaction(message: string): Promise<SignResponse> {
  const res = await fetch(`${API_BASE}/api/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to sign transaction");
  return res.json();
}

export async function fundAccount(address: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/fund-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to fund account");
  return res.json();
}

export async function getPrice(): Promise<{ price: number; stale: boolean }> {
  const res = await fetch(`${API_BASE}/api/price`);
  return res.json();
}

export async function getPositions(address: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/positions/${address}`);
  const data = await res.json();
  return data.positions || [];
}
