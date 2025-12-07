#!/bin/bash
# Run Reverie House test suite inside Docker container with network access

set -e

echo "🧪 Running Reverie House Test Suite"
echo "===================================="
echo ""

# Run tests inside API container which has access to reverie_network
docker exec reverie_api python3 -m pytest /srv/tests/ "$@"
