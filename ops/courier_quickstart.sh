#!/bin/bash
# Quick Start Guide for Courier Service
# Run this script to get the courier system up and running

set -e

echo "=================================================="
echo "  Reverie House Courier - Quick Start"
echo "=================================================="
echo ""

# Check if running as root for service commands
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Note: Service installation requires sudo"
    echo "   Run individual commands with sudo as needed"
    echo ""
fi

# 1. Check Python
echo "1️⃣  Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ $PYTHON_VERSION"
else
    echo "   ❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# 2. Check database
echo ""
echo "2️⃣  Checking database connection..."
if psql -U postgres reverie_house -c "SELECT 1 FROM courier LIMIT 1" &> /dev/null; then
    echo "   ✅ Database accessible"
else
    echo "   ⚠️  Cannot connect to database"
    echo "   Make sure PostgreSQL is running and credentials are correct"
fi

# 3. Check if service is installed
echo ""
echo "3️⃣  Checking courier service..."
if systemctl list-unit-files | grep -q courier.service; then
    echo "   ✅ Service installed"
    
    # Check if running
    if systemctl is-active --quiet courier; then
        echo "   ✅ Service is RUNNING"
    else
        echo "   ⚠️  Service installed but NOT RUNNING"
        echo ""
        echo "   To start:"
        echo "   sudo /srv/reverie.house/ops/manage_courier.sh start"
    fi
else
    echo "   ⚠️  Service not installed"
    echo ""
    echo "   To install:"
    echo "   sudo /srv/reverie.house/ops/manage_courier.sh install"
    echo "   sudo /srv/reverie.house/ops/manage_courier.sh start"
fi

# 4. Check test dependencies
echo ""
echo "4️⃣  Checking test dependencies..."
if python3 -c "import pytest" 2>/dev/null; then
    echo "   ✅ pytest installed"
else
    echo "   ⚠️  pytest not installed"
    echo ""
    echo "   To install test dependencies:"
    echo "   pip install -r /srv/reverie.house/tests/requirements.txt"
fi

# 5. Show quick commands
echo ""
echo "=================================================="
echo "  Quick Commands"
echo "=================================================="
echo ""
echo "Start Service:"
echo "  sudo /srv/reverie.house/ops/manage_courier.sh start"
echo ""
echo "Check Status:"
echo "  sudo /srv/reverie.house/ops/manage_courier.sh status"
echo ""
echo "View Logs:"
echo "  sudo /srv/reverie.house/ops/manage_courier.sh logs"
echo ""
echo "Run Tests:"
echo "  cd /srv/reverie.house && python3 tests/run_tests.sh"
echo ""
echo "Health Check:"
echo "  curl http://localhost:5000/api/courier/health | jq"
echo ""
echo "=================================================="
echo "  Documentation"
echo "=================================================="
echo ""
echo "Technical Review:"
echo "  /srv/reverie.house/docs/COURIER_SYSTEM_TECHNICAL_REVIEW.md"
echo ""
echo "Implementation Summary:"
echo "  /srv/reverie.house/docs/COURIER_IMPROVEMENTS_SUMMARY.md"
echo ""
echo "Test Guide:"
echo "  /srv/reverie.house/tests/README.md"
echo ""
echo "=================================================="
