"""
Shared pytest fixtures for Reverie House test suite
"""
import pytest
import os
import sys
from typing import Generator

# Set test environment variables before imports
# When running in Docker container, use container hostname
# When running on host, use IP address since network_mode: host is used
os.environ.setdefault('POSTGRES_HOST', '172.23.0.3')  # PostgreSQL container IP
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
import requests


@pytest.fixture
def test_db() -> Generator[DatabaseManager, None, None]:
    """
    Provide isolated test database connection.
    Uses PostgreSQL in Docker at 172.23.0.3:5432
    """
    db = DatabaseManager()
    yield db
    # Cleanup happens automatically via connection pool


@pytest.fixture
def api_base_url() -> str:
    """Base URL for API running in Docker with network_mode: host"""
    return 'http://localhost:4444'


@pytest.fixture
def feedgen_base_url() -> str:
    """Base URL for feed generator running in Docker with network_mode: host"""
    return 'http://localhost:3001'


@pytest.fixture
def auth_manager() -> AuthManager:
    """Provide AuthManager instance"""
    return AuthManager()


@pytest.fixture
def valid_session_token() -> str:
    """
    Create a valid test token.
    Note: AuthManager.create_session() may not exist in current implementation.
    Tests using this should mock authentication or test against running services.
    """
    # Return a placeholder token for tests that need it
    # Real tests should authenticate against the Docker service
    return 'test_token_placeholder'


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
