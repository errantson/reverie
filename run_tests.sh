#!/bin/bash
# Run Reverie House test suite with database access
#
# Usage:
#   ./run_tests.sh                    # Run all tests
#   ./run_tests.sh tests/test_history.py -v    # Run specific test file
#   ./run_tests.sh --cov=core --cov-report=html  # With coverage

set -e

echo "🧪 Running Reverie House Test Suite"
echo "===================================="
echo ""

# Check if database container is running
if ! docker ps --format '{{.Names}}' | grep -q '^reverie_db$'; then
    echo "❌ Error: reverie_db container is not running"
    echo "   Start it with: docker-compose up -d"
    exit 1
fi

# Get database IP from Docker
DB_IP=$(docker inspect reverie_db --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')

if [ -z "$DB_IP" ]; then
    echo "❌ Error: Could not get reverie_db IP address"
    exit 1
fi

echo "📊 Database: $DB_IP:5432"
echo ""

# Activate virtual environment if not already active
if [[ "$VIRTUAL_ENV" != *".venv"* ]]; then
    if [ -f /srv/.venv/bin/activate ]; then
        source /srv/.venv/bin/activate
    elif [ -f .venv/bin/activate ]; then
        source .venv/bin/activate
    else
        echo "❌ Error: Virtual environment not found"
        echo "   Expected: /srv/.venv or .venv"
        exit 1
    fi
fi

# Run tests with database connection
POSTGRES_HOST=$DB_IP python3 -m pytest tests/ "$@"
