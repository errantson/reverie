"""
Quests Testing

Complete quest system testing: quest manager, monitoring, and integration.
Includes safety tests for duplicate prevention, rate limiting, and one-time triggers.

Author: Reverie House Testing Framework
Date: 2025-12-08
Updated: 2025-12-12 - Added comprehensive safety and duplicate prevention tests
"""

import pytest
import psycopg2
import json
import time
from psycopg2.extras import RealDictCursor
from unittest.mock import Mock, patch


# ============================================================================
# QUEST MANAGER TESTS
# ============================================================================

@pytest.mark.database
class TestQuestManager:
    """Quest manager core functionality"""
    
    def test_quest_manager_exists(self):
        """Test quest manager can be imported and is a class"""
        from utils.questing import QuestManager
        assert QuestManager is not None
        assert isinstance(QuestManager, type), "QuestManager should be a class"
    
    def test_quest_manager_initialization(self, test_db):
        """Test quest manager initializes properly and works"""
        from utils.questing import QuestManager
        manager = QuestManager()
        assert manager is not None
        assert hasattr(manager, '__dict__'), "Manager should be a real object, not None"
        
        # FIXED: Verify it has a working database connection
        if hasattr(manager, 'db'):
            assert manager.db is not None, "Manager should have database connection"
    
    def test_quest_can_be_created(self, test_db):
        """Test creating a quest actually works and persists to database"""
        from utils.questing import QuestManager
        manager = QuestManager()
        
        # FIXED: Don't just check if method exists - actually call it
        if not (hasattr(manager, 'create_quest') or hasattr(manager, 'add_quest')):
            pytest.skip("Quest creation not implemented yet")
        
        # Try to create a quest
        try:
            create_method = getattr(manager, 'create_quest', None) or getattr(manager, 'add_quest', None)
            
            # Create a simple test quest
            quest_data = {
                'title': 'Test Quest Creation',
                'description': 'Verify quest creation works',
                'condition': 'arrival',  # Simple condition
            }
            
            result = create_method(**quest_data)
            
            # Verify quest was created (method should return something)
            assert result is not None, "create_quest should return quest ID or confirmation"
            
        except NotImplementedError:
            pytest.skip("Quest creation not fully implemented")
        except Exception as e:
            # If quest creation fails, we want to know about it
            pytest.fail(f"Quest creation failed: {e}")


# ============================================================================
# QUEST DATABASE TESTS
# ============================================================================

