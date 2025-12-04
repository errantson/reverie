#!/usr/bin/env python3
"""
Quest Monitoring Service

Dear Cogitarian,

This watches for quest replies from our dreamers. When someone replies to a quest post,
this evaluates conditions and executes commands (like granting rewards or recording progress).

Only monitors posts from known dreamers and only checks replies to active quest posts.
This prevents wasting resources scanning the entire network.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Set, Dict

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message, models
from config import Config
from core.cursor_manager import CursorManager


class QuesthoseMonitor:
    """Monitor the ATProto firehose for quest replies from tracked dreamers."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        
        # Cursor persistence
        self.cursor_manager = CursorManager('questhose', save_interval=1000, verbose=verbose)
        
        self.stats = {
            'total_events': 0,
            'relevant_events': 0,
            'posts_scanned': 0,
            'quest_replies': 0,
            'quest_completions': 0,
            'start_time': datetime.now()
        }
        
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='quest-reply')
        
        # Load dreamers and quests to monitor
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        self.quest_uris: Set[str] = set()
        
        self._load_dreamers()
        self._load_quests()
    
    def _load_dreamers(self):
        """Load tracked dreamers from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("SELECT did, handle, avatar FROM dreamers")
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            if self.verbose:
                print(f"📊 Monitoring {len(self.tracked_dids)} dreamers for quest replies")
                if self.tracked_dids:
                    for did in list(self.tracked_dids)[:5]:
                        handle = self.dreamer_by_did[did].get('handle', 'unknown')
                        print(f"   - @{handle}")
                    if len(self.tracked_dids) > 5:
                        print(f"   ... and {len(self.tracked_dids) - 5} more")
        except Exception as e:
            print(f"❌ Error loading dreamers: {e}")
            self.tracked_dids = set()
    
    def _load_quests(self):
        """Load quest URIs to monitor for replies."""
        try:
            from ops.quest_hooks import get_quest_uris
            self.quest_uris = set(get_quest_uris())
            
            if self.verbose:
                print(f"📜 Monitoring {len(self.quest_uris)} quest posts")
                if self.quest_uris:
                    for uri in list(self.quest_uris)[:3]:
                        print(f"   - {uri}")
                    if len(self.quest_uris) > 3:
                        print(f"   ... and {len(self.quest_uris) - 3} more")
            
            # ALWAYS log quest URIs to help debug detection issues
            print(f"🔍 Quest URIs loaded: {len(self.quest_uris)}")
            for uri in self.quest_uris:
                print(f"   {uri}")
                
        except Exception as e:
            print(f"❌ Error loading quests: {e}")
            import traceback
            traceback.print_exc()
            self.quest_uris = set()
    
    def on_message_handler(self, message) -> None:
        """Process each firehose message - check for quest replies."""
        self.stats['total_events'] += 1
        
        # Progress logging every 5000 events
        if self.verbose and self.stats['total_events'] % 5000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"📜 Questhose: {self.stats['total_events']} events "
                  f"({rate:.0f}/sec) | "
                  f"Relevant: {self.stats['relevant_events']} | "
                  f"Posts scanned: {self.stats['posts_scanned']} | "
                  f"Quest replies: {self.stats['quest_replies']} | "
                  f"Completions: {self.stats['quest_completions']}")
        
        commit = parse_subscribe_repos_message(message)
        
        # Update cursor if this is a sequenced message
        if hasattr(commit, 'seq'):
            self.cursor_manager.update_cursor(commit.seq)
        
        # Only care about commits (not identity events)
        if type(commit).__name__ != 'Commit':
            return
        
        if not hasattr(commit, 'repo') or not commit.ops:
            return
        
        repo_did = commit.repo
        
        # Process all post creations - let quest conditions/commands handle authorization
        for op in commit.ops:
            if op.path.startswith('app.bsky.feed.post/') and op.action == 'create':
                self._check_for_quest_reply(repo_did, op, commit)
    
    def _check_for_quest_reply(self, did: str, op, commit):
        """Check if post is a reply to a quest.
        
        OPTIMIZATION: Only parse CAR for posts from tracked dreamers.
        This avoids parsing ~99% of posts from random users.
        Only count as "scanned" if we actually parse the CAR (i.e., post creation ops).
        """
        if not self.quest_uris:
            return
        
        # CRITICAL OPTIMIZATION: Only check posts from tracked dreamers
        # We're monitoring 28 dreamers - skip the other 99% of posts
        if did not in self.dreamer_by_did:
            return
        
        try:
            if not hasattr(op, 'cid') or not op.cid:
                return
            
            # Parse CAR to get record - this is necessary to see reply structure
            # The reply info is IN the record, not in the op metadata
            car = CAR.from_bytes(commit.blocks)
            record = car.blocks.get(op.cid)
            
            if not record:
                return
            
            # NOW we've scanned a post (parsed the CAR)
            self.stats['posts_scanned'] += 1
            
            # Quick check: is this even a reply?
            reply_ref = record.get('reply')
            if not reply_ref:
                return  # Not a reply, skip immediately
            
            # Extract URIs - this is lightweight
            parent_uri = reply_ref.get('parent', {}).get('uri', '')
            root_uri = reply_ref.get('root', {}).get('uri', '')
            
            # Check if this is a reply to a quest post
            quest_uri = None
            if parent_uri in self.quest_uris:
                quest_uri = parent_uri
            elif root_uri in self.quest_uris:
                quest_uri = root_uri
            
            if not quest_uri:
                return  # Not a quest reply
            
            # Found a quest reply! Now extract the rest of the data
            post_text = record.get('text', '')
            post_created_at = record.get('createdAt', '')
            post_uri = f"at://{did}/{op.path}"
            
            self.stats['relevant_events'] += 1
            self.stats['quest_replies'] += 1
            
            handle = self.dreamer_by_did.get(did, {}).get('handle', did[:12])
            
            print(f"🔍 QUEST REPLY DETECTED: @{handle}")
            print(f"   Parent: {parent_uri}")
            print(f"   Root: {root_uri}")
            print(f"   Text: {post_text[:60]}...")
            
            # Process quest reply asynchronously
            self.executor.submit(
                self._async_process_quest_reply,
                post_uri, did, post_text, post_created_at, quest_uri
            )
            
        except Exception as e:
            # ALWAYS log exceptions - this is critical for debugging
            print(f"⚠️  Error checking quest reply: {e}")
            print(f"   DID: {did}")
            print(f"   Path: {op.path if hasattr(op, 'path') else 'unknown'}")
            import traceback
            traceback.print_exc()
    
    def _async_process_quest_reply(self, post_uri: str, author_did: str,
                                   post_text: str, post_created_at: str, quest_uri: str):
        """Background thread: process a quest reply."""
        try:
            from ops.quest_hooks import process_quest_reply
            
            # Get author handle from cache or database
            if author_did in self.dreamer_by_did:
                author_handle = self.dreamer_by_did[author_did].get('handle', 'unknown')
            else:
                try:
                    from core.database import DatabaseManager
                    db = DatabaseManager()
                    cursor = db.execute("SELECT handle FROM dreamers WHERE did = %s", (author_did,))
                    row = cursor.fetchone()
                    author_handle = row['handle'] if row else 'unknown'
                except:
                    author_handle = 'unknown'
            
            # Process the quest reply
            result = process_quest_reply(
                reply_uri=post_uri,
                author_did=author_did,
                author_handle=author_handle,
                post_text=post_text,
                post_created_at=post_created_at,
                quest_uri=quest_uri,
                verbose=self.verbose
            )
            
            if result.get('success'):
                quest_title = result.get('quest_title', 'unknown')
                commands = result.get('commands_executed', [])
                
                if commands and not result.get('skipped'):
                    self.stats['quest_completions'] += 1
                    print(f"✨ Quest '{quest_title}': Executed {', '.join(commands)} for @{author_handle}")
                elif result.get('skipped'):
                    if self.verbose:
                        reason = result.get('skip_reason', 'unknown')
                        print(f"⏭️  Quest '{quest_title}': Skipped ({reason})")
            else:
                errors = result.get('errors', [])
                if errors:
                    print(f"⚠️  Quest processing error: {errors[0]}")
                    
        except Exception as e:
            print(f"❌ Quest reply processing failed: {e}")
    
    def run(self):
        """Start monitoring the firehose for quest replies."""
        print("\n📜 QUESTHOSE - Quest Monitoring Service")
        print("=" * 60)
        print(f"Monitoring: {len(self.tracked_dids)} dreamers")
        print(f"Quest posts: {len(self.quest_uris)} active")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Load saved cursor
        saved_cursor = self.cursor_manager.load_cursor()
        if saved_cursor:
            print(f"Cursor: Resuming from {saved_cursor}")
        else:
            print(f"Cursor: Starting fresh")
        
        print("=" * 60)
        print("\nListening to firehose for quest replies... (Ctrl+C to stop)\n")
        
        # Create client with cursor if we have one
        params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=saved_cursor) if saved_cursor else None
        client = FirehoseSubscribeReposClient(params=params)
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            print("\n\n⚠️  Stopping questhose...")
        finally:
            print("\n⏳ Waiting for pending quest processing...")
            self.executor.shutdown(wait=True)
            
            # Save final cursor
            self.cursor_manager.finalize()
            
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print("\n📊 QUESTHOSE STATS")
            print("=" * 60)
            print(f"Runtime: {elapsed:.0f} seconds")
            print(f"Total events processed: {self.stats['total_events']:,}")
            print(f"Events per second: {self.stats['total_events']/elapsed:.0f}")
            print(f"Relevant events: {self.stats['relevant_events']}")
            print(f"Posts scanned: {self.stats['posts_scanned']}")
            print(f"Quest replies found: {self.stats['quest_replies']}")
            print(f"Quest completions: {self.stats['quest_completions']}")
            print("=" * 60)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Questhose - Quest Monitoring Service')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = QuesthoseMonitor(verbose=args.verbose)
    monitor.run()


if __name__ == '__main__':
    main()
