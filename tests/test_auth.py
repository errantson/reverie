"""
Authentication Tests
Tests for session management, JWT validation, and OAuth flows
"""
import pytest
import jwt
import time
from core.auth import AuthManager


@pytest.mark.database
class TestSessionManagement:
    """Test admin session creation and validation"""
    
    def test_create_session(self, auth_manager, test_did, test_handle):
        """Creating a session should return valid session ID"""
        session_id = auth_manager.create_session(test_did, test_handle)
        
        assert session_id is not None
        assert session_id in auth_manager.sessions
        assert auth_manager.sessions[session_id]['did'] == test_did
        assert auth_manager.sessions[session_id]['handle'] == test_handle
    
    def test_validate_session_valid_token(self, auth_manager, test_did, test_handle):
        """Valid session token should validate successfully"""
        session_id = auth_manager.create_session(test_did, test_handle)
        token = auth_manager.sessions[session_id]['token']
        
        valid, did, handle = auth_manager.validate_session(token)
        
        assert valid is True
        assert did == test_did
        assert handle == test_handle
    
    def test_validate_session_invalid_token(self, auth_manager):
        """Invalid token should fail validation"""
        valid, did, handle = auth_manager.validate_session('invalid_token_123')
        
        assert valid is False
        assert did is None
        assert handle is None
    
    def test_validate_session_empty_token(self, auth_manager):
        """Empty token should fail validation"""
        valid, did, handle = auth_manager.validate_session('')
        
        assert valid is False
        assert did is None
        assert handle is None
    
    def test_validate_session_none_token(self, auth_manager):
        """None token should fail validation"""
        valid, did, handle = auth_manager.validate_session(None)
        
        assert valid is False
        assert did is None
        assert handle is None
    
    def test_multiple_sessions(self, auth_manager):
        """Should support multiple concurrent sessions"""
        sessions = []
        for i in range(5):
            session_id = auth_manager.create_session(
                f'did:plc:test_user_{i}',
                f'user{i}.reverie.house'
            )
            sessions.append(session_id)
        
        # All sessions should be valid
        assert len(auth_manager.sessions) >= 5
        
        # Each session should validate correctly
        for i, session_id in enumerate(sessions):
            token = auth_manager.sessions[session_id]['token']
            valid, did, handle = auth_manager.validate_session(token)
            assert valid is True
            assert did == f'did:plc:test_user_{i}'


@pytest.mark.database
class TestJWTValidation:
    """Test JWT token validation for OAuth flows"""
    
    def test_jwt_missing_sub_claim(self):
        """JWT without 'sub' claim should be rejected"""
        from admin import validate_work_token
        
        # Create JWT without 'sub' claim
        token = jwt.encode(
            {'iss': 'https://reverie.house', 'exp': int(time.time()) + 3600},
            'secret',
            algorithm='HS256'
        )
        
        valid, did, handle = validate_work_token(token)
        assert valid is False
    
    def test_jwt_expired_token(self):
        """Expired JWT should be rejected"""
        from admin import validate_work_token
        
        # Create expired token
        token = jwt.encode(
            {
                'sub': 'did:plc:test123',
                'iss': 'https://reverie.house',
                'exp': int(time.time()) - 3600  # Expired 1 hour ago
            },
            'secret',
            algorithm='HS256'
        )
        
        valid, did, handle = validate_work_token(token)
        assert valid is False
    
    def test_jwt_valid_structure(self):
        """JWT with valid structure should decode (signature verification pending)"""
        from admin import validate_work_token
        
        # Create valid-looking token
        token = jwt.encode(
            {
                'sub': 'did:plc:test123',
                'iss': 'https://reverie.house',
                'exp': int(time.time()) + 3600
            },
            'secret',
            algorithm='HS256'
        )
        
        # Currently accepts without signature verification
        # TODO: This should fail after implementing proper signature verification
        valid, did, handle = validate_work_token(token)
        assert did == 'did:plc:test123'
    
    def test_jwt_invalid_format(self):
        """Malformed JWT should be rejected"""
        from admin import validate_work_token
        
        valid, did, handle = validate_work_token('not.a.jwt.token')
        assert valid is False
    
    def test_jwt_no_issuer_with_did(self):
        """JWT without issuer but with valid DID should accept (current behavior)"""
        from admin import validate_work_token
        
        token = jwt.encode(
            {
                'sub': 'did:plc:test123',
                'exp': int(time.time()) + 3600
            },
            'secret',
            algorithm='HS256'
        )
        
        valid, did, handle = validate_work_token(token)
        # Current implementation accepts DIDs without issuer
        assert did == 'did:plc:test123'


