# Supreme — Price Prediction Game on Flow

**[Live Demo → supreme-beta.vercel.app](https://supreme-beta.vercel.app/)**

Real-time grid-based price prediction game supporting BTC and FLOW. Click a cell on the price/time grid to bet that the asset's price will touch that price level within the cell's 5-second window. Instant optimistic UI, on-chain settlement via multi-auth Flow transactions.

## Quick Start

```bash
# Terminal 1 — Backend (Express + Oracle + Settlement Bot)
cd backend
cp .env.example .env   # add your Flow admin private key
npm install && npm run dev

# Terminal 2 — Frontend (Next.js)
cd frontend
npm install && npm run dev
```

Frontend: http://localhost:3000 | Backend API: http://localhost:3001

Or try the live deployment at **https://supreme-beta.vercel.app/**

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────────┐
│   Frontend   │────▶│     Backend      │────▶│     Flow Testnet      │
│  Next.js 14  │◀────│  Express :3001   │◀────│  0xb36266e524c6c727   │
│   :3000      │     │                  │     │                       │
└──────┬───────┘     │ • Oracle Updater │     │ • MockPYUSD           │
       │             │ • Settlement Bot │     │ • PriceOracle         │
       │             │ • House Funder   │     │ • PriceRangeOracle    │
       │             │ • Sign API       │     │ • PredictionGame      │
       │             └────────┬─────────┘     │ • FlowPriceOracle     │
       │                      │               │ • FlowPriceRangeOracle│
       ▼                      ▼               │ • FlowPredictionGame  │
┌─────────────┐     ┌─────────────────┐     └───────────────────────┘
│ Magic.link   │     │    Binance WS    │
│ (user auth)  │     │ btcusdt@aggTrade │
└──────────────┘     │ flowusdt@aggTrade│
                     └─────────────────┘
```

## How It Works

1. User selects asset (BTC or FLOW) and clicks a future cell on the grid (each cell = price band × 5s time window)
2. Cell highlights instantly (cyan pulse) — optimistic UI, balance deducted
3. Backend co-signs: `POST /api/sign-bet` → validates params, computes multiplier
4. Multi-auth Flow tx: Magic.link signs for user, backend signs as admin, backend pays gas
5. At expiry: frontend checks Binance price history against the cell's price band
6. Win → green flash, balance credited | Loss → red fade | Failed tx → balance restored
7. Settlement bot settles expired positions on-chain every 10s; house funder auto-mints PYUSD when house balance drops below $10k

## Smart Contracts (Flow Testnet)

All deployed at **`0xb36266e524c6c727`**:

| Contract | Purpose |
|----------|---------|
| `MockPYUSD` | FungibleToken with public `mint()` — testnet stablecoin |
| `PriceOracle` | BTC price history indexed by block height, admin-gated pushPrice |
| `PriceRangeOracle` | High/low price ranges per oracle push (BTC) |
| `PredictionGame` | BTC positions, house vault, multi-auth openPosition, oracle-based settlement |
| `FlowPriceOracle` | FLOW price history (same design as PriceOracle) |
| `FlowPriceRangeOracle` | High/low price ranges per oracle push (FLOW) |
| `FlowPredictionGame` | FLOW positions — uses FlowToken instead of MockPYUSD |
| `BonusRound` | Streak-based bonus multiplier using Flow's on-chain randomness (commit-reveal) |
| `RandomConsumer` | Secure randomness consumption from Flow's random beacon |
| `Xorshift128plus` | PRG struct (xorshift128+ algorithm) for deterministic random number generation |

## Project Structure

```
supreme/
├── frontend/                   # Next.js 14 + React 18 + Tailwind
│   ├── app/                    # App Router (layout, page, providers)
│   ├── components/             # GameGrid, GridCell, PriceLine, PriceDisplay, Sidebar, BottomBar,
│   │                           # LoginModal, Profile, Leaderboard, Icons
│   ├── contexts/               # AuthProvider (Magic.link), MagicProvider
│   ├── hooks/                  # useBinancePrice, useAnimationTime, useBetManager, useBalance,
│   │                           # useTokenSelector, useGameState, useBackendHealth, useLeaderboard,
│   │                           # useProfile, useIsMobile
│   ├── lib/                    # api, flow config, serverSigner, transactions, multiplier, formatters, tokenTheme
│   └── types/
├── backend/                    # Express + TypeScript
│   └── src/
│       ├── index.ts            # Startup: FCL config → key detection → oracle → settlement → house funder → API
│       ├── api.ts              # REST endpoints (sign-bet, sign, fund-account, price, positions, health)
│       ├── oracle-updater.ts   # Binance WS → pushPrice + pushRange tx every ~4s (BTC + FLOW)
│       ├── settlement-bot.ts   # Poll expired positions → settlePosition tx (BTC + FLOW)
│       ├── house-funder.ts     # Auto-mint PYUSD when house balance < $10k (every 60s)
│       ├── flow-client.ts      # FCL config, key pool with rotation, FlowSigner (ECDSA P256)
│       └── multiplier.ts       # Payout formula (mirrors frontend)
├── cadence/
│   ├── contracts/              # MockPYUSD, PriceOracle, PriceRangeOracle, PredictionGame,
│   │                           # FlowPriceOracle, FlowPriceRangeOracle, FlowPredictionGame,
│   │                           # BonusRound, RandomConsumer, Xorshift128plus
│   ├── transactions/           # openPosition, settlePosition, mintPYUSD, pushPrice, pushRange, etc.
│   ├── scripts/                # getPYUSDBalance, getPosition, listUnsettledExpired, etc.
│   └── tests/                  # Cadence test suites (54 tests across 5 contracts)
└── flow.json                   # Flow CLI config, testnet deployment addresses
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion |
| Backend | Express 4, TypeScript (tsx) |
| Blockchain | Flow Testnet, Cadence smart contracts |
| Auth | Magic.link (email → Flow wallet) |
| Price Feed | Binance WebSocket (`btcusdt@aggTrade`, `flowusdt@aggTrade`, 200ms sampling) |
| Signing | ECDSA P256 (elliptic + SHA3), key pool with rotation |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sign-bet` | Validate bet params, compute multiplier, return signed params (accepts `symbol`) |
| POST | `/api/sign` | Sign transaction envelope with admin key (multi-auth) |
| POST | `/api/fund-account` | Send 100 FLOW to user for storage (once per session) |
| GET | `/api/price?symbol=btc\|flow` | Current Binance price + staleness info |
| GET | `/api/positions/:address?symbol=btc\|flow` | On-chain positions for a user |
| GET | `/api/health?symbol=btc\|flow` | Oracle status, admin address, active key count |
| GET | `/api/house-balance?symbol=btc\|flow` | Current house balance for specified asset |
| GET | `/api/leaderboard` | Ranked leaderboard by net P&L across BTC + FLOW |
| GET | `/api/debug/position/:id` | Diagnostic: oracle data and ranges for a position |

## Environment Variables

**`backend/.env`** (required):
```
FLOW_ADMIN_ADDRESS=0xb36266e524c6c727
FLOW_ADMIN_PRIVATE_KEY=<admin_private_key>
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
PORT=3001
```

**Frontend** (via env or hardcoded):
```
NEXT_PUBLIC_MAGIC_API_KEY=<magic_link_api_key>
NEXT_PUBLIC_API_URL=http://localhost:3001    # backend URL
```
Flow config hardcoded in `frontend/lib/flow.ts`.

## Grid Mechanics

- 21 columns × 10 visible rows, panning left at 60fps via `requestAnimationFrame`
- Column 5 = current time. Each column = 5 seconds.
- Price step: dynamic "nice number" series (`currentPrice / 10000` → 1/2/10 rounding). BTC ~$96k → $10 steps.
- Multiplier: `base * exp(rowDist * rowFactor) * pow(colDist, timePow) / exp(rowDist * colDecay)`, capped at 100x
- Win condition: any Binance price during the cell's 5-second window falls within the cell's price band

## Testing

Cadence smart contract tests cover 5 contracts (54 tests):

```bash
flow test
```

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| `MockPYUSD_test.cdc` | 4 | Mint, transfer, withdraw, storage paths |
| `PriceOracle_test.cdc` | 13 | Push, read, config, access control, edge cases |
| `PriceRangeOracle_test.cdc` | 7 | Push, read, validation, access control |
| `PredictionGame_test.cdc` | 17 | Open position, config, validation, house funding, settlement, views |
| `BonusRound_test.cdc` | 13 | Streak tracking, bonus claiming, random tier selection, access control |

## Trust Model

Every bet tx requires **two Flow authorizers**:
- **User** (Magic.link): authorizes PYUSD withdrawal
- **Admin** (backend): attests oracle price, validates multiplier, pays gas

Neither party can act alone. No on-chain signature verification needed — Flow enforces both signers at the protocol level.
