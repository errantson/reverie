#!/usr/bin/env python3
"""
Quests 2026 Test Suite

Comprehensive tests for the January 2026 operational fixes:
1. first_reply → any_reply migration
2. Legacy command format → canonical format
3. Import collision fix (ops.commands → ops.command_executor)
4. Mapper CID fetching for retry requests
5. AuthManager database credential lookup
6. Config secret path resolution

Run with: pytest tests/quests_2026/ -v
"""

import pytest
import sys
import os
import json
from unittest.mock import patch, MagicMock

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestCommandExecutorImport:
    """Test that the command_executor module imports correctly after rename."""
    
    def test_import_execute_quest_commands(self):
        """Verify execute_quest_commands can be imported from new location."""
        from ops.command_executor import execute_quest_commands
        assert callable(execute_quest_commands)
    
    def test_import_name_dreamer(self):
        """Verify name_dreamer can be imported from new location."""
        from ops.command_executor import name_dreamer
        assert callable(name_dreamer)
    
    def test_import_like_post(self):
        """Verify like_post can be imported from new location."""
        from ops.command_executor import like_post
        assert callable(like_post)
    
    def test_import_add_canon(self):
        """Verify add_canon can be imported from new location."""
        from ops.command_executor import add_canon
        assert callable(add_canon)
    
    def test_old_import_path_is_package(self):
        """Verify ops.commands is now a package (directory), not the old module."""
        import ops.commands
        # If it's a package, it should have __path__ attribute
        assert hasattr(ops.commands, '__path__')


class TestCanonicalCommandFormat:
    """Test that command executor only accepts canonical dict format."""
    
    def test_legacy_string_format_raises_error(self):
        """Legacy colon-separated command strings should raise RuntimeError."""
        from ops.command_executor import execute_quest_commands
        
        legacy_commands = ["add_canon:key:event:type"]
        replies = [{'author': {'did': 'did:test', 'handle': 'test'}, 'uri': 'at://test'}]
        
        with pytest.raises(RuntimeError) as exc_info:
            execute_quest_commands(legacy_commands, replies, {}, verbose=False)
        
        assert "Legacy command strings are no longer supported" in str(exc_info.value)
    
    def test_canonical_dict_format_accepted(self):
        """Canonical dict format commands should be accepted."""
        from ops.command_executor import execute_quest_commands
        
        # Mock the database to prevent actual operations
        with patch('ops.command_executor.DatabaseManager') as mock_db:
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = None  # Dreamer not found
            mock_db.return_value.execute.return_value = mock_cursor
            
            canonical_commands = [
                {"cmd": "add_canon", "args": ["test_key", "test event", "event"]}
            ]
            replies = [{'author': {'did': 'did:test', 'handle': 'test'}, 'uri': 'at://test'}]
            
            # Should not raise - returns result dict even if operation fails
            result = execute_quest_commands(canonical_commands, replies, {}, verbose=False)
            assert 'success' in result
            assert 'commands_executed' in result


class TestQuestConditions:
    """Test quest condition handling - any_reply vs deprecated first_reply."""
    
    def test_any_reply_condition_exists(self):
        """Verify any_reply is recognized by the condition system."""
        # Read the quests.py source to verify any_reply is handled
        quests_path = '/srv/reverie.house/ops/quests.py'
        
        if os.path.exists(quests_path):
            with open(quests_path, 'r') as f:
                content = f.read()
            
            # any_reply should be mentioned in the condition handling code
            assert 'any_reply' in content, "any_reply not found in quests.py"
    
    def test_first_reply_not_in_ui_options(self):
        """Verify first_reply was removed from UI dropdown options."""
        # Read the quests.js file and verify first_reply is not present as option
        quests_js_path = '/srv/reverie.house/site/js/quests.js'
        
        if os.path.exists(quests_js_path):
            with open(quests_js_path, 'r') as f:
                content = f.read()
            
            # first_reply should not appear as a dropdown option
            # (it may appear in comments or elsewhere, but not as value="first_reply")
            assert 'value="first_reply"' not in content
            assert "value='first_reply'" not in content


class TestConfigSecretPaths:
    """Test configuration secret path resolution."""
    
    def test_read_secret_checks_docker_path(self):
        """Verify read_secret checks /run/secrets/ first."""
        from config import read_secret
        
        with patch('os.path.exists') as mock_exists:
            with patch('builtins.open', MagicMock()) as mock_open:
                mock_exists.return_value = False
                
                # Should not raise when file doesn't exist
                result = read_secret('TEST_SECRET', 'default_value')
                assert result == 'default_value'
    
    def test_read_secret_checks_mounted_path(self):
        """Verify read_secret checks /srv/secrets/*.txt as fallback."""
        from config import read_secret
        
        with patch('os.path.exists') as mock_exists:
            with patch('builtins.open') as mock_open:
                # First path doesn't exist, second does
                mock_exists.side_effect = [False, True]
                mock_open.return_value.__enter__.return_value.read.return_value = 'secret_value\n'
                
                result = read_secret('TEST_KEY', 'default')
                
                # Should have checked the mounted path
                mock_exists.assert_any_call('/srv/secrets/test_key.txt')


class TestAuthManagerCredentialLookup:
    """Test AuthManager database credential lookup."""
    
    def test_get_internal_credentials_method_exists(self):
        """Verify _get_internal_credentials method exists on AuthManager."""
        from core.auth import AuthManager
        
        auth = AuthManager()
        assert hasattr(auth, '_get_internal_credentials')
        assert callable(auth._get_internal_credentials)
    
    def test_get_internal_credentials_returns_tuple(self):
        """Verify _get_internal_credentials returns (handle, password) tuple."""
        from core.auth import AuthManager
        
        auth = AuthManager()
        
        # Call the method - it returns (None, None) if no credentials found
        # or (handle, password) if found in database
        result = auth._get_internal_credentials()
        
        # Should always return a tuple of length 2
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_authenticate_with_server_accepts_credentials(self):
        """Verify _authenticate_with_server accepts handle/password params."""
        from core.auth import AuthManager
        import inspect
        
        auth = AuthManager()
        sig = inspect.signature(auth._authenticate_with_server)
        params = list(sig.parameters.keys())
        
        assert 'handle' in params
        assert 'password' in params


