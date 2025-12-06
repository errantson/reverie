#!/usr/bin/env python3
"""
Complete SQLite to PostgreSQL Migration
Migrates ALL data from reverie.db to reverie_db in PostgreSQL
"""

import sqlite3
import psycopg2
import psycopg2.extras
import json
from datetime import datetime

# Source and destination
SQLITE_DB = '/srv/reverie.house/data/reverie.db'
PG_HOST = 'localhost'
PG_PORT = 6432
PG_DB = 'reverie_db'
PG_USER = 'lorefarm'

# Read PostgreSQL password
with open('/srv/lore.farm/secrets/db_password.txt', 'r') as f:
    PG_PASSWORD = f.read().strip()


def connect_sqlite():
    """Connect to SQLite database."""
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    return conn


def connect_postgres():
    """Connect to PostgreSQL database."""
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        database=PG_DB,
        user=PG_USER,
        password=PG_PASSWORD
    )


def migrate_table(sqlite_conn, pg_conn, table_name, columns, transform_fn=None):
    """
    Generic table migration function.
    
    Args:
        sqlite_conn: SQLite connection
        pg_conn: PostgreSQL connection
        table_name: Name of table to migrate
        columns: List of column names
        transform_fn: Optional function to transform rows before insert
    """
    print(f"\n📋 Migrating {table_name}...")
    
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()
    
    # Get count from SQLite
    sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total = sqlite_cursor.fetchone()[0]
    
    if total == 0:
        print(f"   ⚠️  No data to migrate")
        return
    
    # Fetch all rows
    sqlite_cursor.execute(f"SELECT {', '.join(columns)} FROM {table_name}")
    rows = sqlite_cursor.fetchall()
    
    # Clear existing data in PostgreSQL
    pg_cursor.execute(f"DELETE FROM {table_name}")
    
    # Prepare batch insert
    placeholders = ', '.join(['%s'] * len(columns))
    insert_query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
    
    # Transform and insert
    batch = []
    for row in rows:
        row_dict = dict(row)
        if transform_fn:
            row_dict = transform_fn(row_dict)
        batch.append([row_dict.get(col) for col in columns])
    
    psycopg2.extras.execute_batch(pg_cursor, insert_query, batch, page_size=100)
    pg_conn.commit()
    
    print(f"   ✅ Migrated {len(batch)} rows")


