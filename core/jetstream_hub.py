#!/usr/bin/env python3
"""
Jetstream Hub - Unified ATProto Event Consumer

Dear Cogitarian,

This replaces 3 separate firehose services with a single Jetstream connection.
Jetstream is Bluesky's official JSON streaming service that:
- Handles all CAR/CBOR parsing server-side
- Supports filtering by DID and collection
- Delivers clean JSON events

This hub receives events from Jetstream and routes them to handlers:
- DreamerHandler: Profile updates for tracked dreamers
- QuestHandler: Quest reply detection
- BiblioHandler: biblio.bond record indexing

Consolidation Benefits:
- 1 WebSocket instead of 3
- ~100 MB RAM instead of ~850 MB
- ~3% CPU instead of ~15%
- No CAR parsing overhead
- Built-in reconnection

Note: dreamhose.py still runs separately because it needs to scan ALL posts
for dream detection (can't filter by DID).
"""

import asyncio
import json
import signal
import sys
import time
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Dict, Set, Optional, Any
from concurrent.futures import ThreadPoolExecutor

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets


# ============================================================================
# Base Handler Class
# ============================================================================

class EventHandler(ABC):
    """Base class for Jetstream event handlers."""
    
    def __init__(self, name: str, verbose: bool = False):
        self.name = name
        self.verbose = verbose
        self.stats = {
            'events_received': 0,
            'events_processed': 0,
            'errors': 0,
            'start_time': datetime.now()
        }
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix=f'{name}-')
    
    @abstractmethod
    def get_wanted_dids(self) -> Set[str]:
        """Return set of DIDs this handler wants to receive events for."""
        pass
    
    @abstractmethod
    def get_wanted_collections(self) -> Set[str]:
        """Return set of collection NSIDs this handler wants."""
        pass
    
    @abstractmethod
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Process a Jetstream event."""
        pass
    
    def log(self, message: str):
        """Log with handler prefix."""
        if self.verbose:
            print(f"[{self.name}] {message}")


# ============================================================================
# Dreamer Handler - Profile Updates
# ============================================================================

class DreamerHandler(EventHandler):
    """
    Watches for profile updates from tracked dreamers.
    Replaces: dreamerhose.py
    """
    
    def __init__(self, verbose: bool = False):
        super().__init__('dreamer', verbose)
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
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
            
            self.log(f"📊 Tracking {len(self.tracked_dids)} dreamers for profile updates")
        except Exception as e:
            print(f"[dreamer] ❌ Error loading dreamers: {e}")
            self.tracked_dids = set()
    
    def get_wanted_dids(self) -> Set[str]:
        return self.tracked_dids
    
    def get_wanted_collections(self) -> Set[str]:
        return {'app.bsky.actor.profile'}
    
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Handle profile update or identity change."""
        self.stats['events_received'] += 1
        
        kind = event.get('kind')
        did = event.get('did', '')
        
        if did not in self.tracked_dids:
            return
        
        try:
            if kind == 'commit':
                commit = event.get('commit', {})
                collection = commit.get('collection', '')
                operation = commit.get('operation', '')
                
                if collection == 'app.bsky.actor.profile' and operation in ('create', 'update'):
                    self.stats['events_processed'] += 1
                    handle = self.dreamer_by_did.get(did, {}).get('handle', did[:20])
                    self.log(f"🔄 Profile update: @{handle}")
                    
                    # Process in background thread
                    self.executor.submit(self._async_profile_update, did, handle)
            
            elif kind == 'identity':
                identity = event.get('identity', {})
                new_handle = identity.get('handle', '')
                old_handle = self.dreamer_by_did.get(did, {}).get('handle', '')
                
                if new_handle and new_handle != old_handle:
                    self.stats['events_processed'] += 1
                    self.log(f"🔄 Handle change: @{old_handle} → @{new_handle}")
                    
                    # Update cache
                    if did in self.dreamer_by_did:
                        self.dreamer_by_did[did]['handle'] = new_handle
                    
                    self.executor.submit(self._async_handle_update, did, new_handle, old_handle)
                    
        except Exception as e:
            self.stats['errors'] += 1
            self.log(f"⚠️ Error handling event: {e}")
    
    def _async_profile_update(self, did: str, handle: str):
        """Background: fetch profile and update database."""
        try:
            from core.network import NetworkClient
            from core.database import DatabaseManager
            
            network = NetworkClient()
            profile = network.get_profile(did)
            
            if not profile:
                return
            
            updates = {}
            if 'displayName' in profile:
                updates['display_name'] = profile['displayName']
            if 'description' in profile:
                updates['description'] = profile['description']
            if 'avatar' in profile:
                updates['avatar'] = profile['avatar']
            if 'followersCount' in profile:
                updates['followers_count'] = profile['followersCount']
            
            if updates:
                db = DatabaseManager()
                set_parts = [f"{k} = %s" for k in updates.keys()]
                values = list(updates.values()) + [did]
                sql = f"UPDATE dreamers SET {', '.join(set_parts)} WHERE did = %s"
                db.execute(sql, tuple(values))
                
                if did in self.dreamer_by_did:
                    self.dreamer_by_did[did].update(updates)
                
                self.log(f"   ✅ @{handle}: Updated {', '.join(updates.keys())}")
                
        except Exception as e:
            self.log(f"   ❌ @{handle}: Update failed: {e}")
    
    def _async_handle_update(self, did: str, new_handle: str, old_handle: str):
        """Background: update handle in database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            db.execute("UPDATE dreamers SET handle = %s WHERE did = %s", (new_handle, did))
            self.log(f"   ✅ Database updated: @{old_handle} → @{new_handle}")
        except Exception as e:
            self.log(f"   ❌ Failed to update handle: {e}")


# ============================================================================
# Quest Handler - Quest Reply Detection
# ============================================================================

class QuestHandler(EventHandler):
    """
    Watches for quest replies from tracked dreamers.
    Replaces: questhose.py
    """
    
    def __init__(self, verbose: bool = False):
        super().__init__('quest', verbose)
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        self.quest_uris: Set[str] = set()
        self._load_dreamers()
        self._load_quests()
    
    def _load_dreamers(self):
        """Load tracked dreamers."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("SELECT did, handle, avatar FROM dreamers")
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            self.log(f"📊 Monitoring {len(self.tracked_dids)} dreamers for quest replies")
        except Exception as e:
            print(f"[quest] ❌ Error loading dreamers: {e}")
    
    def _load_quests(self):
        """Load quest URIs to monitor."""
        try:
            from ops.quest_hooks import get_quest_uris
            self.quest_uris = set(get_quest_uris())
            self.log(f"📜 Monitoring {len(self.quest_uris)} quest posts")
        except Exception as e:
            print(f"[quest] ❌ Error loading quests: {e}")
            self.quest_uris = set()
    
    def get_wanted_dids(self) -> Set[str]:
        return self.tracked_dids
    
    def get_wanted_collections(self) -> Set[str]:
        return {'app.bsky.feed.post'}
    
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Check if post is a reply to a quest."""
        self.stats['events_received'] += 1
        
        if not self.quest_uris:
            return
        
        kind = event.get('kind')
        if kind != 'commit':
            return
        
        commit = event.get('commit', {})
        if commit.get('collection') != 'app.bsky.feed.post':
            return
        if commit.get('operation') != 'create':
            return
        
        did = event.get('did', '')
        if did not in self.tracked_dids:
            return
        
        record = commit.get('record', {})
        reply = record.get('reply')
        if not reply:
            return
        
        # Check if reply is to a quest
        parent_uri = reply.get('parent', {}).get('uri', '')
        root_uri = reply.get('root', {}).get('uri', '')
        
        quest_uri = None
        if parent_uri in self.quest_uris:
            quest_uri = parent_uri
        elif root_uri in self.quest_uris:
            quest_uri = root_uri
        
        if not quest_uri:
            return
        
        # Quest reply detected!
        self.stats['events_processed'] += 1
        
        rkey = commit.get('rkey', '')
        post_uri = f"at://{did}/app.bsky.feed.post/{rkey}"
        post_text = record.get('text', '')
        post_created_at = record.get('createdAt', '')
        
        handle = self.dreamer_by_did.get(did, {}).get('handle', did[:20])
        self.log(f"🔍 Quest reply from @{handle}: {post_text[:50]}...")
        
        # Process in background
        self.executor.submit(
            self._async_process_quest_reply,
            post_uri, did, post_text, post_created_at, quest_uri
        )
    
    def _async_process_quest_reply(self, post_uri: str, author_did: str,
                                    post_text: str, post_created_at: str, quest_uri: str):
        """Background: process quest reply."""
        try:
            from ops.quest_hooks import process_quest_reply
            
            author_handle = self.dreamer_by_did.get(author_did, {}).get('handle', 'unknown')
            
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
                commands = result.get('commands_executed', [])
                if commands and not result.get('skipped'):
                    quest_title = result.get('quest_title', 'unknown')
                    self.log(f"✨ Quest '{quest_title}': {', '.join(commands)} for @{author_handle}")
                    
        except Exception as e:
            self.log(f"❌ Quest processing failed: {e}")


# ============================================================================
# Biblio Handler - biblio.bond Record Indexing
# ============================================================================

class BiblioHandler(EventHandler):
    """
    Indexes biblio.bond.* records from the network.
    Replaces: bibliohose.py
    
    Note: Since we can't filter by collection prefix in Jetstream's DID mode,
    we receive all events from tracked DIDs and filter locally.
    For biblio.bond, we track users who have used biblio.bond before.
    """
    
    def __init__(self, db_path: str = '/srv/biblio.bond/data/bibliobond.db', verbose: bool = False):
        super().__init__('biblio', verbose)
        self.db_path = db_path
        self.known_dids: Set[str] = set()
        self._load_known_users()
    
    def _load_known_users(self):
        """Load DIDs that have used biblio.bond."""
        try:
            import sqlite3
            db = sqlite3.connect(self.db_path)
            db.row_factory = sqlite3.Row
            
            # Get unique DIDs from books, lists, stamps
            cursor = db.execute("SELECT DISTINCT did FROM books UNION SELECT DISTINCT did FROM lists UNION SELECT DISTINCT did FROM stamps")
            self.known_dids = {row[0] for row in cursor.fetchall()}
            db.close()
            
            self.log(f"📚 Tracking {len(self.known_dids)} biblio.bond users")
        except Exception as e:
            print(f"[biblio] ⚠️ Could not load users: {e}")
            self.known_dids = set()
    
    def get_wanted_dids(self) -> Set[str]:
        return self.known_dids
    
    def get_wanted_collections(self) -> Set[str]:
        return {'biblio.bond.book', 'biblio.bond.list', 'biblio.bond.stamp'}
    
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Index biblio.bond records."""
        self.stats['events_received'] += 1
        
        kind = event.get('kind')
        if kind != 'commit':
            return
        
        commit = event.get('commit', {})
        collection = commit.get('collection', '')
        
        if not collection.startswith('biblio.bond.'):
            return
        
        did = event.get('did', '')
        operation = commit.get('operation', '')
        rkey = commit.get('rkey', '')
        uri = f"at://{did}/{collection}/{rkey}"
        record = commit.get('record', {})
        
        self.stats['events_processed'] += 1
        
        # Add new DID to tracking
        if did not in self.known_dids:
            self.known_dids.add(did)
            self.log(f"📚 New biblio.bond user: {did[:20]}...")
        
        if operation == 'create':
            self.executor.submit(self._index_record, uri, did, collection, record)
            self.log(f"📖 {collection}: create by {did[:20]}")
        elif operation == 'delete':
            self.executor.submit(self._delete_record, uri, collection)
            self.log(f"🗑️ {collection}: delete {rkey}")
    
    def _get_db(self):
        """Get SQLite connection."""
        import sqlite3
        db = sqlite3.connect(self.db_path)
        db.row_factory = sqlite3.Row
        return db
    
    def _index_record(self, uri: str, did: str, collection: str, record: Dict):
        """Background: index a record."""
        try:
            db = self._get_db()
            now = datetime.utcnow().isoformat()
            
            if collection == 'biblio.bond.book':
                db.execute('''
                    INSERT OR REPLACE INTO books (uri, did, title, author, created_at, indexed_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (uri, did, record.get('title', ''), record.get('author', ''),
                      record.get('createdAt', now), now))
                
                # Handle list associations
                db.execute('DELETE FROM book_lists WHERE book_uri = ?', (uri,))
                for list_uri in record.get('lists', []):
                    db.execute('INSERT OR IGNORE INTO book_lists (book_uri, list_uri) VALUES (?, ?)',
                               (uri, list_uri))
                
            elif collection == 'biblio.bond.list':
                db.execute('''
                    INSERT OR REPLACE INTO lists (uri, did, name, description, created_at, indexed_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (uri, did, record.get('name', ''), record.get('description', ''),
                      record.get('createdAt', now), now))
                
            elif collection == 'biblio.bond.stamp':
                db.execute('''
                    INSERT OR REPLACE INTO stamps (uri, did, book_uri, list_uri, created_at, indexed_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (uri, did, record.get('book', ''), record.get('list', ''),
                      record.get('createdAt', now), now))
            
            db.commit()
            db.close()
            
        except Exception as e:
            self.log(f"❌ Index error: {e}")
    
    def _delete_record(self, uri: str, collection: str):
        """Background: delete a record."""
        try:
            db = self._get_db()
            
            if collection == 'biblio.bond.book':
                db.execute('DELETE FROM books WHERE uri = ?', (uri,))
                db.execute('DELETE FROM book_lists WHERE book_uri = ?', (uri,))
            elif collection == 'biblio.bond.list':
                db.execute('DELETE FROM lists WHERE uri = ?', (uri,))
            elif collection == 'biblio.bond.stamp':
                db.execute('DELETE FROM stamps WHERE uri = ?', (uri,))
            
            db.commit()
            db.close()
            
        except Exception as e:
            self.log(f"❌ Delete error: {e}")


# ============================================================================
# Jetstream Hub - Main Consumer
# ============================================================================

class JetstreamHub:
    """
    Unified Jetstream consumer that routes events to handlers.
    """
    
    JETSTREAM_URLS = [
        "wss://jetstream2.us-east.bsky.network/subscribe",
        "wss://jetstream1.us-east.bsky.network/subscribe",
        "wss://jetstream2.us-west.bsky.network/subscribe",
        "wss://jetstream1.us-west.bsky.network/subscribe",
    ]
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.handlers: list[EventHandler] = []
        self.running = True
        self.cursor: Optional[int] = None
        
        self.stats = {
            'total_events': 0,
            'start_time': datetime.now(),
            'reconnects': 0,
            'last_event_time': None
        }
        
        # Load cursor from file
        self._load_cursor()
    
    def register(self, handler: EventHandler):
        """Register an event handler."""
        self.handlers.append(handler)
        print(f"✅ Registered handler: {handler.name}")
    
    def _build_subscribe_url(self) -> str:
        """Build Jetstream subscribe URL with filters."""
        base_url = self.JETSTREAM_URLS[0]
        
        # Collect all wanted DIDs
        all_dids: Set[str] = set()
        for handler in self.handlers:
            all_dids.update(handler.get_wanted_dids())
        
        # Collect all wanted collections
        all_collections: Set[str] = set()
        for handler in self.handlers:
            all_collections.update(handler.get_wanted_collections())
        
        # Build query params
        params = []
        
        # Add collection filters (max 100)
        for collection in list(all_collections)[:100]:
            params.append(f"wantedCollections={collection}")
        
        # Add DID filters (max 10,000 - Jetstream limit)
        dids_list = list(all_dids)[:10000]
        for did in dids_list:
            params.append(f"wantedDids={did}")
        
        # Add cursor if we have one
        if self.cursor:
            params.append(f"cursor={self.cursor}")
        
        url = f"{base_url}?{'&'.join(params)}"
        
        print(f"📡 Jetstream URL built:")
        print(f"   Collections: {len(all_collections)}")
        print(f"   DIDs: {len(dids_list)}")
        if self.cursor:
            print(f"   Cursor: {self.cursor}")
        
        return url
    
    def _load_cursor(self):
        """Load cursor from file."""
        cursor_file = Path('/srv/reverie.house/data/jetstream_cursor.txt')
        try:
            if cursor_file.exists():
                self.cursor = int(cursor_file.read_text().strip())
                print(f"📖 Loaded cursor: {self.cursor}")
        except Exception as e:
            print(f"⚠️ Could not load cursor: {e}")
    
    def _save_cursor(self, cursor: int):
        """Save cursor to file and database."""
        cursor_file = Path('/srv/reverie.house/data/jetstream_cursor.txt')
        try:
            cursor_file.parent.mkdir(parents=True, exist_ok=True)
            cursor_file.write_text(str(cursor))
            self.cursor = cursor
        except Exception as e:
            print(f"⚠️ Could not save cursor to file: {e}")
        
        # Also save to database for monitoring
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=os.environ.get('POSTGRES_HOST', 'localhost'),
                port=os.environ.get('POSTGRES_PORT', 5432),
                database=os.environ.get('POSTGRES_DB', 'reverie_house'),
                user=os.environ.get('POSTGRES_USER', 'reverie'),
                password=os.environ.get('POSTGRES_PASSWORD', '')
            )
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO firehose_cursors (service_name, cursor, events_processed, updated_at)
                VALUES ('jetstream_hub', %s, %s, NOW())
                ON CONFLICT (service_name) DO UPDATE SET
                    cursor = EXCLUDED.cursor,
                    events_processed = EXCLUDED.events_processed,
                    updated_at = NOW()
            """, (cursor, self.stats['total_events']))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"⚠️ Could not save cursor to database: {e}")
    
    async def _dispatch_event(self, event: Dict[str, Any]):
        """Route event to appropriate handlers."""
        self.stats['total_events'] += 1
        self.stats['last_event_time'] = datetime.now()
        
        # Save cursor periodically
        time_us = event.get('time_us')
        if time_us and self.stats['total_events'] % 1000 == 0:
            self._save_cursor(time_us)
        
        # Progress logging
        if self.verbose and self.stats['total_events'] % 5000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            
            handler_stats = []
            for h in self.handlers:
                handler_stats.append(f"{h.name}:{h.stats['events_processed']}")
            
            print(f"📡 Hub: {self.stats['total_events']} events ({rate:.0f}/sec) | {' | '.join(handler_stats)}")
        
        # Dispatch to all handlers
        for handler in self.handlers:
            try:
                await handler.handle_event(event)
            except Exception as e:
                print(f"❌ Handler {handler.name} error: {e}")
    
    async def run(self):
        """Main run loop with reconnection."""
        print("\n" + "=" * 70)
        print("🌊 JETSTREAM HUB - Unified ATProto Event Consumer")
        print("=" * 70)
        print(f"Handlers: {[h.name for h in self.handlers]}")
        print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70 + "\n")
        
        while self.running:
            try:
                url = self._build_subscribe_url()
                print(f"\n🔌 Connecting to Jetstream...")
                
                async with websockets.connect(
                    url,
                    ping_interval=30,
                    ping_timeout=10,
                    max_size=10 * 1024 * 1024  # 10 MB max message
                ) as ws:
                    print("✅ Connected!")
                    
                    message_count = 0
                    async for message in ws:
                        if not self.running:
                            break
                        
                        message_count += 1
                        if message_count == 1:
                            print(f"📨 First message received! (len={len(message)})")
                        if self.verbose and message_count % 1000 == 0:
                            print(f"📨 Received {message_count} messages so far...")
                        
                        try:
                            event = json.loads(message)
                            await self._dispatch_event(event)
                        except json.JSONDecodeError as e:
                            print(f"⚠️ JSON decode error: {e}")
                
            except websockets.exceptions.ConnectionClosed as e:
                self.stats['reconnects'] += 1
                print(f"🔄 Connection closed ({e}), reconnecting in 5s... (attempt {self.stats['reconnects']})")
                await asyncio.sleep(5)
                
            except Exception as e:
                self.stats['reconnects'] += 1
                print(f"❌ Error: {e}, reconnecting in 10s... (attempt {self.stats['reconnects']})")
                await asyncio.sleep(10)
    
    def stop(self):
        """Stop the hub gracefully."""
        print("\n🛑 Stopping Jetstream Hub...")
        self.running = False
        
        # Save final cursor
        if self.cursor:
            self._save_cursor(self.cursor)
        
        # Print final stats
        print("\n📊 Final Statistics:")
        print(f"   Total events: {self.stats['total_events']}")
        print(f"   Reconnects: {self.stats['reconnects']}")
        
        for handler in self.handlers:
            print(f"   {handler.name}: {handler.stats['events_processed']} processed, {handler.stats['errors']} errors")


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Jetstream Hub - Unified ATProto Event Consumer')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--handlers', nargs='+', default=['dreamer', 'quest', 'biblio'],
                        choices=['dreamer', 'quest', 'biblio'],
                        help='Which handlers to enable')
    args = parser.parse_args()
    
    # Create hub
    hub = JetstreamHub(verbose=args.verbose)
    
    # Register handlers
    if 'dreamer' in args.handlers:
        hub.register(DreamerHandler(verbose=args.verbose))
    
    if 'quest' in args.handlers:
        hub.register(QuestHandler(verbose=args.verbose))
    
    if 'biblio' in args.handlers:
        hub.register(BiblioHandler(verbose=args.verbose))
    
    # Handle signals
    def signal_handler(sig, frame):
        hub.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run
    try:
        asyncio.run(hub.run())
    except KeyboardInterrupt:
        hub.stop()


if __name__ == '__main__':
    main()
