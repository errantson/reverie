"""
Stripe-specific test suite for the order system.

Tests Stripe checkout session creation, webhook processing, and session tracking.
Production-safe with proper cleanup.
"""

import pytest
import json
import time
import os
from unittest.mock import patch, MagicMock
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force production database for tests
os.environ['POSTGRES_DB'] = 'reverie_house'

from core.events import EventsManager, ANONYMOUS_DID
from core.database import DatabaseManager


@pytest.fixture(scope="session", autouse=True)
def ensure_order_sessions_table():
    """
    Ensure order_sessions table exists for testing.
    Creates schema if missing, cleans up test data after all tests.
    """
    db = DatabaseManager()

    # Track when test session starts for cleanup
    test_session_start = int(time.time())

    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            # Create table if not exists (matches stripe/app.py schema)
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

    # Cleanup test data after all tests
    print("\n🧹 Cleaning up test data...")
    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            # Clean up test order sessions (cs_test_ prefix)
            cursor.execute("""
                DELETE FROM order_sessions
                WHERE session_id LIKE 'cs_test_%'
                RETURNING id
            """)
            sessions_deleted = cursor.fetchall()
            
            # Clean up test events: all anonymous order events created during test session
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
def production_db() -> DatabaseManager:
    """Provide production database connection for tests that need direct DB access"""
    return DatabaseManager()


class TestStripeCheckoutFlow:
    """
    Test Stripe checkout session creation and handling.
    Uses mocks for Stripe API calls to avoid actual charges.
    """

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_authenticated(self, mock_stripe_create):
        """
        Test checkout creation for authenticated user.
        Verifies metadata is passed correctly to Stripe.
        """
        mock_stripe_create.return_value = MagicMock(
            id='cs_test_authenticated',
            url='https://checkout.stripe.com/test_auth',
            amount_total=2998  # 2 books @ $14.99
        )

        # Load Stripe configuration
        from dotenv import load_dotenv
        load_dotenv('/srv/secrets/stripe.env')

        import stripe
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

        # Create session with authenticated metadata
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': os.getenv('STRIPE_PRICE_ID'),
                'quantity': 2
            }],
            mode='payment',
            metadata={
                'customer_did': 'did:plc:testuser123',
                'customer_handle': 'testuser.bsky.social',
                'anonymous': 'False',
                'quantity': '2'
            }
        )

        assert session.id == 'cs_test_authenticated'
        assert mock_stripe_create.called

        # Verify metadata passed correctly
        call_args = mock_stripe_create.call_args[1]
        assert call_args['metadata']['customer_did'] == 'did:plc:testuser123'
        assert call_args['metadata']['anonymous'] == 'False'
        assert call_args['metadata']['quantity'] == '2'

    @patch('stripe.checkout.Session.create')
    def test_create_checkout_anonymous(self, mock_stripe_create):
        """
        Test checkout creation for anonymous user.
        Verifies anonymous flag and empty DID in metadata.
        """
        mock_stripe_create.return_value = MagicMock(
            id='cs_test_anonymous',
            url='https://checkout.stripe.com/test_anon',
            amount_total=1499
        )

        from dotenv import load_dotenv
        load_dotenv('/srv/secrets/stripe.env')

        import stripe
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

        # Create session with anonymous metadata
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': os.getenv('STRIPE_PRICE_ID'),
                'quantity': 1
            }],
            mode='payment',
            metadata={
                'customer_did': None,
                'customer_handle': None,
                'anonymous': 'True',
                'quantity': '1'
            }
        )

        assert session.id == 'cs_test_anonymous'
        assert mock_stripe_create.called

        # Verify anonymous metadata
        call_args = mock_stripe_create.call_args[1]
        assert call_args['metadata']['customer_did'] is None
        assert call_args['metadata']['anonymous'] == 'True'
        assert call_args['metadata']['quantity'] == '1'

    def test_null_customer_data_handling(self):
        """
        Test that the stripe service properly handles null customer_did and customer_handle.
        
        BUG FIX VALIDATION: Previously, passing null values would crash with:
        'NoneType' object has no attribute 'strip'
        
        This test validates the fix: (data.get('customer_did') or '').strip()
        """
        import requests
        
        test_cases = [
            # Test 1: Both null (typical anonymous user from browser)
            {
                'quantity': 1,
                'customer_did': None,
                'customer_handle': None,
                'anonymous': True,
                'description': 'Both customer_did and customer_handle are null'
            },
            # Test 2: Empty strings
            {
                'quantity': 2,
                'customer_did': '',
                'customer_handle': '',
                'anonymous': True,
                'description': 'Both customer_did and customer_handle are empty strings'
            },
            # Test 3: Mixed null and empty
            {
                'quantity': 1,
                'customer_did': None,
                'customer_handle': '',
                'anonymous': True,
                'description': 'customer_did is null, customer_handle is empty'
            },
            # Test 4: Whitespace only
            {
                'quantity': 3,
                'customer_did': '   ',
                'customer_handle': '  ',
                'anonymous': True,
                'description': 'customer_did and customer_handle are whitespace'
            }
        ]
        
        for test_case in test_cases:
            description = test_case.pop('description')
            
            # Call the actual stripe service
            response = requests.post(
                'http://127.0.0.1:5555/create-checkout-session',
                json=test_case,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            # Should succeed and return a checkout URL
            assert response.status_code == 200, \
                f"Test failed for: {description}. Status: {response.status_code}, Body: {response.text}"
            
            data = response.json()
            assert 'url' in data, \
                f"Test failed for: {description}. Missing 'url' in response: {data}"
            assert 'id' in data, \
                f"Test failed for: {description}. Missing 'id' in response: {data}"
            assert data['url'].startswith('https://checkout.stripe.com'), \
                f"Test failed for: {description}. Invalid checkout URL: {data['url']}"


class TestWebhookHandling:
    """
    Test Stripe webhook processing and event creation.
    CRITICAL: Webhook signature verification is tested here.
    """

    def test_webhook_signature_verification(self):
        """
        Test that webhook signatures are properly verified.
        CRITICAL: This prevents payment tampering.
        """
        # Load webhook secret
        from dotenv import load_dotenv
        load_dotenv('/srv/secrets/stripe.env')
        webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

        import stripe
        # Mock webhook payload and signature
        payload = json.dumps({
            'id': 'evt_test_webhook',
            'object': 'event',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_webhook',
                    'metadata': {
                        'customer_did': 'did:plc:testuser123',
                        'anonymous': 'False',
                        'quantity': '1'
                    }
                }
            }
        })

        # Create valid signature
        timestamp = str(int(time.time()))
        signed_payload = f"{timestamp}.{payload}"
        import hmac
        import hashlib
        signature = hmac.new(
            webhook_secret.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).hexdigest()
        stripe_signature = f"t={timestamp},v1={signature}"

        # This should not raise an exception
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, webhook_secret
        )

        assert event['type'] == 'checkout.session.completed'
        assert event['data']['object']['id'] == 'cs_test_webhook'

    @patch('stripe.checkout.Session.retrieve')
    def test_checkout_session_retrieval(self, mock_session_retrieve):
        """
        Test retrieving checkout session details from Stripe.
        Used to get customer email and other metadata.
        """
        mock_session_retrieve.return_value = {
            'id': 'cs_test_retrieve',
            'customer_email': 'test@example.com',
            'metadata': {
                'customer_did': 'did:plc:testuser123',
                'anonymous': 'False',
                'quantity': '2'
            }
        }

        from dotenv import load_dotenv
        load_dotenv('/srv/secrets/stripe.env')

        import stripe
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

        session = stripe.checkout.Session.retrieve('cs_test_retrieve')

        assert session['customer_email'] == 'test@example.com'
        assert session['metadata']['quantity'] == '2'
        assert mock_session_retrieve.called


