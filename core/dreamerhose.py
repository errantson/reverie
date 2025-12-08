#!/usr/bin/env python3
"""
Dreamer Profile Monitor

Dear Cogitarian,

This watches the ATProto firehose for profile updates from our ~500 dreamers.
When someone changes their avatar, display name, or handle, this updates the database.
Runs PDS sync every 15 minutes to catch new accounts at reverie.house.

Cursor persistence means it resumes from where it left off on restart.
"""

import json
import sys
from pathlib import Path
from typing import Set, Dict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message, models
from config import Config
from core.cursor_manager import CursorManager


class DreamerhoseMonitor:
    """Monitor the ATProto firehose for dreamer profile updates."""
    
    def __init__(self, verbose: bool = False, demo: bool = False):
        self.verbose = verbose
        self.demo = demo
        
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        
        # PDS sync timing
        self.last_pds_sync: float = 0
        self.pds_sync_interval: int = 900  # 15 minutes
        
        # Cursor persistence
        self.cursor_manager = CursorManager('dreamerhose', save_interval=1000, verbose=verbose)
        
        self.stats = {
            'total_events': 0,
            'relevant_events': 0,
            'profile_updates': 0,
            'identity_updates': 0,
            'pds_syncs': 0,
            'saves_started': 0,
            'saves_completed': 0,
            'start_time': datetime.now()
        }
        
        self.executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix='dreamer-update')
        
        self._load_dreamers()
    
    def _load_dreamers(self):
        """Load tracked dreamers from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("SELECT did, handle, avatar, followers_count FROM dreamers")
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            if self.verbose:
                print(f"📊 Tracking {len(self.tracked_dids)} dreamers")
                if self.demo and self.tracked_dids:
                    for did in list(self.tracked_dids)[:5]:
                        handle = self.dreamer_by_did[did].get('handle', 'unknown')
                        print(f"   - @{handle} ({did})")
                    if len(self.tracked_dids) > 5:
                        print(f"   ... and {len(self.tracked_dids) - 5} more")
        except Exception as e:
            print(f"❌ Error loading dreamers: {e}")
            self.tracked_dids = set()
    
    def on_message_handler(self, message) -> None:
        """Process each firehose message - track dreamer activity."""
        self.stats['total_events'] += 1
        
        # Progress logging every 5000 events
        if self.verbose and self.stats['total_events'] % 5000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"👥 Dreamerhose: {self.stats['total_events']} events "
                  f"({rate:.0f}/sec) | "
                  f"Relevant: {self.stats['relevant_events']} | "
                  f"Profiles: {self.stats['profile_updates']} | "
                  f"Handles: {self.stats['identity_updates']} | "
                  f"PDS syncs: {self.stats['pds_syncs']} | "
                  f"Saves: {self.stats['saves_completed']}/{self.stats['saves_started']}")
        
        # Check for PDS sync
        self._check_pds_sync()
        
        commit = parse_subscribe_repos_message(message)
        
        # Update cursor if this is a sequenced message
        if hasattr(commit, 'seq'):
            self.cursor_manager.update_cursor(commit.seq)
        
        # Handle identity events (handle changes)
        if type(commit).__name__ == 'Identity':
            self._handle_identity_event(commit)
            return
        
        # Only process commits
        if type(commit).__name__ != 'Commit':
            return
        
        if not hasattr(commit, 'repo') or not commit.ops:
            return
        
        repo_did = commit.repo
        
        # Only process events from tracked dreamers
        if repo_did not in self.tracked_dids:
            return
        
        self.stats['relevant_events'] += 1
        
        if self.demo:
            dreamer = self.dreamer_by_did.get(repo_did, {})
            handle = dreamer.get('handle', repo_did[:12] + '...')
            print(f"🎯 Event from @{handle}: {len(commit.ops)} ops")
            for op in commit.ops:
                print(f"   {op.action} {op.path}")
        
        # Process operations
        for op in commit.ops:
            # Profile updates
            if op.path == 'app.bsky.actor.profile/self' and op.action in ['create', 'update']:
                self._on_profile_update(repo_did)
    
    def _on_profile_update(self, did: str):
        """Handle profile update event - spawn async update immediately."""
        self.stats['profile_updates'] += 1
        
        dreamer = self.dreamer_by_did.get(did, {})
        handle = dreamer.get('handle', did[:12] + '...')
        
        print(f"🔄 PROFILE UPDATE: @{handle}")
        print(f"   DID: {did}")
        print(f"   Time: {datetime.now().strftime('%H:%M:%S')}")
        
        self.stats['saves_started'] += 1
        self.executor.submit(self._async_profile_update, did, handle)
    
    def _handle_identity_event(self, identity_event):
        """Handle #identity event (handle change)."""
        try:
            if not hasattr(identity_event, 'did'):
                return
            
            did = identity_event.did
            
            if did not in self.tracked_dids:
                return
            
            self.stats['relevant_events'] += 1
            self.stats['identity_updates'] += 1
            
            old_handle = self.dreamer_by_did.get(did, {}).get('handle', 'unknown')
            
            # The identity event has the new handle
            new_handle = None
            if hasattr(identity_event, 'handle'):
                new_handle = identity_event.handle
            
            if new_handle and new_handle != old_handle:
                print(f"🔄 HANDLE CHANGE: @{old_handle} → @{new_handle}")
                print(f"   DID: {did}")
                
                # Update in cache immediately
                if did in self.dreamer_by_did:
                    self.dreamer_by_did[did]['handle'] = new_handle
                
                # Update in database asynchronously
                self.executor.submit(self._async_handle_update, did, new_handle, old_handle)
        except Exception as e:
            if self.verbose:
                print(f"⚠️  Error handling identity event: {e}")
    
    def _async_handle_update(self, did: str, new_handle: str, old_handle: str):
        """Background thread: update handle in database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            db.execute("""
                UPDATE dreamers
                SET handle = %s
                WHERE did = %s
            """, (new_handle, did))
            # Note: db.execute() auto-commits
            
            print(f"   ✅ Database updated: @{old_handle} → @{new_handle}")
            self.stats['saves_completed'] += 1
            
        except Exception as e:
            print(f"   ❌ Failed to update handle: {e}")
    
    def _async_profile_update(self, did: str, handle: str):
        """Background thread: fetch profile and update database."""
        try:
            from core.network import NetworkClient
            from core.database import DatabaseManager
            
            network = NetworkClient()
            
            # Fetch current profile
            profile = network.get_profile(did)
            
            if not profile:
                print(f"   ⚠️ @{handle}: Could not fetch profile")
                return
            
            # Extract updates
            updates = {}
            
            if 'displayName' in profile:
                updates['display_name'] = profile['displayName']
            
            if 'description' in profile:
                updates['bio'] = profile['description']
            
            if 'avatar' in profile:
                updates['avatar'] = profile['avatar']
            
            if 'followersCount' in profile:
                updates['followers_count'] = profile['followersCount']
            
            if not updates:
                print(f"   ℹ️  @{handle}: No changes to save")
                return
            
            # Apply updates to database
            self._apply_single_update(did, updates, handle)
            
        except Exception as e:
            print(f"   ❌ @{handle}: Update failed: {e}")
    
    def _apply_single_update(self, did: str, updates: Dict, handle: str):
        """Apply profile updates to database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            set_parts = []
            values = []
            
            for key, value in updates.items():
                set_parts.append(f"{key} = %s")
                values.append(value)
            
            values.append(did)
            
            sql = f"UPDATE dreamers SET {', '.join(set_parts)} WHERE did = %s"
            db.execute(sql, tuple(values))
            # Note: db.execute() auto-commits, no need for db.commit()
            
            # Update cache
            if did in self.dreamer_by_did:
                self.dreamer_by_did[did].update(updates)
            
            update_summary = ', '.join([f"{k}: {v[:30] if isinstance(v, str) else v}" 
                                       for k, v in updates.items()])
            print(f"   ✅ @{handle}: {update_summary}")
            
            self.stats['saves_completed'] += 1
            
        except Exception as e:
            print(f"   ❌ @{handle}: Save failed: {e}")
    
    def _check_pds_sync(self):
        """Check if it's time to sync PDS accounts."""
        current_time = datetime.now().timestamp()
        
        if current_time - self.last_pds_sync < self.pds_sync_interval:
            return
        
        self.last_pds_sync = current_time
        
        self.executor.submit(self._async_pds_sync)
    
    def _async_pds_sync(self):
        """Background thread: sync PDS accounts to database."""
        try:
            from data.db_dreamers import sync_pds_accounts
            from core.network import NetworkClient
            from core.database import DatabaseManager
            
            if self.verbose:
                print("\n🏡 Running PDS sync...")
            
            db = DatabaseManager()
            network = NetworkClient()
            result = sync_pds_accounts(db, network, verbose=False)
            
            self.stats['pds_syncs'] += 1
            
            if result.get('added', 0) > 0 or result.get('updated', 0) > 0:
                print(f"   🏡 PDS sync complete: +{result.get('added', 0)} updated={result.get('updated', 0)}")
                
                # Reload dreamers to include new PDS accounts
                self._load_dreamers()
            else:
                if self.verbose:
                    print(f"   🏡 PDS sync: No changes")
                
        except Exception as e:
            print(f"⚠️ PDS sync failed: {e}")
    
    def run(self):
        """Start monitoring the firehose for dreamer profile updates."""
        print("\n👥 DREAMERHOSE - Dreamer Profile Monitor")
        print("=" * 60)
        print(f"Monitoring: {len(self.tracked_dids)} dreamers")
        print(f"Tracking: Profile updates, handle changes")
        print(f"PDS sync: Every {self.pds_sync_interval // 60} minutes")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Load saved cursor
        saved_cursor = self.cursor_manager.load_cursor()
        if saved_cursor:
            print(f"Cursor: Resuming from {saved_cursor}")
        else:
            print(f"Cursor: Starting fresh")
        
        print("=" * 60)
        print("\nListening to firehose for dreamer events... (Ctrl+C to stop)\n")
        
        # Create client with cursor if we have one
        params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=saved_cursor) if saved_cursor else None
        client = FirehoseSubscribeReposClient(params=params)
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            print("\n\n⚠️  Stopping dreamerhose...")
        finally:
            print("\n⏳ Waiting for pending updates...")
            self.executor.shutdown(wait=True)
            
            # Save final cursor
            self.cursor_manager.finalize()
            
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print("\n📊 DREAMERHOSE STATS")
            print("=" * 60)
            print(f"Runtime: {elapsed:.0f} seconds")
            print(f"Total events processed: {self.stats['total_events']:,}")
            print(f"Events per second: {self.stats['total_events']/elapsed:.0f}")
            print(f"Relevant events: {self.stats['relevant_events']}")
            print(f"Profile updates: {self.stats['profile_updates']}")
            print(f"Handle changes: {self.stats['identity_updates']}")
            print(f"PDS syncs: {self.stats['pds_syncs']}")
            print(f"Saves completed: {self.stats['saves_completed']}/{self.stats['saves_started']}")
            print("=" * 60)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Dreamerhose - Dreamer Profile Monitor')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--demo', action='store_true', help='Demo mode with detailed event logging')
    args = parser.parse_args()
    
    monitor = DreamerhoseMonitor(verbose=args.verbose, demo=args.demo)
    monitor.run()


if __name__ == '__main__':
    main()
