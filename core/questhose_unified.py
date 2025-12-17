#!/usr/bin/env python3
"""
🌊 Unified Questhose - Full Network Quest Trigger Monitor

Dear Cogitarian,

This is the unified firehose scanner for quest triggers that require
full network access. It handles:

1. firehose_phrase triggers - Monitor all posts for specific phrases/hashtags
2. Future full-network triggers (extensible design)

This replaces:
- dreamhose.py (was writing to non-existent dream_queue table - REMOVED)
- phrasehose.py (never deployed, now integrated here)

NOTE: bsky_reply quests (replies to specific posts) are handled by 
jetstream_hub.py which only monitors tracked DIDs via Bluesky's Jetstream API.

Architecture:
                ATProto Firehose (~5000 events/sec)
                            │
                            ▼
                ┌───────────────────────┐
                │  Unified Questhose    │
                │  (full network scan)  │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   Phrase Triggers    [Future]            [Future]
   (firehose_phrase)   Hashtag            Dream detect
                       Trends             (if needed)
"""

import json
import sys
import time
import signal
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message, models
from core.cursor_manager import CursorManager


class UnifiedQuesthose:
    """
    Unified firehose monitor for quest triggers requiring full network access.
    """
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.running = True
        
        # Cursor persistence
        self.cursor_manager = CursorManager('questhose_unified', save_interval=1000, verbose=verbose)
        
        # Stats
        self.stats = {
            'total_events': 0,
            'posts_scanned': 0,
            'phrase_matches': 0,
            'quests_triggered': 0,
            'errors': 0,
            'start_time': datetime.now()
        }
        
        # Thread pool for background processing
        self.executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix='questhose-')
        
        # Phrase monitoring
        self.phrase_quests: List[Dict] = []
        self.all_phrases: Set[str] = set()
        self.phrase_config: Dict[str, Dict] = {}  # phrase -> {case_sensitive, quest_id, ...}
        
        # Load configuration
        self._load_phrase_quests()
        
        # Signal handling
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, sig, frame):
        """Handle shutdown signals gracefully."""
        print("\n🛑 Shutdown signal received...")
        self.running = False
    
    def _load_phrase_quests(self):
        """Load quests with firehose_phrase trigger type."""
        try:
            from ops.quests import QuestManager
            
            manager = QuestManager()
            all_quests = manager.get_enabled_quests()
            
            self.phrase_quests = []
            self.all_phrases = set()
            self.phrase_config = {}
            
            for quest in all_quests:
                trigger_type = quest.get('trigger_type', 'bsky_reply')
                
                if trigger_type != 'firehose_phrase':
                    continue
                
                # Parse trigger config
                trigger_config = quest.get('trigger_config', {})
                if isinstance(trigger_config, str):
                    try:
                        trigger_config = json.loads(trigger_config)
                    except:
                        trigger_config = {}
                
                phrases = trigger_config.get('phrases', [])
                if isinstance(phrases, str):
                    phrases = [p.strip() for p in phrases.split(',') if p.strip()]
                
                case_sensitive = trigger_config.get('case_sensitive', False)
                
                if not phrases:
                    print(f"⚠️  Quest '{quest['title']}' has no phrases configured")
                    continue
                
                self.phrase_quests.append(quest)
                
                for phrase in phrases:
                    # Store phrase (lowercase for case-insensitive matching)
                    phrase_key = phrase if case_sensitive else phrase.lower()
                    self.all_phrases.add(phrase_key)
                    
                    # Store config for this phrase
                    if phrase_key not in self.phrase_config:
                        self.phrase_config[phrase_key] = []
                    
                    self.phrase_config[phrase_key].append({
                        'quest': quest,
                        'original_phrase': phrase,
                        'case_sensitive': case_sensitive
                    })
            
            print(f"📜 Loaded {len(self.phrase_quests)} phrase-triggered quests")
            if self.all_phrases:
                sample = list(self.all_phrases)[:5]
                print(f"   Phrases: {', '.join(sample)}" + 
                      (f" ... +{len(self.all_phrases) - 5} more" if len(self.all_phrases) > 5 else ""))
            
        except Exception as e:
            print(f"❌ Error loading phrase quests: {e}")
            import traceback
            traceback.print_exc()
    
    def on_message_handler(self, message):
        """Handle firehose messages."""
        if not self.running:
            raise KeyboardInterrupt("Shutdown requested")
        
        self.stats['total_events'] += 1
        
        # Parse the raw message into a commit
        commit = parse_subscribe_repos_message(message)
        
        # Update cursor
        if hasattr(commit, 'seq'):
            self.cursor_manager.update_cursor(commit.seq)
        
        # Progress logging
        if self.stats['total_events'] % 50000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"📊 Events: {self.stats['total_events']:,} | "
                  f"Posts: {self.stats['posts_scanned']:,} | "
                  f"Matches: {self.stats['phrase_matches']} | "
                  f"Triggered: {self.stats['quests_triggered']} | "
                  f"Rate: {rate:.0f}/sec")
        
        # Only process commits (not identity events)
        if type(commit).__name__ != 'Commit':
            return
        
        if not hasattr(commit, 'repo') or not commit.ops:
            return
        
        # Parse CAR file
        try:
            car = CAR.from_bytes(commit.blocks)
        except Exception as e:
            if self.verbose:
                print(f"⚠️  CAR parse error: {e}")
            return
        
        # Check each operation
        for op in commit.ops:
            if op.action != 'create':
                continue
            
            if not op.path.startswith('app.bsky.feed.post/'):
                continue
            
            try:
                if not op.cid:
                    continue
                
                record = car.blocks.get(op.cid)
                if not record:
                    continue
                
                # Parse record
                if isinstance(record, dict):
                    post_data = record
                elif isinstance(record, (bytes, str)):
                    if isinstance(record, bytes):
                        record = record.decode('utf-8')
                    post_data = json.loads(record)
                else:
                    continue
                
                text = post_data.get('text', '')
                if not text:
                    continue
                
                self.stats['posts_scanned'] += 1
                
                # Check for phrase matches
                self._check_phrase_matches(commit.repo, op.path, post_data, text)
                
            except Exception as e:
                self.stats['errors'] += 1
                if self.verbose:
                    print(f"⚠️  Post processing error: {e}")
    
    def _check_phrase_matches(self, author_did: str, op_path: str, 
                               post_data: Dict, text: str):
        """Check if post matches any monitored phrases."""
        if not self.all_phrases:
            return
        
        text_lower = text.lower()
        
        # Quick check: any phrase potentially matches?
        matched_phrases = []
        for phrase_key in self.all_phrases:
            if phrase_key in text_lower:
                matched_phrases.append(phrase_key)
        
        if not matched_phrases:
            return
        
        # Found matches! Process them
        self.stats['phrase_matches'] += 1
        
        post_uri = f"at://{author_did}/{op_path}"
        created_at = post_data.get('createdAt', datetime.now().isoformat())
        
        if self.verbose:
            print(f"\n✨ Phrase match: {matched_phrases}")
            print(f"   Author: {author_did}")
            print(f"   Text: {text[:80]}...")
        
        # Trigger quests for each matched phrase
        for phrase_key in matched_phrases:
            configs = self.phrase_config.get(phrase_key, [])
            
            for config in configs:
                quest = config['quest']
                
                # Build reply object for quest processing
                reply_obj = {
                    'uri': post_uri,
                    'author': {
                        'did': author_did,
                        'handle': 'unknown'  # Not available from firehose
                    },
                    'record': {
                        'text': text,
                        'createdAt': created_at
                    }
                }
                
                # Process in background
                self.executor.submit(
                    self._process_phrase_quest,
                    quest, reply_obj, config['original_phrase']
                )
    
    def _process_phrase_quest(self, quest: Dict, reply_obj: Dict, matched_phrase: str):
        """Process a phrase-triggered quest."""
        try:
            from ops.conditions import evaluate_conditions
            from ops.commands import execute_quest_commands
            
            quest_title = quest.get('title', 'unknown')
            author_did = reply_obj['author']['did']
            
            # Evaluate conditions
            conditions = quest.get('conditions', [])
            condition_operator = quest.get('condition_operator', 'AND')
            
            thread_result = {'replies': [reply_obj]}
            
            if conditions:
                cond_result = evaluate_conditions(
                    conditions, condition_operator, thread_result, quest
                )
                
                if not cond_result.get('success'):
                    if self.verbose:
                        reason = cond_result.get('reason', 'unknown')
                        print(f"   ⏭️  Conditions not met: {reason}")
                    return
            
            # Execute commands
            commands = quest.get('commands', [])
            
            if commands:
                if self.verbose:
                    print(f"   🎯 Executing quest '{quest_title}' commands")
                
                result = execute_quest_commands(
                    commands, [reply_obj], quest, verbose=self.verbose
                )
                
                if result.get('success'):
                    self.stats['quests_triggered'] += 1
                    if self.verbose:
                        print(f"   ✅ Quest triggered for {author_did[:20]}...")
                else:
                    errors = result.get('errors', [])
                    print(f"   ❌ Quest execution errors: {errors}")
            
        except Exception as e:
            print(f"⚠️  Error processing quest '{quest.get('title')}': {e}")
            if self.verbose:
                import traceback
                traceback.print_exc()
    
    def start(self):
        """Start the unified questhose monitor."""
        print("\n" + "=" * 70)
        print("🌊 UNIFIED QUESTHOSE - Full Network Quest Monitor")
        print("=" * 70)
        print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Phrase quests: {len(self.phrase_quests)}")
        print(f"Monitored phrases: {len(self.all_phrases)}")
        print("=" * 70 + "\n")
        
        if not self.phrase_quests:
            print("⚠️  No firehose_phrase quests enabled")
            print("   Create quests with trigger_type='firehose_phrase' to activate")
            print("   Running anyway to wait for quest additions...")
            print()
        
        # Load cursor
        saved_cursor = self.cursor_manager.load_cursor()
        if saved_cursor:
            print(f"📖 Resuming from cursor: {saved_cursor}")
        else:
            print("📖 Starting fresh (no cursor)")
        
        # Create client
        params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=saved_cursor) if saved_cursor else None
        client = FirehoseSubscribeReposClient(params=params)
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            print("\n\n🛑 Shutting down...")
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.running = False
            self.cursor_manager.finalize()
            self.executor.shutdown(wait=False)
            self._print_stats()
    
    def _print_stats(self):
        """Print final statistics."""
        elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
        rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
        
        print("\n" + "=" * 70)
        print("📊 UNIFIED QUESTHOSE - FINAL STATISTICS")
        print("=" * 70)
        print(f"Runtime:          {elapsed:.0f} seconds")
        print(f"Total events:     {self.stats['total_events']:,}")
        print(f"Posts scanned:    {self.stats['posts_scanned']:,}")
        print(f"Phrase matches:   {self.stats['phrase_matches']:,}")
        print(f"Quests triggered: {self.stats['quests_triggered']:,}")
        print(f"Errors:           {self.stats['errors']:,}")
        print(f"Event rate:       {rate:.0f}/sec")
        
        if self.stats['posts_scanned'] > 0:
            match_rate = (self.stats['phrase_matches'] / self.stats['posts_scanned']) * 100
            print(f"Match rate:       {match_rate:.4f}%")
        
        print("=" * 70 + "\n")


def main():
    """Run the unified questhose monitor."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Unified Questhose - Full Network Quest Monitor')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--reload-interval', type=int, default=300,
                       help='Seconds between quest config reloads (default: 300)')
    args = parser.parse_args()
    
    monitor = UnifiedQuesthose(verbose=args.verbose)
    monitor.start()


if __name__ == '__main__':
    main()
