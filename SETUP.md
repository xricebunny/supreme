# Quick Start Guide

## 1. Run Locally (2 commands)

```bash
# Install and setup
npm install && cp .env.example .env.local

# Run
npm run dev
```

Open http://localhost:3000

That's it! The app runs in **demo mode** by default - all UI features work, blockchain calls are mocked.

---

## 2. Push to GitHub (4 commands)

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Emerpus grid price prediction game"

# Add your repo and push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy to Vercel (optional)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Deploy (no env vars needed for demo mode)

---

## Project Structure

```
wolf-emerpus/
├── src/
│   ├── app/page.tsx         # Main game
│   ├── components/          # UI components
│   ├── hooks/               # State management
│   └── lib/                 # Flow + Magic config
├── cadence/                 # Smart contracts
├── .env.example             # Config template
└── package.json
```

---

## Enable Real Blockchain (optional)

1. Get Magic.link API key from https://dashboard.magic.link
2. Edit `.env.local`:
   ```
   NEXT_PUBLIC_MAGIC_API_KEY=pk_live_YOUR_KEY
   ```
3. Deploy contract to Flow testnet
4. Update contract address in `src/lib/flow.ts`

---

## Troubleshooting

**Port 3000 in use?**
```bash
npm run dev -- -p 3001
```

**Module not found?**
```bash
rm -rf node_modules && npm install
```

**TypeScript errors?**
```bash
npm run build
```
