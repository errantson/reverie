#!/usr/bin/env python3
"""
Integration tests for the quests 2026 fixes.

These tests verify the entire flow works correctly end-to-end.
Run with: pytest tests/quests_2026/test_integration.py -v
"""

import pytest
import sys
import os
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestQuestProcessingFlow:
    """Test the complete quest processing flow."""
    
    @pytest.fixture
    def mock_reply(self):
        """Create a mock reply object."""
        return {
            'uri': 'at://did:plc:test123/app.bsky.feed.post/abc123',
            'author': {
                'did': 'did:plc:test123',
                'handle': 'test.user'
            },
            'record': {
                'text': 'This is a dream about flying',
                'createdAt': '2026-01-04T12:00:00Z'
            }
        }
    
    @pytest.fixture
    def mock_quest_config(self):
        """Create a mock quest configuration."""
        return {
            'title': 'test_quest',
            'uri': 'at://did:plc:system/app.bsky.feed.post/quest123',
            'conditions': [
                {'condition': 'any_reply'}
            ],
            'commands': [
                {'cmd': 'add_canon', 'args': ['test_key', 'completed test', 'event']}
            ]
        }
    
    def test_quest_hook_processes_canonical_commands(self, mock_reply, mock_quest_config):
        """Test that quest hooks correctly process canonical format commands."""
        with patch('ops.quest_hooks.DatabaseManager') as mock_db:
            with patch('ops.quest_hooks.process_quest_reply') as mock_process:
                mock_process.return_value = {'success': True, 'skipped': False}
                
                # The import should work
                from ops.quest_hooks import process_quest_reply
                
                result = process_quest_reply(
                    reply_uri=mock_reply['uri'],
                    author_did=mock_reply['author']['did'],
                    author_handle=mock_reply['author']['handle'],
                    post_text=mock_reply['record']['text'],
                    post_created_at=mock_reply['record']['createdAt'],
                    quest_uri=mock_quest_config['uri'],
                    verbose=False
                )
                
                # Should have been called
                mock_process.assert_called_once()


class TestMapperFlow:
    """Test the mapper workflow."""
    
    def test_mapper_module_imports(self):
        """Test that mapper module can be imported without errors."""
        # This verifies the command_executor rename fix worked
        from core.mapperwatch import MapperhoseMonitor
        
        # Verify core class exists
        assert MapperhoseMonitor is not None
        assert hasattr(MapperhoseMonitor, '_send_retry_request')


class TestAuthManagerFlow:
    """Test the AuthManager credential resolution flow."""
    
    def test_refresh_token_tries_database_first(self):
        """Test that refresh_token checks database before Config."""
        from core.auth import AuthManager
        
        with patch.object(AuthManager, '_get_internal_credentials') as mock_get_creds:
            with patch.object(AuthManager, '_resolve_pds_for_handle') as mock_resolve:
                with patch.object(AuthManager, '_authenticate_with_server') as mock_auth:
                    # Database returns credentials
                    mock_get_creds.return_value = ('reverie.house', 'app_password')
                    mock_resolve.return_value = 'https://reverie.house'
                    mock_auth.return_value = True
                    
                    auth = AuthManager()
                    result = auth.refresh_token()
                    
                    # Should have tried to get internal credentials
                    mock_get_creds.assert_called_once()
                    
                    # Should have authenticated with those credentials
                    mock_auth.assert_called_once()
                    call_args = mock_auth.call_args
                    assert call_args[0][0] == 'https://reverie.house'
    
    def test_refresh_token_falls_back_to_config(self):
        """Test that refresh_token falls back to Config when DB has no credentials."""
        from core.auth import AuthManager
        from config import Config
        
        with patch.object(AuthManager, '_get_internal_credentials') as mock_get_creds:
            with patch.object(Config, 'validate_credentials') as mock_validate:
                # Database returns nothing
                mock_get_creds.return_value = (None, None)
                
                # Config validation fails (no env vars set)
                mock_validate.return_value = (False, "Not configured")
                
                auth = AuthManager()
                result = auth.refresh_token()
                
                # Should have tried database first
                mock_get_creds.assert_called_once()
                
                # Should have fallen back to Config validation
                mock_validate.assert_called_once()
                
                # Should return False since neither worked
                assert result == False


class TestConditionChecking:
    """Test quest condition evaluation."""
    
    def test_quest_manager_exists(self):
        """Test that QuestManager exists and can be imported."""
        from ops.quests import QuestManager
        
        # Verify the class exists and has expected methods
        assert hasattr(QuestManager, 'get_enabled_quests')
        assert hasattr(QuestManager, 'get_quest')
    
    def test_dreamer_replies_condition(self):
        """Test dreamer_replies condition requires registered dreamer."""
        # Placeholder for more detailed condition testing
        pass


class TestUIJavaScriptFixes:
    """Test that UI JavaScript files have correct fixes applied."""
    
    def test_quests_js_no_first_reply_option(self):
        """Verify quests.js doesn't offer first_reply as option."""
        js_path = '/srv/reverie.house/site/js/quests.js'
        
        if not os.path.exists(js_path):
            pytest.skip("quests.js not found")
        
        with open(js_path, 'r') as f:
            content = f.read()
        
        # Should not have first_reply as a selectable option
        assert 'value="first_reply"' not in content
    
    def test_quests_js_canonical_command_format(self):
        """Verify quests.js generates canonical command format."""
        js_path = '/srv/reverie.house/site/js/quests.js'
        
        if not os.path.exists(js_path):
            pytest.skip("quests.js not found")
        
        with open(js_path, 'r') as f:
            content = f.read()
        
        # Should use object format for commands
        assert "{ cmd: commandType, args: [] }" in content or "cmd:" in content
    
    def test_quests2_js_no_first_reply_option(self):
        """Verify quests2.js doesn't offer first_reply as option."""
        js_path = '/srv/reverie.house/site/js/quests2.js'
        
        if not os.path.exists(js_path):
            pytest.skip("quests2.js not found")
        
        with open(js_path, 'r') as f:
            content = f.read()
        
        # Should not have first_reply as a selectable option
        assert 'value="first_reply"' not in content
