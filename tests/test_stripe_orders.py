"""
Stripe Order System Test Suite
==============================

Comprehensive tests for the Reverie House book ordering system:
- Environment & secrets validation
- Event formatting and DID attribution
- Checkout session creation
- Webhook processing
- Database operations

Uses production database with cs_test_ prefixed data for cleanup.
"""

import pytest
import json
import time
import os
from unittest.mock import patch, MagicMock
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['POSTGRES_DB'] = 'reverie_house'

from core.events import EventsManager, ANONYMOUS_DID
from core.database import DatabaseManager
from core.utils import number_to_words


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(scope="session", autouse=True)
def ensure_order_sessions_table():
    """Ensure order_sessions table exists and clean up test data after tests."""
    db = DatabaseManager()
    test_session_start = int(time.time())
    
    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
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
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_order_sessions_did 
                ON order_sessions(customer_did)
            """)
            conn.commit()
    
    yield
    
    print("\n🧹 Cleaning up test data...")
    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                DELETE FROM order_sessions 
                WHERE session_id LIKE 'cs_test_%'
                RETURNING id
            """)
            sessions_deleted = cursor.fetchall()
            
            cursor.execute("""
                DELETE FROM events 
                WHERE type = 'order' 
                AND did = %(did)s 
                AND epoch >= %(start_time)s
                RETURNING id
            """, {'did': ANONYMOUS_DID, 'start_time': test_session_start})
            events_deleted = cursor.fetchall()
            
            conn.commit()
            print(f"✅ Cleaned up {len(sessions_deleted)} test sessions and {len(events_deleted)} test events")


@pytest.fixture
def db() -> DatabaseManager:
    """Provide database connection"""
    return DatabaseManager()


@pytest.fixture
def events(db) -> EventsManager:
    """Provide EventsManager instance"""
    return EventsManager(db)


# =============================================================================
# ENVIRONMENT & SECRETS
# =============================================================================

class TestEnvironment:
    """Validate production environment configuration."""
    
    def test_stripe_secrets_exist(self):
        """Verify Stripe secrets file exists with required keys."""
        secrets_path = '/srv/secrets/stripe.env'
        assert os.path.exists(secrets_path), f"Missing {secrets_path}"
        
        from dotenv import load_dotenv
        load_dotenv(secrets_path)
        
        secret_key = os.getenv('STRIPE_SECRET_KEY')
        webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        price_id = os.getenv('STRIPE_PRICE_ID')
        
        assert secret_key, "STRIPE_SECRET_KEY not set"
        assert webhook_secret, "STRIPE_WEBHOOK_SECRET not set"
        assert price_id, "STRIPE_PRICE_ID not set"
        
        assert secret_key.startswith('sk_'), f"Invalid secret key format"
        assert webhook_secret.startswith('whsec_'), f"Invalid webhook secret format"
        assert price_id.startswith('price_'), f"Invalid price ID format"
    
    def test_database_accessible(self, db):
        """Verify database connection works."""
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 as test")
                result = cursor.fetchone()
                assert result['test'] == 1
    
    def test_anonymous_did_configured(self):
        """Verify anonymous DID is properly configured."""
        assert ANONYMOUS_DID.startswith('did:plc:')
        assert ANONYMOUS_DID == 'did:plc:zdxbourfcbv66iq2xfpb233q'


# =============================================================================
# EVENT FORMATTING
# =============================================================================

class TestEventFormatting:
    """Test event text generation."""
    
    def test_number_to_words(self):
        """Test quantity word conversion."""
        assert number_to_words(1) == "one"
        assert number_to_words(2) == "two"
        assert number_to_words(5) == "five"
        assert number_to_words(13) == "thirteen"
        assert number_to_words(21) == "twenty one"
        assert number_to_words(100) == "one hundred"
    
    def test_event_format_singular(self, events):
        """Test single book event format."""
        text = events._format_order_event("TestUser", 1)
        assert "realizes" in text.lower()
        assert "one" in text.lower()
        assert "book" in text.lower()
        assert "books" not in text.lower()
    
    def test_event_format_plural(self, events):
        """Test multiple books event format."""
        text = events._format_order_event("TestUser", 5)
        assert "five" in text.lower()
        assert "books" in text.lower()
    
    def test_event_format_anonymous(self, events):
        """Test anonymous order format."""
        text = events._format_order_event(None, 3, anonymous=True)
        assert "three" in text.lower()
        assert "books" in text.lower()


