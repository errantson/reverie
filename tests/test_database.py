"""
Database Layer Tests
Tests for DatabaseManager connection pooling, transactions, and CRUD operations
"""
import pytest
import time
from core.database import DatabaseManager


@pytest.mark.database
class TestDatabaseConnection:
    """Test database connection and pooling"""
    
    def test_connection_successful(self, test_db):
        """Database connection should succeed"""
        assert test_db is not None
        assert test_db.pool is not None
    
    def test_connection_pooling(self, test_db):
        """Connection pool should be initialized correctly"""
        # Pool should have min 1, max 20 connections
        assert test_db.pool.minconn == 1
        assert test_db.pool.maxconn == 20
    
    def test_execute_query(self, test_db):
        """Basic query execution should work"""
        result = test_db.execute("SELECT 1 as test")
        rows = result.fetchall()
        assert len(rows) == 1
        assert rows[0]['test'] == 1
    
    def test_fetch_one(self, test_db):
        """fetch_one should return single row"""
        row = test_db.fetch_one("SELECT 1 as num, 'test' as text")
        assert row is not None
        assert row['num'] == 1
        assert row['text'] == 'test'
    
    def test_fetch_all(self, test_db):
        """fetch_all should return all rows"""
        rows = test_db.fetch_all("SELECT generate_series(1, 5) as num")
        assert len(rows) == 5
        assert rows[0]['num'] == 1
        assert rows[4]['num'] == 5


@pytest.mark.database
class TestDatabaseTransactions:
    """Test transaction handling and rollback"""
    
    def test_transaction_context_manager(self, test_db):
        """transaction() context manager should work"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            # Create temporary test table
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT
                )
            """)
            
            # Use transaction context manager
            with test_db.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(f"INSERT INTO {test_table} (value) VALUES (%s)", ('test1',))
                cursor.execute(f"INSERT INTO {test_table} (value) VALUES (%s)", ('test2',))
            
            # Verify data was committed
            rows = test_db.fetch_all(f"SELECT * FROM {test_table}")
            assert len(rows) == 2
            
        finally:
            # Cleanup
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")
    
    def test_transaction_rollback_on_error(self, test_db):
        """transaction() should rollback on exception"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            # Create temporary test table
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            
            # Insert initial data
            test_db.execute(f"INSERT INTO {test_table} (value) VALUES (%s)", ('initial',))
            
            # Try transaction that will fail
            try:
                with test_db.transaction() as conn:
                    cursor = conn.cursor()
                    cursor.execute(f"INSERT INTO {test_table} (value) VALUES (%s)", ('test1',))
                    # This will fail - NULL not allowed
                    cursor.execute(f"INSERT INTO {test_table} (value) VALUES (NULL)")
            except Exception:
                pass  # Expected to fail
            
            # Verify rollback - should only have initial row
            rows = test_db.fetch_all(f"SELECT * FROM {test_table}")
            assert len(rows) == 1
            assert rows[0]['value'] == 'initial'
            
        finally:
            # Cleanup
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")
    
    def test_insert_returns_id(self, test_db):
        """insert() should return row ID"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            # Create temporary test table
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT
                )
            """)
            
            # Insert and get ID
            row_id = test_db.insert(
                f"INSERT INTO {test_table} (value) VALUES (%s) RETURNING id",
                ('test_value',)
            )
            
            assert row_id is not None
            assert isinstance(row_id, int)
            assert row_id > 0
            
            # Verify data exists
            row = test_db.fetch_one(f"SELECT * FROM {test_table} WHERE id = %s", (row_id,))
            assert row['value'] == 'test_value'
            
        finally:
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")
    
    def test_update_returns_count(self, test_db):
        """update() should return affected row count"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            # Create temporary test table with data
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT,
                    status TEXT DEFAULT 'pending'
                )
            """)
            test_db.execute(f"INSERT INTO {test_table} (value) VALUES ('a'), ('b'), ('c')")
            
            # Update multiple rows
            count = test_db.update(
                f"UPDATE {test_table} SET status = %s WHERE value IN ('a', 'b')",
                ('done',)
            )
            
            assert count == 2
            
            # Verify updates
            rows = test_db.fetch_all(f"SELECT * FROM {test_table} WHERE status = 'done'")
            assert len(rows) == 2
            
        finally:
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")
    
    def test_delete_returns_count(self, test_db):
        """delete() should return deleted row count"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            # Create temporary test table with data
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT
                )
            """)
            test_db.execute(f"INSERT INTO {test_table} (value) VALUES ('a'), ('b'), ('c'), ('d')")
            
            # Delete multiple rows
            count = test_db.delete(
                f"DELETE FROM {test_table} WHERE value IN ('b', 'c')"
            )
            
            assert count == 2
            
            # Verify remaining rows
            rows = test_db.fetch_all(f"SELECT * FROM {test_table}")
            assert len(rows) == 2
            
        finally:
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")


@pytest.mark.database
class TestDatabaseConcurrency:
    """Test concurrent connections and thread safety"""
    
    def test_concurrent_connections(self, test_db):
        """Pool should handle multiple concurrent queries"""
        import concurrent.futures
        
        def run_query(n):
            result = test_db.fetch_one(f"SELECT {n} as num")
            return result['num']
        
        # Run 10 concurrent queries
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(run_query, i) for i in range(10)]
            results = [f.result() for f in futures]
        
        assert len(results) == 10
        assert sorted(results) == list(range(10))
    
    def test_connection_reuse(self, test_db):
        """Connections should be reused from pool"""
        # Execute multiple queries in sequence
        for i in range(25):  # More than pool max (20)
            result = test_db.fetch_one(f"SELECT {i} as num")
            assert result['num'] == i
        
        # Pool should still be healthy
        assert test_db.pool is not None


@pytest.mark.database
class TestDatabaseErrorHandling:
    """Test error handling and edge cases"""
    
    def test_invalid_query_raises_error(self, test_db):
        """Invalid SQL should raise error"""
        with pytest.raises(Exception):
            test_db.execute("SELECT * FROM nonexistent_table_12345")
    
    def test_parameterized_query(self, test_db):
        """Parameterized queries should prevent SQL injection"""
        # This should work safely
        result = test_db.fetch_one(
            "SELECT %s as value",
            ("test';DROP TABLE users;--",)
        )
        assert result['value'] == "test';DROP TABLE users;--"
    
    def test_none_params_handling(self, test_db):
        """NULL parameters should be handled correctly"""
        test_table = f"test_table_{int(time.time())}"
        
        try:
            test_db.execute(f"""
                CREATE TEMP TABLE {test_table} (
                    id SERIAL PRIMARY KEY,
                    value TEXT
                )
            """)
            
            # Insert with NULL value
            row_id = test_db.insert(
                f"INSERT INTO {test_table} (value) VALUES (%s) RETURNING id",
                (None,)
            )
            
            # Verify NULL was stored
            row = test_db.fetch_one(f"SELECT * FROM {test_table} WHERE id = %s", (row_id,))
            assert row['value'] is None
            
        finally:
            test_db.execute(f"DROP TABLE IF EXISTS {test_table}")
