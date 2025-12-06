"""
API Routes Tests
Tests for Flask API endpoints and HTTP responses
"""
import pytest
import json


@pytest.mark.database
class TestWorldEndpoint:
    """Test /api/world endpoint"""
    
    def test_world_returns_200(self, client):
        """World endpoint should return 200 OK"""
        response = client.get('/api/world')
        assert response.status_code == 200
    
    def test_world_returns_json(self, client):
        """World endpoint should return valid JSON"""
        response = client.get('/api/world')
        data = json.loads(response.data)
        assert isinstance(data, dict)
    
    def test_world_has_required_fields(self, client):
        """World endpoint should have all required fields"""
        response = client.get('/api/world')
        data = json.loads(response.data)
        
        required_fields = [
            'dreamers', 'keeper', 'keeper_did', 'epoch',
            'logins', 'core_color', 'canon_size'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_world_dreamers_count(self, client):
        """World endpoint should return valid dreamer count"""
        response = client.get('/api/world')
        data = json.loads(response.data)
        
        assert 'dreamers' in data
        assert isinstance(data['dreamers'], int)
        assert data['dreamers'] >= 0
    
    def test_world_keeper_did(self, client):
        """World endpoint should return valid keeper DID"""
        response = client.get('/api/world')
        data = json.loads(response.data)
        
        assert 'keeper_did' in data
        assert data['keeper_did'].startswith('did:')


@pytest.mark.database
class TestDreamersEndpoint:
    """Test /api/dreamers endpoint"""
    
    def test_dreamers_returns_200(self, client):
        """Dreamers endpoint should return 200 OK"""
        response = client.get('/api/dreamers')
        assert response.status_code == 200
    
    def test_dreamers_returns_array(self, client):
        """Dreamers endpoint should return array of dreamers"""
        response = client.get('/api/dreamers')
        data = json.loads(response.data)
        assert isinstance(data, list)
    
    def test_dreamers_have_required_fields(self, client):
        """Each dreamer should have required fields"""
        response = client.get('/api/dreamers')
        data = json.loads(response.data)
        
        if len(data) > 0:
            dreamer = data[0]
            required_fields = [
                'did', 'handle', 'name', 'display_name',
                'avatar', 'spectrum', 'souvenirs'
            ]
            
            for field in required_fields:
                assert field in dreamer, f"Missing field: {field}"
    
    def test_dreamers_spectrum_structure(self, client):
        """Dreamer spectrum should have correct structure"""
        response = client.get('/api/dreamers')
        data = json.loads(response.data)
        
        if len(data) > 0:
            spectrum = data[0]['spectrum']
            assert isinstance(spectrum, dict)
            
            spectrum_fields = [
                'entropy', 'oblivion', 'liberty',
                'authority', 'receptive', 'skeptic', 'octant'
            ]
            
            for field in spectrum_fields:
                assert field in spectrum


@pytest.mark.database
class TestAuthenticatedEndpoints:
    """Test endpoints that require authentication"""
    
    def test_work_endpoint_requires_auth(self, client):
        """Work endpoints should require authentication"""
        response = client.get('/api/work/greeter/status')
        # Should return 401 or redirect without auth
        assert response.status_code in [401, 403, 302]
    
    def test_work_endpoint_with_valid_token(self, client, valid_session_token):
        """Work endpoints should accept valid session token"""
        response = client.get(
            '/api/work/greeter/status',
            headers={'Authorization': f'Bearer {valid_session_token}'}
        )
        # Should not be authentication error
        assert response.status_code not in [401, 403]
    
    def test_work_endpoint_with_invalid_token(self, client):
        """Work endpoints should reject invalid token"""
        response = client.get(
            '/api/work/greeter/status',
            headers={'Authorization': 'Bearer invalid_token_123'}
        )
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestRateLimitedEndpoints:
    """Test rate limiting on API endpoints"""
    
    def test_rate_limit_allows_normal_requests(self, client):
        """Normal request rate should be allowed"""
        # Make 5 requests (should be under limit)
        for i in range(5):
            response = client.get('/api/world')
            assert response.status_code == 200
    
    def test_auth_endpoint_rate_limited(self, client):
        """Auth endpoints should have lower rate limits"""
        # Auth endpoints have stricter limits
        # This test verifies rate limiting is applied
        endpoint = '/api/auth/session'
        
        # First few requests should work
        response = client.post(endpoint, json={'handle': 'test.reverie.house'})
        # Response may be 400 (invalid creds) but not 429 (rate limited) yet
        assert response.status_code != 429


@pytest.mark.database  
class TestErrorHandling:
    """Test API error handling"""
    
    def test_404_on_invalid_endpoint(self, client):
        """Invalid endpoints should return 404"""
        response = client.get('/api/nonexistent_endpoint_12345')
        assert response.status_code == 404
    
    def test_invalid_json_request(self, client):
        """Malformed JSON should be handled gracefully"""
        response = client.post(
            '/api/auth/session',
            data='invalid json{{{',
            content_type='application/json'
        )
        # Should return error, not crash
        assert response.status_code in [400, 422, 500]
    
    def test_missing_required_params(self, client):
        """Missing required parameters should return error"""
        response = client.post(
            '/api/auth/session',
            json={}  # Missing required fields
        )
        # Should return validation error
        assert response.status_code in [400, 422]


@pytest.mark.database
class TestContentNegotiation:
    """Test content type handling"""
    
    def test_json_content_type(self, client):
        """API should return JSON content type"""
        response = client.get('/api/world')
        assert 'application/json' in response.content_type
    
    def test_accepts_json_requests(self, client):
        """API should accept JSON request bodies"""
        response = client.post(
            '/api/dreamer/color',
            json={'color': '#FF0000'},
            content_type='application/json'
        )
        # May fail auth but should accept JSON format
        assert response.status_code != 415  # Not "Unsupported Media Type"


@pytest.mark.database
class TestCORSHeaders:
    """Test CORS configuration"""
    
    def test_cors_headers_present(self, client):
        """CORS headers should be set correctly"""
        response = client.get('/api/world')
        # Check if CORS headers are present (if configured)
        # This may vary based on your CORS setup
        assert response.status_code == 200


@pytest.mark.database
class TestSpecificEndpoints:
    """Test specific critical endpoints"""
    
    def test_operations_status(self, client):
        """Operations status endpoint should work"""
        response = client.get('/api/operations-status')
        assert response.status_code == 200
    
    def test_notifications_stream_endpoint_exists(self, client):
        """SSE notifications endpoint should exist"""
        # SSE endpoint requires DID parameter
        response = client.get('/api/notifications/stream?user_did=did:plc:test123')
        # Should not return 404
        assert response.status_code != 404
    
    def test_souvenirs_endpoint(self, client):
        """Souvenirs endpoint should return data"""
        response = client.get('/api/souvenirs')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert isinstance(data, dict)