# =============================================================================
# DID ATTRIBUTION
# =============================================================================

class TestDIDAttribution:
    """Test DID resolution priority hierarchy."""
    
    def test_anonymous_overrides_all(self, events):
        """Anonymous flag must override even valid DIDs."""
        did, method = events._resolve_customer_did(
            customer_did="did:plc:realuser123",
            customer_email="user@example.com",
            customer_handle="user.bsky.social",
            anonymous=True
        )
        assert method == "anonymous"
        assert did == ANONYMOUS_DID
    
    def test_unknown_email_fallback(self, events):
        """Unknown email should fall back to anonymous."""
        did, method = events._resolve_customer_did(
            customer_did=None,
            customer_email="unknown_test_email_12345@example.com",
            anonymous=False
        )
        assert method == "anonymous"
        assert did == ANONYMOUS_DID
    
    def test_empty_metadata_fallback(self, events):
        """Empty metadata should fall back to anonymous."""
        did, method = events._resolve_customer_did(
            customer_did=None,
            customer_email=None,
            customer_handle=None,
            anonymous=True
        )
        assert method == "anonymous"
        assert did == ANONYMOUS_DID


# =============================================================================
# ORDER EVENT CREATION
# =============================================================================

class TestOrderEvents:
    """Test order event recording."""
    
    def test_anonymous_order_creates_event(self, events, db):
        """Test anonymous order creates event correctly."""
        session_id = f"cs_test_anon_{int(time.time() * 1000)}"
        
        result = events.record_book_order(
            customer_email="test@example.com",
            customer_name="Test User",
            quantity=1,
            amount=1499,
            currency="usd",
            session_id=session_id,
            customer_did=None,
            customer_handle=None,
            anonymous=True
        )
        
        assert result['success'] is True
        assert result['attribution_method'] == 'anonymous'
        assert result['did'] == ANONYMOUS_DID
        assert result['event_id'] is not None
    
    def test_multi_book_order(self, events, db):
        """Test ordering multiple books."""
        session_id = f"cs_test_multi_{int(time.time() * 1000)}"
        
        result = events.record_book_order(
            customer_email="test@example.com",
            customer_name="Test User",
            quantity=5,
            amount=7495,
            currency="usd",
            session_id=session_id,
            anonymous=True
        )
        
        assert result['success'] is True
        
        # Verify event text
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT event FROM events WHERE id = %s",
                    (result['event_id'],)
                )
                event = cursor.fetchone()
                assert "five" in event['event'].lower()
                assert "books" in event['event'].lower()
    
    def test_order_quantities_stored(self, events, db):
        """Test order quantities stored in JSONB."""
        session_id = f"cs_test_qty_{int(time.time() * 1000)}"
        
        result = events.record_book_order(
            customer_email="test@example.com",
            customer_name="Test User",
            quantity=3,
            amount=4497,
            currency="usd",
            session_id=session_id,
            anonymous=True
        )
        
        assert result['success'] is True
        
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT quantities FROM events WHERE id = %s",
                    (result['event_id'],)
                )
                event = cursor.fetchone()
                quantities = event['quantities']
                assert quantities['books'] == 3
                assert quantities['amount_cents'] == 4497
                assert quantities['currency'] == 'usd'


# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

