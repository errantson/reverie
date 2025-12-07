#!/bin/bash
# Reverie House Health Check Script
# Location: /srv/scripts/health_check.sh
# Usage: ./health_check.sh

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        REVERIE HOUSE SYSTEM HEALTH CHECK                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Port Status
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ PORT STATUS                                             │"
echo "└─────────────────────────────────────────────────────────┘"
sudo netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}' | column -t | sort -V
echo ""

# Docker Services
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ DOCKER SERVICES                                         │"
echo "└─────────────────────────────────────────────────────────┘"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || echo "❌ Unable to check Docker services"
echo ""

# Service Health Checks
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ SERVICE HEALTH CHECKS                                   │"
echo "└─────────────────────────────────────────────────────────┘"

# Admin API
echo -n "Admin API (4444):    "
if curl -s -f -m 5 http://localhost:4444/api/work/greeter/status > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# PDS
echo -n "PDS (3333):          "
if curl -s -f -m 5 http://localhost:3333/xrpc/com.atproto.server.describeServer > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Caddy
echo -n "Caddy (443):         "
if curl -s -f -m 5 -k https://localhost > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Lorefarm
echo -n "Lorefarm (6000):     "
if curl -s -f -m 5 http://localhost:6000/health > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# PostgreSQL
echo -n "PostgreSQL (6432):   "
if nc -z localhost 6432 2>/dev/null; then
    echo "✅ Listening"
else
    echo "❌ Not listening"
fi

echo ""

# Recent Errors
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ RECENT ERRORS (last 5 log entries)                     │"
echo "└─────────────────────────────────────────────────────────┘"

echo "Admin:"
admin_errors=$(docker logs admin --tail 5 2>&1 | grep -i error | head -2)
if [ -z "$admin_errors" ]; then
    echo "  ✅ No errors"
else
    echo "$admin_errors" | sed 's/^/  /'
fi

echo ""
echo "Caddy:"
caddy_errors=$(docker logs caddy --tail 5 2>&1 | grep -i error | head -2)
if [ -z "$caddy_errors" ]; then
    echo "  ✅ No errors"
else
    echo "$caddy_errors" | sed 's/^/  /'
fi

echo ""
echo "Firehose:"
firehose_errors=$(docker logs firehose --tail 5 2>&1 | grep -i error | head -2)
if [ -z "$firehose_errors" ]; then
    echo "  ✅ No errors"
else
    echo "$firehose_errors" | sed 's/^/  /'
fi

echo ""

# Resource Usage
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ RESOURCE USAGE                                          │"
echo "└─────────────────────────────────────────────────────────┘"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -10

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║ Health check complete                                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
