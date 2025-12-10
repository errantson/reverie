"""
Shared pytest fixtures for Reverie House test suite

CRITICAL SAFETY NOTE:
- By default, tests connect to TEST database (reverie_test)
- Set POSTGRES_DB=reverie_house to run against production (DANGEROUS)
- Use mocked fixtures for unit tests to avoid any database dependency
- Only run integration tests in isolated test environment
"""
import pytest
import os
import sys
from typing import Generator
from unittest.mock import Mock, MagicMock

# SAFETY: Mark that we're in test mode
os.environ['PYTEST_RUNNING'] = '1'

# SAFE: Use test database by default
# Override with POSTGRES_DB=reverie_house for integration tests only
os.environ.setdefault('POSTGRES_HOST', '172.23.0.3')  # PostgreSQL container IP
os.environ.setdefault('POSTGRES_PORT', '5432')
os.environ.setdefault('POSTGRES_DB', 'reverie_test')  # TEST DATABASE
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
    
    WARNING: Does NOT auto-rollback. Use test_db_transaction for isolation.
    """
    db = DatabaseManager()
    yield db
    # Cleanup happens automatically via connection pool


@pytest.fixture
def test_db_transaction(test_db) -> Generator[DatabaseManager, None, None]:
    """
    Provide test database with automatic transaction rollback.
    Use this for tests that need database isolation.
    
    Example:
        def test_something(test_db_transaction):
            test_db_transaction.execute("INSERT INTO ...")
            # Changes automatically rolled back after test
    """
    conn = test_db.get_connection()
    try:
        yield test_db
        conn.rollback()  # Rollback all changes
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


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
        # Delete in proper order (foreign keys)
        try:
            db.execute(
                "DELETE FROM messages WHERE user_did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
                (pattern,)
            )
        except:
            pass
        
        try:
            db.execute(
                "DELETE FROM awards WHERE did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
                (pattern,)
            )
        except:
            pass
        
        try:
            db.execute(
                "DELETE FROM spectrum WHERE did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
                (pattern,)
            )
        except:
            pass
        
        try:
            db.execute(
                "DELETE FROM events WHERE did IN (SELECT did FROM dreamers WHERE handle LIKE %s)",
                (pattern,)
            )
        except:
            pass
        
        try:
            result = db.execute("DELETE FROM dreamers WHERE handle LIKE %s RETURNING handle", (pattern,))
            deleted = result.fetchall()
            total_deleted += len(deleted)
        except:
            pass
    
    # Clean up by DID patterns
    for did_pattern in test_did_patterns:
        try:
            db.execute("DELETE FROM messages WHERE user_did LIKE %s", (did_pattern,))
        except:
            pass
        
        try:
            db.execute("DELETE FROM awards WHERE did LIKE %s", (did_pattern,))
        except:
            pass
        
        try:
            db.execute("DELETE FROM spectrum WHERE did LIKE %s", (did_pattern,))
        except:
            pass
        
        try:
            db.execute("DELETE FROM events WHERE did LIKE %s", (did_pattern,))
        except:
            pass
        
        try:
            result = db.execute("DELETE FROM dreamers WHERE did LIKE %s RETURNING handle", (did_pattern,))
            deleted = result.fetchall()
            total_deleted += len(deleted)
        except:
            pass
    
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
    """Test session token placeholder - tests should mock authentication."""
    return 'test_token_placeholder'


@pytest.fixture
def mock_db():
    """
    Provide a mocked database for UNIT tests.
    Use this fixture to avoid touching production database.
    
    Usage:
        def test_something(mock_db):
            mock_db.fetch_one.return_value = {'id': 1, 'name': 'test'}
            # Your test code here
    """
    mock = MagicMock()
    
    # Set up common mock return values
    mock.fetch_one.return_value = None
    mock.fetch_all.return_value = []
    mock.execute.return_value = Mock(rowcount=0)
    
    # Mock connection context manager
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value = mock_cursor
    mock.get_connection.return_value.__enter__.return_value = mock_conn
    mock.get_connection.return_value.__exit__.return_value = None
    
    return mock


@pytest.fixture
def mock_pds_client():
    """
    Provide a mocked AT Protocol PDS client.
    Use for tests that would otherwise make real network calls.
    """
    mock = MagicMock()
    
    # Common PDS responses
    mock.com.atproto.repo.uploadBlob.return_value = {
        'blob': {
            '$type': 'blob',
            'ref': {'$link': 'bafytest123'},
            'mimeType': 'image/jpeg',
            'size': 12345
        }
    }
    
    mock.com.atproto.repo.createRecord.return_value = {
        'uri': 'at://did:plc:test/app.bsky.feed.post/test123',
        'cid': 'bafytest456'
    }
    
    return mock


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
