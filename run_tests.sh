#!/bin/bash
# Run Reverie House test suite
#
# By default, runs against TEST database (reverie_test)
# For integration tests against production: POSTGRES_DB=reverie_house ./run_tests.sh
#
# Usage:
#   ./run_tests.sh                    # Run all tests (test DB)
#   ./run_tests.sh tests/test_history.py -v    # Run specific test file
#   ./run_tests.sh --cov=core --cov-report=html  # With coverage
#   POSTGRES_DB=reverie_house ./run_tests.sh -m integration  # Production integration tests

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

# Get database configuration
DB_NAME="${POSTGRES_DB:-reverie_test}"
echo "📊 Database: $DB_IP:5432/$DB_NAME"

if [ "$DB_NAME" = "reverie_house" ]; then
    echo "⚠️  WARNING: Running against PRODUCTION database!"
    echo "   Press Ctrl+C within 3 seconds to cancel..."
    sleep 3
fi
echo ""

# Activate virtual environment if not already active
if [[ "$VIRTUAL_ENV" != *".venv"* ]]; then
    if [ -f /srv/.venv/bin/activate ]; then
        source /srv/.venv/bin/activate
    elif [ -f .venv/bin/activate ]; then
# Run tests with database connection
export POSTGRES_HOST=$DB_IP
export POSTGRES_DB=$DB_NAME
python3 -m pytest tests/ "$@"
        echo "❌ Error: Virtual environment not found"
        echo "   Expected: /srv/.venv or .venv"
        exit 1
    fi
fi

# Run tests with database connection
POSTGRES_HOST=$DB_IP python3 -m pytest tests/ "$@"
