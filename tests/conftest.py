"""
Shared pytest fixtures for Reverie House test suite
"""
import pytest
import os
import sys
from typing import Generator

# Set test environment variables before imports
# When running in Docker container, use container hostname
# When running on host (not recommended), use localhost
os.environ.setdefault('POSTGRES_HOST', 'reverie_db')  # Docker network hostname
os.environ.setdefault('POSTGRES_PORT', '5432')
os.environ.setdefault('POSTGRES_DB', 'reverie_house')
os.environ.setdefault('POSTGRES_USER', 'reverie')

# Read password from secrets file
try:
    with open('/srv/secrets/reverie_db_password.txt', 'r') as f:
        os.environ.setdefault('POSTGRES_PASSWORD', f.read().strip())
except FileNotFoundError:
    os.environ.setdefault('POSTGRES_PASSWORD', 'reverie_temp_password_change_me')

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager
from core.auth import AuthManager
from flask import Flask


@pytest.fixture
def test_db() -> Generator[DatabaseManager, None, None]:
    """
    Provide isolated test database connection.
    Uses the same database but wraps operations in transactions that rollback.
    """
    db = DatabaseManager()
    yield db
    # Cleanup happens automatically via connection pool


@pytest.fixture
def app() -> Flask:
    """Provide Flask application instance for testing"""
    sys.path.insert(0, '/srv/reverie.house')
    from admin import app as admin_app
    admin_app.config['TESTING'] = True
    return admin_app


@pytest.fixture
def client(app):
    """Provide Flask test client"""
    return app.test_client()


@pytest.fixture
def auth_manager() -> AuthManager:
    """Provide AuthManager instance"""
    return AuthManager()


@pytest.fixture
def valid_session_token(auth_manager) -> str:
    """
    Create a valid admin session token for testing.
    Returns a token that will validate for the test duration.
    """
    # Create session for test admin
    session_id = auth_manager.create_session(
        'did:plc:test_admin',
        'test.admin.reverie.house'
    )
    token = auth_manager.sessions[session_id]['token']
    return token


@pytest.fixture
def test_did() -> str:
    """Standard test DID for consistency"""
    return 'did:plc:test_user_12345678901234'


@pytest.fixture
def test_handle() -> str:
    """Standard test handle for consistency"""
    return 'testuser.reverie.house'


@pytest.fixture(scope="session")
def docker_available() -> bool:
    """Check if Docker is available for integration tests"""
    import subprocess
    try:
        result = subprocess.run(
            ['docker', 'ps'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


@pytest.fixture(scope="session")
def pds_available() -> bool:
    """Check if PDS admin commands are available"""
    import subprocess
    try:
        result = subprocess.run(
            ['sudo', 'pdsadmin', 'account', 'list'],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False
