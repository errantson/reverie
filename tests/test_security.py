"""
Security Testing

Consolidated auth, encryption, session management, and recovery tests.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import jwt
import time
from datetime import datetime, timedelta
from unittest.mock import patch, Mock
import requests


# ============================================================================
# JWT VALIDATION SECURITY TESTS
# ============================================================================

@pytest.mark.unit
class TestJWTValidation:
    """Test JWT token validation security"""
    
    @patch('core.admin_auth.auth')
    def test_validate_user_token_admin_session(self, mock_auth):
        """Test validate_user_token accepts valid admin session"""
        from core.admin_auth import validate_user_token
        
        mock_auth.validate_session.return_value = (True, 'did:plc:test123', 'test.handle')
            
        valid, did, handle = validate_user_token('valid-admin-token')
        assert valid == True
        assert did == 'did:plc:test123'
        assert handle == 'test.handle'
    
    @patch('core.admin_auth.auth')
    def test_validate_user_token_invalid_admin_session(self, mock_auth):
        """Test validate_user_token rejects invalid admin session"""
        from core.admin_auth import validate_user_token
        
        mock_auth.validate_session.return_value = (False, None, None)
            
        valid, did, handle = validate_user_token('invalid-admin-token')
        assert valid == False
        assert did is None
        assert handle is None
    
    @patch('core.admin_auth.verify_pds_jwt')
    @patch('core.admin_auth.auth')
    def test_validate_user_token_calls_pds_verification(self, mock_auth, mock_verify):
        """Test validate_user_token calls PDS verification when admin session fails"""
        from core.admin_auth import validate_user_token
        
        mock_auth.validate_session.return_value = (False, None, None)
        mock_verify.return_value = (True, 'did:plc:test123', None)
            
        valid, did, handle = validate_user_token('pds-jwt-token')
        assert valid == True
        assert did == 'did:plc:test123'
        mock_verify.assert_called_once_with('pds-jwt-token')
    
    def test_verify_pds_jwt_invalid_structure(self):
        """Test verify_pds_jwt rejects malformed JWT"""
        from core.admin_auth import verify_pds_jwt
        
        # Invalid JWT
        valid, did, handle = verify_pds_jwt('not-a-jwt')
        assert valid == False
        assert did is None
    
    def test_verify_pds_jwt_expired_token(self):
        """Test verify_pds_jwt rejects expired JWT"""
        from core.admin_auth import verify_pds_jwt
        
        # Create expired JWT
        expired_token = jwt.encode(
            {'sub': 'did:plc:test123', 'iss': 'https://pds.example.com', 'exp': time.time() - 3600},
            'fake-key',
            algorithm='RS256'
        )
        
        valid, did, handle = verify_pds_jwt(expired_token)
        assert valid == False
    
    @patch('core.admin_auth.requests.get')
    def test_verify_pds_jwt_forged_signature(self, mock_get):
        """Test verify_pds_jwt rejects JWT with forged signature"""
        from core.admin_auth import verify_pds_jwt
        
        # Mock JWKS response with wrong key
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'keys': [{
                'kid': 'test-key',
                'kty': 'RSA',
                'n': 'wrong-public-key-modulus',
                'e': 'AQAB'
            }]
        }
        mock_get.return_value = mock_response
        
        # Create JWT signed with different key
        forged_token = jwt.encode(
            {'sub': 'did:plc:test123', 'iss': 'https://pds.example.com', 'exp': time.time() + 3600, 'kid': 'test-key'},
            'different-private-key',
            algorithm='RS256'
        )
        
        valid, did, handle = verify_pds_jwt(forged_token)
        assert valid == False
    
    @patch('core.admin_auth.requests.get')
    def test_verify_pds_jwt_valid_token(self, mock_get):
        """Test verify_pds_jwt accepts properly signed JWT"""
        from core.admin_auth import verify_pds_jwt
        import json
        
        # Create a proper RSA key pair for testing
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        
        # Generate test key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Get public key in JWK format
        public_key = private_key.public_key()
        public_numbers = public_key.public_numbers()
        
        # Create JWKS response
        jwk = {
            'kid': 'test-key',
            'kty': 'RSA',
            'n': jwt.utils.base64url_encode(
                public_numbers.n.to_bytes((public_numbers.n.bit_length() + 7) // 8, 'big')
            ).decode(),
            'e': jwt.utils.base64url_encode(
                public_numbers.e.to_bytes((public_numbers.e.bit_length() + 7) // 8, 'big')
            ).decode()
        }
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'keys': [jwk]}
        mock_get.return_value = mock_response
        
        # Create properly signed JWT
        token = jwt.encode(
            {'sub': 'did:plc:test123', 'iss': 'https://pds.example.com', 'exp': time.time() + 3600, 'kid': 'test-key'},
            private_key,
            algorithm='RS256'
        )
        
        valid, did, handle = verify_pds_jwt(token)
        assert valid == True
        assert did == 'did:plc:test123'


# ============================================================================
# ACCOUNT DELETION SECURITY TESTS
# ============================================================================

@pytest.mark.unit
class TestAccountDeletion:
    """Test account deletion endpoint security"""
    
    @pytest.fixture
    def app(self):
        """Create Flask app for testing"""
        from flask import Flask
        app = Flask(__name__)
        app.config['TESTING'] = True
        
        # Register the blueprint
        from api.routes import user_routes
        app.register_blueprint(user_routes.bp)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    @patch('api.routes.user_routes.validate_user_token')
    @patch('api.routes.user_routes.DatabaseManager')
    @patch('api.routes.user_routes.EventsManager')
    def test_delete_account_unauthorized(self, mock_events, mock_db_class, mock_validate, client):
        """Test delete account rejects unauthorized requests"""
        mock_validate.return_value = (False, None, None)
        
        response = client.delete('/api/user/delete', 
                               json={'did': 'did:plc:test123', 'confirm': 'Goodbye, Reverie House'})
        
        assert response.status_code == 401
        assert b'Unauthorized' in response.data
    
    @patch('api.routes.user_routes.validate_user_token')
    def test_delete_account_wrong_user(self, mock_validate, client):
        """Test delete account rejects when authenticated user != target user"""
        mock_validate.return_value = (True, 'did:plc:attacker', 'attacker.handle')
        
        response = client.delete('/api/user/delete', 
                               json={'did': 'did:plc:victim', 'confirm': 'Goodbye, Reverie House'})
        
        assert response.status_code == 403
        assert b'Forbidden' in response.data
    
    @patch('api.routes.user_routes.validate_user_token')
    def test_delete_account_wrong_confirmation(self, mock_validate, client):
        """Test delete account rejects wrong confirmation text"""
        mock_validate.return_value = (True, 'did:plc:test123', 'test.handle')
        
        response = client.delete('/api/user/delete', 
                               json={'did': 'did:plc:test123', 'confirm': 'Wrong text'})
        
        assert response.status_code == 400
        assert b'Confirmation text does not match' in response.data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