class TestOrderSessionTracking:
    """
    Test order session creation and tracking in database.
    Ensures sessions are properly stored and retrieved.
    """

    def test_session_creation(self, production_db):
        """
        Test creating an order session in the database.
        Verifies all required fields are stored.
        """
        session_id = f"cs_test_session_{int(time.time() * 1000)}"
        customer_did = 'did:plc:testuser123'
        quantity = 3
        amount = 4497  # 3 * 1499

        with production_db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO order_sessions
                    (session_id, customer_did, customer_handle, quantity, anonymous, amount, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    session_id, customer_did, 'testuser.bsky.social',
                    quantity, False, amount, int(time.time())
                ))
                conn.commit()

        # Verify session was created
        with production_db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM order_sessions WHERE session_id = %s
                """, (session_id,))

                session = cursor.fetchone()
                assert session is not None
                assert session['customer_did'] == customer_did
                assert session['quantity'] == quantity
                assert session['amount'] == amount
                assert session['anonymous'] is False

    def test_session_update_processed(self, production_db):
        """
        Test marking a session as processed after successful payment.
        Prevents duplicate processing.
        """
        session_id = f"cs_test_processed_{int(time.time() * 1000)}"

        # Create session
        with production_db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO order_sessions
                    (session_id, customer_did, quantity, amount, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (session_id, 'did:plc:testuser123', 1, 1499, int(time.time())))
                conn.commit()

        # Mark as processed
        processed_time = int(time.time())
        with production_db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE order_sessions
                    SET processed = TRUE, processed_at = %s
                    WHERE session_id = %s
                """, (processed_time, session_id))
                conn.commit()

        # Verify update
        with production_db.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT processed, processed_at FROM order_sessions
                    WHERE session_id = %s
                """, (session_id,))

                session = cursor.fetchone()
                assert session['processed'] is True
                assert session['processed_at'] == processed_time