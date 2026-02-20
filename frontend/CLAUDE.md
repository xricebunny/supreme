# CLAUDE.md — Euphoria Frontend Spec

## Project
Price prediction trading game for FLOW token. Desktop-first. Next.js 14, TypeScript, Tailwind CSS, App Router.

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
- 21 columns × 10 rows of cells
- Each cell = 5 seconds (X axis) × $0.00005 price increment (Y axis)
- Grid does NOT scroll or resize — fixed viewport
- Top and bottom rows may be partially visible (clipped ~1/3 height)
- Left ~3 columns sit under the sidebar nav (still rendered, just overlaid)
- Current time is ALWAYS pinned to column 6 from the left
- As time progresses: the grid pans LEFT — new future columns enter from the right
- Current price is ALWAYS vertically centered — grid shifts smoothly on Y axis as price moves
- Left of current time column = past (cells dimmed, no interaction)
- Right of current time column = future (cells active, bettable)

## Visual Design
- Dark green-black background (#0a0f0d)
- Grid cells: subtle #1e3329 border, #111a16 dark fill, dimmer in past columns
- Text in cells: neon green (#00ff88) for payout amounts
- Current price row: slightly highlighted horizontal line with neon-dim glow
- Current time column: vertical line separator
- Price labels: Y axis on the RIGHT side, showing price levels every row
- Time labels: X axis on the BOTTOM, label every OTHER column (every 10 seconds)
  Format: HH:MM:SS — e.g. 05:27:30, 05:27:40, 05:27:50
  Unlabelled columns show no text, just dots at intersections
- Font: Inter (imported from Google Fonts) or system-ui fallback
- Cell hover: gradient border highlight that bleeds into adjacent cell borders
  (think: a subtle glow on borders of the hovered cell + faint extension onto neighboring cell edges)
- Active bet on a cell: cyan (#00e5ff) glow background, shows stake amount + payout

## Price Data (Session 1 — Simulated)
`frontend/lib/data.ts` contains:
- A FLOW price time series array: 60 data points, each 1 second apart
- Start price: $0.03840
- Simulate realistic micro-movements: ±$0.00003 per second random walk
- Export: `flowPriceData: { timestamp: number, price: number }[]`
- Export: `getCurrentPrice(timestamp: number): number` — interpolates
- Later this gets replaced with Binance WebSocket feed

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
All values update every second as time and price change.

## Layout
- Left sidebar: 200px wide, fixed. Logo top-left. Nav items: Trade (active), Leaderboard, Profile. Icons + labels. Bottom: settings gear + music note icons.
- Main area: full remaining width × full height. Contains the game grid.
- Bottom bar: shows current wallet balance (simulated: "$1,842.50"), and bet size selector ("🏁 $10" with up/down or click to change). Bet sizes: $5, $10, $25, $50, $75, $100.
- Top left of grid area: current FLOW price display ("$0.03840" with a small down arrow for dropdown)
- Top right: (skip for now)

## Component Structure
```
frontend/
├── app/
│   ├── layout.tsx        # root layout
│   ├── page.tsx          # main trade page
│   └── globals.css
├── components/
│   ├── GameGrid.tsx      # the main grid
│   ├── GridCell.tsx      # individual cell
│   ├── PriceLine.tsx     # the animated price line path
│   ├── Sidebar.tsx       # left nav
│   ├── BottomBar.tsx     # balance + bet size
│   └── PriceDisplay.tsx  # top-left price ticker
├── hooks/
│   ├── useGameState.ts   # grid state, current price row/col, time
│   └── useSimulatedPrice.ts # drives price from data.ts, 1 tick/second
├── lib/
│   ├── data.ts           # simulated FLOW price data
│   ├── multiplier.ts     # getMultiplier, getCellPayout functions
│   └── formatters.ts     # price/payout formatting helpers
└── types/
    └── index.ts          # Cell, Bet, GameState interfaces
```

## State — hooks only, no external state library
useSimulatedPrice: drives a tick every 1 second through data.ts prices
useGameState: derives currentPriceRow, currentTimeCol, grid offset, visible rows/cols

## Not Yet Implemented
- Blockchain / FCL / Flow transactions
- Magic.link auth
- Bet placement interaction (click handlers)
- Leaderboard or Profile pages
- Real Binance WebSocket (comes in session 2)
