#!/usr/bin/env python3
"""
🔍 Phrase Scanner - Efficient Network-Wide Phrase Monitoring

Dear Cogitarian,

This replaces questhose_unified.py with a much more efficient approach.
Instead of consuming the full ATProto firehose with CAR parsing (~20% CPU),
we use Jetstream without DID filtering to get all posts as clean JSON (~2% CPU).

Architecture:
    Jetstream (all posts, JSON) → Phrase Scanner → Quest Triggers
    
    ~900 posts/sec as JSON vs ~5000 events/sec as CAR binary
    No CAR parsing overhead = ~90% CPU reduction

Monitors:
- firehose_phrase quests: Scan all posts for specific phrases/hashtags
"""

import asyncio
import json
import os
import signal
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets


class PhraseScanner:
    """
    Efficient network-wide phrase scanner using Jetstream.
    """
    
    JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"
    CURSOR_FILE = Path('/srv/reverie.house/data/phrase_scanner_cursor.txt')
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.running = True
        self.cursor: Optional[int] = None
        
        # Stats
        self.stats = {
            'total_events': 0,
            'posts_scanned': 0,
            'phrase_matches': 0,
            'quests_triggered': 0,
            'errors': 0,
            'start_time': datetime.now(),
            'reconnects': 0
        }
        
        # Thread pool for background processing
        self.executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix='phrase-')
        
        # Phrase monitoring
        self.phrase_quests: List[Dict] = []
        self.all_phrases: Set[str] = set()
        self.phrase_config: Dict[str, List[Dict]] = {}  # phrase_key -> [{quest, original_phrase, case_sensitive}]
        
        # Load configuration
        self._load_cursor()
        self._load_phrase_quests()
        
        # Signal handling
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, sig, frame):
        """Handle shutdown signals gracefully."""
        print("\n🛑 Shutdown signal received...")
        self.running = False
    
    def _load_cursor(self):
        """Load cursor from file."""
        try:
            if self.CURSOR_FILE.exists():
                self.cursor = int(self.CURSOR_FILE.read_text().strip())
                print(f"📖 Loaded cursor: {self.cursor}")
        except Exception as e:
            print(f"⚠️ Could not load cursor: {e}")
    
    def _save_cursor(self, cursor: int):
        """Save cursor to file."""
        try:
            self.CURSOR_FILE.parent.mkdir(parents=True, exist_ok=True)
            self.CURSOR_FILE.write_text(str(cursor))
            self.cursor = cursor
        except Exception as e:
            if self.verbose:
                print(f"⚠️ Could not save cursor: {e}")
        
        # Also save to database
        self._save_cursor_db(cursor)
    
    def _save_cursor_db(self, cursor: int):
        """Save cursor to database for monitoring."""
        try:
            import psycopg2
            
            password = os.environ.get('POSTGRES_PASSWORD', '')
            if not password:
                password_file = os.environ.get('POSTGRES_PASSWORD_FILE', '/srv/secrets/reverie.postgres.password')
                try:
                    with open(password_file, 'r') as f:
                        password = f.read().strip()
                except Exception:
                    pass
            
            conn = psycopg2.connect(
                host=os.environ.get('POSTGRES_HOST', 'localhost'),
                port=int(os.environ.get('POSTGRES_PORT', 5432)),
                database=os.environ.get('POSTGRES_DB', 'reverie_house'),
                user=os.environ.get('POSTGRES_USER', 'reverie'),
                password=password
            )
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO firehose_cursors (service_name, cursor, events_processed, updated_at)
                VALUES ('phrase_scanner', %s, %s, NOW())
                ON CONFLICT (service_name) DO UPDATE SET
                    cursor = EXCLUDED.cursor,
                    events_processed = EXCLUDED.events_processed,
                    updated_at = NOW()
            """, (cursor, self.stats['total_events']))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            if self.verbose:
                print(f"⚠️ DB cursor save failed: {e}")
    
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
                exclude_reposts = trigger_config.get('exclude_reposts', True)
                
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
                        'case_sensitive': case_sensitive,
                        'exclude_reposts': exclude_reposts
                    })
            
            print(f"📜 Loaded {len(self.phrase_quests)} phrase-triggered quests")
            if self.all_phrases:
                sample = list(self.all_phrases)[:3]
                display = [f'"{p[:30]}..."' if len(p) > 30 else f'"{p}"' for p in sample]
                print(f"   Phrases: {', '.join(display)}" + 
                      (f" +{len(self.all_phrases) - 3} more" if len(self.all_phrases) > 3 else ""))
            
        except Exception as e:
            print(f"❌ Error loading phrase quests: {e}")
            import traceback
            traceback.print_exc()
    
    def reload_quests(self):
        """Reload quest configuration (called periodically)."""
        old_count = len(self.phrase_quests)
        self._load_phrase_quests()
        if len(self.phrase_quests) != old_count:
            print(f"🔄 Quest reload: {old_count} → {len(self.phrase_quests)} phrase quests")
    
    async def handle_event(self, event: Dict[str, Any]):
        """Handle a Jetstream event."""
        self.stats['total_events'] += 1
        
        # Save cursor periodically
        time_us = event.get('time_us')
        if time_us and self.stats['total_events'] % 1000 == 0:
            self._save_cursor(time_us)
        
        # Progress logging
        if self.stats['total_events'] % 50000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"📊 Events: {self.stats['total_events']:,} | "
                  f"Posts: {self.stats['posts_scanned']:,} | "
                  f"Matches: {self.stats['phrase_matches']} | "
                  f"Triggered: {self.stats['quests_triggered']} | "
                  f"Rate: {rate:.0f}/sec")
        
        # Only process commits
        kind = event.get('kind')
        if kind != 'commit':
            return
        
        commit = event.get('commit', {})
        if commit.get('collection') != 'app.bsky.feed.post':
            return
        if commit.get('operation') != 'create':
            return
        
        record = commit.get('record', {})
        text = record.get('text', '')
        if not text:
            return
        
        self.stats['posts_scanned'] += 1
        
        # Check for phrase matches
        did = event.get('did', '')
        rkey = commit.get('rkey', '')
        
        await self._check_phrase_matches(did, rkey, record, text)
    
    async def _check_phrase_matches(self, author_did: str, rkey: str, 
                                    record: Dict, text: str):
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
        
        # Found matches!
        self.stats['phrase_matches'] += 1
        
        post_uri = f"at://{author_did}/app.bsky.feed.post/{rkey}"
        created_at = record.get('createdAt', datetime.now().isoformat())
        
        if self.verbose:
            print(f"\n✨ Phrase match!")
            print(f"   Author: {author_did}")
            print(f"   Text: {text[:80]}...")
        
        # Trigger quests for each matched phrase
        for phrase_key in matched_phrases:
            configs = self.phrase_config.get(phrase_key, [])
            
            for config in configs:
                quest = config['quest']
                
                # Check if repost should be excluded
                if config.get('exclude_reposts', True):
                    # Reposts have a $type of app.bsky.feed.repost or embed type
                    if record.get('$type') == 'app.bsky.feed.repost':
                        continue
                
                # Build reply object for quest processing
                reply_obj = {
                    'uri': post_uri,
                    'author': {
                        'did': author_did,
                        'handle': 'unknown'  # Not available from Jetstream
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
            from ops.command_executor import execute_quest_commands
            
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
                    print(f"✅ Quest '{quest_title}' triggered for {author_did[:30]}...")
                else:
                    errors = result.get('errors', [])
                    print(f"❌ Quest execution errors: {errors}")
            
        except Exception as e:
            print(f"⚠️  Error processing quest '{quest.get('title')}': {e}")
            if self.verbose:
                import traceback
                traceback.print_exc()
    
    def _build_url(self) -> str:
        """Build Jetstream URL with cursor if available."""
        url = self.JETSTREAM_URL
        if self.cursor:
            url += f"&cursor={self.cursor}"
        return url
    
    async def run(self):
        """Main run loop."""
        print("\n" + "=" * 70)
        print("🔍 PHRASE SCANNER - Network-Wide Phrase Monitor")
        print("=" * 70)
        print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Phrase quests: {len(self.phrase_quests)}")
        print(f"Monitored phrases: {len(self.all_phrases)}")
        print("Using Jetstream (JSON) - efficient low-CPU scanning")
        print("=" * 70 + "\n")
        
        if not self.phrase_quests:
            print("⚠️  No firehose_phrase quests enabled")
            print("   Waiting for quests to be enabled...")
            print()
        
        # Quest reload task
        reload_task = asyncio.create_task(self._periodic_reload())
        
        try:
            while self.running:
                try:
                    url = self._build_url()
                    print(f"🔌 Connecting to Jetstream...")
                    
                    async with websockets.connect(
                        url,
                        ping_interval=30,
                        ping_timeout=10,
                        max_size=10 * 1024 * 1024
                    ) as ws:
                        print("✅ Connected to Jetstream!")
                        
                        async for message in ws:
                            if not self.running:
                                break
                            
                            try:
                                event = json.loads(message)
                                await self.handle_event(event)
                            except json.JSONDecodeError as e:
                                if self.verbose:
                                    print(f"⚠️ JSON error: {e}")
                                    
                except websockets.exceptions.ConnectionClosed as e:
                    self.stats['reconnects'] += 1
                    print(f"🔄 Connection closed, reconnecting in 5s... (attempt {self.stats['reconnects']})")
                    await asyncio.sleep(5)
                    
                except Exception as e:
                    self.stats['reconnects'] += 1
                    print(f"❌ Error: {e}, reconnecting in 10s...")
                    await asyncio.sleep(10)
        finally:
            reload_task.cancel()
            try:
                await reload_task
            except asyncio.CancelledError:
                pass
            
            self._print_stats()
    
    async def _periodic_reload(self):
        """Reload quest config periodically."""
        while self.running:
            await asyncio.sleep(300)  # 5 minutes
            if self.running:
                self.reload_quests()
    
    def _print_stats(self):
        """Print final statistics."""
        elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
        rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
        
        print("\n" + "=" * 70)
        print("📊 PHRASE SCANNER - FINAL STATISTICS")
        print("=" * 70)
        print(f"Runtime:          {elapsed:.0f} seconds")
        print(f"Total events:     {self.stats['total_events']:,}")
        print(f"Posts scanned:    {self.stats['posts_scanned']:,}")
        print(f"Phrase matches:   {self.stats['phrase_matches']:,}")
        print(f"Quests triggered: {self.stats['quests_triggered']:,}")
        print(f"Errors:           {self.stats['errors']:,}")
        print(f"Reconnects:       {self.stats['reconnects']:,}")
        print(f"Event rate:       {rate:.0f}/sec")
        print("=" * 70 + "\n")
    
    def stop(self):
        """Stop gracefully."""
        self.running = False
        if self.cursor:
            self._save_cursor(self.cursor)
        self.executor.shutdown(wait=False)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Phrase Scanner - Network-Wide Phrase Monitor')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    scanner = PhraseScanner(verbose=args.verbose)
    
    try:
        asyncio.run(scanner.run())
    except KeyboardInterrupt:
        scanner.stop()


if __name__ == '__main__':
    main()