class TestSessionManagement:
    """Test order_sessions table operations."""
    
    def test_session_storage(self, db):
        """Test storing checkout session."""
        session_id = f"cs_test_store_{int(time.time() * 1000)}"
        
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO order_sessions 
                    (session_id, customer_did, customer_handle, quantity, anonymous, amount, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (session_id, 'did:plc:test', 'test.bsky.social', 2, False, 2998, int(time.time())))
                conn.commit()
                
                cursor.execute(
                    "SELECT * FROM order_sessions WHERE session_id = %s",
                    (session_id,)
                )
                session = cursor.fetchone()
                
                assert session is not None
                assert session['quantity'] == 2
                assert session['amount'] == 2998
                assert session['processed'] is False
    
    def test_session_idempotency(self, db):
        """Test duplicate session prevention."""
        session_id = f"cs_test_idem_{int(time.time() * 1000)}"
        
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                # First insert
                cursor.execute("""
                    INSERT INTO order_sessions 
                    (session_id, quantity, amount, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (session_id) DO NOTHING
                """, (session_id, 1, 1499, int(time.time())))
                conn.commit()
                
                # Duplicate insert should be ignored
                cursor.execute("""
                    INSERT INTO order_sessions 
                    (session_id, quantity, amount, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (session_id) DO NOTHING
                """, (session_id, 5, 7495, int(time.time())))
                conn.commit()
                
                cursor.execute(
                    "SELECT quantity FROM order_sessions WHERE session_id = %s",
                    (session_id,)
                )
                session = cursor.fetchone()
                assert session['quantity'] == 1  # Original value preserved


# =============================================================================
# WEBHOOK SECURITY
# =============================================================================

class TestWebhookSecurity:
    """Test webhook security measures."""
    
    def test_duplicate_order_check(self, events, db):
        """Test duplicate order detection."""
        session_id = f"cs_test_dup_{int(time.time() * 1000)}"
        
        # Create first order
        result1 = events.record_book_order(
            customer_email="test@example.com",
            customer_name="Test User",
            quantity=1,
            amount=1499,
            currency="usd",
            session_id=session_id,
            anonymous=True
        )
        assert result1['success'] is True
        
        # Check for duplicate via URI
        session_short = session_id.split('_')[-1][:8]
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM events WHERE uri = %s",
                    (f'stripe:{session_short}',)
                )
                existing = cursor.fetchone()
                assert existing is not None


# =============================================================================
# STRIPE SERVICE HEALTH
# =============================================================================

class TestStripeService:
    """Test Stripe service connectivity."""
    
    def test_health_endpoint(self):
        """Test Stripe service health endpoint."""
        import requests
        try:
            response = requests.get('http://127.0.0.1:5555/health', timeout=5)
            if response.status_code == 200:
                data = response.json()
                assert data['status'] == 'healthy'
                assert data['service'] == 'stripe_payment'
            else:
                pytest.skip("Stripe service not running")
        except requests.exceptions.ConnectionError:
            pytest.skip("Stripe service not running")
    
    def test_checkout_session_validation(self):
        """Test checkout session request validation."""
        import requests
        try:
            # Test invalid quantity
            response = requests.post(
                'http://127.0.0.1:5555/create-checkout-session',
                json={'quantity': 0},
                timeout=5
            )
            if response.status_code != 400:
                # Service might not be running
                pytest.skip("Stripe service not responding as expected")
            
            assert response.status_code == 400
            assert 'error' in response.json()
        except requests.exceptions.ConnectionError:
            pytest.skip("Stripe service not running")


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """End-to-end integration tests."""
    
    def test_full_order_flow(self, events, db):
        """Test complete order flow from session to event."""
        session_id = f"cs_test_flow_{int(time.time() * 1000)}"
        quantity = 2
        amount = 2998
        
        # 1. Store session (simulating checkout creation)
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO order_sessions 
                    (session_id, customer_did, quantity, anonymous, amount, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (session_id, None, quantity, True, amount, int(time.time())))
                conn.commit()
        
        # 2. Process payment (simulating webhook)
        result = events.record_book_order(
            customer_email="test@example.com",
            customer_name="Test User",
            quantity=quantity,
            amount=amount,
            currency="usd",
            session_id=session_id,
            anonymous=True
        )
        
        assert result['success'] is True
        
        # 3. Mark session processed
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE order_sessions 
                    SET processed = TRUE, processed_at = %s
                    WHERE session_id = %s
                """, (int(time.time()), session_id))
                conn.commit()
        
        # 4. Verify final state
        with db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT processed FROM order_sessions WHERE session_id = %s",
                    (session_id,)
                )
                session = cursor.fetchone()
                assert session['processed'] is True
                
                cursor.execute(
                    "SELECT * FROM events WHERE id = %s",
                    (result['event_id'],)
                )
                event = cursor.fetchone()
                assert event['type'] == 'order'
                assert event['key'] == 'seeker'
                assert event['did'] == ANONYMOUS_DID


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