def main():
    print("🚀 Starting SQLite → PostgreSQL Migration")
    print("=" * 60)
    
    sqlite_conn = connect_sqlite()
    pg_conn = connect_postgres()
    
    try:
        # 1. Metadata
        migrate_table(sqlite_conn, pg_conn, '_metadata', ['key', 'value'])
        
        # 2. Dreamers
        migrate_table(
            sqlite_conn, pg_conn, 'dreamers',
            ['did', 'handle', 'name', 'display_name', 'description', 'server',
             'avatar', 'banner', 'followers_count', 'follows_count', 'posts_count',
             'arrival', 'created_at', 'updated_at', 'heading', 'heading_changed_at']
        )
        
        # 3. Spectrum
        migrate_table(
            sqlite_conn, pg_conn, 'spectrum',
            ['did', 'entropy', 'oblivion', 'liberty', 'authority', 
             'receptive', 'skeptic', 'octant', 'updated_at']
        )
        
        # 4. Kindred
        migrate_table(
            sqlite_conn, pg_conn, 'kindred',
            ['did_a', 'did_b', 'discovered_epoch']
        )
        
        # 5. Dreamer Souvenirs
        migrate_table(
            sqlite_conn, pg_conn, 'dreamer_souvenirs',
            ['did', 'souvenir_key', 'earned_epoch']
        )
        
        # 6. Canon (SQLite has id, epoch, created_at)
        def transform_canon(row):
            return {
                'did': row['did'],
                'event': row['event'],
                'type': row['type'],
                'key': row['key'],
                'uri': row['uri'],
                'url': row['url'],
                'epoch': row['epoch']
            }
        
        migrate_table(
            sqlite_conn, pg_conn, 'canon',
            ['did', 'event', 'type', 'key', 'uri', 'url', 'epoch'],
            transform_fn=transform_canon
        )
        
        # 7. Profile History
        migrate_table(
            sqlite_conn, pg_conn, 'profile_history',
            ['did', 'epoch', 'handle', 'display_name', 'description', 
             'avatar', 'banner', 'followers_count', 'follows_count', 'posts_count']
        )
        
        # 8. Heading History
        migrate_table(
            sqlite_conn, pg_conn, 'heading_history',
            ['did', 'epoch', 'heading']
        )
        
        # 9. Souvenirs
        migrate_table(
            sqlite_conn, pg_conn, 'souvenirs',
            ['key', 'category', 'name', 'description', 'phanera', 'icon', 'epoch']
        )
        
        # 10. Library Books
        migrate_table(
            sqlite_conn, pg_conn, 'library_books',
            ['id', 'title', 'author', 'pages', 'release', 'cover', 'epub']
        )
        
        # 11. Library Chapters
        migrate_table(
            sqlite_conn, pg_conn, 'library_chapters',
            ['book_id', 'chapter_order', 'title', 'file']
        )
        
        # 12. World State
        migrate_table(
            sqlite_conn, pg_conn, 'world_state',
            ['epoch', 'keeper', 'keeper_did', 'color', 'theme', 'temperature', 'stability']
        )
        
        # 13. World Items
        migrate_table(
            sqlite_conn, pg_conn, 'world_items',
            ['key', 'name', 'description', 'category', 'icon', 'rarity', 
             'discovered_by', 'discovered_epoch']
        )
        
        # 14. World Snapshots
        migrate_table(
            sqlite_conn, pg_conn, 'world_snapshots',
            ['id', 'epoch', 'snapshot_data', 'operation', 'created_at']
        )
        
        # 15. Quests
        migrate_table(
            sqlite_conn, pg_conn, 'quests',
            ['quest_id', 'name', 'prompt', 'author_did', 'active', 
             'created_epoch', 'completed_count']
        )
        
        # 16. Dream Queue
        migrate_table(
            sqlite_conn, pg_conn, 'dream_queue',
            ['uri', 'author_did', 'author_handle', 'text', 'created_at',
             'indexed_at', 'processed', 'processed_at']
        )
        
        # 17. Zones
        migrate_table(
            sqlite_conn, pg_conn, 'zones',
            ['zone_id', 'name', 'description', 'created_by', 'created_epoch',
             'active', 'member_count']
        )
        
        # 18. Zone Members
        migrate_table(
            sqlite_conn, pg_conn, 'zone_members',
            ['zone_id', 'did', 'joined_epoch', 'role']
        )
        
        # 19. User Credentials (ENCRYPTED - handle carefully)
        migrate_table(
            sqlite_conn, pg_conn, 'user_credentials',
            ['did', 'app_password_encrypted', 'encryption_key_path', 
             'created_at', 'last_used']
        )
        
        # 20. User Roles
        migrate_table(
            sqlite_conn, pg_conn, 'user_roles',
            ['did', 'role', 'granted_at', 'granted_by']
        )
        
        # 21. Work
        migrate_table(
            sqlite_conn, pg_conn, 'work',
            ['role', 'did', 'status', 'activated_at', 'deactivated_at']
        )
        
        # 22. Spectrum Snapshots
        migrate_table(
            sqlite_conn, pg_conn, 'spectrum_snapshots',
            ['id', 'epoch', 'operation', 'total_dreamers', 'snapshot_data',
             'created_at', 'notes']
        )
        
        # Get final counts
        print("\n" + "=" * 60)
        print("📊 Migration Complete - Final Statistics:")
        print("=" * 60)
        
        pg_cursor = pg_conn.cursor()
        tables = [
            'dreamers', 'spectrum', 'canon', 'souvenirs', 'user_credentials',
            'work', 'quests', 'world_state'
        ]
        
        for table in tables:
            pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = pg_cursor.fetchone()[0]
            print(f"  {table:<25} {count:>10} rows")
        
        print("\n✅ Migration successful!")
        print("\n⚠️  IMPORTANT: Update core/database.py to use PostgreSQL")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        pg_conn.rollback()
        return False
    
    finally:
        sqlite_conn.close()
        pg_conn.close()
    
    return True


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
