/**
 * Format a price for display with 5 decimal places.
 * e.g. 0.03840 → "$0.03840"
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(5)}`;
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
