#!/bin/bash

# Supreme - Setup Script
# Run this once after cloning

echo "🎮 Setting up Supreme..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# Create .env.local if not exists
if [ ! -f .env.local ]; then
    echo "Creating .env.local (demo mode)..."
    cp .env.example .env.local
    echo "✓ .env.local created"
else
    echo "✓ .env.local exists"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To run the app:"
    echo "  npm run dev"
    echo ""
    echo "Then open: http://localhost:3000"
    echo ""
else
    echo "❌ npm install failed"
    exit 1
fi
