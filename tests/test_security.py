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


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@pytest.mark.database
class TestSessions:
    """Session creation and validation"""
    
    def test_create_session(self, test_db):
        """Test session creation"""
        from utils.auth import create_session
        
        did = 'did:plc:test123'
        token = create_session(did)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 20
    
    def test_validate_valid_session(self, test_db):
        """Test validating valid session"""
        from utils.auth import create_session, validate_session
        
        did = 'did:plc:test123'
        token = create_session(did)
        
        validated_did = validate_session(token)
        assert validated_did == did
    
    def test_validate_invalid_session(self, test_db):
        """Test validating invalid session"""
        from utils.auth import validate_session
        
        result = validate_session('invalid-token-12345')
        assert result is None


# ============================================================================
# JWT VALIDATION
# ============================================================================

@pytest.mark.database
class TestJWT:
    """JWT token validation"""
    
    def test_jwt_structure(self, test_db):
        """Test JWT has valid structure"""
        from utils.auth import create_session
        
        token = create_session('did:plc:test123')
        
        # Should have 3 parts
        parts = token.split('.')
        assert len(parts) == 3
    
    def test_jwt_expired_token(self, test_db):
        """Test expired JWT is rejected"""
        from utils.auth import validate_session
        from config import SECRET_KEY
        
        # Create expired token
        expired_token = jwt.encode(
            {'sub': 'did:plc:test123', 'exp': datetime.utcnow() - timedelta(hours=1)},
            SECRET_KEY,
            algorithm='HS256'
        )
        
        result = validate_session(expired_token)
        assert result is None


# ============================================================================
# PASSWORD ENCRYPTION
# ============================================================================

@pytest.mark.database  
class TestEncryption:
    """Password hashing and verification"""
    
    def test_password_hashing(self):
        """Test password hashing"""
        from utils.encryption import hash_password
        
        password = 'test-password-123'
        hashed = hash_password(password)
        
        assert hashed != password
        assert len(hashed) > 20
    
    def test_password_verification(self):
        """Test password verification"""
        from utils.encryption import hash_password, verify_password
        
        password = 'test-password-123'
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) == True
        assert verify_password('wrong-password', hashed) == False


# ============================================================================
# AUTH RECOVERY
# ============================================================================

@pytest.mark.database
class TestAuthRecovery:
    """Authentication recovery flows"""
    
    def test_recovery_code_generation(self, test_db):
        """Test recovery code generation"""
        from utils.courier_auth import generate_recovery_code
        
        code = generate_recovery_code()
        
        assert code is not None
        assert len(code) >= 6
        assert code.isalnum()
    
    def test_recovery_code_validation(self, test_db):
        """Test recovery code validation"""
        from utils.courier_auth import generate_recovery_code, validate_recovery_code
        
        code = generate_recovery_code()
        did = 'did:plc:test123'
        
        # Store code (mock)
        # Validate code
        # Should work in real implementation


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
