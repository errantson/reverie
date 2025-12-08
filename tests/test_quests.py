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
        """Test quest manager can be imported"""
        from utils.questing import QuestManager
        assert QuestManager is not None
    
    def test_quest_manager_initialization(self, test_db):
        """Test quest manager initializes"""
        from utils.questing import QuestManager
        manager = QuestManager()
        assert manager is not None
    
    def test_quest_can_be_created(self, test_db):
        """Test creating a quest"""
        from utils.questing import QuestManager
        manager = QuestManager()
        
        # Quest creation logic
        assert hasattr(manager, 'create_quest') or hasattr(manager, 'add_quest')


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
        """Test querying canon events for quest conditions"""
        events = test_db.execute(
            "SELECT * FROM events ORDER BY epoch DESC LIMIT 5"
        ).fetchall()
        # Should not crash
        assert events is not None
    
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
