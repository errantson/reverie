#!/bin/bash
# =============================================================================
# PIGEONS SYSTEM STATUS CHECK
# =============================================================================
# Quick health check for the Pigeons automation system
# 
# Usage:
#   ./scripts/check_pigeons.sh
# =============================================================================

echo "🐦 =============================================="
echo "🐦 Pigeons System Status Check"
echo "🐦 =============================================="
echo ""

# Check database tables
echo "📊 Database Tables:"
TABLES=$(sqlite3 /srv/data/reverie.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pigeons', 'pigeon_deliveries');")
if echo "$TABLES" | grep -q "pigeons" && echo "$TABLES" | grep -q "pigeon_deliveries"; then
    echo "   ✅ pigeons"
    echo "   ✅ pigeon_deliveries"
else
    echo "   ❌ Missing tables!"
    exit 1
fi
echo ""

# Count pigeons
PIGEON_COUNT=$(sqlite3 /srv/data/reverie.db "SELECT COUNT(*) FROM pigeons;")
ACTIVE_COUNT=$(sqlite3 /srv/data/reverie.db "SELECT COUNT(*) FROM pigeons WHERE status='active';")
echo "📋 Pigeons:"
echo "   Total: $PIGEON_COUNT"
echo "   Active: $ACTIVE_COUNT"
echo ""

# Count deliveries
DELIVERY_COUNT=$(sqlite3 /srv/data/reverie.db "SELECT COUNT(*) FROM pigeon_deliveries;")
echo "📬 Deliveries: $DELIVERY_COUNT"
echo ""

# Check Docker services
echo "🐳 Docker Services:"
if docker compose ps aviary 2>/dev/null | grep -q "Up"; then
    echo "   ✅ aviary (running)"
else
    echo "   ❌ aviary (not running)"
fi

if docker compose ps admin 2>/dev/null | grep -q "Up"; then
    echo "   ✅ admin (running)"
else
    echo "   ❌ admin (not running)"
fi
echo ""

# Show recent aviary logs
echo "📝 Recent Aviary Logs:"
docker compose logs --tail 3 aviary 2>/dev/null | sed 's/^/   /'
echo ""

echo "🐦 =============================================="
echo "🐦 Status Check Complete"
echo "🐦 =============================================="
echo ""
echo "Next steps:"
echo "  - Create pigeons: https://reverie.house/admin/dialogues.html"
echo "  - View docs: /srv/docs/PIGEONS_AUTOMATION.md"
echo "  - Run tests: python3 /srv/scripts/test_pigeons.py"
echo ""