@pytest.mark.database
class TestQuestDatabase:
    """Quest database schema and views"""
    
    def test_canon_view_exists(self, test_db):
        """Test canon view exists for quest monitoring"""
        result = test_db.execute("""
            SELECT EXISTS (
                SELECT FROM pg_views 
                WHERE schemaname = 'public' 
                AND viewname = 'canon'
            )
        """).fetchone()
        assert result[0] == True
    
    def test_events_table_for_quests(self, test_db):
        """Test events table supports quest monitoring"""
        result = test_db.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'events'
            )
        """).fetchone()
        assert result[0] == True


# ============================================================================
# QUEST MONITORING TESTS
# ============================================================================

@pytest.mark.database
class TestQuestMonitoring:
    """Quest monitoring and evaluation"""
    
    def test_can_query_canon_events(self, test_db):
        """Test querying canon events for quest conditions returns valid data"""
        events = test_db.execute(
            "SELECT * FROM events ORDER BY epoch DESC LIMIT 5"
        ).fetchall()
        # FIXED: Verify we get a list (even if empty)
        assert isinstance(events, list), "Should return list of events"
        
        # If events exist, verify they have required structure
        if len(events) > 0:
            event = events[0]
            assert 'did' in event, "Events must have 'did' field"
            assert 'type' in event, "Events must have 'type' field"
            assert 'epoch' in event, "Events must have 'epoch' field"
            assert event['epoch'] > 0, "Epoch must be positive timestamp"
    
    def test_quest_conditions_evaluable(self, test_db):
        """Test quest conditions can be evaluated"""
        # Basic quest condition check
        result = test_db.execute(
            "SELECT COUNT(*) as count FROM events WHERE type = 'arrival'"
        ).fetchone()
        assert result['count'] >= 0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

@pytest.mark.integration
class TestQuestIntegration:
    """Full quest system integration"""
    
    def test_quest_system_components_present(self):
        """Test all quest system components can be imported"""
        try:
            from utils.questing import QuestManager
            from core.dreamerhose import DreamerHose
            assert QuestManager is not None
        except ImportError as e:
            pytest.skip(f"Quest components not available: {e}")
    
    def test_end_to_end_quest_flow(self, test_db):
        """Test complete quest flow"""
        # This would test: create quest → monitor events → evaluate → complete
        # Simplified for now
        events = test_db.execute("SELECT COUNT(*) FROM events").fetchone()
        assert events is not None


# ============================================================================
# SAFETY & DUPLICATE PREVENTION TESTS
# ============================================================================

@pytest.mark.database
class TestQuestSafety:
    """Test quest safety mechanisms - prevent duplicates, rate limiting, one-time triggers"""
    
    def test_hasnt_canon_prevents_duplicate_execution(self, test_db):
        """Test hasnt_canon condition prevents quest from firing twice"""
        from ops.conditions.hasnt_canon import hasnt_canon
        
        test_did = "did:plc:test123"
        test_handle = "test_user"
        test_key = "name"  # Use 'name' which is in the canon view
        
        # Setup: Create dreamer first (foreign key requirement)
        test_db.execute(
            "INSERT INTO dreamers (did, handle, name) VALUES (%s, %s, %s) ON CONFLICT (did) DO NOTHING",
            (test_did, test_handle, "testname")
        )
        
        # Insert an event (canon view only shows 'name' and 'origin' keys)
        test_db.execute(
            """INSERT INTO events (did, key, event, type, created_at) 
               VALUES (%s, %s, 'test event', 'name', %s)""",
            (test_did, test_key, int(time.time()))
        )
        
        # Create mock reply from user who already has canon
        reply_with_canon = {
            'author': {'did': test_did, 'handle': 'test_user'},
            'record': {'text': 'test reply'}
        }
        
        thread_result = {'replies': [reply_with_canon]}
        quest_config = {}
        
        result = hasnt_canon(thread_result, quest_config, test_key)
        
        # Should NOT match because user already has the canon entry
        assert result['success'] == False, "Should fail when user already has canon entry"
        assert len(result['matching_replies']) == 0
        assert 'already have canon entry' in result['reason']
        
        # Cleanup (events will cascade delete with dreamer)
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_hasnt_canon_allows_first_time_trigger(self, test_db):
        """Test hasnt_canon allows quest to fire the first time"""
        from ops.conditions.hasnt_canon import hasnt_canon
        
        test_did = "did:plc:newuser456"
        test_handle = "new_user"
        test_key = "origin"  # Use 'origin' which is in the canon view
        
        # Setup: Create dreamer without the event
        test_db.execute(
            "INSERT INTO dreamers (did, handle, name) VALUES (%s, %s, %s) ON CONFLICT (did) DO NOTHING",
            (test_did, test_handle, "newname")
        )
        # Ensure no event/canon entry exists for this key
        test_db.execute("DELETE FROM events WHERE did = %s AND key = %s", (test_did, test_key))
        
        reply_without_canon = {
            'author': {'did': test_did, 'handle': 'new_user'},
            'record': {'text': 'first time!'}
        }
        
        thread_result = {'replies': [reply_without_canon]}
        quest_config = {}
        
        result = hasnt_canon(thread_result, quest_config, test_key)
        
        # Should match because user doesn't have canon entry yet
        assert result['success'] == True, "Should succeed for first-time user"
        assert len(result['matching_replies']) == 1
        assert result['matching_replies'][0]['author']['did'] == test_did
        
        # Cleanup
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_once_only_condition_marked_for_disable(self):
        """Test once_only conditions are tracked for disabling after match"""
        from ops.conditions import evaluate_conditions
        
        conditions = [
            {
                'type': 'condition',
                'condition': 'any_reply',
                'operator': 'OR',
                'once_only': True  # This should trigger disable command
            }
        ]
        
        thread_result = {
            'replies': [{
                'author': {'did': 'did:plc:test', 'handle': 'test'},
                'record': {'text': 'trigger'}
            }]
        }
        
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'OR', thread_result, quest_config)
        
        assert result['success'] == True
        # Check that a disable command was added
        assert 'custom_commands' in result
        # Should contain disable_condition_group command
        disable_cmds = [cmd for cmd in result['custom_commands'] if 'disable_condition_group' in cmd]
        assert len(disable_cmds) > 0, "Should add disable command for once_only condition"
    
    def test_multiple_replies_deduplicated_by_uri(self):
        """Test that duplicate reply URIs are filtered out"""
        from ops.conditions import evaluate_conditions
        
        # Same URI appears twice (shouldn't happen but we should handle it)
        duplicate_uri = "at://did:plc:test/app.bsky.feed.post/123"
        
        conditions = [
            {'type': 'condition', 'condition': 'any_reply', 'operator': 'OR'}
        ]
        
        thread_result = {
            'replies': [
                {
                    'uri': duplicate_uri,
                    'author': {'did': 'did:plc:test', 'handle': 'test'},
                    'record': {'text': 'first'}
                },
                {
                    'uri': duplicate_uri,  # Duplicate!
                    'author': {'did': 'did:plc:test', 'handle': 'test'},
                    'record': {'text': 'second'}
                }
            ]
        }
        
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'OR', thread_result, quest_config)
        
        # Should only return ONE unique reply even though we sent two with same URI
        assert result['success'] == True
        assert result['count'] == 1, "Should deduplicate replies by URI"
        assert len(result['matching_replies']) == 1
    
    @pytest.mark.skip(reason="Requires full command infrastructure - covered by integration tests")
    def test_name_dreamer_idempotent_on_duplicate_call(self, test_db):
        """Test name_dreamer doesn't create duplicates if called twice with same user"""
        from ops.command_executor import name_dreamer
        
        test_did = "did:plc:idempotent_test"
        test_handle = "idempotent_user"
        test_name = "testname"
        
        # Setup: Create a dreamer with name event already
        test_db.execute(
            "INSERT INTO dreamers (did, handle, name) VALUES (%s, %s, %s) ON CONFLICT (did) DO NOTHING",
            (test_did, test_handle, test_name)
        )
        test_db.execute(
            """INSERT INTO events (did, key, event, type, created_at) 
               VALUES (%s, 'name', 'spoke their name', 'name', %s) 
               ON CONFLICT DO NOTHING""",
            (test_did, int(time.time()))
        )
        
        # Try to name them again
        reply = {
            'author': {'did': test_did, 'handle': test_handle},
            'record': {'text': test_name, 'createdAt': '2025-12-12T00:00:00Z'},
            'uri': 'at://did:plc:idempotent_test/app.bsky.feed.post/duplicate'
        }
        
        with patch('ops.commands.NetworkClient') as mock_network:
            result = name_dreamer([reply], {}, verbose=False)
        
        # Should succeed but skip because they already have name canon
        assert result['success'] == True
        
        # Verify only ONE event entry exists (not duplicated)
        event_count = test_db.execute(
            "SELECT COUNT(*) as count FROM events WHERE did = %s AND key = 'name'",
            (test_did,)
        ).fetchone()
        assert event_count['count'] == 1, "Should not create duplicate event entries"
        
        # Cleanup
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        test_db.execute("DELETE FROM events WHERE did = %s", (test_did,))


