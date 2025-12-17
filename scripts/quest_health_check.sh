#!/bin/bash
#
# Quest Monitoring Health Check
# Run this anytime to verify quest system is operational
#

set -e

echo "🔍 Quest Monitoring Health Check"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Function to check service status
check_service() {
    SERVICE=$1
    STATUS=$(docker ps --filter "name=$SERVICE" --format "{{.Status}}" 2>/dev/null || echo "NOT FOUND")
    
    if echo "$STATUS" | grep -q "Up"; then
        echo -e "${GREEN}✓${NC} $SERVICE: Running"
        # Get recent log line
        RECENT=$(docker logs $SERVICE --tail 1 2>/dev/null || echo "")
        if [ -n "$RECENT" ]; then
            echo "  └─ Latest: ${RECENT:0:80}..."
        fi
    elif echo "$STATUS" | grep -q "Restarting"; then
        echo -e "${YELLOW}⚠${NC} $SERVICE: Restarting (check logs)"
        FAILURES=$((FAILURES + 1))
    else
        echo -e "${RED}✗${NC} $SERVICE: Not running"
        FAILURES=$((FAILURES + 1))
    fi
}

# Function to check database
check_database() {
    echo ""
    echo "📊 Checking Database Schema..."
    
    # Check canon view exists
    if docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT EXISTS (SELECT FROM pg_views WHERE viewname = 'canon');" 2>/dev/null | grep -q "t"; then
        echo -e "${GREEN}✓${NC} Canon view exists"
    else
        echo -e "${RED}✗${NC} Canon view missing - quest monitoring will fail!"
        FAILURES=$((FAILURES + 1))
    fi
    
    # Check events table exists
    if docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'events');" 2>/dev/null | grep -q "t"; then
        echo -e "${GREEN}✓${NC} Events table exists"
    else
        echo -e "${RED}✗${NC} Events table missing!"
        FAILURES=$((FAILURES + 1))
    fi
    
    # Check quests table exists
    if docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'quests');" 2>/dev/null | grep -q "t"; then
        echo -e "${GREEN}✓${NC} Quests table exists"
    else
        echo -e "${RED}✗${NC} Quests table missing!"
        FAILURES=$((FAILURES + 1))
    fi
    
    # Count greeted dreamers
    GREETED=$(docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT COUNT(DISTINCT did) FROM canon WHERE key = 'name';" 2>/dev/null | tr -d ' ')
    echo -e "${GREEN}✓${NC} Greeted dreamers: $GREETED"
    
    # Count origin declarations
    ORIGINS=$(docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT COUNT(DISTINCT did) FROM canon WHERE key = 'origin';" 2>/dev/null | tr -d ' ')
    echo -e "${GREEN}✓${NC} Origin declarations: $ORIGINS"
}

# Check quest monitoring services
echo "🎯 Quest Monitoring Services:"
check_service "reverie_jetstream"  # DID-filtered: bsky_reply quests, dreamers, biblio
check_service "reverie_greeter"
check_service "reverie_mapper"

echo ""
echo "🌙 Full Network Firehose Services:"
check_service "reverie_questhose"  # firehose_phrase triggers (full network scan)

# Check database
check_database

# Check quest endpoints
echo ""
echo "🔌 Quest System Endpoints:"

# Check if quest URIs are accessible
NAMEGIVER_URI=$(docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT uri FROM quests WHERE title = 'namegiver';" 2>/dev/null | tr -d ' ')
if [ -n "$NAMEGIVER_URI" ]; then
    echo -e "${GREEN}✓${NC} Namegiver quest URI: ${NAMEGIVER_URI:0:60}..."
else
    echo -e "${RED}✗${NC} Namegiver quest not found in database"
    FAILURES=$((FAILURES + 1))
fi

ORIGIN_URI=$(docker exec reverie_db psql -U reverie -d reverie_house -t -c "SELECT uri FROM quests WHERE title = 'origin';" 2>/dev/null | tr -d ' ')
if [ -n "$ORIGIN_URI" ]; then
    echo -e "${GREEN}✓${NC} Origin quest URI: ${ORIGIN_URI:0:60}..."
else
    echo -e "${RED}✗${NC} Origin quest not found in database"
    FAILURES=$((FAILURES + 1))
fi

# Summary
echo ""
echo "================================"
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ All quest monitoring systems operational!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Found $FAILURES issue(s) - check logs above${NC}"
    exit 1
fi
