#!/bin/bash
# Stripe Payment Service Quick Start
# This script sets up the Stripe payment service for Reverie House

set -e

echo "🎯 Reverie House - Stripe Payment Service Setup"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please do not run as root"
   exit 1
fi

# Check if .env file exists
if [ ! -f "/srv/secrets/.env" ]; then
    echo "📝 Creating environment file from template..."
    cp /srv/reverie.house/stripe/.env.example /srv/secrets/.env
    echo "⚠️  Please edit /srv/secrets/.env with your Stripe API keys"
    echo "   Required values:"
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
    echo "   - STRIPE_PRICE_ID"
    echo ""
    read -p "Press Enter when you've configured .env..."
fi

# Verify required environment variables
source /srv/secrets/.env
if [ -z "$STRIPE_SECRET_KEY" ] || [ "$STRIPE_SECRET_KEY" == "sk_test_xxxxxxxxxxxxx" ]; then
    echo "❌ STRIPE_SECRET_KEY not configured in /srv/secrets/.env"
    exit 1
fi

echo "✅ Environment configuration loaded"

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! pg_isready -h ${POSTGRES_HOST:-172.23.0.3} -p ${POSTGRES_PORT:-5432} > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running or not accessible"
    exit 1
fi
echo "✅ PostgreSQL is running"

# Check if database exists
echo "🔍 Checking database..."
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h ${POSTGRES_HOST:-172.23.0.3} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-reverie} -d ${POSTGRES_DB:-reverie_house} -c "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Cannot connect to database"
    exit 1
fi
echo "✅ Database connection successful"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd /srv/reverie.house/stripe
pip3 install -r requirements.txt > /dev/null 2>&1
echo "✅ Dependencies installed"

# Initialize database schema
echo "🗄️  Initializing database schema..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h ${POSTGRES_HOST:-172.23.0.3} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-reverie} -d ${POSTGRES_DB:-reverie_house} << EOF > /dev/null 2>&1
CREATE TABLE IF NOT EXISTS order_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    customer_did TEXT,
    customer_handle TEXT,
    quantity INTEGER NOT NULL,
    anonymous BOOLEAN DEFAULT FALSE,
    amount INTEGER NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    expired BOOLEAN DEFAULT FALSE,
    created_at INTEGER NOT NULL,
    processed_at INTEGER,
    expired_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_order_sessions_did ON order_sessions(customer_did);
EOF
echo "✅ Database schema initialized"

# Start the service
echo "🚀 Starting Stripe payment service..."
cd /srv
if command -v docker-compose &> /dev/null; then
    docker-compose up -d reverie_stripe
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up -d reverie_stripe
else
    echo "⚠️  Docker Compose not found, starting manually..."
    cd /srv/reverie.house/stripe
    PORT=5555 python3 app.py &
    echo $! > /tmp/stripe_service.pid
    echo "   PID: $(cat /tmp/stripe_service.pid)"
fi

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 3

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -s http://localhost:5555/health | grep -q "healthy"; then
    echo "✅ Service is healthy!"
else
    echo "❌ Service health check failed"
    exit 1
fi

# Display status
echo ""
echo "================================================"
echo "✅ Stripe Payment Service is running!"
echo "================================================"
echo ""
echo "Service URL: http://localhost:5555"
echo "Health check: http://localhost:5555/health"
echo ""
echo "Next steps:"
echo "1. Configure Stripe webhook at https://dashboard.stripe.com/webhooks"
echo "   - Endpoint: https://reverie.house/api/stripe/webhook"
echo "   - Events: checkout.session.completed, checkout.session.expired"
echo ""
echo "2. Test the integration:"
echo "   curl -X POST http://localhost:5555/create-checkout-session \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"quantity\": 1, \"customer_did\": \"did:plc:test\"}'"
echo ""
echo "3. Run tests:"
echo "   cd /srv/reverie.house && pytest tests/test_orders.py -v"
echo ""
echo "📚 Documentation:"
echo "   - Setup Guide: /srv/reverie.house/docs/STRIPE_SETUP.md"
echo "   - Implementation: /srv/reverie.house/docs/STRIPE_IMPLEMENTATION_SUMMARY.md"
echo ""
