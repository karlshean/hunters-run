#!/bin/bash

# Staging Server Restart Script
# Simple script to restart the hr-api server in staging mode

set -e

STAGING_PORT=${STAGING_PORT:-3000}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
HR_API_DIR="$PROJECT_ROOT/apps/hr-api"

echo "🔄 Restarting Hunters Run HR API in staging mode..."
echo "📁 Project root: $PROJECT_ROOT"
echo "🖥️  HR API dir: $HR_API_DIR"
echo "🔌 Port: $STAGING_PORT"

# Change to HR API directory
cd "$HR_API_DIR"

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo "❌ Error: .env.staging not found"
    echo "💡 Copy .env.staging.example and populate with real staging values"
    exit 1
fi

echo "✅ Found .env.staging configuration"

# Build if needed (or skip if already built)
if [ ! -d "dist" ]; then
    echo "🔨 Building application..."
    npm run build
else
    echo "📦 Using existing build (run 'npm run build' to rebuild)"
fi

# Kill existing staging process if running
echo "🛑 Stopping any existing staging processes..."
pkill -f "node dist/main.js" || true
sleep 2

# Load staging environment and start server
echo "🚀 Starting staging server..."
echo "📊 Health check will be available at: http://localhost:$STAGING_PORT/api/health"

# Source the .env.staging file and start the server
set -o allexport
source .env.staging
set +o allexport

# Override PORT if set via environment
export PORT=$STAGING_PORT
export NODE_ENV=staging

# Start server in background with logging
nohup node dist/main.js > staging.log 2>&1 &
SERVER_PID=$!

echo "✅ Staging server started with PID: $SERVER_PID"
echo "📝 Logs: $HR_API_DIR/staging.log"

# Wait a moment for startup
sleep 3

# Basic health check
echo "🏥 Performing health check..."
if curl -f -s "http://localhost:$STAGING_PORT/api/health" > /dev/null; then
    echo "✅ Health check passed - staging server is running"
    echo ""
    echo "🔗 Available endpoints:"
    echo "   Health: http://localhost:$STAGING_PORT/api/health"
    echo "   Properties: http://localhost:$STAGING_PORT/api/properties"  
    echo "   Work Orders: http://localhost:$STAGING_PORT/api/work-orders"
    echo ""
    echo "🛠️  Test with:"
    echo "   curl -H 'Authorization: Bearer dev-token' -H 'x-org-id: 00000000-0000-4000-8000-000000000001' http://localhost:$STAGING_PORT/api/properties"
else
    echo "❌ Health check failed - server may not be ready yet"
    echo "📝 Check logs: tail -f $HR_API_DIR/staging.log"
    exit 1
fi