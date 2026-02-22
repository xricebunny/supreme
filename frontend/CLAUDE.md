# CLAUDE.md — Supreme Frontend Spec

## Project
BTC price prediction game on Flow blockchain. Desktop-first. Next.js 14, TypeScript, Tailwind CSS, App Router.

Contracts deployed on Flow testnet at `0xb36266e524c6c727`: MockPYUSD, PriceOracle, PredictionGame.

## Color Palette
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
- Active bet on a cell: cyan (#00e5ff) glow background, shows stake amount + multiplier
- Won bet: green background, shows "+$XX" payout
- Lost bet: red background, shows "-$XX" stake

## Price Data — Live Binance WebSocket
`hooks/useBinancePrice.ts`:
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

## Bet Lifecycle
1. **Click cell** → optimistic: cell highlights cyan, balance deducted, bet added to `activeBets`
2. **Background**: `POST /api/sign-bet` → get multiplier/params → build multi-auth Cadence tx → Magic.link signs (user) + backend signs (admin) → FCL submits to Flow
3. **Resolution**: when `now >= startTimestamp + 5000` (column's right edge), check Binance price history in `[startTimestamp, startTimestamp + 5000]` against cell's price band
4. **Win**: price touched band → green flash, balance += payout
5. **Loss**: price never touched → red fade
6. **Failed**: tx error → balance restored, cell cleared

Bet statuses: `active | won | lost | failed`. No "pending", "confirming", or "settling" states.

Transaction queue: Magic.link has a single key, so txs are serialized via a promise chain (`txQueueRef`). Optimistic UI is instant regardless.

## Layout
- Left sidebar: 200px wide, fixed. Logo top-left. Nav items: Trade (active), Leaderboard (coming soon), Profile (coming soon). Bottom: login/logout button.
- Main area: full remaining width × full height. Top bar: BTC price + PYUSD balance badge + address badge.
- Grid area: fills remaining space. Cells scale to fill available height.
- Bottom bar: PYUSD balance, "Fund Demo" button ($1000 PYUSD mint), bet size selector ($5–$100).

## Component Structure
```
frontend/
├── app/
│   ├── layout.tsx          # root layout, wraps Providers
│   ├── page.tsx            # TradePage — grid, sidebar, bottom bar, login modal
│   ├── providers.tsx       # AuthProvider + MagicProvider wrappers
│   └── globals.css
├── components/
│   ├── GameGrid.tsx        # 21×10 grid (dynamic price step, anchor ref, virtual rows, bet overlays)
│   ├── PriceLine.tsx       # Catmull-Rom spline (dashed→solid, live dot)
│   ├── Sidebar.tsx         # left nav with login button
│   ├── BottomBar.tsx       # balance + bet size
│   ├── PriceDisplay.tsx    # top-left BTC price ticker
│   ├── LoginModal.tsx      # Magic.link email auth
│   └── Icons.tsx           # SVG icon components
├── contexts/
│   ├── AuthProvider.tsx    # Magic.link auth state (address, email, login/logout)
│   └── MagicProvider.tsx   # Magic SDK initialization
├── hooks/
│   ├── useBinancePrice.ts  # Binance WebSocket, 200ms sampling, auto-reconnect
│   ├── useAnimationTime.ts # rAF-driven grid panning (60fps, direct DOM manipulation)
│   ├── useGameState.ts     # bet size state
│   ├── useBalance.ts       # PYUSD balance query + optimistic tracking + mint
│   └── useBetManager.ts    # active bets, optimistic state, expiry resolution, multi-auth tx queue
├── lib/
│   ├── flow.ts             # FCL config (testnet, contract addresses at 0xb36266e524c6c727)
│   ├── api.ts              # Backend API client (signBet, signTransaction, fundAccount, getPrice)
│   ├── serverSigner.ts     # FCL serverAuthorization function (calls backend /api/sign)
│   ├── transactions.ts     # Cadence transaction templates (setup vault, mint PYUSD, open position)
│   ├── multiplier.ts       # getMultiplier, getCellPayout functions
│   └── formatters.ts       # formatPrice, formatGridPrice, formatPayout, formatTime, formatBalance
└── types/
    └── index.ts            # PricePoint interface
```

## State — hooks only, no external state library
- `useBinancePrice`: WebSocket connection to Binance, 200ms sampling into rolling buffer
- `useAnimationTime`: requestAnimationFrame loop driving horizontal grid pan via ref-based DOM updates. Triggers React re-render only on slot boundaries (every 5s). Throttled `slotProgress` updates every 200ms for smooth payout decay.
- `useGameState`: bet size management ($5/$10/$25/$50/$75/$100)
- `useBalance`: queries on-chain PYUSD balance, tracks optimistic deductions/additions, handles minting via Magic.link-signed tx
- `useBetManager`: manages `activeBets[]` array, optimistic bet placement, expiry resolution via Binance price history (checks every 200ms), multi-auth tx submission via serialized queue

## Auth — Magic.link
- `MagicProvider` initializes Magic SDK with Flow extension
- `AuthProvider` exposes: address, email, login(), logout(), loading
- Login modal: user enters email → Magic.link passwordless auth → Flow address created
- `magic.flow.authorization` used as FCL authorizer for user-signed transactions
- Backend auto-funds new accounts with FLOW for storage (`POST /api/fund-account`)

## Not Yet Implemented
- Leaderboard page
- Profile page
- Sound effects
- Mobile optimization
- On-chain balance reconciliation (frontend/chain result comparison)
