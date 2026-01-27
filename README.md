# Emerpus - Flow Price Prediction Game

A price prediction game built on Flow.

## Quick Start

```bash
# 1. Install
npm install && cp .env.example .env.local

# 2. Run
npm run dev
```

Open http://localhost:3000 - works immediately in demo mode!

## Features

- 📊 **Price/Time Grid**: Y-axis shows price levels, X-axis shows time
- 📈 **Live Price Line**: Pink/magenta animated price line with glow
- 🟨 **Yellow Bet Cells**: Place bets with visual feedback
- 👆 **Single-tap Betting**: Tap to place, hold to cancel
- ⛓️ **On-chain Settlement**: Positions escrowed and settled via oracle
- 🔐 **Dual Auth**: Magic.link email + Flow wallets (Blocto, Lilico, Dapper)

## UI Design

| Element | Color |
|---------|-------|
| Background | `#1a0a20` (dark purple) |
| Price line | `#d946ef` (pink/magenta) |
| Bet cells | `#e8e855` (yellow) |
| Price badge | `#d946ef` (pink) |
| Muted text | `#6b5280` |

## Architecture

### Trust Boundary
- UI animations are **indicative only**
- All funds escrowed **on-chain**
- Settlement via **Increment oracle**

### On-chain Flow
1. **Open Position**: Tap cell -> `openPosition` tx -> stake escrowed
2. **Settle Position**: After expiry -> `settlePosition` tx -> payout
3. **Emergency Cancel**: If oracle stale -> `cancelPosition` tx -> refund

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Magic.link + Flow FCL
- **Blockchain**: Flow Testnet
- **Contract**: Cadence (MicroOptionsMVP)
- **Styling**: Tailwind CSS

## Project Structure

```
src/
├── app/
│   ├── globals.css      # Emerpus theme
│   └── page.tsx         # Main game
├── components/
│   ├── GameGrid.tsx     # Grid with price/time axes
│   ├── GameHeader.tsx   # Brand + price display
│   ├── BottomControls.tsx # Balance, bid, nav
│   └── AuthModal.tsx    # Login modal
├── hooks/
│   └── index.ts         # State management
└── lib/
    ├── flow.ts          # FCL + contract calls
    └── magic.ts         # Magic.link config

cadence/
├── contracts/
│   └── MicroOptionsMVP.cdc
├── transactions/
│   ├── openPosition.cdc
│   ├── settlePosition.cdc
│   └── cancelPositionAfterTimeout.cdc
└── scripts/
    └── getOracleSnapshot.cdc
```

## Getting Started

```bash
# Install
npm install

# Configure
cp .env.example .env.local
# Add: NEXT_PUBLIC_MAGIC_API_KEY=pk_live_YOUR_KEY

# Run
npm run dev
```

Open http://localhost:3000

## UX

| Action | Gesture |
|--------|---------|
| Place bet | Tap empty cell |
| Stack bet | Tap existing bet |
| Cancel bet | Hold 0.5s (red fill) |
| Change amount | Tap bid pill |

## Contract Config

```
maxStaleBlocksEntry: 50 (~1 min)
maxStaleBlocksSettle: 100 (~2 min)
positionDurationBlocks: 60 (~1.5 min)

Multipliers:
  Tier 0: 1.15x
  Tier 1: 1.50x
  Tier 2: 2.00x
  ...
  Tier 5+: 5.00x
```

## License

MIT
