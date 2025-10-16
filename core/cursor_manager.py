#!/usr/bin/env python3
"""
Firehose Cursor Manager

Dear Cogitarian,

This manages cursor persistence for our ATProto firehose services. A cursor is just
a bookmark - a number telling the firehose "I've processed everything up to event X".
Without it, services replay millions of old events on restart.

When you see cursor_manager in a firehose service, it's saving progress every 1000
events and loading the last position on startup.
"""

import sys
from pathlib import Path
from typing import Optional
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager


class CursorManager:
    """Manages cursor persistence for firehose services."""
    
    def __init__(self, service_name: str, save_interval: int = 1000, verbose: bool = False):
        """
        Args:
            service_name: Unique identifier (e.g., 'dreamerhose', 'questhose')
            save_interval: How often to save (default: every 1000 events)
            verbose: Print save operations
        """
        self.service_name = service_name
        self.save_interval = save_interval
        self.verbose = verbose
        
        self.db = DatabaseManager()
        self.current_cursor: Optional[int] = None
        self.events_since_save: int = 0
        
        self._init_cursor_record()
    
    def _init_cursor_record(self):
        """Ensure cursor record exists in database."""
        self.db.execute("""
            INSERT INTO firehose_cursors (service_name, cursor, events_processed)
            VALUES (%s, 0, 0)
            ON CONFLICT (service_name) DO NOTHING
        """, (self.service_name,))
    
    def load_cursor(self) -> Optional[int]:
        """
        Load saved cursor from database.
        
        Returns:
            Cursor value (int) or None to start from current time
        """
        cursor = self.db.execute(
            "SELECT cursor, events_processed FROM firehose_cursors WHERE service_name = %s",
            (self.service_name,)
        ).fetchone()
        
        if cursor and cursor['cursor'] > 0:
            self.current_cursor = cursor['cursor']
            
            if self.verbose:
                print(f"📖 [{self.service_name}] Resuming from cursor: {self.current_cursor}")
                print(f"   Events previously processed: {cursor['events_processed']:,}")
            
            return self.current_cursor
        else:
            if self.verbose:
                print(f"📖 [{self.service_name}] No saved cursor - starting from current time")
            return None
    
    def update_cursor(self, cursor: int, force_save: bool = False) -> None:
        """
        Update current cursor and optionally save to database.
        
        Args:
            cursor: New cursor value from firehose
            force_save: Save immediately regardless of interval
        """
        self.current_cursor = cursor
        self.events_since_save += 1
        
        # Save periodically or on force
        if force_save or self.events_since_save >= self.save_interval:
            self._save_cursor()
            self.events_since_save = 0
    
    def _save_cursor(self) -> None:
        """Save current cursor to database."""
        if self.current_cursor is None:
            return
        
        try:
            self.db.execute("""
                UPDATE firehose_cursors
                SET cursor = %s,
                    updated_at = NOW(),
                    events_processed = events_processed + %s,
                    last_error = NULL,
                    last_error_at = NULL
                WHERE service_name = %s
            """, (self.current_cursor, self.events_since_save, self.service_name))
            
            if self.verbose:
                print(f"💾 [{self.service_name}] Saved cursor: {self.current_cursor} "
                      f"(+{self.events_since_save} events)")
        except Exception as e:
            print(f"⚠️ [{self.service_name}] Failed to save cursor: {e}")
    
    def record_error(self, error_message: str) -> None:
        """
        Record an error in cursor tracking.
        
        Args:
            error_message: Description of error encountered
        """
        try:
            self.db.execute("""
                UPDATE firehose_cursors
                SET last_error = %s,
                    last_error_at = NOW()
                WHERE service_name = %s
            """, (error_message, self.service_name))
        except Exception as e:
            print(f"⚠️ [{self.service_name}] Failed to record error: {e}")
    
    def finalize(self) -> None:
        """
        Save final cursor state on shutdown.
        Call this in shutdown handlers or finally blocks.
        """
        if self.events_since_save > 0:
            if self.verbose:
                print(f"🏁 [{self.service_name}] Final cursor save on shutdown...")
            self._save_cursor()
    
    def get_stats(self) -> dict:
        """
        Get cursor statistics from database.
        
        Returns:
            Dict with cursor, events_processed, updated_at, last_error
        """
        stats = self.db.execute(
            "SELECT * FROM firehose_cursors WHERE service_name = %s",
            (self.service_name,)
        ).fetchone()
        
        return dict(stats) if stats else {}


def check_all_cursors(verbose: bool = True) -> None:
    """
    Check cursor status for all services.
    Useful for monitoring and diagnostics.
    """
    db = DatabaseManager()
    cursors = db.execute("SELECT * FROM firehose_cursors ORDER BY service_name").fetchall()
    
    if not cursors:
        print("No cursor data found.")
        return
    
    print("\n📊 FIREHOSE CURSOR STATUS")
    print("=" * 80)
    
    for cursor in cursors:
        print(f"\n{cursor['service_name']}")
        print(f"  Cursor: {cursor['cursor']:,}")
        print(f"  Events processed: {cursor['events_processed']:,}")
        print(f"  Last updated: {cursor['updated_at']}")
        
        if cursor['last_error']:
            print(f"  ⚠️  Last error: {cursor['last_error']}")
            print(f"      At: {cursor['last_error_at']}")
    
    print("=" * 80)


if __name__ == '__main__':
    # CLI for checking cursor status
    import argparse
    
    parser = argparse.ArgumentParser(description='Firehose Cursor Manager')
    parser.add_argument('--check', action='store_true', help='Check cursor status for all services')
    args = parser.parse_args()
    
    if args.check:
        check_all_cursors()
    else:
        parser.print_help()
