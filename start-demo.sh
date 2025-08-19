#!/bin/bash

# Hunters Run Demo Startup Script
# This sets up everything you need for browser testing

echo "🚀 Starting Hunters Run Demo Environment"
echo "========================================"

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"

# Start databases
echo "📊 Starting databases..."
docker compose up -d
sleep 5

# Run migrations and seeds
echo "🗃️ Setting up database..."
npm run migrate
npm run seed:local

# Build applications
echo "🔨 Building applications..."
npm run build:hr

echo ""
echo "🎯 Demo Environment Ready!"
echo ""
echo "To start testing:"
echo ""
echo "1. API Backend:"
echo "   npm run dev:hr"
echo "   → http://localhost:3000"
echo ""
echo "2. Web Interface:"
echo "   cd apps/hr-web && npm install && npm run dev"
echo "   → http://localhost:3001"
echo ""
echo "3. Manual API Testing:"
echo "   bash scripts/demo-payments.sh"
echo "   node scripts/demo-workflow.js"
echo ""
echo "📋 Open these URLs in your browser:"
echo "   • Work Orders: http://localhost:3001/work-orders"
echo "   • Payments: http://localhost:3001/payments"
echo ""
echo "✨ Everything is ready for user testing!"