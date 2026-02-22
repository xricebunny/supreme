export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface Cell {
  row: number;
  col: number;
  rowDist: number;
  colDist: number;
  multiplier: number;
  payout: number;
  isPast: boolean;
}

export interface Bet {
  id: string;
  row: number;
  col: number;
  amount: number;
  multiplier: number;
  payout: number;
  timestamp: number;
  status: "pending" | "confirmed" | "settled";
}

export type BetStatus = "active" | "won" | "lost" | "failed";

export interface ActiveBet {
  id: string;
  targetPrice: number;
  aboveTarget: boolean;
  multiplier: number;
  expiryTimestamp: number; // UNIX ms
  betSize: number;
  status: BetStatus;
  row: number;
  col: number;
  payout: number;
}

export interface GameState {
  currentPrice: number;
  currentPriceRow: number;
  currentTimeCol: number;
  gridOffsetX: number;
  gridOffsetY: number;
  tickIndex: number;
  visibleRows: number;
  visibleCols: number;
  betSize: number;
}
