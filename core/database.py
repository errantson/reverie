#!/usr/bin/env python3
"""
PostgreSQL Database Layer for Reverie
Migrated from SQLite - PostgreSQL only
"""

import os
import logging
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager
import time
import functools

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

try:
    from config import Config
except ImportError:
    class Config:
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

logger = logging.getLogger(__name__)


class DatabaseManager:
    """PostgreSQL database manager with connection pooling."""
    
    def __init__(self):
        """Initialize PostgreSQL connection pool"""
        self.pg_pool = None
        self._init_postgres_pool()
        logger.info("DatabaseManager initialized with PostgreSQL")

    def _normalize_query(self, query: str) -> str:
        """
        Normalize SQL query parameter placeholders for the underlying DB driver.

        psycopg2 expects `%s` placeholders. Many older modules in this
        repository used `?` (SQLite style). Convert `?` -> `%s` when needed.
        """
        if '?' in query and '%s' not in query:
            # Replace positional placeholders
            return query.replace('?', '%s')
        return query
    
    def _init_postgres_pool(self):
        """Initialize PostgreSQL connection pool"""
        try:
            # Get password from environment or read from file
            password = os.getenv('POSTGRES_PASSWORD')
            if not password:
                # Try to read from password file
                password_file = os.getenv('POSTGRES_PASSWORD_FILE', '/srv/secrets/reverie_db_password.txt')
                try:
                    with open(password_file, 'r') as f:
                        password = f.read().strip()
                    logger.info(f"Loaded database password from {password_file}")
                except Exception as e:
                    logger.error(f"❌ CRITICAL: Could not read password file {password_file}: {e}")
                    logger.error("Using fallback password - THIS WILL LIKELY FAIL!")
                    password = 'reverie_temp_password_change_me'
            
            if not password:
                logger.error("❌ CRITICAL: Database password is empty!")
                raise ValueError("Database password cannot be empty")
            
            self.pg_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=20,
                host=os.getenv('POSTGRES_HOST', 'localhost'),
                port=int(os.getenv('POSTGRES_PORT', '5432')),
                database=os.getenv('POSTGRES_DB', 'reverie_house'),
                user=os.getenv('POSTGRES_USER', 'reverie'),
                password=password,
                cursor_factory=RealDictCursor
            )
            logger.info("✅ PostgreSQL connection pool initialized successfully")
        except psycopg2.OperationalError as e:
            if "password authentication failed" in str(e):
                logger.error("❌ DATABASE PASSWORD AUTHENTICATION FAILED!")
                logger.error("The password in secrets does not match PostgreSQL.")
                logger.error("Run: /srv/scripts/sync_db_password.sh to fix this.")
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
            raise
    
    def _get_connection(self):
        """Get connection from PostgreSQL pool"""
        return self.pg_pool.getconn()
    
    def _return_connection(self, conn):
        """Return connection to PostgreSQL pool"""
        if self.pg_pool:
            self.pg_pool.putconn(conn)

    def _is_retryable_db_error(self, err: Exception) -> bool:
        """Return True for SQLSTATEs that should be retried (deadlock/serialization)."""
        try:
            code = getattr(err, 'pgcode', None)
            return code in ('40P01', '40001')
        except Exception:
            return False

    def _retry_on_deadlock(self, func):
        """Decorator to retry DB operations on deadlock/serialization failures."""
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            self = args[0]
            max_retries = 3
            backoff = 0.1
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except psycopg2.Error as e:
                    if self._is_retryable_db_error(e) and attempt < max_retries - 1:
                        sleep_time = backoff * (2 ** attempt)
                        logger.warning(f"Transient DB error (attempt {attempt+1}/{max_retries}), retrying in {sleep_time:.2f}s: {e}")
                        time.sleep(sleep_time)
                        continue
                    raise
        return wrapper
    
    @contextmanager
    def get_connection(self):
        """
        Context manager for database connections with automatic transaction handling
        
        Example:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM dreamers WHERE did = %s", (did,))
                result = cursor.fetchone()
                # Auto-commits on success, auto-rolls back on exception
        """
        conn = self._get_connection()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"PostgreSQL transaction error: {e}")
            raise
        finally:
            self._return_connection(conn)
    
    @contextmanager
    def transaction(self):
        """
        Explicit transaction context manager for multi-step operations
        
        Example:
            with db.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE dreamers SET name = %s WHERE did = %s", (name, did))
                cursor.execute("INSERT INTO events (dreamer_did, type) VALUES (%s, %s)", (did, 'name_change'))
                # Both queries committed together, or both rolled back on error
        """
        conn = self._get_connection()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Transaction failed and was rolled back: {e}")
            raise
        finally:
            self._return_connection(conn)
    
    def execute(self, query: str, params: Tuple = (), autocommit: bool = True):
        """
        Execute a query and return a cursor (uses %s placeholders)
        
        DEPRECATED: Use transaction() context manager for writes or fetch_one/fetch_all for reads.
        
        WARNING: The cursor becomes invalid after this method returns because
        the connection is returned to the pool. Use fetch_one() or fetch_all()
        instead for SELECT queries.
        
        Args:
            query: SQL query with %s placeholders
            params: Tuple of parameters
            autocommit: If True, auto-commits (default). Set False for read-only queries.
        
        Returns:
            cursor object (note: invalidated when connection returns to pool)
        """
        def _op(self, query: str, params: Tuple = (), autocommit: bool = True):
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)

                if autocommit:
                    conn.commit()

                return cursor
            except Exception as e:
                if autocommit:
                    conn.rollback()
                logger.error(f"Query execution error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params, autocommit)
    
    def fetch_one(self, query: str, params: Tuple = ()):
        """Execute a SELECT query and return one row (or None)"""
        def _op(self, query: str, params: Tuple = ()): 
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)
                result = cursor.fetchone()
                return result
            except Exception as e:
                logger.error(f"Query execution error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params)
    
    def fetch_all(self, query: str, params: Tuple = ()):
        """Execute a SELECT query and return all rows"""
        def _op(self, query: str, params: Tuple = ()): 
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)
                results = cursor.fetchall()
                return results
            except Exception as e:
                logger.error(f"Query execution error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params)
    
    def execute_many(self, query: str, params_list: List[Tuple]) -> None:
        """Execute query multiple times with different parameters (transactional)"""
        def _op(self, query: str, params_list: List[Tuple]) -> None:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.executemany(query, params_list)
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Batch execution error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params_list)
    
    def insert(self, query: str, params: Tuple = ()) -> Optional[int]:
        """
        Execute an INSERT query and return the inserted row ID
        
        Example:
            row_id = db.insert(
                "INSERT INTO dreamers (did, name) VALUES (%s, %s) RETURNING id",
                (did, name)
            )
        """
        def _op(self, query: str, params: Tuple = ()) -> Optional[int]:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)
                conn.commit()

                # Try to get RETURNING id if present
                if cursor.description:
                    row = cursor.fetchone()
                    if row and 'id' in row:
                        return row['id']
                return None
            except Exception as e:
                conn.rollback()
                logger.error(f"Insert error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params)
    
    def update(self, query: str, params: Tuple = ()) -> int:
        """
        Execute an UPDATE query and return number of affected rows
        
        Example:
            rows_updated = db.update(
                "UPDATE dreamers SET name = %s WHERE did = %s",
                (new_name, did)
            )
        """
        def _op(self, query: str, params: Tuple = ()) -> int:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)
                rowcount = cursor.rowcount
                conn.commit()
                return rowcount
            except Exception as e:
                conn.rollback()
                logger.error(f"Update error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params)
    
    def delete(self, query: str, params: Tuple = ()) -> int:
        """
        Execute a DELETE query and return number of deleted rows
        
        Example:
            rows_deleted = db.delete(
                "DELETE FROM events WHERE timestamp < %s",
                (cutoff_time,)
            )
        """
        def _op(self, query: str, params: Tuple = ()) -> int:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                query = self._normalize_query(query)
                cursor.execute(query, params)
                rowcount = cursor.rowcount
                conn.commit()
                return rowcount
            except Exception as e:
                conn.rollback()
                logger.error(f"Delete error: {e}")
                raise
            finally:
                self._return_connection(conn)

        return self._retry_on_deadlock(_op)(self, query, params)
    
    def close(self) -> None:
        """Close PostgreSQL connection pool"""
        if self.pg_pool:
            self.pg_pool.closeall()
            logger.info("PostgreSQL connection pool closed")
    
    def get_schema_version(self) -> str:
        """Get database schema version"""
        try:
            cursor = self.execute("SELECT value FROM _metadata WHERE key = %s", ('schema_version',))
            row = cursor.fetchone()
            return row['value'] if row else '1.0.0'
        except:
            return '1.0.0'
    
    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = %s
            )
        """
        cursor = self.execute(query, (table_name,))
        row = cursor.fetchone()
        return row['exists'] if row else False
    
    def get_table_stats(self, public_only: bool = True) -> Dict[str, int]:
        """
        Get row counts for tables
        
        Args:
            public_only: If True, only return counts for public game data tables (default).
                        If False, return all tables (admin use only).
        """
        stats = {}
        
        # Define public game data tables (safe to expose)
        public_tables = [
            'dreamers', 'spectrum', 'kindred', 'awards',
            'events', 'souvenirs', 'books', 'chapters',
            'world', 'spectrum_snapshots', 'quests',
            'dialogues', 'actions', 'work', 'messages',
            'courier', 'deliveries'
        ]
        
        if public_only:
            # Only count public game data tables
            tables = public_tables
        else:
            # Get all tables (admin only)
            query = """
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public'
            """
            cursor = self.execute(query)
            tables = [row['tablename'] for row in cursor.fetchall()]
        
        for table in tables:
            try:
                cursor = self.execute(f"SELECT COUNT(*) as count FROM {table}")
                row = cursor.fetchone()
                stats[table] = row['count'] if row else 0
            except:
                stats[table] = 0
        
        return stats


def create_database() -> DatabaseManager:
    """Factory function for creating DatabaseManager instance"""
    return DatabaseManager()



if __name__ == '__main__':
    import sys
    
    print("🗄️  Database Manager (PostgreSQL)")
    
    
    try:
        db = DatabaseManager()
        
        print(f"✅ Connected to PostgreSQL: {os.getenv('POSTGRES_DB', 'reverie_house')}")
        
        print(f"📌 Schema version: {db.get_schema_version()}")
        
        stats = db.get_table_stats()
        print("\n📊 Table Statistics:")
        for table, count in sorted(stats.items()):
            if count > 0:  # Only show non-empty tables
                print(f"  {table:<25} {count:>10} rows")
        
        total_rows = sum(stats.values())
        print(f"\n  {'TOTAL':<25} {total_rows:>10} rows")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)