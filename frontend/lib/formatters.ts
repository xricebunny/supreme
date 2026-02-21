/**
 * Format a price for display with smart decimals and thousands separators.
 * BTC $96,578.42 → "$96,578.42"
 * ETH $2,734.18 → "$2,734.18"
 * SOL $168.35   → "$168.35"
 * FLOW $0.03870 → "$0.03870"
 */
export function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  // Sub-dollar: show 5 decimals to capture micro-movements
  return `$${price.toFixed(5)}`;
}

/**
 * Format a price for the Y-axis grid labels.
 * Uses the grid's priceStep to determine appropriate precision,
 * and adds thousands separators for large values.
 */
export function formatGridPrice(price: number, priceStep: number): string {
  const decimals = priceStep < 0.001 ? 5 : priceStep < 0.01 ? 4 : priceStep < 0.1 ? 3 : priceStep < 1 ? 2 : 0;
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `$${price.toFixed(decimals)}`;
}

/**
 * Format a payout amount for display in grid cells.
 * Under $100:   "+$XX.X"
 * $100-$999:    "+$XXX"
 * $1000+:       "+$X.Xk"
 */
export function formatPayout(payout: number): string {
  if (payout < 0.1) return "+$0.0";
  if (payout < 100) return `+$${payout.toFixed(1)}`;
  if (payout < 1000) return `+$${Math.round(payout)}`;
  return `+$${(payout / 1000).toFixed(1)}k`;
}

/**
 * Format a timestamp as HH:MM:SS (24-hour).
 */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Format a balance for display.
 * e.g. 1842.5 → "$1,842.50"
 */
export function formatBalance(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
