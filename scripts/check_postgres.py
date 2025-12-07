#!/usr/bin/env python3
"""
Quick PostgreSQL connection and health check
Usage: python3 scripts/check_postgres.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager

def check_postgres():
    """Check PostgreSQL connection and database health"""
    try:
        db = DatabaseManager()
        
        print("🔍 Checking PostgreSQL connection...")
        
        # Check connection
        version = db.fetch_one("SELECT version()")
        print(f"✅ Connected: {version['version'][:50]}...")
        
        # Check tables
        tables = db.fetch_all("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        print(f"✅ Tables: {len(tables)}")
        
        # Check key counts
        dreamers_count = db.fetch_one("SELECT COUNT(*) as count FROM dreamers")
        print(f"✅ Dreamers: {dreamers_count['count']}")
        
        events_count = db.fetch_one("SELECT COUNT(*) as count FROM events")
        print(f"✅ Events: {events_count['count']}")
        
        quests_count = db.fetch_one("SELECT COUNT(*) as count FROM quests")
        print(f"✅ Quests: {quests_count['count']}")
        
        messages_count = db.fetch_one("SELECT COUNT(*) as count FROM messages")
        print(f"✅ Messages: {messages_count['count']}")
        
        # Check recent activity
        recent_dreamer = db.fetch_one("""
            SELECT name, handle, arrival 
            FROM dreamers 
            ORDER BY arrival DESC 
            LIMIT 1
        """)
        if recent_dreamer:
            print(f"✅ Most recent dreamer: {recent_dreamer['name']} (@{recent_dreamer['handle']})")
        
        print("\n🎉 PostgreSQL is healthy!")
        return True
        
    except Exception as e:
        print(f"\n❌ PostgreSQL check failed: {e}")
        return False

if __name__ == '__main__':
    success = check_postgres()
    sys.exit(0 if success else 1)
