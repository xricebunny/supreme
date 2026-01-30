# Supreme - Visual Price Prediction Game

Turn price prediction into a spatial game. You don't choose leverage or set limit orders. You place conviction on a grid around a moving price line. The closer you play, the safer you are. The farther you reach, the higher the reward—and the higher the risk.

Built on Flow blockchain.

## Quick Start

```bash
# Install & run
npm install && npm run dev
```

Open http://localhost:3000 - works immediately in demo mode!

## Features

### Core Gameplay
- **Price/Time Grid**: 14-row price grid with real-time price movement
- **Visual Betting**: Tap cells to place bets, see multipliers instantly
- **Risk = Distance**: Further from price line = higher multiplier = higher risk
- **Instant Feedback**: Win/loss animations, confetti, screen shake

### User Experience
- **Onboarding Tutorial**: 6-step interactive guide for new users
- **Stats Dashboard**: Win rate, profit/loss, streaks, performance metrics
- **Leaderboard**: Daily/weekly/all-time rankings
- **Position History**: Track all your settled bets
- **Sound Effects**: Procedural audio for bets, wins, losses
- **Haptic Feedback**: Vibration patterns for mobile interactions

### Technical
- **PWA Support**: Install as mobile app, works offline
- **Settings Panel**: Toggle sounds, haptics, reset tutorial
- **On-chain Settlement**: Positions escrowed and settled via oracle
- **Dual Auth**: Magic.link email + Flow wallets (Blocto, Lilico, Dapper)

## How to Play

| Action | Gesture |
|--------|---------|
| Place bet | Tap any grid cell |
| Stack bet | Tap existing bet cell |
| Cancel bet | Hold 0.5s (red fill animation) |
| Change amount | Tap bid pill ($5/$10/$25/$50/$100) |

### Understanding Multipliers

```
Distance from price = Higher multiplier = Higher risk

Safe (close to price):    1.5x - 2.0x
Medium:                   2.5x - 3.5x
Risky (far from price):   4.0x - 5.0x+
```

## Screenshots

The grid shows:
- **Y-axis**: FLOW price levels ($0.50-$1.00)
- **X-axis**: Time progression
- **Neon green line**: Current market price
- **Cyan cells**: Your active bets

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS |
| Animations | Framer Motion + CSS |
| Blockchain | Flow Testnet + Cadence |
| Auth | Magic.link + FCL |
| Audio | Web Audio API |

## Project Structure

```
src/
├── app/
│   ├── globals.css       # Theme & component styles
│   ├── layout.tsx        # PWA config, metadata
│   └── page.tsx          # Main game orchestration
├── components/
│   ├── GameGrid.tsx      # 14x6 betting grid
│   ├── GameHeader.tsx    # Price display, settings
│   ├── BottomControls.tsx # Balance, bid, navigation
│   ├── Confetti.tsx      # Win celebration particles
│   ├── Onboarding.tsx    # Tutorial overlay
│   ├── Settings.tsx      # Sound/haptic toggles
│   ├── StatsDashboard.tsx # Performance metrics
│   ├── Leaderboard.tsx   # Player rankings
│   ├── PositionHistory.tsx # Bet history
│   └── AuthModal.tsx     # Login modal
├── hooks/
│   └── index.ts          # useGameState, useAuth, useOracle
├── lib/
│   ├── flow.ts           # FCL + contract calls
│   ├── magic.ts          # Magic.link config
│   ├── sounds.ts         # Web Audio sound effects
│   └── haptics.ts        # Vibration API
└── types/
    └── index.ts          # TypeScript interfaces

cadence/
├── contracts/
│   └── MicroOptionsMVP.cdc
├── transactions/
│   ├── openPosition.cdc
│   ├── settlePosition.cdc
│   └── cancelPositionAfterTimeout.cdc
└── scripts/
    └── getOracleSnapshot.cdc

public/
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker
└── icons/                # App icons
```

## Design System

| Element | Color | Hex |
|---------|-------|-----|
| Background | Dark green-black | `#0a0f0d` |
| Secondary | Dark teal | `#111a16` |
| Tertiary | Forest | `#1a2721` |
| Grid lines | Green border | `#1e3329` |
| Price line | Neon green | `#00ff88` |
| Bet cells | Cyan | `#00e5ff` |
| Win | Green | `#22c55e` |
| Loss | Red | `#ef4444` |
| Muted text | Sage | `#4a7a66` |

## On-chain Architecture

### Trust Boundary
- UI animations are **indicative only**
- All funds escrowed **on-chain**
- Settlement via **Increment oracle**

### Position Lifecycle
```
1. OPEN    → User stakes tokens → Contract holds in vault
2. ACTIVE  → Wait for position duration (60 blocks)
3. SETTLE  → Oracle price checked → Win/loss determined
4. PAYOUT  → Winner receives stake × multiplier
```

### Contract Config
```
maxStaleBlocksEntry: 50 blocks (~1 min)
maxStaleBlocksSettle: 100 blocks (~2 min)
positionDurationBlocks: 60 blocks (~1.5 min)
emergencyCancelTimeout: 400 blocks (~10 min)

Multiplier Tiers:
  Tier 0: 1.15x    Tier 3: 2.50x
  Tier 1: 1.50x    Tier 4: 3.50x
  Tier 2: 2.00x    Tier 5+: 5.00x
```

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run lint
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_MAGIC_API_KEY=pk_live_YOUR_KEY
```

## PWA Installation

### iOS
1. Open in Safari
2. Tap Share button
3. "Add to Home Screen"

### Android
1. Open in Chrome
2. Tap menu (⋮)
3. "Install app" or "Add to Home screen"

## Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT

---

Built with conviction on Flow.
