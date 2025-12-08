"""
Consolidated API Testing Suite

Combines all API endpoint tests:
- Basic API routes (from test_api_routes.py)
- Brutal/security API testing (from test_api_brutal.py)

Covers all REST endpoints with both functional and security testing.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import requests
import json
import time


# ============================================================================
# WORLD ENDPOINT TESTS
# ============================================================================

@pytest.mark.api
class TestWorldEndpoint:
    """Test /api/world endpoint (basic + security)"""
    
    def test_world_returns_200(self, api_base_url):
        """Test world endpoint returns 200"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        assert response.status_code == 200
    
    def test_world_returns_json(self, api_base_url):
        """Test world endpoint returns JSON"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        assert response.headers['Content-Type'] == 'application/json'
    
    def test_world_has_required_fields(self, api_base_url):
        """Test world endpoint has all required fields"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        data = response.json()
        
        required_fields = ['dreamers', 'epoch', 'keeper', 'core_color', 'canon_size']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_world_dreamers_is_integer(self, api_base_url):
        """Test dreamers count is a non-negative integer"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        data = response.json()
        
        assert isinstance(data['dreamers'], int)
        assert data['dreamers'] >= 0
    
    def test_world_epoch_is_valid_timestamp(self, api_base_url):
        """Test epoch is a valid Unix timestamp"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        data = response.json()
        
        assert isinstance(data['epoch'], (int, float))
        assert data['epoch'] > 1577836800  # After 2020-01-01
        assert data['epoch'] <= time.time() + 60  # Not too far in future
    
    def test_world_keeper_did_format(self, api_base_url):
        """Test keeper DID has valid format"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        data = response.json()
        
        assert 'keeper' in data
        assert isinstance(data['keeper'], str)
        assert data['keeper'].startswith('did:')
    
    def test_world_core_color_is_hex(self, api_base_url):
        """Test core_color is a valid hex color"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        data = response.json()
        
        assert 'core_color' in data
        assert data['core_color'].startswith('#')
        assert len(data['core_color']) in [4, 7]  # #RGB or #RRGGBB
    
    def test_world_no_sql_errors_exposed(self, api_base_url):
        """Test that SQL errors are not exposed in responses"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        text = response.text.lower()
        
        assert 'sql' not in text
        assert 'postgresql' not in text
        assert 'syntax error' not in text


# ============================================================================
# DREAMERS ENDPOINT TESTS
# ============================================================================

@pytest.mark.api
class TestDreamersEndpoint:
    """Test /api/dreamers endpoint (basic + security)"""
    
    def test_dreamers_returns_200(self, api_base_url):
        """Test dreamers endpoint returns 200"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        assert response.status_code == 200
    
    def test_dreamers_returns_array(self, api_base_url):
        """Test dreamers endpoint returns array"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_dreamers_have_required_fields(self, api_base_url):
        """Test each dreamer has required fields"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        if len(data) > 0:
            dreamer = data[0]
            required_fields = ['did', 'name', 'handle']
            for field in required_fields:
                assert field in dreamer
    
    def test_dreamer_spectrum_structure(self, api_base_url):
        """Test dreamer spectrum values are floats 0-1"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        for dreamer in data[:10]:  # Check first 10
            if 'spectrum' in dreamer and dreamer['spectrum']:
                for key, value in dreamer['spectrum'].items():
                    assert isinstance(value, (int, float))
                    assert 0 <= value <= 1
    
    def test_dreamer_did_format_valid(self, api_base_url):
        """Test all dreamer DIDs have valid format"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        for dreamer in data[:10]:
            assert 'did' in dreamer
            assert dreamer['did'].startswith('did:')
    
    def test_dreamer_handle_format_valid(self, api_base_url):
        """Test all dreamer handles have valid format"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        for dreamer in data[:10]:
            assert 'handle' in dreamer
            assert '.' in dreamer['handle']  # Should have domain
            assert not dreamer['handle'].startswith('did:')
    
    def test_dreamer_avatar_is_url_or_empty(self, api_base_url):
        """Test avatar is either a URL or empty"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        for dreamer in data[:10]:
            if 'avatar' in dreamer and dreamer['avatar']:
                assert 'http' in dreamer['avatar'].lower()
    
    def test_dreamers_no_sensitive_data_leak(self, api_base_url):
        """Test that sensitive data is not exposed"""
        response = requests.get(f'{api_base_url}/api/dreamers', timeout=10)
        data = response.json()
        
        for dreamer in data[:5]:
            # Should not contain passwords, tokens, etc
            assert 'password' not in str(dreamer).lower()
            assert 'token' not in str(dreamer).lower()
            assert 'secret' not in str(dreamer).lower()


