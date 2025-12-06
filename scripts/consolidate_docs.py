#!/usr/bin/env python3
"""
Documentation Consolidation Script

Consolidates 160+ docs into ~20 essential ones.
Archives historical/completed work.
Deletes empty/redundant files.
"""

import os
import shutil
from pathlib import Path

# Base paths
DOCS = Path('/srv/reverie.house/docs')
ARCHIVE = DOCS / 'archive'

# Ensure archive exists
ARCHIVE.mkdir(exist_ok=True)

# Files to archive (historical/completed work)
ARCHIVE_FILES = [
    # Migration docs (all done)
    'CLEANUP_POSTGRESQL_MIGRATION.md',
    'POSTGRES_MIGRATION_CLEANUP.md',
    'POSTGRES_MIGRATION_PHASE2.md',
    'POSTGRESQL_MIGRATION_COMPLETE.md',
    'POSTGRESQL_MIGRATION_SUMMARY.md',
    'POSTGRESQL_QUEST_FIXES_COMPLETE.md',
    'ADMIN_SYSTEM_POSTGRESQL_REVIEW.md',
    'FEEDGEN_POSTGRES_FIX.md',
    'MIGRATION_COMPLETE.md',
    'CLEANUP_COMPLETE.md',
    
    # Status/Fix docs (one-time fixes, now resolved)
    'IMPLEMENTATION_COMPLETE.md',
    'SERVICE_RENAME_COMPLETE.md',
    'WORK_TABLE_MIGRATION_COMPLETE.md',
    'MESSAGES_MONITOR_FIXED.md',
    'CREDENTIALS_TABLE_FIX.md',
    'ADMIN_DB_FIX.md',
    'DIALOGUE_CLEANUP_2024-12-04.md',
    'MONITOR_SERVICES_RENAMED.md',
    'COMPOSE_SYSTEM_FIXED.md',
    'COMPOSE_POST_DEBUG_IMPROVEMENTS.md',
    'COMPOSE_POST_FULLY_FUNCTIONAL.md',
    'QUEST_CLEANUP_20251123.md',
    
    # OAuth implementation docs (merge into core/AUTHENTICATION.md)
    'OAUTH_CREDENTIALS_GUIDE.md',
    'OAUTH_DASHBOARD_UTILITY_REPORT.md',
    'OAUTH_DEEP_DIVE.md',
    'OAUTH_IMPLEMENTATION_COMPLETE.md',
    'OAUTH_QUICK_REFERENCE.md',
    'OAUTH_TEST_INSTRUCTIONS.md',
    'OAUTH_TOKEN_FIX.md',
    'OAUTH_UNIFIED_FLOW_PLAN.md',
    'OAUTH_WORKER_FLOW.md',  # Speculative future work
    
    # Quest system docs (merge into features/QUESTS.md)
    'QUEST_SYSTEM_AUDIT.md',
    'QUEST_SYSTEM_DIAGNOSTIC_PLAN.md',
    'QUEST_SYSTEM_REVIEW_SUMMARY.md',
    'QUEST_SYSTEM_STATUS.md',
    'QUEST_TIMELINE_OVERHAUL.md',
    'QUEST_TRIGGER_IMPLEMENTATION.md',
    'QUEST_TRIGGER_SYSTEM.md',
    'TODO_QUEST_COMMANDS_CONDITIONS_FIXES.md',
    'TRIGGER_SYSTEM_AUDIT.md',
    'TRIGGER_SYSTEM_IMPLEMENTATION.md',
    'FIREHOSE_PHRASE_TRIGGER.md',
    'PRINCIPLES_OF_SIMULTANEITY_TRIGGER.md',
    
    # Composer docs (merge into features/COMPOSER.md)
    'COMPOSE_CREDENTIALS_NOTICE.md',
    'COMPOSE_POST_IMPROVEMENTS.md',
    'COMPOSER_WIDGET_IMPLEMENTATION.md',
    'COMPOSE_SCHEDULE_SYSTEM.md',
    'CALENDAR_WIDGET_IMPLEMENTATION.md',
    
    # Pigeon docs (merge into features/PIGEONS.md)
    'DIALOGUE_PIGEON_SYSTEM_STATUS.md',
    'PIGEON_FIXES_TESTING.md',
    'PIGEON_TRIGGER_SYSTEM_ANALYSIS.md',
    'PIGEON_UI_REDESIGN.md',
    'PIGEON_USER_LOGIN_IMPLEMENTATION.md',
    
    # Biblio docs (merge into features/BIBLIO.md)
    'BIBLIOHOSE_ARCHITECTURE.md',
    'BIBLIOHOSE.md',
    'BIBLIOHOSE_QUEST_CONFIG_GUIDE.md',
    'BIBLIOHOSE_SETUP_COMPLETE.md',
    'BIBLIO_STAMPS_ARCHITECTURE.md',
    'BIBLIO_STAMPS_QUERY.md',
    'BIBLIO_STAMPS_QUICKSTART.md',
    'SUMMARY_BIBLIO_STAMPS.md',
    
    # Database/backend docs (info now in schema/ and reference/)
    'DATABASE_CODE_REVIEW.md',
    'DATABASE_RESTORATION_STRATEGY.md',
    'DATABASE_SCHEMA_ANALYSIS.md',
    'BACKEND_TRANSITION_PLAN.md',
    'TRANSACTION_HANDLING_DEEP_DIVE.md',
    
    # Frontend docs (covered in guides/)
    'FRONTEND_RECONNECTION_REVIEW.md',
    'FRONTEND_TESTING_PLAN.md',
    
    # Other implementation docs
    'LORE_HISTORY_INTEGRATION_PLAN.md',
    'RESTRUCTURE_PLAN.md',
    'SYSTEM_STATUS_20251203.md',
    'ADMIN_SYSTEM_STATUS.md',
    'STANDALONE_DREAMS_SETUP.md',
    
    # Speculative/future
    'FUTURE_CONCEPTS.md',
    
    # Review docs (useful but snapshot in time)
    'CRITICAL_ATPROTO_REVIEW.md',  # Keep updated version
]

