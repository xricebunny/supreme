# CLAUDE.md — Supreme Frontend Spec

## Project
Price prediction trading game on Flow blockchain. Desktop-first. Next.js 14, TypeScript, Tailwind CSS, App Router.

## Color Palette (extracted from src/)
```
--bg-primary:    #0a0f0d    /* Dark green-black background */
--bg-secondary:  #111a16    /* Slightly lighter dark green */
--bg-tertiary:   #1a2721    /* Card/surface background */
--border-grid:   #1e3329    /* Grid cell borders */

--neon-primary:  #00ff88    /* Neon green - main accent */
--neon-glow:     rgba(0, 255, 136, 0.5)
--neon-dim:      rgba(0, 255, 136, 0.15)

--cyan-bet:      #00e5ff    /* Cyan - active bets */
--cyan-border:   #40efff
--cyan-glow:     rgba(0, 229, 255, 0.4)

--text-primary:  #ffffff
--text-muted:    #4a7a66    /* Muted labels */
--text-dim:      #3d5c4d    /* Dimmest text */

Win green:       #22c55e
Loss red:        #ef4444
Warning amber:   #f59e0b
```

## Grid Architecture
- 21 columns × 10 rows of cells (+ 2 extra render columns for panning gap fill)
- Each cell = 5 seconds (X axis) × dynamic price step (Y axis)
- Price step uses 1-2-10 "nice number" series: `currentPrice / 10000` rounded to nearest nice number
  - BTC (~$96k) → $10 steps, ETH (~$2.7k) → $0.20 steps, sub-dollar assets → micro steps
- Grid pans LEFT as time progresses — 60fps via requestAnimationFrame with direct DOM manipulation
- Current time is ALWAYS pinned to column 6 from the left
- Current price is ALWAYS vertically centered — smooth Y-axis tracking via CSS translate
- Stable grid anchor (useRef) prevents price sticking to row borders — only re-anchors when price drifts >10 rows
- Left of current time column = past (cells dimmed, no interaction)
- Right of current time column = future (cells active, bettable)

## Visual Design
- Dark green-black background (#0a0f0d)
- Grid cells: subtle #1e3329 border, dimmer in past columns
- Text in cells: neon green (#00ff88) for payout amounts
- Current time column: vertical line separator with neon gradient
- Price labels: Y axis on the RIGHT side, with thousands separators for large values
- Time labels: X axis on the BOTTOM, label every OTHER column (every 10 seconds)
  Format: HH:MM:SS — e.g. 05:27:30, 05:27:40, 05:27:50
- Price line: Catmull-Rom spline through history points, dashed (historical) → solid (recent 10s)
  Live dot with pulse animation at current price
- Font: Inter (imported from Google Fonts) or system-ui fallback
- Active bet on a cell: cyan (#00e5ff) glow background, shows stake amount + payout

## Price Data — Live Binance WebSocket
`frontend/hooks/useBinancePrice.ts`:
- Connects to Binance aggTrade WebSocket (`btcusdt@aggTrade`)
- Trades arrive at irregular intervals — sampled at fixed 200ms into a rolling buffer of 150 points (30s of history)
- Exports: `SAMPLE_INTERVAL_MS` (200), `useBinancePrice()` → `{ currentPrice, priceHistory, connected, timedOut }`
- Auto-reconnects on disconnect (3s delay)
- Shows timeout warning if no trade arrives within 10s of connecting

## Multiplier Formula
Each future cell displays: `+$XX.X` where the dollar amount = betSize × (multiplier - 1)
```typescript
function getMultiplier(rowDist: number, colDist: number): number {
  const base = 1.4
  const rowFactor = 0.55
  const timePow = 0.3
  const colDecay = 0.08
  const cap = 100

  const rowComponent = Math.exp(rowDist * rowFactor)
  const timeComponent = Math.pow(colDist, timePow) / Math.exp(rowDist * colDecay)

  return Math.min(cap, base * rowComponent * timeComponent)
}

function getCellPayout(betSize: number, rowDist: number, colDist: number): number {
  return betSize * (getMultiplier(rowDist, colDist) - 1)
}
```

Display format: under $100 = "+$XX.X", $100-$999 = "+$XXX", $1000+ = "+$X.XXk"
All values update in real-time as time and price change.

## Layout
- Left sidebar: 200px wide, fixed. Logo top-left. Nav items: Trade (active), Leaderboard (coming soon), Profile (coming soon). Bottom: settings gear + music note icons.
- Main area: full remaining width × full height. Contains the game grid.
- Bottom bar: shows current wallet balance (currently hardcoded: "$1,842.50"), and bet size selector with up/down. Bet sizes: $5, $10, $25, $50, $75, $100.
- Top left of grid area: current BTC price display with smart formatting (thousands separators)

## Component Structure
```
frontend/
├── app/
│   ├── layout.tsx          # root layout
│   ├── page.tsx            # main trade page
│   └── globals.css
├── components/
│   ├── GameGrid.tsx        # the main grid (dynamic price step, anchor ref, virtual rows)
│   ├── GridCell.tsx        # individual cell
│   ├── PriceLine.tsx       # animated Catmull-Rom price line (dashed→solid)
│   ├── Sidebar.tsx         # left nav with "coming soon" tooltips
│   ├── BottomBar.tsx       # balance + bet size
│   ├── PriceDisplay.tsx    # top-left BTC price ticker
│   └── Icons.tsx           # SVG icon components
├── hooks/
│   ├── useBinancePrice.ts  # Binance WebSocket, 200ms sampling, auto-reconnect
│   ├── useAnimationTime.ts # rAF-driven grid panning (60fps, direct DOM manipulation)
│   └── useGameState.ts     # bet size state
├── lib/
│   ├── multiplier.ts       # getMultiplier, getCellPayout functions
│   └── formatters.ts       # formatPrice, formatGridPrice, formatPayout, formatTime, formatBalance
└── types/
    └── index.ts            # PricePoint, Cell, Bet interfaces
```

## State — hooks only, no external state library
- useBinancePrice: WebSocket connection to Binance, 200ms sampling into rolling buffer
- useAnimationTime: requestAnimationFrame loop driving horizontal grid pan via ref-based DOM updates
- useGameState: bet size management

## Not Yet Implemented
- Blockchain / FCL / Flow transactions (contract exists in `cadence/contracts/MicroOptionsMVP.cdc`)
- Magic.link wallet auth
- Bet placement interaction (click handlers on grid cells)
- Real wallet balance (currently hardcoded)
- Leaderboard or Profile pages
