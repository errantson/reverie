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


@pytest.fixture(scope="session", autouse=True)
def cleanup_all_test_data():
    """
    Clean up ALL test data before AND after the entire test session.
    Ensures clean state for tests and no pollution afterward.
    """
    # Cleanup BEFORE tests (in case previous run didn't clean up)
    try:
        _cleanup_test_users()
    except Exception as e:
        print(f"\n⚠️  Pre-test cleanup warning: {e}")
    
    yield  # Run all tests
    
    # Cleanup AFTER tests
    try:
        _cleanup_test_users()
    except Exception as e:
        print(f"\n⚠️  Post-test cleanup warning: {e}")


def _cleanup_test_users():
    """Helper function to clean up test data."""
    db = DatabaseManager()
    
    print("\n🧹 Cleaning up test data...")
    
    # Delete test users by pattern matching
    test_patterns = [
        'rate%.bsky.social',           # Rate limiting tests
        'test.bsky.social',            # Generic test user
        '%test%.bsky.social',          # Any test in handle
        'aaaaaaa%.bsky.social',        # Long handle tests
        "'; DROP TABLE%",              # SQL injection tests
    ]
    
    # Also delete by test DIDs
    test_did_patterns = [
        'did:plc:test%',               # Test DIDs
        'did:plc:rate%',               # Rate test DIDs
        'not-a-valid-did',             # Invalid DID test
    ]
    
    total_deleted = 0
    
    for pattern in test_patterns:
        db.execute(
            "DELETE FROM spectrum WHERE did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
            (pattern,)
        )
        db.execute(
            "DELETE FROM events WHERE did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
            (pattern,)
        )
        result = db.execute("DELETE FROM dreamers WHERE handle LIKE %s RETURNING handle", (pattern,))
        deleted = result.fetchall()
        total_deleted += len(deleted)
    
    for pattern in test_did_patterns:
        db.execute("DELETE FROM spectrum WHERE did LIKE %s", (pattern,))
        db.execute("DELETE FROM events WHERE did LIKE %s", (pattern,))
        result = db.execute("DELETE FROM dreamers WHERE did LIKE %s RETURNING handle", (pattern,))
        deleted = result.fetchall()
        total_deleted += len(deleted)
    
    if total_deleted > 0:
        print(f"✅ Cleaned up {total_deleted} test users")
    else:
        print("✅ No test data to clean up")


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """
    Track test results for potential cleanup decisions.
    """
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


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


@pytest.fixture
def unique_test_id() -> str:
    """
    Generate unique test ID for each test run.
    Used to prevent test collisions when running in parallel.
    """
    import time
    return str(int(time.time()))


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
