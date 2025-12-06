#!/bin/bash
# =============================================================================
# PIGEONS AUTOMATION MIGRATION SCRIPT
# =============================================================================
# This script sets up the Pigeons automation system
# 
# Usage:
#   ./scripts/migrate_pigeons.sh
#
# What it does:
#   1. Creates pigeons and pigeon_deliveries tables
#   2. Adds indexes for performance
#   3. Restarts aviary service
# =============================================================================

set -e  # Exit on error

echo "🐦 =============================================="
echo "🐦 Pigeons Automation System Migration"
echo "🐦 =============================================="
echo ""

# Configuration
DB_PATH="${DB_PATH:-/srv/data/reverie.db}"
MIGRATION_FILE="/srv/data/migrations/005_pigeons_automation.sql"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration Details:"
echo "   Database: $DB_PATH"
echo "   Migration: $MIGRATION_FILE"
echo ""

# Backup database
BACKUP_DIR="/srv/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/reverie.db.before_pigeons_$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "💾 Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"
echo "   ✅ Backup saved: $BACKUP_FILE"
echo ""

# Run migration
echo "🔨 Running migration..."
sqlite3 "$DB_PATH" < "$MIGRATION_FILE"
echo "   ✅ Tables created successfully"
echo ""

# Verify tables
echo "🔍 Verifying tables..."
TABLES=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pigeons', 'pigeon_deliveries');")

if echo "$TABLES" | grep -q "pigeons" && echo "$TABLES" | grep -q "pigeon_deliveries"; then
    echo "   ✅ Tables verified:"
    echo "      - pigeons"
    echo "      - pigeon_deliveries"
else
    echo "   ❌ Error: Tables not found after migration"
    exit 1
fi
echo ""

# Show table info
echo "📊 Table Structure:"
echo ""
echo "--- pigeons ---"
sqlite3 "$DB_PATH" "PRAGMA table_info(pigeons);" | head -5
echo "   ..."
echo ""

echo "--- pigeon_deliveries ---"
sqlite3 "$DB_PATH" "PRAGMA table_info(pigeon_deliveries);" | head -5
echo "   ..."
echo ""

# Restart aviary service if running in Docker
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "^aviary$"; then
        echo "🔄 Restarting aviary service..."
        docker compose restart aviary
        echo "   ✅ Aviary restarted"
    else
        echo "ℹ️  Aviary service not running. Start with:"
        echo "   docker compose up -d aviary"
    fi
else
    echo "ℹ️  Docker not found. If using Docker, restart aviary manually:"
    echo "   docker compose restart aviary"
fi
echo ""

# Success
echo "🐦 =============================================="
echo "🐦 Migration Complete!"
echo "🐦 =============================================="
echo ""
echo "Next steps:"
echo "1. Go to https://reverie.house/admin/dialogues.html"
echo "2. Click the 'Pigeons' tab"
echo "3. Create your first pigeon automation"
echo ""
echo "Documentation: /docs/PIGEONS_AUTOMATION.md"
echo ""

exit 0