@pytest.mark.database
class TestAuthorizationChecks:
    """Test role-based authorization"""
    
    def test_admin_session_authorized(self, valid_session_token):
        """Valid admin session should pass authorization"""
        from admin import validate_work_token
        
        valid, did, handle = validate_work_token(valid_session_token)
        assert valid is True
        assert did is not None
    
    def test_unauthorized_access(self):
        """Missing or invalid token should fail authorization"""
        from admin import validate_work_token
        
        valid, did, handle = validate_work_token(None)
        assert valid is False
    
    def test_work_token_validation(self, valid_session_token):
        """Work endpoints should accept valid admin sessions"""
        from admin import validate_work_token
        
        valid, did, handle = validate_work_token(valid_session_token)
        assert valid is True


@pytest.mark.database
class TestPasswordEncryption:
    """Test password encryption and decryption"""
    
    def test_encrypt_password(self):
        """Should encrypt passwords using Fernet"""
        from core.encryption import encrypt_password
        
        password = 'test_password_123'
        encrypted = encrypt_password(password)
        
        assert encrypted != password
        assert len(encrypted) > 0
        assert isinstance(encrypted, str)
    
    def test_decrypt_password(self):
        """Should decrypt passwords correctly"""
        from core.encryption import encrypt_password, decrypt_password
        
        original = 'test_password_123'
        encrypted = encrypt_password(original)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == original
    
    def test_encrypt_decrypt_roundtrip(self):
        """Multiple encrypt/decrypt cycles should work"""
        from core.encryption import encrypt_password, decrypt_password
        
        passwords = [
            'simple',
            'complex!@#$%^&*()',
            'unicode_πάσσωρδ',
            'very_long_password_' * 10
        ]
        
        for pwd in passwords:
            encrypted = encrypt_password(pwd)
            decrypted = decrypt_password(encrypted)
            assert decrypted == pwd
    
    def test_encrypt_empty_password(self):
        """Should handle empty passwords"""
        from core.encryption import encrypt_password, decrypt_password
        
        encrypted = encrypt_password('')
        decrypted = decrypt_password(encrypted)
        assert decrypted == ''
    
    def test_different_encryptions(self):
        """Same password should produce different encrypted values (uses nonce)"""
        from core.encryption import encrypt_password
        
        password = 'test123'
        encrypted1 = encrypt_password(password)
        encrypted2 = encrypt_password(password)
        
        # Should be different due to Fernet nonce
        assert encrypted1 != encrypted2
        
        # But both should decrypt to same value
        from core.encryption import decrypt_password
        assert decrypt_password(encrypted1) == password
        assert decrypt_password(encrypted2) == password


@pytest.mark.database
class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limiter_exists(self):
        """Rate limiter should be initialized"""
        from core.rate_limiter import PersistentRateLimiter
        
        limiter = PersistentRateLimiter('/tmp/test_ratelimit.db')
        assert limiter is not None
    
    def test_rate_limit_allows_requests(self):
        """Should allow requests under limit"""
        from core.rate_limiter import PersistentRateLimiter
        
        limiter = PersistentRateLimiter('/tmp/test_ratelimit.db')
        endpoint = f'test_endpoint_{int(time.time())}'
        
        # Should allow first request
        allowed = limiter.check_limit('test_user', endpoint, requests_per_minute=10)
        assert allowed is True
    
    def test_rate_limit_blocks_excessive_requests(self):
        """Should block requests over limit"""
        from core.rate_limiter import PersistentRateLimiter
        
        limiter = PersistentRateLimiter('/tmp/test_ratelimit.db')
        endpoint = f'test_endpoint_{int(time.time())}'
        
        # Make requests up to limit
        for i in range(5):
            allowed = limiter.check_limit('test_user', endpoint, requests_per_minute=5)
            if i < 5:
                assert allowed is True
        
        # Next request should be blocked
        allowed = limiter.check_limit('test_user', endpoint, requests_per_minute=5)
        assert allowed is False
    
    def test_rate_limit_different_users(self):
        """Different users should have separate limits"""
        from core.rate_limiter import PersistentRateLimiter
        
        limiter = PersistentRateLimiter('/tmp/test_ratelimit.db')
        endpoint = f'test_endpoint_{int(time.time())}'
        
        # User 1 makes requests
        for i in range(5):
            limiter.check_limit('user1', endpoint, requests_per_minute=5)
        
        # User 2 should still be allowed
        allowed = limiter.check_limit('user2', endpoint, requests_per_minute=5)
        assert allowed is True
