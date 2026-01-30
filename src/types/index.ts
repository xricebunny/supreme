// Price line point for UI animation
export interface PricePoint {
  x: number;
  y: number;
}

// UI-only bet representation (before on-chain)
export interface LocalBet {
  id: string;
  amount: number;
  row: number;
  col: number;
  placedAt: number;
  status: "pending" | "confirmed" | "hit" | "settling" | "settled" | "cancelled";
  positionId?: string; // Links to on-chain position after tx sealed
  entryPrice?: number;
  multiplier?: string;
}

// Settled position for history tracking
export interface SettledPosition {
  id: string;
  stake: number;
  row: number;
  col: number;
  multiplier: string;
  entryPrice: number;
  exitPrice: number;
  won: boolean;
  payout: number;
  settledAt: number;
}

// On-chain position from contract
export interface Position {
  id: string;
  owner: string;
  stake: number;
  row: number;
  col: number;
  multiplierTier: number;
  entryPrice: number;
  entryOracleUpdatedAtBlock: number;
  entryBlockHeight: number;
  expiryBlockHeight: number;
  settled: boolean;
  payout: number;
  won: boolean | null;
}

// Oracle snapshot
export interface OracleSnapshot {
  price: number;
  updatedAtBlock: number;
  currentBlock: number;
  isStale: boolean;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  name: string;
  balance: number;
  color: string;
  isCurrentUser?: boolean;
}

// User state
export interface User {
  address: string;
  email?: string;
  balance: number;
  isAuthenticated: boolean;
  isWalletConnected: boolean;
}

// Game configuration
export interface GameConfig {
  rows: number;
  cols: number;
  maxStaleBlocksEntry: number;
  maxStaleBlocksSettle: number;
  positionDurationBlocks: number;
}

// Flow transaction result
export interface FlowTransaction {
  status: number;
  statusString: string;
  errorMessage: string;
  events: any[];
  transactionId?: string;
}
