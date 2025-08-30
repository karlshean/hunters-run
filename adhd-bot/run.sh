#!/bin/bash

# ADHD Bot Setup and Run Script

echo "🧠 ADHD Accountability Bot Setup"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your TELEGRAM_BOT_TOKEN"
    echo "   Get token from @BotFather on Telegram"
    exit 1
fi

# Check if token is set
if grep -q "YOUR_BOT_TOKEN_HERE" .env; then
    echo "❌ Please add your TELEGRAM_BOT_TOKEN to .env file"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Initialize database
echo "🗄️ Initializing database..."
npm run db:reset

# Start the bot
echo "🚀 Starting bot..."
npm run dev