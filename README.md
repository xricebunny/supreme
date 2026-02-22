# Supreme — BTC Price Prediction Game on Flow

Real-time grid-based BTC price prediction game. Click a cell on the price/time grid to bet that BTC will touch that price level within the cell's 5-second window. Instant optimistic UI, on-chain settlement via multi-auth Flow transactions.

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

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│     Backend      │────▶│   Flow Testnet   │
│  Next.js 14  │◀────│  Express :3001   │◀────│ 0xb36266e524c6c7 │
│   :3000      │     │                  │     │                  │
└──────┬───────┘     │ • Oracle Updater │     │ • MockPYUSD      │
       │             │ • Settlement Bot │     │ • PriceOracle    │
       │             │ • Sign API       │     │ • PredictionGame │
       │             └────────┬─────────┘     └──────────────────┘
       │                      │
       ▼                      ▼
┌─────────────┐     ┌─────────────────┐
│ Magic.link   │     │    Binance WS    │
│ (user auth)  │     │ btcusdt@aggTrade │
└──────────────┘     └─────────────────┘
```

## How It Works

1. User clicks a future cell on the grid (each cell = price band × 5s time window)
2. Cell highlights instantly (cyan pulse) — optimistic UI, balance deducted
3. Backend co-signs: `POST /api/sign-bet` → validates params, computes multiplier
4. Multi-auth Flow tx: Magic.link signs for user, backend signs as admin, backend pays gas
5. At expiry: frontend checks Binance price history against the cell's price band
6. Win → green flash, balance credited | Loss → red fade | Failed tx → balance restored

## Smart Contracts (Flow Testnet)

All deployed at **`0xb36266e524c6c727`**:

| Contract | Purpose |
|----------|---------|
| `MockPYUSD` | FungibleToken with public `mint()` — testnet stablecoin |
| `PriceOracle` | BTC price history indexed by block height, admin-gated pushPrice |
| `PredictionGame` | Positions, house vault, multi-auth openPosition, oracle-based settlement |

## Project Structure

```
supreme/
├── frontend/                   # Next.js 14 + React 18 + Tailwind
│   ├── app/                    # App Router (layout, page, providers)
│   ├── components/             # GameGrid, PriceLine, Sidebar, BottomBar, LoginModal
│   ├── contexts/               # AuthProvider (Magic.link), MagicProvider
│   ├── hooks/                  # useBinancePrice, useAnimationTime, useBetManager, useBalance
│   ├── lib/                    # api, flow config, serverSigner, transactions, multiplier, formatters
│   └── types/
├── backend/                    # Express + TypeScript
│   └── src/
│       ├── index.ts            # Startup: FCL config → oracle → settlement bot → API
│       ├── api.ts              # REST endpoints (sign-bet, sign, fund-account, price, health)
│       ├── oracle-updater.ts   # Binance WS → pushPrice tx every ~4s
│       ├── settlement-bot.ts   # Poll expired positions → settlePosition tx
│       ├── flow-client.ts      # FCL config, key pool, FlowSigner
│       └── multiplier.ts       # Payout formula (mirrors frontend)
├── cadence/
│   ├── contracts/              # MockPYUSD, PriceOracle, PredictionGame
│   ├── transactions/           # openPosition, settlePosition, mintPYUSD, pushPrice, etc.
│   └── scripts/                # getPYUSDBalance, getPosition, listUnsettledExpired, etc.
└── flow.json                   # Flow CLI config, testnet deployment addresses
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Express 4, TypeScript (tsx) |
| Blockchain | Flow Testnet, Cadence smart contracts |
| Auth | Magic.link (email → Flow wallet) |
| Price Feed | Binance WebSocket (`btcusdt@aggTrade`, 200ms sampling) |
| Signing | ECDSA P256 (elliptic + SHA3) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sign-bet` | Validate bet params, compute multiplier, return signed params |
| POST | `/api/sign` | Sign transaction envelope with admin key (multi-auth) |
| POST | `/api/fund-account` | Send FLOW to user for storage (once per session) |
| GET | `/api/price` | Current Binance BTC price + staleness info |
| GET | `/api/positions/:address` | On-chain positions for a user |
| GET | `/api/health` | Oracle status, admin address |

## Environment Variables

**`backend/.env`** (required):
```
FLOW_ADMIN_ADDRESS=0xb36266e524c6c727
FLOW_ADMIN_PRIVATE_KEY=<admin_private_key>
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
PORT=3001
```

**Frontend**: Flow config hardcoded in `frontend/lib/flow.ts`. Magic.link API key in `frontend/contexts/MagicProvider.tsx`.

## Grid Mechanics

- 21 columns × 10 visible rows, panning left at 60fps via `requestAnimationFrame`
- Column 5 = current time. Each column = 5 seconds.
- Price step: dynamic "nice number" series (`currentPrice / 10000` → 1/2/10 rounding). BTC ~$96k → $10 steps.
- Multiplier: `base * exp(rowDist * rowFactor) * pow(colDist, timePow) / exp(rowDist * colDecay)`, capped at 100x
- Win condition: any Binance price during the cell's 5-second window falls within the cell's price band

## Trust Model

Every bet tx requires **two Flow authorizers**:
- **User** (Magic.link): authorizes PYUSD withdrawal
- **Admin** (backend): attests oracle price, validates multiplier, pays gas

Neither party can act alone. No on-chain signature verification needed — Flow enforces both signers at the protocol level.