# Files to delete (empty or truly redundant)
DELETE_FILES = [
    'BUILD_THE_TRIGGER.md',  # Empty
    'COMPOSE_POST_IMPROVEMENTS_COMPLETE.md',  # Empty
    'COMPOSE_POST_IMPROVEMENTS.md',  # Empty
    'TRIGGER_IMPLEMENTATION_GUIDE.md',  # Empty
    '.README.md',  # Duplicate of README.md
]

def main():
    print("=" * 70)
    print("📚 DOCUMENTATION CONSOLIDATION")
    print("=" * 70)
    print()
    
    # Archive files
    print(f"📦 Archiving {len(ARCHIVE_FILES)} historical docs...")
    archived_count = 0
    for filename in ARCHIVE_FILES:
        src = DOCS / filename
        if src.exists():
            dst = ARCHIVE / filename
            shutil.move(str(src), str(dst))
            archived_count += 1
            print(f"   ✓ {filename}")
    print(f"✅ Archived {archived_count} files")
    print()
    
    # Delete empty files
    print(f"🗑️  Deleting {len(DELETE_FILES)} empty/redundant docs...")
    deleted_count = 0
    for filename in DELETE_FILES:
        filepath = DOCS / filename
        if filepath.exists():
            filepath.unlink()
            deleted_count += 1
            print(f"   ✓ {filename}")
    print(f"✅ Deleted {deleted_count} files")
    print()
    
    # Count remaining
    remaining = len([f for f in DOCS.iterdir() if f.is_file() and f.suffix == '.md'])
    print("=" * 70)
    print(f"📊 SUMMARY")
    print("=" * 70)
    print(f"Archived: {archived_count}")
    print(f"Deleted:  {deleted_count}")
    print(f"Remaining in docs/: {remaining}")
    print()
    print("Next steps:")
    print("1. Review remaining docs")
    print("2. Create consolidated docs in core/, features/, guides/")
    print("3. Update cross-references")
    print()

if __name__ == '__main__':
    main()