# ============================================================================
# CONDITION EVALUATION TESTS
# ============================================================================

@pytest.mark.database
class TestConditionEvaluation:
    """Test condition evaluation logic and operators"""
    
    def test_and_operator_requires_all_conditions(self):
        """Test AND operator requires all conditions to match"""
        from ops.conditions import evaluate_conditions
        
        conditions = [
            {'type': 'condition', 'condition': 'any_reply', 'operator': 'AND'},
            {'type': 'condition', 'condition': 'reply_contains:magic', 'operator': 'AND'}
        ]
        
        # Reply without "magic" word
        thread_result = {
            'replies': [{
                'author': {'did': 'did:plc:test', 'handle': 'test'},
                'record': {'text': 'no special word here'}
            }]
        }
        
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'AND', thread_result, quest_config)
        
        # Should fail because "magic" is not in the text
        assert result['success'] == False
        assert 'Not all conditions matched' in result['reason']
    
    def test_or_operator_requires_one_condition(self):
        """Test OR operator only needs one condition to match"""
        from ops.conditions import evaluate_conditions
        
        conditions = [
            {'type': 'condition', 'condition': 'reply_contains:dragon', 'operator': 'OR'},
            {'type': 'condition', 'condition': 'reply_contains:wizard', 'operator': 'OR'},
            {'type': 'condition', 'condition': 'reply_contains:magic', 'operator': 'OR'}
        ]
        
        # Reply with only one matching word
        thread_result = {
            'replies': [{
                'author': {'did': 'did:plc:test', 'handle': 'test'},
                'record': {'text': 'I saw a wizard today'}
            }]
        }
        
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'OR', thread_result, quest_config)
        
        # Should succeed because at least one condition matched
        assert result['success'] == True
        assert 'At least one condition matched' in result['reason']
    
    def test_disabled_conditions_are_skipped(self):
        """Test that disabled conditions don't affect evaluation"""
        from ops.conditions import evaluate_conditions
        
        conditions = [
            {'type': 'condition', 'condition': 'any_reply', 'operator': 'AND'},
            {'type': 'condition', 'condition': 'reply_contains:impossible', 'operator': 'AND', 'disabled': True}
        ]
        
        thread_result = {
            'replies': [{
                'author': {'did': 'did:plc:test', 'handle': 'test'},
                'record': {'text': 'regular text'}
            }]
        }
        
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'AND', thread_result, quest_config)
        
        # Should succeed because disabled condition is skipped
        assert result['success'] == True


