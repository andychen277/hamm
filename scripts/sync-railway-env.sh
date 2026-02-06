#!/bin/bash
# Hamm Railway Environment Sync Script
# Usage: ./sync-railway-env.sh
#
# Syncs critical environment variables from .env.local to Railway

set -e

HAMM_DIR=~/Desktop/hamm
ENV_FILE="$HAMM_DIR/.env.local"

cd "$HAMM_DIR"

echo "🚀 Hamm Railway Environment Sync"
echo "================================"

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install with: npm i -g @railway/cli"
    exit 1
fi

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.local not found at $ENV_FILE"
    exit 1
fi

# Function to extract value from .env.local
get_env_value() {
    grep "^$1=" "$ENV_FILE" | cut -d'=' -f2-
}

# Critical variables to sync
VARS=(
    "LINE_CHANNEL_ACCESS_TOKEN"
    "ERP_BASE_URL"
    "ERP_USERNAME"
    "ERP_PASSWORD"
)

echo ""
echo "📋 Syncing variables to Railway..."
echo ""

for VAR in "${VARS[@]}"; do
    VALUE=$(get_env_value "$VAR")
    if [ -n "$VALUE" ]; then
        echo "  ✓ Setting $VAR"
        railway variables --set "$VAR=$VALUE" 2>/dev/null || {
            echo "  ⚠️  Failed to set $VAR (may need to run: railway link)"
        }
    else
        echo "  ⚠️  $VAR not found in .env.local"
    fi
done

echo ""
echo "✅ Sync complete!"
echo ""
echo "Railway will auto-redeploy. Check logs with:"
echo "  cd $HAMM_DIR && railway logs --recent"
