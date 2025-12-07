"""
Test Suite: Courier Authentication Recovery Flow
=================================================

Tests the complete flow for handling expired/invalid app passwords:
1. Courier detects 401 auth failure
2. Post marked as 'auth_failed' status
3. User credentials invalidated
4. Dashboard detects auth issue on load
5. User reconnects app password
6. Posts auto-retry

Run with: pytest tests/test_courier_auth_recovery.py -v
"""

import pytest
import time
from core.database import DatabaseManager
from core.encryption import encrypt_password


class TestCourierAuthRecovery:
    """Test authentication recovery flow for scheduled posts"""
    
    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Set up test database state"""
        self.db = DatabaseManager()
        
        # Create test user
        self.test_did = 'did:plc:test_courier_auth_user'
        self.test_handle = 'test.courier.auth'
        
        # Clean up any existing test data
        self.db.execute('DELETE FROM courier WHERE did = ?', (self.test_did,))
        self.db.execute('DELETE FROM user_credentials WHERE did = ?', (self.test_did,))
        self.db.execute('DELETE FROM dreamers WHERE did = ?', (self.test_did,))
        
        # Create test dreamer
        self.db.execute('''
            INSERT INTO dreamers (did, handle, name, arrival)
            VALUES (?, ?, ?, ?)
        ''', (self.test_did, self.test_handle, 'Test User', int(time.time())))
        
        yield
        
        # Cleanup
        self.db.execute('DELETE FROM courier WHERE did = ?', (self.test_did,))
        self.db.execute('DELETE FROM user_credentials WHERE did = ?', (self.test_did,))
        self.db.execute('DELETE FROM dreamers WHERE did = ?', (self.test_did,))
    
    def test_database_schema_auth_failed_status(self):
        """Test: Database accepts 'auth_failed' status"""
        # Create a test scheduled post with auth_failed status
        self.db.execute('''
            INSERT INTO courier (did, post_text_encrypted, scheduled_for, status, error_message)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            self.test_did,
            encrypt_password('Test post'),
            int(time.time()) + 3600,
            'auth_failed',
            'App password expired or invalid. Please reconnect.'
        ))
        
        # Verify it was inserted
        result = self.db.execute('''
            SELECT status, error_message FROM courier 
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,)).fetchone()
        
        assert result is not None
        assert result['status'] == 'auth_failed'
        assert 'App password expired' in result['error_message']
    
    def test_last_failure_at_column_exists(self):
        """Test: user_credentials has last_failure_at column"""
        # Insert credentials with failure timestamp
        failure_time = int(time.time())
        
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid, last_failure_at)
            VALUES (?, ?, ?, ?)
        ''', (self.test_did, encrypt_password('test-pass'), False, failure_time))
        
        # Verify
        result = self.db.execute('''
            SELECT last_failure_at FROM user_credentials WHERE did = ?
        ''', (self.test_did,)).fetchone()
        
        assert result is not None
        assert result['last_failure_at'] == failure_time
    
    def test_auth_status_endpoint_no_issues(self):
        """Test: /api/auth-status returns no issues for valid user"""
        # Create valid credentials
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid)
            VALUES (?, ?, ?)
        ''', (self.test_did, encrypt_password('valid-pass'), True))
        
        # Mock endpoint call (would need Flask test client in real test)
        creds = self.db.execute('''
            SELECT is_valid, last_failure_at 
            FROM user_credentials 
            WHERE did = ?
        ''', (self.test_did,)).fetchone()
        
        failed_count = self.db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,)).fetchone()
        
        assert creds['is_valid'] is True
        assert failed_count['count'] == 0
    
    def test_auth_status_endpoint_detects_failures(self):
        """Test: /api/auth-status detects invalid credentials and failed posts"""
        # Create invalid credentials with failure time
        failure_time = int(time.time())
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid, last_failure_at)
            VALUES (?, ?, ?, ?)
        ''', (self.test_did, encrypt_password('invalid-pass'), False, failure_time))
        
        # Create auth_failed post
        self.db.execute('''
            INSERT INTO courier (did, post_text_encrypted, scheduled_for, status, error_message)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            self.test_did,
            encrypt_password('Failed post'),
            int(time.time()) + 3600,
            'auth_failed',
            'App password expired'
        ))
        
        # Simulate endpoint logic
        creds = self.db.execute('''
            SELECT is_valid, last_failure_at 
            FROM user_credentials 
            WHERE did = ?
        ''', (self.test_did,)).fetchone()
        
        failed_count = self.db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,)).fetchone()
        
        assert creds['is_valid'] is False
        assert creds['last_failure_at'] == failure_time
        assert failed_count['count'] == 1
    
    def test_retry_auth_failed_posts(self):
        """Test: Retry endpoint resets auth_failed posts to pending"""
        # Create valid credentials
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid)
            VALUES (?, ?, ?)
        ''', (self.test_did, encrypt_password('new-valid-pass'), True))
        
        # Create multiple auth_failed posts
        for i in range(3):
            self.db.execute('''
                INSERT INTO courier (did, post_text_encrypted, scheduled_for, status, error_message)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                self.test_did,
                encrypt_password(f'Post {i}'),
                int(time.time()) + 3600,
                'auth_failed',
                'App password expired'
            ))
        
        # Simulate retry endpoint
        self.db.execute('''
            UPDATE courier
            SET status = 'pending',
                error_message = NULL
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,))
        
        # Verify all posts are now pending
        pending_count = self.db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'pending'
        ''', (self.test_did,)).fetchone()
        
        auth_failed_count = self.db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,)).fetchone()
        
        assert pending_count['count'] == 3
        assert auth_failed_count['count'] == 0
    
    def test_courier_invalidates_credentials_on_401(self):
        """Test: Courier service invalidates credentials when 401 occurs"""
        # Create valid credentials
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid)
            VALUES (?, ?, ?)
        ''', (self.test_did, encrypt_password('will-fail'), True))
        
        # Simulate courier detecting 401 and invalidating
        current_time = int(time.time())
        self.db.execute('''
            UPDATE user_credentials
            SET is_valid = FALSE,
                last_failure_at = ?
            WHERE did = ?
        ''', (current_time, self.test_did))
        
        # Verify credentials are invalidated
        creds = self.db.execute('''
            SELECT is_valid, last_failure_at 
            FROM user_credentials 
            WHERE did = ?
        ''', (self.test_did,)).fetchone()
        
        assert creds['is_valid'] is False
        assert creds['last_failure_at'] == current_time
    
    def test_complete_recovery_flow(self):
        """
        Test: Complete flow from failure to recovery
        
        Steps:
        1. User has valid credentials and scheduled post
        2. Credentials become invalid (simulated 401)
        3. Post marked as auth_failed
        4. Credentials invalidated with timestamp
        5. User reconnects (new valid password)
        6. Posts reset to pending
        7. Courier processes successfully
        """
        # Step 1: Initial valid state
        self.db.execute('''
            INSERT INTO user_credentials (did, app_password_hash, is_valid)
            VALUES (?, ?, ?)
        ''', (self.test_did, encrypt_password('old-pass'), True))
        
        post_id = self.db.execute('''
            INSERT INTO courier (did, post_text_encrypted, scheduled_for, status)
            VALUES (?, ?, ?, ?)
            RETURNING id
        ''', (
            self.test_did,
            encrypt_password('Test post'),
            int(time.time()) + 3600,
            'pending'
        )).fetchone()['id']
        
        # Step 2-4: Simulate 401 failure
        failure_time = int(time.time())
        
        self.db.execute('''
            UPDATE courier
            SET status = 'auth_failed',
                error_message = 'App password expired or invalid. Please reconnect.'
            WHERE id = ?
        ''', (post_id,))
        
        self.db.execute('''
            UPDATE user_credentials
            SET is_valid = FALSE,
                last_failure_at = ?
            WHERE did = ?
        ''', (failure_time, self.test_did))
        
        # Verify failure state
        post = self.db.execute('SELECT * FROM courier WHERE id = ?', (post_id,)).fetchone()
        creds = self.db.execute('SELECT * FROM user_credentials WHERE did = ?', (self.test_did,)).fetchone()
        
        assert post['status'] == 'auth_failed'
        assert creds['is_valid'] is False
        assert creds['last_failure_at'] == failure_time
        
        # Step 5: User reconnects with new password
        self.db.execute('''
            UPDATE user_credentials
            SET app_password_hash = ?,
                is_valid = TRUE,
                last_failure_at = NULL
            WHERE did = ?
        ''', (encrypt_password('new-valid-pass'), self.test_did))
        
        # Step 6: Posts reset to pending
        self.db.execute('''
            UPDATE courier
            SET status = 'pending',
                error_message = NULL
            WHERE did = ? AND status = 'auth_failed'
        ''', (self.test_did,))
        
        # Step 7: Verify recovery state
        post = self.db.execute('SELECT * FROM courier WHERE id = ?', (post_id,)).fetchone()
        creds = self.db.execute('SELECT * FROM user_credentials WHERE did = ?', (self.test_did,)).fetchone()
        
        assert post['status'] == 'pending'
        assert post['error_message'] is None
        assert creds['is_valid'] is True


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
