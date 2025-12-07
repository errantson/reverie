#!/usr/bin/env python3
"""
Test suite for quest monitoring system

These tests verify that the quest monitoring infrastructure is working:
- Database canon view exists
- Quest monitoring services can read data
- Quest conditions can be evaluated
- Firehose services are tracking correctly
"""

import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestQuestDatabase:
    """Test database schema for quest monitoring."""
    
    @pytest.fixture
    def db_connection(self):
        """Connect to the database."""
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'reverie_house'),
            user=os.getenv('POSTGRES_USER', 'reverie'),
            password=os.getenv('POSTGRES_PASSWORD', 'reverie_temp_password_change_me'),
            cursor_factory=RealDictCursor
        )
        yield conn
        conn.close()
    
    def test_canon_view_exists(self, db_connection):
        """Verify the canon compatibility view exists."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM pg_views 
                WHERE schemaname = 'public' 
                AND viewname = 'canon'
            );
        """)
        result = cursor.fetchone()
        assert result['exists'], "Canon view must exist for quest monitoring"
    
    def test_canon_has_name_column(self, db_connection):
        """Verify canon view has required columns."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'canon'
        """)
        columns = [row['column_name'] for row in cursor.fetchall()]
        assert 'did' in columns, "Canon view must have 'did' column"
        assert 'key' in columns, "Canon view must have 'key' column"
    
    def test_canon_query_for_namegiver(self, db_connection):
        """Test the exact query used by greeterwatch.py."""
        cursor = db_connection.cursor()
        # This is the query from greeterwatch.py line 133
        cursor.execute("SELECT DISTINCT did FROM canon WHERE key = 'name'")
        result = cursor.fetchall()
        # Should return list of DIDs who completed namegiver quest
        assert isinstance(result, list), "Query should return a list"
        # Don't assert count - it varies, but query should work
    
    def test_canon_query_for_origin(self, db_connection):
        """Test the exact query used by mapperwatch.py."""
        cursor = db_connection.cursor()
        # This is the query from mapperwatch.py line 114
        cursor.execute("SELECT DISTINCT did FROM canon WHERE key = 'origin'")
        result = cursor.fetchall()
        assert isinstance(result, list), "Query should return a list"
    
    def test_events_table_exists(self, db_connection):
        """Verify the underlying events table exists."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'events'
            );
        """)
        result = cursor.fetchone()
        assert result['exists'], "Events table must exist"
    
    def test_events_has_key_column(self, db_connection):
        """Verify events table has the key column for quest tracking."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'key'
        """)
        result = cursor.fetchone()
        assert result is not None, "Events table must have 'key' column"
    
    def test_quests_table_exists(self, db_connection):
        """Verify quests table exists for quest definitions."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'quests'
            );
        """)
        result = cursor.fetchone()
        assert result['exists'], "Quests table must exist"
    
    def test_dreamers_table_exists(self, db_connection):
        """Verify dreamers table exists for user tracking."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'dreamers'
            );
        """)
        result = cursor.fetchone()
        assert result['exists'], "Dreamers table must exist"


class TestQuestMonitoringLogic:
    """Test quest condition evaluation and processing logic."""
    
    def test_quest_manager_import(self):
        """Verify QuestManager can be imported."""
        try:
            from ops.quests import QuestManager
            assert QuestManager is not None
        except ImportError as e:
            pytest.fail(f"Cannot import QuestManager: {e}")
    
    def test_conditions_module_import(self):
        """Verify conditions module can be imported."""
        try:
            from ops import conditions
            assert conditions is not None
        except ImportError as e:
            pytest.fail(f"Cannot import conditions module: {e}")
    
    def test_quest_hooks_import(self):
        """Verify quest_hooks module can be imported."""
        try:
            from ops import quest_hooks
            assert quest_hooks is not None
        except ImportError as e:
            pytest.fail(f"Cannot import quest_hooks module: {e}")


class TestFirehoseCursors:
    """Test firehose cursor persistence."""
    
    @pytest.fixture
    def db_connection(self):
        """Connect to the database."""
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'reverie_house'),
            user=os.getenv('POSTGRES_USER', 'reverie'),
            password=os.getenv('POSTGRES_PASSWORD', 'reverie_temp_password_change_me'),
            cursor_factory=RealDictCursor
        )
        yield conn
        conn.close()
    
    def test_firehose_cursors_table_exists(self, db_connection):
        """Verify firehose_cursors table exists."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'firehose_cursors'
            );
        """)
        result = cursor.fetchone()
        assert result['exists'], "firehose_cursors table must exist"
    
    def test_questhose_cursor_exists(self, db_connection):
        """Verify questhose firehose has a cursor saved."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT cursor_value 
            FROM firehose_cursors 
            WHERE service = 'questhose'
        """)
        result = cursor.fetchone()
        # Should have a cursor if questhose has run
        # If it hasn't run yet, this test will fail but that's informative
        assert result is not None, "Questhose should have saved a cursor"
        assert result['cursor_value'] > 0, "Cursor should be a positive integer"


@pytest.mark.integration
class TestQuestMonitoringIntegration:
    """Integration tests for quest monitoring workflow."""
    
    @pytest.fixture
    def db_connection(self):
        """Connect to the database."""
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'reverie_house'),
            user=os.getenv('POSTGRES_USER', 'reverie'),
            password=os.getenv('POSTGRES_PASSWORD', 'reverie_temp_password_change_me'),
            cursor_factory=RealDictCursor
        )
        yield conn
        conn.close()
    
    def test_namegiver_quest_exists(self, db_connection):
        """Verify namegiver quest is defined in database."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT uri, enabled 
            FROM quests 
            WHERE title = 'namegiver'
        """)
        result = cursor.fetchone()
        assert result is not None, "Namegiver quest must be defined"
        assert result['uri'] is not None, "Namegiver quest must have a URI"
    
    def test_origin_quest_exists(self, db_connection):
        """Verify origin quest is defined in database."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT uri, enabled 
            FROM quests 
            WHERE title = 'origin'
        """)
        result = cursor.fetchone()
        assert result is not None, "Origin quest must be defined"
        assert result['uri'] is not None, "Origin quest must have a URI"
    
    def test_can_check_greeted_dreamers(self, db_connection):
        """Verify we can check which dreamers have been greeted."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT did) as count
            FROM canon 
            WHERE key = 'name'
        """)
        result = cursor.fetchone()
        assert result['count'] >= 0, "Should be able to count greeted dreamers"
    
    def test_can_check_origin_declarations(self, db_connection):
        """Verify we can check which dreamers have declared origins."""
        cursor = db_connection.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT did) as count
            FROM canon 
            WHERE key = 'origin'
        """)
        result = cursor.fetchone()
        assert result['count'] >= 0, "Should be able to count origin declarations"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