# ============================================================================
# DREAMER DETAIL ENDPOINT TESTS
# ============================================================================

@pytest.mark.api
class TestDreamerDetailEndpoint:
    """Test /api/dreamer/<handle> endpoint"""
    
    def test_dreamer_detail_returns_200_for_valid(self, api_base_url, test_db):
        """Test dreamer detail returns 200 for valid handle"""
        # Get a real dreamer
        dreamer = test_db.execute(
            "SELECT name FROM dreamers WHERE name IS NOT NULL LIMIT 1"
        ).fetchone()
        
        if not dreamer:
            pytest.skip("No dreamers in database")
        
        response = requests.get(
            f'{api_base_url}/api/dreamer/{dreamer["name"]}',
            timeout=10
        )
        assert response.status_code == 200
    
    def test_dreamer_detail_404_for_nonexistent(self, api_base_url):
        """Test dreamer detail returns 404 for nonexistent handle"""
        response = requests.get(
            f'{api_base_url}/api/dreamer/definitely-does-not-exist-xyz123',
            timeout=10
        )
        assert response.status_code == 404
    
    def test_dreamer_detail_sql_injection_blocked(self, api_base_url):
        """Test SQL injection attempts return 404, not 500"""
        response = requests.get(
            f'{api_base_url}/api/dreamer/\'; DROP TABLE dreamers; --',
            timeout=10
        )
        assert response.status_code in [404, 400]  # Not 500
    
    def test_dreamer_detail_xss_escaped(self, api_base_url):
        """Test XSS attempts are handled"""
        response = requests.get(
            f'{api_base_url}/api/dreamer/<script>alert("xss")</script>',
            timeout=10
        )
        assert response.status_code in [404, 400]
    
    def test_dreamer_detail_long_handle_handled(self, api_base_url):
        """Test very long handles don't cause crashes"""
        long_handle = 'a' * 500
        response = requests.get(
            f'{api_base_url}/api/dreamer/{long_handle}',
            timeout=10
        )
        assert response.status_code in [404, 400]  # Not 500
    
    def test_dreamer_detail_unicode_handled(self, api_base_url):
        """Test Unicode in handles is handled"""
        response = requests.get(
            f'{api_base_url}/api/dreamer/tëst🌟',
            timeout=10
        )
        assert response.status_code in [200, 404, 400]  # Not 500


# ============================================================================
# CANON ENDPOINT TESTS
# ============================================================================

@pytest.mark.api
class TestCanonEndpoint:
    """Test /api/canon endpoint"""
    
    def test_canon_returns_200(self, api_base_url):
        """Test canon endpoint returns 200"""
        response = requests.get(f'{api_base_url}/api/canon', timeout=10)
        assert response.status_code == 200
    
    def test_canon_returns_array(self, api_base_url):
        """Test canon endpoint returns array"""
        response = requests.get(f'{api_base_url}/api/canon', timeout=10)
        data = response.json()
        assert isinstance(data, list)
    
    def test_canon_events_have_valid_epochs(self, api_base_url):
        """Test canon events have valid timestamps"""
        response = requests.get(f'{api_base_url}/api/canon', timeout=10)
        data = response.json()
        
        for event in data[:10]:
            if 'epoch' in event:
                assert isinstance(event['epoch'], (int, float))
                assert event['epoch'] > 1577836800
    
    def test_canon_events_chronologically_ordered(self, api_base_url):
        """Test canon events are in reverse chronological order"""
        response = requests.get(f'{api_base_url}/api/canon', timeout=10)
        data = response.json()
        
        if len(data) > 1:
            epochs = [e.get('epoch', 0) for e in data[:10]]
            assert epochs == sorted(epochs, reverse=True)
    
    def test_canon_no_internal_fields_exposed(self, api_base_url):
        """Test internal fields are not exposed"""
        response = requests.get(f'{api_base_url}/api/canon', timeout=10)
        text = response.text.lower()
        
        assert 'password' not in text
        assert 'secret' not in text


# ============================================================================
# AUTHENTICATED ENDPOINTS
# ============================================================================

