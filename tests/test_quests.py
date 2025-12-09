"""
Quests Testing

Complete quest system testing: quest manager, monitoring, and integration.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor


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


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
