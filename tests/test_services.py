"""
Services Testing

Services: firehose monitoring, feed generation, rate limiting, PDS operations.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
from unittest.mock import Mock, patch


# ============================================================================
# FIREHOSE MONITORING (DreamerHose)
# ============================================================================

@pytest.mark.database
class TestFirehose:
    """Firehose monitoring service"""
    
    def test_dreamerhose_can_import(self):
        """Test DreamerHose can be imported"""
        from core.dreamerhose import DreamerhoseMonitor
        assert DreamerhoseMonitor is not None
    
    def test_dreamerhose_initialization(self, test_db):
        """Test DreamerHose initializes"""
        from core.dreamerhose import DreamerhoseMonitor
        monitor = DreamerhoseMonitor()
        assert monitor is not None
    
    def test_dreamerhose_loads_dreamers(self, test_db):
        """Test DreamerHose loads dreamer list"""
        from core.dreamerhose import DreamerhoseMonitor
        monitor = DreamerhoseMonitor()
        # Should load dreamers from database
        assert hasattr(monitor, 'dreamers') or hasattr(monitor, 'load_dreamers')


# ============================================================================
# FEED GENERATION
# ============================================================================

@pytest.mark.database
class TestFeedGen:
    """Feed generator service"""
    
    def test_feed_db_exists(self):
        """Test feed database can be imported"""
        try:
            from core.feedgen import FeedDatabase
            assert FeedDatabase is not None
        except ImportError:
            pytest.skip("FeedGen not available")
    
    def test_feed_skeleton_generation(self):
        """Test feed skeleton can be generated"""
        try:
            from core.feedgen import FeedGenerator
            gen = FeedGenerator()
            # Should have skeleton generation method
            assert hasattr(gen, 'get_feed_skeleton') or hasattr(gen, 'generate_feed')
        except ImportError:
            pytest.skip("FeedGen not available")
    
    def test_feedgen_did_document(self):
        """Test feedgen DID document is accessible"""
        import requests
        response = requests.get('https://reverie.house/.well-known/did.json', verify=False)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data['id'] == 'did:web:reverie.house', "DID should match"
        assert len(data['service']) > 0, "Should have service endpoints"
        assert data['service'][0]['type'] == 'BskyFeedGenerator', "Should be feed generator service"
    
    def test_feedgen_describe_endpoint(self):
        """Test feedgen describe endpoint returns feed metadata"""
        import requests
        response = requests.get('https://reverie.house/xrpc/app.bsky.feed.describeFeedGenerator', verify=False)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data['did'] == 'did:web:reverie.house', "DID should match"
        assert 'feeds' in data, "Should have feeds list"
        assert len(data['feeds']) >= 2, "Should have at least 2 feeds (lore, dreaming)"
        
        # Check feed metadata
        feed_uris = [f['uri'] for f in data['feeds']]
        assert any('lore' in uri for uri in feed_uris), "Should have lore feed"
        assert any('dreaming' in uri for uri in feed_uris), "Should have dreaming feed"
    
    def test_feedgen_skeleton_endpoint(self):
        """Test feedgen skeleton endpoint returns posts"""
        import requests
        response = requests.get(
            'https://reverie.house/xrpc/app.bsky.feed.getFeedSkeleton',
            params={
                'feed': 'at://did:web:reverie.house/app.bsky.feed.generator/lore',
                'limit': 5
            },
            verify=False
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert 'feed' in data, "Should have feed array"
        # Feed might be empty if no posts, but structure should be valid
        if len(data['feed']) > 0:
            assert 'post' in data['feed'][0], "Feed items should have post URIs"
            assert data['feed'][0]['post'].startswith('at://'), "Post URIs should be AT URIs"


# ============================================================================
# RATE LIMITING
# ============================================================================

@pytest.mark.database
class TestRateLimiting:
    """Rate limiter service"""
    
    def test_rate_limiter_initialization(self):
        """Test rate limiter initializes"""
        from core.rate_limiter import PersistentRateLimiter
        limiter = PersistentRateLimiter(max_requests=10, window_seconds=60)
        assert limiter is not None
    
    def test_rate_limiter_allows_requests(self):
        """Test rate limiter allows normal requests"""
        from core.rate_limiter import PersistentRateLimiter
        limiter = PersistentRateLimiter(max_requests=10, window_seconds=60)
        
        # First request should be allowed
        allowed = limiter.check('test-key')
        assert allowed is True, "First request should be allowed"
        assert isinstance(allowed, bool), "check() should return boolean"
    
    def test_rate_limiter_blocks_excess(self, test_db):
        """Test rate limiter blocks excess requests AND verifies database state"""
        from core.rate_limiter import PersistentRateLimiter
        limiter = PersistentRateLimiter(max_requests=2, window_seconds=60)
        
        test_key = 'test-rate-limit-key'
        
        # Make requests up to limit
        first = limiter.check(test_key)
        assert first is True, "First request should be allowed"
        assert isinstance(first, bool), "check() should return boolean"
        
        # FIXED: Verify database state after first request
        state1 = test_db.execute(
            "SELECT request_count, window_start FROM rate_limits WHERE key = %s",
            (test_key,)
        ).fetchone()
        assert state1 is not None, "State must be persisted in database"
        assert state1['request_count'] == 1, "Count should be 1 after first request"
        
        second = limiter.check(test_key)
        assert second is True, "Second request should be allowed"
        
        # FIXED: Verify count incremented
        state2 = test_db.execute(
            "SELECT request_count FROM rate_limits WHERE key = %s",
            (test_key,)
        ).fetchone()
        assert state2['request_count'] == 2, "Count should be 2 after second request"
        
        # Third should be blocked
        third = limiter.check(test_key)
        assert third is False, "Third request should be blocked (limit=2)"
        
        # FIXED: Verify count didn't increment when blocked
        state3 = test_db.execute(
            "SELECT request_count FROM rate_limits WHERE key = %s",
            (test_key,)
        ).fetchone()
        assert state3['request_count'] == 2, "Count should stay at 2 (request was blocked)"
        
        # Cleanup
        test_db.execute("DELETE FROM rate_limits WHERE key = %s", (test_key,))
    
    def test_rate_limiter_key_isolation(self, test_db):
        """CRITICAL: Verify different keys don't interfere with each other"""
        from core.rate_limiter import PersistentRateLimiter
        limiter = PersistentRateLimiter(max_requests=1, window_seconds=60)
        
        # Use key1 to max
        assert limiter.check('isolation_key1') is True
        assert limiter.check('isolation_key1') is False, "Should be blocked at limit"
        
        # key2 should still work independently
        assert limiter.check('isolation_key2') is True, "Different key must not be affected"
        
        # Verify database has both keys with correct counts
        keys = test_db.execute("""
            SELECT key, request_count FROM rate_limits 
            WHERE key IN ('isolation_key1', 'isolation_key2')
        """).fetchall()
        
        assert len(keys) == 2, "Both keys should be in database"
        
        key_counts = {k['key']: k['request_count'] for k in keys}
        assert key_counts['isolation_key1'] == 1, "Key1 should have count 1"
        assert key_counts['isolation_key2'] == 1, "Key2 should have count 1"
        
        # Cleanup
        test_db.execute("DELETE FROM rate_limits WHERE key IN ('isolation_key1', 'isolation_key2')")


# ============================================================================
# PDS OPERATIONS
# ============================================================================

@pytest.mark.pds
class TestPDS:
    """PDS admin operations"""
    
    def test_pds_admin_exists(self):
        """Test PDS admin can be imported"""
        try:
            from utils.pds_admin import PDSAdmin
            assert PDSAdmin is not None
        except ImportError:
            pytest.skip("PDS admin not available")
    
    def test_pds_can_create_account(self):
        """Test PDS account creation interface"""
        try:
            from utils.pds_admin import PDSAdmin
            admin = PDSAdmin()
            # Should have account creation method
            assert hasattr(admin, 'create_account') or hasattr(admin, 'createAccount')
        except ImportError:
            pytest.skip("PDS admin not available")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
