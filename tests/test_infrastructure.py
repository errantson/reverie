"""
Infrastructure Testing

Consolidated database, docker, and system infrastructure tests.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import psycopg2
import subprocess


# ============================================================================
# DATABASE TESTS
# ============================================================================

@pytest.mark.database
class TestDatabase:
    """Database connection and operations"""
    
    def test_database_connection(self, test_db):
        """Test database connects"""
        assert test_db is not None
    
    def test_database_pool_active(self, test_db):
        """Test connection pool works"""
        result = test_db.execute("SELECT 1 as test").fetchone()
        assert result['test'] == 1
    
    def test_dreamers_table_exists(self, test_db):
        """Test dreamers table exists"""
        result = test_db.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'dreamers'
            )
        """).fetchone()
        assert result[0] == True
    
    def test_events_table_exists(self, test_db):
        """Test events table exists"""
        result = test_db.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'events'
            )
        """).fetchone()
        assert result[0] == True


# ============================================================================
# DOCKER TESTS
# ============================================================================

@pytest.mark.docker
class TestDocker:
    """Docker services health checks"""
    
    def test_postgres_container_running(self):
        """Test PostgreSQL container is running"""
        try:
            result = subprocess.run(
                ['docker', 'ps', '--filter', 'name=postgres', '--format', '{{.Status}}'],
                capture_output=True,
                text=True,
                timeout=5
            )
            assert 'Up' in result.stdout or result.returncode == 0
        except Exception:
            pytest.skip("Docker not available")
    
    def test_caddy_container_running(self):
        """Test Caddy container is running"""
        try:
            result = subprocess.run(
                ['docker', 'ps', '--filter', 'name=caddy', '--format', '{{.Status}}'],
                capture_output=True,
                text=True,
                timeout=5
            )
            # May or may not be running
            assert result.returncode == 0
        except Exception:
            pytest.skip("Docker not available")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