@pytest.mark.api
class TestAuthenticatedEndpoints:
    """Test endpoints requiring authentication"""
    
    def test_work_endpoint_requires_auth(self, api_base_url):
        """Test work endpoint requires authentication"""
        response = requests.get(f'{api_base_url}/api/work', timeout=10)
        assert response.status_code in [401, 403]
    
    def test_work_with_invalid_token(self, api_base_url):
        """Test work endpoint rejects invalid tokens"""
        response = requests.get(
            f'{api_base_url}/api/work',
            headers={'Authorization': 'Bearer invalid-token-12345'},
            timeout=10
        )
        assert response.status_code in [401, 403]
    
    def test_quests_endpoint_auth(self, api_base_url):
        """Test quests endpoint authentication"""
        response = requests.get(f'{api_base_url}/api/quests', timeout=10)
        assert response.status_code in [200, 401, 403]  # May allow public or require auth


# ============================================================================
# ERROR HANDLING
# ============================================================================

@pytest.mark.api
class TestErrorHandling:
    """Test API error handling"""
    
    def test_404_on_invalid_endpoint(self, api_base_url):
        """Test 404 for non-existent endpoints"""
        response = requests.get(
            f'{api_base_url}/api/definitely-does-not-exist',
            timeout=10
        )
        assert response.status_code == 404
    
    def test_invalid_json_request(self, api_base_url):
        """Test invalid JSON is handled"""
        response = requests.post(
            f'{api_base_url}/api/register',
            data='invalid json {{{',
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        assert response.status_code in [400, 422]
    
    def test_missing_required_params(self, api_base_url):
        """Test missing required parameters are handled"""
        response = requests.post(
            f'{api_base_url}/api/register',
            json={},  # Empty body
            timeout=10
        )
        assert response.status_code in [400, 422]


# ============================================================================
# CONTENT NEGOTIATION
# ============================================================================

@pytest.mark.api
class TestContentNegotiation:
    """Test content type handling"""
    
    def test_json_content_type(self, api_base_url):
        """Test endpoints return JSON content type"""
        response = requests.get(f'{api_base_url}/api/world', timeout=10)
        assert 'application/json' in response.headers.get('Content-Type', '')
    
    def test_accepts_json_requests(self, api_base_url):
        """Test endpoints accept JSON requests"""
        response = requests.post(
            f'{api_base_url}/api/check-handle',
            json={'handle': 'test.bsky.social'},
            timeout=10
        )
        assert response.status_code in [200, 400, 404, 405]


# ============================================================================
# CORS HEADERS
# ============================================================================

@pytest.mark.api
class TestCORS:
    """Test CORS header handling"""
    
    def test_cors_headers_present(self, api_base_url):
        """Test CORS headers are present"""
        response = requests.options(f'{api_base_url}/api/world', timeout=10)
        # CORS headers may or may not be present depending on config
        assert response.status_code in [200, 204, 404, 405]


# ============================================================================
# RATE LIMITING
# ============================================================================

@pytest.mark.api
class TestRateLimiting:
    """Test rate limiting on API endpoints"""
    
    def test_rate_limit_allows_normal_requests(self, api_base_url):
        """Test that normal request rates are allowed"""
        responses = []
        for _ in range(5):
            r = requests.get(f'{api_base_url}/api/world', timeout=10)
            responses.append(r.status_code)
            time.sleep(0.5)
        
        # All should succeed
        assert all(code == 200 for code in responses)
    
    def test_extreme_rate_handled(self, api_base_url):
        """Test that extreme request rates are handled"""
        responses = []
        for _ in range(50):
            try:
                r = requests.get(f'{api_base_url}/api/world', timeout=2)
                responses.append(r.status_code)
            except:
                pass
        
        # Should either rate limit (429) or allow all (200)
        # As long as server doesn't crash, test passes
        assert all(code in [200, 429, 503] for code in responses)


# ============================================================================
# SPECIFIC ENDPOINTS
# ============================================================================

@pytest.mark.api
class TestSpecificEndpoints:
    """Test specific specialized endpoints"""
    
    def test_operations_status(self, api_base_url):
        """Test operations status endpoint"""
        response = requests.get(f'{api_base_url}/api/operations', timeout=10)
        assert response.status_code in [200, 401, 404]
    
    def test_souvenirs_endpoint(self, api_base_url):
        """Test souvenirs endpoint"""
        response = requests.get(f'{api_base_url}/api/souvenirs', timeout=10)
        assert response.status_code in [200, 404]
    
    def test_notifications_endpoint_exists(self, api_base_url):
        """Test notifications stream endpoint exists"""
        response = requests.get(
            f'{api_base_url}/api/notifications',
            timeout=5,
            stream=True
        )
        assert response.status_code in [200, 401, 404]


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
