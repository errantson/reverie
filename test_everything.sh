#!/bin/bash
# Reverie House Comprehensive Test Suite Runner
# Runs all tests in proper order with environment validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🧪 Reverie House Comprehensive Test Suite"
echo "=========================================="
echo "Date: $(date)"
echo "Environment: $(uname -a)"
echo ""

# ============================================================================
# ENVIRONMENT VALIDATION
# ============================================================================

echo "📋 Environment Validation"
echo "-------------------------"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found"
    exit 1
fi
echo "✅ Python3: $(python3 --version)"

# Check virtual environment
if [[ "$VIRTUAL_ENV" != *".venv"* ]]; then
    echo "⚠️  Not in virtual environment, activating..."
    source .venv/bin/activate
fi
echo "✅ Virtual environment: $VIRTUAL_ENV"

# Check database connectivity
echo "🔍 Checking database connectivity..."
if python3 -c "
import sys
sys.path.insert(0, '.')
from core.database import DatabaseManager
db = DatabaseManager()
result = db.execute('SELECT 1').fetchone()
print('✅ Database connected')
" 2>/dev/null; then
    echo "✅ Database: Connected"
else
    echo "❌ Database: Not accessible"
    echo "   Make sure PostgreSQL is running"
    exit 1
fi

# Check Docker services (optional)
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "^reverie_api$"; then
        echo "✅ Docker: API service running"
    else
        echo "⚠️  Docker: API service not running"
    fi
else
    echo "⚠️  Docker: Not available"
fi

echo ""

# ============================================================================
# DEPENDENCY CHECKS
# ============================================================================

echo "📦 Dependency Validation"
echo "-----------------------"

# Check test dependencies
python3 -c "
import pytest
import jwt
print('✅ Test dependencies available')
" 2>/dev/null || {
    echo "❌ Missing test dependencies"
    echo "   Run: pip install -r requirements-test.txt"
    exit 1
}

echo "✅ Dependencies: OK"
echo ""

# ============================================================================
# TEST EXECUTION
# ============================================================================

echo "🧪 Test Execution"
echo "================="

TOTAL_START=$(date +%s)
FAILED_TESTS=0

# Function to run test category
run_test_category() {
    local category_name="$1"
    local test_files="$2"
    local description="$3"

    echo ""
    echo "🎯 $category_name"
    echo "   $description"
    echo "   Files: $test_files"

    if [ -z "$test_files" ]; then
        echo "   ⚠️  No test files found"
        return 0
    fi

    START=$(date +%s)

    # Run tests with coverage and junit output
    if python3 -m pytest $test_files \
        --tb=short \
        --strict-markers \
        --disable-warnings \
        --junitxml=test-results-$category_name.xml \
        --cov=core \
        --cov-report=term-missing \
        --cov-report=xml:coverage-$category_name.xml \
        -q; then

        END=$(date +%s)
        DURATION=$((END - START))
        echo "   ✅ PASSED ($DURATION seconds)"
        return 0
    else
        END=$(date +%s)
        DURATION=$((END - START))
        echo "   ❌ FAILED ($DURATION seconds)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 1. Critical Infrastructure Tests
run_test_category \
    "Critical Infrastructure" \
    "tests/test_database.py tests/test_encryption.py" \
    "Database connectivity and encryption"

# 2. Unit Tests
run_test_category \
    "Unit Tests" \
    "tests/test_quantities.py" \
    "Core business logic units"

# 3. Worker System Tests
run_test_category \
    "Worker System" \
    "tests/test_work_roles.py" \
    "Worker authentication and operations"

# 4. API Tests
run_test_category \
    "API Tests" \
    "tests/test_api_routes.py" \
    "API endpoint validation"

# 5. Authentication Tests
run_test_category \
    "Authentication" \
    "tests/test_auth.py" \
    "Session and JWT validation"

# 6. Rate Limiting Tests
run_test_category \
    "Rate Limiting" \
    "tests/test_rate_limiting.py" \
    "Rate limit enforcement"

# 7. Network Tests (may require external connectivity)
run_test_category \
    "Network Tests" \
    "tests/test_network.py" \
    "ATProto network operations"

# 8. Quest System Tests
run_test_category \
    "Quest System" \
    "tests/test_quest_monitoring.py" \
    "Quest monitoring and processing"

# 9. End-to-End Tests
run_test_category \
    "End-to-End Tests" \
    "tests/test_resident_creation_flow.py" \
    "Complete user journey validation"

# 10. Infrastructure Tests
run_test_category \
    "Infrastructure" \
    "tests/test_docker.py tests/test_pds.py" \
    "Docker and PDS integration"

# 11. Additional Services
run_test_category \
    "Additional Services" \
    "tests/test_feedgen.py tests/test_courier_auth_recovery.py" \
    "Feed generation and messaging"

echo ""
echo "📊 Test Summary"
echo "==============="

TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

echo "Total runtime: $TOTAL_DURATION seconds"
echo "Failed categories: $FAILED_TESTS"

# Generate coverage report
if command -v coverage &> /dev/null; then
    echo ""
    echo "📈 Coverage Report"
    echo "------------------"
    python3 -m coverage combine coverage-*.xml 2>/dev/null || true
    python3 -m coverage report --include="core/*" --omit="*/test_*" || true
fi

# Cleanup
rm -f test-results-*.xml coverage-*.xml .coverage

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED!"
    echo "   Reverie House is operating correctly."
    exit 0
else
    echo ""
    echo "❌ $FAILED_TESTS test categories failed"
    echo "   Check the output above for details."
    echo "   Some tests may require additional setup (workers, external services)."
    exit 1
fi