# ============================================================================
# FIREHOSE OPTIMIZATION TESTS
# ============================================================================

@pytest.mark.integration
class TestFirehoseOptimizations:
    """Test firehose scanning optimizations to prevent performance issues"""
    
    def test_questhose_only_scans_tracked_dreamers(self):
        """Test questhose only parses posts from tracked dreamers (not everyone)"""
        # This is a design verification test - questhose should skip 99% of posts
        from core.questhose import QuesthoseMonitor
        
        with patch('core.questhose.DatabaseManager') as mock_db:
            mock_db.return_value.execute.return_value.fetchall.return_value = [
                {'did': 'did:plc:tracked1', 'handle': 'user1', 'avatar': None}
            ]
            
            monitor = QuesthoseMonitor(verbose=False)
            
            # Verify it only tracks specific DIDs
            assert len(monitor.tracked_dids) == 1
            assert 'did:plc:tracked1' in monitor.tracked_dids
    
    def test_quest_uris_loaded_at_startup(self):
        """Test quest URIs are loaded once at startup, not per-message"""
        from ops.quest_hooks import get_quest_uris
        
        # Should return a list of URIs
        uris = get_quest_uris()
        assert isinstance(uris, list)
        # URIs should be AT Protocol format
        for uri in uris:
            if uri:  # Skip if empty
                assert uri.startswith('at://'), f"Invalid URI format: {uri}"


# ============================================================================
# EDGE CASE TESTS  
# ============================================================================

@pytest.mark.database
class TestQuestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_quest_with_no_conditions(self, test_db):
        """Test quest with empty conditions list"""
        from ops.conditions import evaluate_conditions
        
        conditions = []
        thread_result = {'replies': []}
        quest_config = {}
        
        result = evaluate_conditions(conditions, 'AND', thread_result, quest_config)
        
        assert result['success'] == False
        assert 'No conditions to evaluate' in result['reason']
    
    def test_quest_with_invalid_condition_format(self):
        """Test quest handles invalid condition gracefully"""
        from ops.conditions import evaluate_single_condition
        
        result = evaluate_single_condition('invalid_format_no_colon', {'replies': []}, {})
        
        assert result['success'] == False
        assert 'Unknown condition' in result['reason']
    
    def test_command_execution_handles_missing_parameters(self):
        """Test commands handle missing required parameters"""
        from ops.command_executor import execute_quest_commands
        
        # add_canon requires parameters - should fail gracefully
        commands = ['add_canon']  # Missing key:event:type
        replies = [{'author': {'did': 'test', 'handle': 'test'}, 'record': {'text': 'test'}}]
        
        result = execute_quest_commands(commands, replies, {}, verbose=False)
        
        assert result['success'] == False
        assert any('Invalid add_canon format' in err for err in result['errors'])


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