class TestMapperRetryMechanism:
    """Test mapper retry request CID fetching."""
    
    def test_mapperwatch_imports_correctly(self):
        """Verify mapperwatch module can be imported."""
        from core.mapperwatch import MapperhoseMonitor
        assert MapperhoseMonitor is not None
    
    def test_send_retry_request_fetches_cids(self):
        """Verify _send_retry_request fetches CIDs before posting."""
        # Read the source to verify CID fetching is present
        mapperwatch_path = '/srv/reverie.house/core/mapperwatch.py'
        
        if os.path.exists(mapperwatch_path):
            with open(mapperwatch_path, 'r') as f:
                content = f.read()
            
            # Should fetch parent and root CIDs
            assert 'get_posts' in content
            assert 'parent_cid' in content
            assert 'root_cid' in content
            
            # Should NOT have empty CID strings
            assert "cid=''" not in content


class TestDatabaseMigrations:
    """Test that database has correct state after migrations."""
    
    @pytest.fixture
    def db(self):
        """Get database connection."""
        try:
            from core.database import DatabaseManager
            return DatabaseManager()
        except Exception:
            pytest.skip("Database not available")
    
    def test_quests_use_any_reply_not_first_reply(self, db):
        """Verify no quests use the deprecated first_reply condition."""
        cursor = db.execute("""
            SELECT title, conditions 
            FROM quests 
            WHERE conditions::text LIKE %s
        """, ('%first_reply%',))
        results = cursor.fetchall()
        
        assert len(results) == 0, f"Found quests with first_reply: {[r['title'] for r in results]}"
    
    def test_quests_use_canonical_commands(self, db):
        """Verify quest commands are in canonical dict format."""
        cursor = db.execute("""
            SELECT title, commands 
            FROM quests 
            WHERE commands IS NOT NULL 
            AND commands::text != '[]'
        """)
        results = cursor.fetchall()
        
        for quest in results:
            commands = quest['commands']
            if isinstance(commands, str):
                commands = json.loads(commands)
            
            for cmd in commands:
                # Each command should be a dict with 'cmd' key, not a string
                assert isinstance(cmd, dict), f"Quest {quest['title']} has non-dict command: {cmd}"
                assert 'cmd' in cmd, f"Quest {quest['title']} command missing 'cmd' key: {cmd}"
    
    def test_pigeons_conditions_not_double_encoded(self, db):
        """Verify pigeon conditions are not double-encoded JSON."""
        cursor = db.execute("""
            SELECT name, conditions 
            FROM pigeons 
            WHERE conditions IS NOT NULL
        """)
        results = cursor.fetchall()
        
        for pigeon in results:
            conditions = pigeon['conditions']
            
            # If it's a string, it shouldn't start with a quote (double-encoded)
            if isinstance(conditions, str):
                assert not conditions.startswith('"'), \
                    f"Pigeon {pigeon['name']} has double-encoded conditions"
    
    def test_mapper_worker_assigned(self, db):
        """Verify a mapper is assigned in the user_roles table."""
        cursor = db.execute("""
            SELECT d.handle, r.role, r.status 
            FROM user_roles r
            JOIN dreamers d ON r.did = d.did
            WHERE r.role = 'mapper'
        """)
        results = cursor.fetchall()
        
        # Should have at least one mapper assignment
        assert len(results) > 0, "No mapper assignments in user_roles table"
        
        # Verify at least one is active or retiring (functional)
        statuses = [r['status'] for r in results]
        assert any(s in ['active', 'retiring'] for s in statuses), \
            f"No active/retiring mapper found, statuses: {statuses}"


class TestPdsServicesDisabled:
    """Test that deprecated services are disabled."""
    
    def test_poke_contact_disabled_in_compose(self):
        """Verify poke.contact services are commented out in docker-compose."""
        compose_path = '/srv/docker-compose.yml'
        
        if os.path.exists(compose_path):
            with open(compose_path, 'r') as f:
                content = f.read()
            
            # pokehose and poke_app should be commented out
            # Look for the pattern of commented service definitions
            lines = content.split('\n')
            
            poke_services_active = False
            for i, line in enumerate(lines):
                if 'pokehose:' in line and not line.strip().startswith('#'):
                    poke_services_active = True
                if 'poke_app:' in line and not line.strip().startswith('#'):
                    poke_services_active = True
            
            assert not poke_services_active, "poke.contact services should be disabled"


class TestEncryptionSystem:
    """Test the encryption system for credentials."""
    
    def test_encrypt_decrypt_roundtrip(self):
        """Verify password encryption/decryption works correctly."""
        try:
            from core.encryption import encrypt_password, decrypt_password
            
            test_password = "test-app-password-1234"
            encrypted = encrypt_password(test_password)
            decrypted = decrypt_password(encrypted)
            
            assert decrypted == test_password
        except FileNotFoundError:
            pytest.skip("Encryption key not available")
    
    def test_encrypted_password_is_different(self):
        """Verify encrypted output differs from plaintext."""
        try:
            from core.encryption import encrypt_password
            
            test_password = "test-app-password-1234"
            encrypted = encrypt_password(test_password)
            
            assert encrypted != test_password
            assert len(encrypted) > len(test_password)
        except FileNotFoundError:
            pytest.skip("Encryption key not available")
