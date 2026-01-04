#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Reverie - Social Network Overlay System
Clean rebuild starting from basics.

Usage:
    python3 reverie.py              # Normal cycle
    python3 reverie.py --rebuild    # Clear database and 3-phase rebuild
"""

import sys
import os
import json
import time
import shutil
import glob
import subprocess
from datetime import datetime

from config import Config

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def rebuild_database():
    """
    Complete database rebuild - 3-phase workflow.
    Phase 1: PDS residence check
    Phase 2: Quest monitors (name discovery)
    Phase 3: Profile enrichment
    """
    from core.database import DatabaseManager
    
    print("=" * 70)
    print("🌜 REVERIE DATABASE REBUILD (3-PHASE)")
    print("=" * 70)
    
    db = DatabaseManager()
    
    # Clear database
    print("\n🗑️  CLEARING DATABASE...")
    try:
        db.execute("DELETE FROM profile_history")
        db.execute("DELETE FROM dreamer_souvenirs")
        db.execute("DELETE FROM kindred")
        db.execute("DELETE FROM spectrum")
        db.execute("DELETE FROM canon")
        db.execute("DELETE FROM dreamers")
        # DatabaseManager auto-commits after execute()
        print("✅ Database cleared")
    except Exception as e:
        print(f"❌ Failed to clear database: {e}")
        # Note: rollback not needed with auto-commit, but kept for clarity
        return 1
    
    # Hard override: Add errantson
    print("\n=== HARD OVERRIDE ===")
    try:
        errantson_did = "did:plc:yauphjufk7phkwurn266ybx2"
        errantson_handle = "errantson.bsky.social"
        errantson_name = "errantson"
        
        db.execute("""
            INSERT INTO dreamers (did, handle, name, server, arrival, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (errantson_did, errantson_handle, errantson_name, 
              "https://bsky.social", int(time.time()), int(time.time())))
        # DatabaseManager auto-commits after execute()
        print(f"✅ Hard override: {errantson_name} (@{errantson_handle})")
    except Exception as e:
        print(f"❌ Hard override failed: {e}")
        # Note: rollback not needed with auto-commit, but kept for clarity
    
    # Check auth
    if not Config.BSKY_HANDLE or not Config.BSKY_APP_PASSWORD:
        print("❌ Missing Bluesky credentials in .env")
        return 1
    
    print("\n=== AUTH ===")
    try:
        from core.auth import AuthManager
        auth = AuthManager()
        token = auth.get_token()
        if not token:
            print("❌ Authentication failed")
            return 1
        print("✅ Authenticated")
    except Exception as e:
        print(f"❌ Auth error: {e}")
        return 1
    
    # Phase 1: PDS residence check
    print("\n=== PHASE 1: PDS RESIDENCE CHECK ===\n")
    try:
        from ops.command_executor import check_pds_residence
        result = check_pds_residence()
        print(f"\n📊 PDS Check Results:")
        print(f"   New primitives: {result['added']}")
        print(f"   Handle updates: {result.get('handle_updates', 0)}")
        print(f"   Already in DB: {result['existing']}")
        print(f"   Errors: {result['errors']}")
        primitives_added = result['added']
    except Exception as e:
        print(f"❌ PDS check error: {e}")
        primitives_added = 0
    
    # Phase 2: Quest monitors
    print("\n=== PHASE 2: QUEST MONITORS (NAME DISCOVERY) ===\n")
    try:
        from ops.quest import monitor_quests
        monitor_quests()
        cursor = db.execute("SELECT COUNT(*) as count FROM dreamers")
        dreamer_count = cursor.fetchone()['count']
    except Exception as e:
        print(f"❌ Monitor processing error: {e}")
        dreamer_count = 0
    
    # Phase 3: Profile updates
    print("\n=== PHASE 3: PROFILE UPDATES ===\n")
    try:
        from ops.command_executor import update_profiles_from_bluesky
        result = update_profiles_from_bluesky(verbose=Config.DEBUG)
        print(f"\n📊 Profile Update Results:")
        print(f"   Updated: {result['updated']}")
        print(f"   Skipped: {result['skipped']}")
        print(f"   Errors: {result['errors']}")
        profiles_updated = result['updated']
    except Exception as e:
        print(f"❌ Profile update error: {e}")
        profiles_updated = 0
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 REBUILD SUMMARY")
    print("=" * 70)
    print(f"Phase 1 - PDS primitives added: {primitives_added}")
    print(f"Phase 2 - Dreamers after monitors: {dreamer_count}")
    print(f"Phase 3 - Profiles enriched: {profiles_updated}")
    print()
    
    # Show final stats
    stats = db.get_table_stats()
    print("📊 DATABASE STATS")
    print("=" * 70)
    print(f"Dreamers: {stats.get('dreamers', 0)}")
    print(f"Canon entries: {stats.get('canon', 0)}")
    print(f"Spectrum entries: {stats.get('spectrum', 0)}")
    print()
    
    return 0


def main():
    """Main entry point for Reverie - rebuild only."""
    if len(sys.argv) > 1 and sys.argv[1] in ['--rebuild', '--reset', '-r']:
        return rebuild_database()
    
    print("Usage: python3 reverie.py --rebuild")
    print("Rebuilds the database in 3 phases.")
    return 1

if __name__ == "__main__":
    sys.exit(main())