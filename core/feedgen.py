#!/usr/bin/env python3
"""
Reverie House Feed Generator

Provides custom feeds for the Reverie House community:
1. "Expanded Lore" - All posts with lore/canon labels from lore.farm
2. "Idle Dreaming" - All posts from users in PostgreSQL database

Architecture:
- Subscribes to Bluesky firehose (com.atproto.sync.subscribeRepos)
- Indexes posts in PostgreSQL database
- Serves feeds via HTTPS endpoint
- Responds to app.bsky.feed.getFeedSkeleton requests
"""

import sys
import time
import json
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.auth import AuthManager
from core.network import NetworkClient



class FeedDatabase:
    """Manages feed-specific database for indexed posts - PostgreSQL version"""
    
    def __init__(self, db_path: str = None):  # db_path kept for compatibility but ignored
        self.db = DatabaseManager()
        self._init_db()
    
    def _init_db(self):
        """Initialize feed database schema in PostgreSQL"""
        # Posts table - stores all posts from community members
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS feed_posts (
                uri TEXT PRIMARY KEY,
                cid TEXT NOT NULL,
                author_did TEXT NOT NULL,
                text TEXT,
                created_at TIMESTAMP NOT NULL,
                indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
                has_lore_label INTEGER DEFAULT 0,
                has_canon_label INTEGER DEFAULT 0
            )
        ''')
        
        # Create indexes for fast queries
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC)')
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON feed_posts(author_did)')
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_lore ON feed_posts(has_lore_label) WHERE has_lore_label = 1')
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_canon ON feed_posts(has_canon_label) WHERE has_canon_label = 1')
        
        # Labels cache - stores lore.farm labels
        self.db.execute('''
            CREATE TABLE IF NOT EXISTS feed_labels (
                uri TEXT NOT NULL,
                label_type TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                PRIMARY KEY (uri, label_type)
            )
        ''')
        
        self.db.execute('CREATE INDEX IF NOT EXISTS idx_feed_labels_uri ON feed_labels(uri)')
    
    def add_post(self, uri: str, cid: str, author_did: str, text: str, created_at: str):
        """Add or update a post in the database. Returns True if new post was added."""
        indexed_at = datetime.now(timezone.utc)
        
        # Check if post already exists
        existing = self.db.fetch_one('SELECT uri FROM feed_posts WHERE uri = %s', (uri,))
        
        if existing:
            return False  # Post already indexed, skip
        
        # Insert new post
        self.db.execute('''
            INSERT INTO feed_posts (uri, cid, author_did, text, created_at, indexed_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (uri) DO UPDATE SET
                cid = EXCLUDED.cid,
                text = EXCLUDED.text,
                indexed_at = EXCLUDED.indexed_at
        ''', (uri, cid, author_did, text, created_at, indexed_at))
        
        return True  # New post added
    
    def update_labels(self, labels: List[Dict]):
        """Update labels from lore.farm"""
        # Clear old labels
        self.db.execute('DELETE FROM feed_labels')
        
        # Insert new labels
        for label in labels:
            uri = label.get('uri', '')
            label_val = label.get('val', '')
            created_at = label.get('cts', datetime.now(timezone.utc).isoformat())
            
            # Extract label type from formats like "lore:reverie.house" or "canon:reverie.house"
            if ':' in label_val:
                label_type, domain = label_val.split(':', 1)
                # Only index reverie.house labels
                if domain == 'reverie.house' and label_type in ['lore', 'canon']:
                    self.db.execute('''
                        INSERT INTO feed_labels (uri, label_type, created_at)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (uri, label_type) DO NOTHING
                    ''', (uri, label_type, created_at))
        
        # Update posts with label flags
        self.db.execute('''
            UPDATE feed_posts 
            SET has_lore_label = (
                SELECT COUNT(*)::INTEGER FROM feed_labels 
                WHERE feed_labels.uri = feed_posts.uri AND feed_labels.label_type = 'lore'
            )
        ''')
        
        self.db.execute('''
            UPDATE feed_posts 
            SET has_canon_label = (
                SELECT COUNT(*)::INTEGER FROM feed_labels 
                WHERE feed_labels.uri = feed_posts.uri AND feed_labels.label_type = 'canon'
            )
        ''')
    
    def get_lore_feed(self, limit: int = 50, cursor: Optional[str] = None) -> tuple[List[Dict], Optional[str]]:
        """Get posts with lore or canon labels"""
        query = '''
            SELECT uri, created_at
            FROM feed_posts
            WHERE has_lore_label = 1 OR has_canon_label = 1
        '''
        
        params = []
        
        if cursor:
            # Cursor format: timestamp::uri
            try:
                cursor_time, cursor_uri = cursor.split('::', 1)
                query += ' AND (created_at < %s OR (created_at = %s AND uri < %s))'
                params.extend([cursor_time, cursor_time, cursor_uri])
            except ValueError:
                pass  # Invalid cursor, ignore
        
        query += ' ORDER BY created_at DESC, uri DESC LIMIT %s'
        params.append(limit + 1)  # Fetch one extra to determine if there's a next page
        
        rows = self.db.fetch_all(query, params)
        
        posts = [{'post': row['uri']} for row in rows[:limit]]
        
        # Generate next cursor if there are more results
        next_cursor = None
        if len(rows) > limit:
            last_row = rows[limit - 1]
            next_cursor = f"{last_row['created_at'].isoformat()}::{last_row['uri']}"
        
        return posts, next_cursor
    
    def get_community_feed(self, community_dids: set, limit: int = 50, cursor: Optional[str] = None) -> tuple[List[Dict], Optional[str]]:
        """Get all posts from community members"""
        if not community_dids:
            return [], None
        
        # Build query with DID list
        did_placeholders = ','.join(['%s'] * len(community_dids))
        query = f'''
            SELECT uri, created_at
            FROM feed_posts
            WHERE author_did IN ({did_placeholders})
        '''
        
        params = list(community_dids)
        
        if cursor:
            try:
                cursor_time, cursor_uri = cursor.split('::', 1)
                query += ' AND (created_at < %s OR (created_at = %s AND uri < %s))'
                params.extend([cursor_time, cursor_time, cursor_uri])
            except ValueError:
                pass
        
        query += ' ORDER BY created_at DESC, uri DESC LIMIT %s'
        params.append(limit + 1)
        
        rows = self.db.fetch_all(query, params)
        
        posts = [{'post': row['uri']} for row in rows[:limit]]
        
        next_cursor = None
        if len(rows) > limit:
            last_row = rows[limit - 1]
            next_cursor = f"{last_row['created_at'].isoformat()}::{last_row['uri']}"
        
        return posts, next_cursor
    
    def cleanup_old_posts(self, days: int = 30):
        """Remove posts that haven't been re-indexed in N days.
        
        Uses indexed_at (when we last saw the post) rather than created_at
        (when it was originally posted) so we keep recently active content
        regardless of original post date.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = self.db.execute('DELETE FROM feed_posts WHERE indexed_at < %s', (cutoff,))
        return result.rowcount if hasattr(result, 'rowcount') else 0


class FeedGenerator:
    """Main feed generator service"""
    
    def __init__(self):
        self.feed_db = FeedDatabase()
        self.main_db = DatabaseManager()
        self.auth = AuthManager()
        self.network = NetworkClient()
        
        # Feed definitions
        self.feeds = {
            'lore': {
                'name': 'Expanded Lore',
                'description': 'Stories, dreams, and misadventures from dreamweavers across our wild mindscape',
                'avatar': 'https://reverie.house/assets/pack_icon.png'
            },
            'dreaming': {
                'name': 'Idle Dreaming',
                'description': 'All manner of passing thoughts from those who visit Reverie House',
                'avatar': 'https://reverie.house/assets/pack_face.png'
            }
        }
        
        # Cache community DIDs
        self._community_dids = None
        self._lore_labels = None
        self._last_label_sync = None
    
    def get_community_dids(self) -> set:
        """Get all DIDs from reverie.db"""
        if self._community_dids is None:
            rows = self.main_db.fetch_all('SELECT did FROM dreamers')
            self._community_dids = {row['did'] for row in rows}
        return self._community_dids
    
    def sync_lore_labels(self, force: bool = False):
        """Sync labels from lore.farm (cache for 5 minutes)"""
        now = datetime.now(timezone.utc)
        
        if not force and self._last_label_sync:
            elapsed = (now - self._last_label_sync).total_seconds()
            if elapsed < 300:  # 5 minutes
                return
        
        try:
            response = requests.get(
                'https://lore.farm/xrpc/com.atproto.label.queryLabels',
                params={'limit': 5000},
                timeout=30
            )
            
            if response.status_code == 200:
                labels = response.json().get('labels', [])
                self.feed_db.update_labels(labels)
                self._last_label_sync = now
                print(f"✓ Synced {len(labels)} labels from lore.farm")
                
                # Update history with lore events
                self._update_lore_history(labels)
        except Exception as e:
            print(f"✗ Failed to sync labels: {e}")
    
    def _update_lore_history(self, labels: List[Dict]):
        """Update events table with lore contributions"""
        # Filter for reverie.house labels only
        reverie_labels = [
            label for label in labels
            if label.get('val', '').endswith(':reverie.house')
        ]
        
        if not reverie_labels:
            return
        
        print(f"📜 Processing {len(reverie_labels)} reverie.house labels for history...")
        
        # Group labels by URI to handle lore+canon together, and fetch post timestamps
        import requests
        from datetime import datetime, timezone
        
        labels_by_uri = defaultdict(lambda: {'lore': False, 'canon': False, 'epoch': None})
        
        for label in reverie_labels:
            uri = label.get('uri', '')
            val = label.get('val', '')
            
            # Fetch post timestamp if we haven't already
            if labels_by_uri[uri]['epoch'] is None:
                try:
                    parts = uri.replace('at://', '').split('/')
                    if len(parts) >= 3:
                        post_response = requests.get(
                            'https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord',
                            params={
                                'repo': parts[0],
                                'collection': parts[1],
                                'rkey': parts[2]
                            }
                        )
                        if post_response.status_code == 200:
                            post_data = post_response.json()
                            created_at = post_data.get('value', {}).get('createdAt')
                            if created_at:
                                post_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                                labels_by_uri[uri]['epoch'] = int(post_dt.timestamp())
                except Exception:
                    pass
            
            if val == 'lore:reverie.house':
                labels_by_uri[uri]['lore'] = True
            elif val == 'canon:reverie.house':
                labels_by_uri[uri]['canon'] = True
        
        # Sort URIs by epoch (chronological order) so oldest posts are processed first
        sorted_uris = sorted(
            labels_by_uri.items(),
            key=lambda x: x[1]['epoch'] if x[1]['epoch'] is not None else float('inf')
        )
        
        # Process each labeled post in chronological order
        processed = 0
        for uri, label_info in sorted_uris:
            if self._process_lore_event(uri, label_info):
                processed += 1
        
        print(f"✅ Processed {processed} lore/canon events")
    
    def _process_lore_event(self, uri: str, label_info: Dict) -> bool:
        """Process a single lore event and update history. Returns True if processed."""
        try:
            # Extract author DID from URI: at://did:plc:abc123/app.bsky.feed.post/xyz
            if not uri.startswith('at://'):
                return False
            
            parts = uri.replace('at://', '').split('/')
            if len(parts) < 3:
                return False
            
            author_did = parts[0]
            rkey = parts[2]
            
            # Get post epoch from label_info (already fetched in _update_lore_history)
            post_epoch = label_info.get('epoch')
            if post_epoch is None:
                return False
            
            # Check if author is a registered dreamer
            dreamer = self.main_db.fetch_one(
                'SELECT did, handle, name FROM dreamers WHERE did = %s',
                (author_did,)
            )
            
            if not dreamer:
                return False  # Not a registered dreamer, skip
            
            # Check for existing events for this URI
            has_lore_label = label_info['lore']
            has_canon_label = label_info['canon']
            
            # If post has canon, we only create canon event (not lore)
            if has_canon_label:
                # Check if this URI already has a canon event
                existing_canon = self.main_db.fetch_one(
                    'SELECT id FROM events WHERE uri = %s AND type = %s',
                    (uri, 'canon')
                )
                
                # Remove any existing lore event for this URI (canon supersedes lore)
                existing_lore = self.main_db.fetch_one(
                    'SELECT id FROM events WHERE uri = %s AND type = %s',
                    (uri, 'lore')
                )
                if existing_lore:
                    self.main_db.execute('DELETE FROM events WHERE id = %s', (existing_lore['id'],))
                    print(f"  🗑️  Removed lore event (superseded by canon)")
                
                # Create or skip canon event
                if not existing_canon:
                    handle = dreamer['handle'] or author_did[:20]
                    post_url = f"https://bsky.app/profile/{handle}/post/{rkey}"
                    
                    # Check if this is the user's oldest canon post by epoch
                    import random
                    oldest_canon_result = self.main_db.fetch_one(
                        'SELECT MIN(epoch) as oldest_epoch FROM events WHERE did = %s AND type = %s',
                        (author_did, 'canon')
                    )
                    oldest_epoch = oldest_canon_result['oldest_epoch'] if oldest_canon_result else None
                    
                    # Determine canon text with variance
                    if oldest_epoch is None or post_epoch <= oldest_epoch:
                        # This is their first/oldest canon post
                        canon_text = "played part in the canon"
                    else:
                        varied_canon_texts = [
                            "impacted the canon",
                            "made mark in the canon",
                            "built upon the canon",
                            "helped shape the canon",
                            "developed the canon"
                        ]
                        canon_text = random.choice(varied_canon_texts)
                    
                    self.main_db.execute('''
                        INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, color_source, color_intensity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (author_did, canon_text, 'canon', 'canon', uri, post_url, post_epoch, post_epoch, 'user', 'highlight'))
                    
                    print(f"  ✓ Canon: {dreamer['handle']} - {canon_text}")
                    return True
                
                return False  # Canon already exists
            
            # Only process lore if there's no canon label
            if has_lore_label:
                # Check if this URI already has a lore event
                existing_lore = self.main_db.fetch_one(
                    'SELECT id FROM events WHERE uri = %s AND type = %s',
                    (uri, 'lore')
                )
                
                if not existing_lore:
                    handle = dreamer['handle'] or author_did[:20]
                    post_url = f"https://bsky.app/profile/{handle}/post/{rkey}"
                    
                    # Check if this is the user's oldest lore post by epoch
                    import random
                    oldest_lore_result = self.main_db.fetch_one(
                        'SELECT MIN(epoch) as oldest_epoch FROM events WHERE did = %s AND type = %s',
                        (author_did, 'lore')
                    )
                    oldest_epoch = oldest_lore_result['oldest_epoch'] if oldest_lore_result else None
                    
                    # Determine event text with variance
                    if oldest_epoch is None or post_epoch <= oldest_epoch:
                        # This is their first/oldest lore post
                        event_text = "became part of shared history"
                    else:
                        # Varied texts for subsequent contributions
                        varied_texts = [
                            "added some lore",
                            "acted in our wild mindscape",
                            "told their story's part",
                            "did their part of it",
                            "shared us a dream",
                            "grew our collective tale",
                            "expanded our adventures",
                            "gave fable to us all"
                        ]
                        event_text = random.choice(varied_texts)
                    
                    self.main_db.execute('''
                        INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, color_source, color_intensity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (author_did, event_text, 'lore', 'lore', uri, post_url, post_epoch, post_epoch, 'user', 'highlight'))
                    
                    print(f"  ✓ Lore: {dreamer['handle']} - {event_text}")
                    return True
            
            # Handle label removals
            if not has_lore_label and not has_canon_label:
                # Both labels removed - clean up any events for this URI
                existing_lore = self.main_db.fetch_one(
                    'SELECT id FROM events WHERE uri = %s AND type = %s',
                    (uri, 'lore')
                )
                existing_canon = self.main_db.fetch_one(
                    'SELECT id FROM events WHERE uri = %s AND type = %s',
                    (uri, 'canon')
                )
                
                if existing_lore:
                    self.main_db.execute('DELETE FROM events WHERE id = %s', (existing_lore['id'],))
                    print(f"  🗑️  Removed lore event (label revoked)")
                
                if existing_canon:
                    self.main_db.execute('DELETE FROM events WHERE id = %s', (existing_canon['id'],))
                    print(f"  🗑️  Removed canon event (label revoked)")
                
                return True
            
            return False
                
        except Exception as e:
            print(f"  ❌ Error processing {uri[:60]}...: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_feed_skeleton(self, feed: str, limit: int = 50, cursor: Optional[str] = None) -> Dict[str, Any]:
        """
        Main endpoint for feed generation.
        Called by Bluesky AppView with feed URI.
        
        Note: Label sync is now done asynchronously by feedgen_updater or jetstream_hub.
        We just serve from the database without blocking on external API calls.
        """
        # Extract feed name from URI: at://did:plc:.../app.bsky.feed.generator/{feed_name}
        feed_name = feed.split('/')[-1]
        
        if feed_name not in self.feeds:
            return {'error': 'UnknownFeed'}
        
        # Note: Removed synchronous sync_lore_labels() call here
        # Labels are now synced by feedgen_updater every 2 minutes
        # This prevents blocking requests when lore.farm is slow
        
        if feed_name == 'lore':
            posts, next_cursor = self.feed_db.get_lore_feed(limit, cursor)
        elif feed_name == 'dreaming':
            community_dids = self.get_community_dids()
            posts, next_cursor = self.feed_db.get_community_feed(community_dids, limit, cursor)
        else:
            posts, next_cursor = [], None
        
        result = {'feed': posts}
        if next_cursor:
            result['cursor'] = next_cursor
        
        return result
    
    def describe_feed_generator(self) -> Dict[str, Any]:
        """
        Describe what feeds this generator provides.
        Called by Bluesky to discover available feeds.
        """
        return {
            'did': 'did:web:reverie.house',
            'feeds': [
                {
                    'uri': f'at://did:web:reverie.house/app.bsky.feed.generator/lore',
                    **self.feeds['lore']
                },
                {
                    'uri': f'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
                    **self.feeds['dreaming']
                }
            ]
        }


def main():
    """Test the feed generator"""
    generator = FeedGenerator()
    
    print("🎯 Reverie House Feed Generator")
    print("=" * 60)
    
    # Sync labels
    print("\n📚 Syncing labels from lore.farm...")
    generator.sync_lore_labels(force=True)
    
    # Get community size
    community = generator.get_community_dids()
    print(f"\n👥 Community: {len(community)} dreamers")
    
    # Test Lore feed
    print("\n🔮 Testing Lore feed...")
    result = generator.get_feed_skeleton('at://did:web:reverie.house/app.bsky.feed.generator/lore', limit=10)
    print(f"   Found {len(result.get('feed', []))} lore posts")
    
    # Test Dreaming feed
    print("\n💭 Testing Dreaming feed...")
    result = generator.get_feed_skeleton('at://did:web:reverie.house/app.bsky.feed.generator/dreaming', limit=10)
    print(f"   Found {len(result.get('feed', []))} community posts")
    
    print("\n✅ Feed generator initialized")


if __name__ == '__main__':
    main()
