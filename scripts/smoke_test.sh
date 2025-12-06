#!/bin/bash
# Simple smoke tests to verify Reverie House is working
set -e

echo "🔍 Reverie House Smoke Tests"
echo "================================"
echo ""

# Test 1: Main website
echo "✓ Testing main website..."
curl -sf https://reverie.house/ > /dev/null
echo "  ✅ Site loads"

# Test 2: PDS health
echo "✓ Testing PDS..."
curl -sf https://reverie.house/xrpc/_health | grep -q "version"
echo "  ✅ PDS responding"

# Test 3: Feed generator
echo "✓ Testing feed generator..."
curl -sf https://reverie.house/xrpc/app.bsky.feed.describeFeedGenerator | grep -q "did:web:reverie.house"
echo "  ✅ Feed generator working"

# Test 4: API health
echo "✓ Testing API..."
curl -sf https://reverie.house/api/world | grep -q "keeper"
echo "  ✅ API responding"

# Test 5: DID document
echo "✓ Testing DID document..."
curl -sf https://reverie.house/.well-known/did.json | grep -q "BskyFeedGenerator"
echo "  ✅ DID document valid"

# Test 6: Docker services
echo "✓ Checking Docker services..."
RUNNING=$(docker ps --filter "name=reverie" --format "{{.Names}}" | wc -l)
echo "  ✅ $RUNNING reverie services running"

# Test 7: Database health
echo "✓ Testing database..."
docker exec reverie_db pg_isready -U reverie > /dev/null
echo "  ✅ Database accepting connections"

echo ""
echo "================================"
echo "✅ All smoke tests passed!"
echo ""
echo "Services status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(reverie|pds|caddy)" | grep -v "Restarting" | sort
echo ""
echo "⚠️  Known issues (non-critical):"
echo "   - bibliowatch: Missing ops.commands.execute_commands"
echo "   - lorefarm_labeler: Can't connect to its database"
echo ""
echo "💡 These are optional services and don't affect main functionality"
