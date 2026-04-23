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
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.auth import AuthManager
from core.network import NetworkClient

# AppView cache proxy (local)
BSKY_CACHE = 'http://127.0.0.1:2847'


def _parse_iso_to_epoch(value: Optional[str]) -> Optional[int]:
    """Parse an ISO timestamp into epoch seconds."""
    if not value:
        return None
    try:
        return int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp())
    except Exception:
        return None


def _build_record_url(did: str, handle: str, collection: str, rkey: str) -> str:
    """Build a human-view URL for known record collections."""
    if collection == 'app.bsky.feed.post':
        actor = handle or did
        return f"https://bsky.app/profile/{actor}/post/{rkey}"
    if collection == 'ink.branchline.bud':
        return f"https://branchline.ink/bud/{did}/{rkey}"
    return ''



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
    
    def add_post(self, uri: str, cid: str, author_did: str, text: str, created_at: str,
                  is_reply: int = 0, is_repost: int = 0):
        """Add or update a post in the database. Returns True if new post was added."""
        indexed_at = datetime.now(timezone.utc)

        # Check if post already exists
        existing = self.db.fetch_one('SELECT uri FROM feed_posts WHERE uri = %s', (uri,))

        if existing:
            # Still update the reply/repost flags in case they were wrong before
            self.db.execute('''
                UPDATE feed_posts SET is_reply = %s, is_repost = %s WHERE uri = %s
            ''', (is_reply, is_repost, uri))
            return False  # Not a new post

        # Insert new post
        self.db.execute('''
            INSERT INTO feed_posts (uri, cid, author_did, text, created_at, indexed_at, is_reply, is_repost)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (uri) DO UPDATE SET
                cid = EXCLUDED.cid,
                text = EXCLUDED.text,
                indexed_at = EXCLUDED.indexed_at,
                is_reply = EXCLUDED.is_reply,
                is_repost = EXCLUDED.is_repost
        ''', (uri, cid, author_did, text, created_at, indexed_at, is_reply, is_repost))

        return True  # New post added
    
    def update_labels(self, labels: List[Dict]):
        """Update labels from lore.farm — incremental merge instead of full replace"""
        # Track ALL affected URIs (both active and negated)
        active_labels = set()
        negated_uris = set()
        
        for label in labels:
            uri = label.get('uri', '')
            label_val = label.get('val', '')
            created_at = label.get('cts', datetime.now(timezone.utc).isoformat())
            is_neg = label.get('neg', False)
            
            if ':' not in label_val:
                continue
            label_type, domain = label_val.split(':', 1)
            if domain != 'reverie.house' or label_type not in ['lore', 'canon']:
                continue
            
            if is_neg:
                # Remove negated labels
                self.db.execute(
                    'DELETE FROM feed_labels WHERE uri = %s AND label_type = %s',
                    (uri, label_type)
                )
                negated_uris.add(uri)
            else:
                active_labels.add((uri, label_type))
                self.db.execute('''
                    INSERT INTO feed_labels (uri, label_type, created_at)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (uri, label_type) DO NOTHING
                ''', (uri, label_type, created_at))
        
        # Update post flags for ALL affected URIs (active + negated)
        affected_uris = {uri for uri, _ in active_labels} | negated_uris
        if affected_uris:
            uri_list = list(affected_uris)
            placeholders = ','.join(['%s'] * len(uri_list))
            self.db.execute(f'''
                UPDATE feed_posts 
                SET has_lore_label = (
                    SELECT COUNT(*)::INTEGER FROM feed_labels 
                    WHERE feed_labels.uri = feed_posts.uri AND feed_labels.label_type = 'lore'
                ),
                has_canon_label = (
                    SELECT COUNT(*)::INTEGER FROM feed_labels 
                    WHERE feed_labels.uri = feed_posts.uri AND feed_labels.label_type = 'canon'
                )
                WHERE uri IN ({placeholders})
            ''', uri_list)
    
    def full_label_resync(self, labels: List[Dict]):
        """Full resync — clear and rebuild label table. Used for periodic reconciliation."""
        self.db.execute('DELETE FROM feed_labels')
        
        for label in labels:
            if label.get('neg', False):
                continue
            uri = label.get('uri', '')
            label_val = label.get('val', '')
            created_at = label.get('cts', datetime.now(timezone.utc).isoformat())
            
            if ':' in label_val:
                label_type, domain = label_val.split(':', 1)
                if domain == 'reverie.house' and label_type in ['lore', 'canon']:
                    self.db.execute('''
                        INSERT INTO feed_labels (uri, label_type, created_at)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (uri, label_type) DO NOTHING
                    ''', (uri, label_type, created_at))
        
        # Full update of all post flags
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
              AND is_reply = 0
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

    def get_quiet_dids(self, candidate_dids: set) -> set:
        """
        Return the subset of candidate_dids within the posting frequency threshold.

        Threshold is dynamic:
          - 2 posts / 48h if they had any posts in the 3 days prior to the window
          - 4 posts / 48h if they've been silent for those 3 prior days

        Reposts (quote posts) are not counted toward frequency.
        Accounts with NO rows in post_freq are excluded (not yet bootstrapped).
        """
        if not candidate_dids:
            return set()

        ph = ','.join(['%s'] * len(candidate_dids))
        params = list(candidate_dids)

        rows = self.db.fetch_all(f'''
            WITH bootstrapped AS (
                SELECT DISTINCT author_did
                FROM post_freq
                WHERE author_did IN ({ph})
            ),
            recent AS (
                SELECT author_did, SUM(post_count) AS cnt
                FROM post_freq
                WHERE author_did IN ({ph})
                  AND day >= CURRENT_DATE - INTERVAL '1 day'
                GROUP BY author_did
            ),
            prior AS (
                SELECT author_did, SUM(post_count) AS cnt
                FROM post_freq
                WHERE author_did IN ({ph})
                  AND day >= CURRENT_DATE - INTERVAL '4 days'
                  AND day <  CURRENT_DATE - INTERVAL '1 day'
                GROUP BY author_did
            )
            SELECT
                b.author_did,
                COALESCE(r.cnt, 0) AS recent_count,
                COALESCE(p.cnt, 0) AS prior_count
            FROM bootstrapped b
            LEFT JOIN recent r USING (author_did)
            LEFT JOIN prior  p USING (author_did)
        ''', params * 3)

        quiet = set()
        for row in rows:
            threshold = 4 if row['prior_count'] == 0 else 2
            if row['recent_count'] <= threshold:
                quiet.add(row['author_did'])
        return quiet

    def get_quiet_feed_posts(self, quiet_dids: set, limit: int = 30,
                              cursor: Optional[str] = None) -> tuple:
        """Like get_community_feed but filters out replies and reposts."""
        if not quiet_dids:
            return [], None

        placeholders = ','.join(['%s'] * len(quiet_dids))
        query = f'''
            SELECT uri, created_at
            FROM feed_posts
            WHERE author_did IN ({placeholders})
              AND is_reply = 0
              AND is_repost = 0
        '''
        params = list(quiet_dids)

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
        
        # Static feed definitions
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
            },
            'quiet-mindscape': {
                'name': 'Quiet Mindscape',
                'description': 'Quiet posters you follow, of rarer thoughts and fewer words.',
                'avatar': 'https://reverie.house/assets/quiet_mindscape.png'
            }
        }
        
        # Cache community DIDs
        self._community_dids = None
        self._lore_labels = None
        self._last_label_sync = None
        self._last_full_resync = None  # Track full reconciliation  
        self._label_cursor = None  # Cursor for incremental label fetching
        
    def get_community_dids(self, force_refresh: bool = False) -> set:
        """Get all active DIDs from dreamers table (excludes deactivated accounts)"""
        if self._community_dids is None or force_refresh:
            rows = self.main_db.fetch_all(
                'SELECT did FROM dreamers WHERE deactivated IS NOT TRUE'
            )
            self._community_dids = {row['did'] for row in rows}
        return self._community_dids
    
    def refresh_community_dids(self):
        """Force refresh the community DIDs cache"""
        return self.get_community_dids(force_refresh=True)

    # ── Quiet Mindscape feed helpers ───────────────────────────────────────

    def _get_viewer_follows(self, viewer_did: str) -> set:
        """
        Fetch all DIDs that viewer_did follows via bsky-cache.
        Paginates up to 2 000 follows to keep latency bounded.
        Returns a set of DID strings (empty on error).
        """
        follows = set()
        cursor = None
        max_pages = 20  # 100 per page × 20 = 2 000

        for _ in range(max_pages):
            params = {'actor': viewer_did, 'limit': 100}
            if cursor:
                params['cursor'] = cursor
            try:
                resp = requests.get(
                    f'{BSKY_CACHE}/xrpc/app.bsky.graph.getFollows',
                    params=params,
                    timeout=8
                )
                if resp.status_code != 200:
                    break
                data = resp.json()
                for f in data.get('follows', []):
                    did = f.get('did')
                    if did:
                        follows.add(did)
                cursor = data.get('cursor')
                if not cursor:
                    break
            except Exception as e:
                print(f"[quiet-mindscape] ⚠️  getFollows error: {e}")
                break

        return follows

    def _ensure_tracked(self, dids: set):
        """
        Insert any new DIDs into tracked_follows so the PostFreqHandler
        starts receiving their Jetstream events.  Bootstraps historical
        post frequency + posts for newly added DIDs.
        """
        if not dids:
            return
        try:
            # Find which DIDs are genuinely new (not already tracked)
            placeholders = ','.join(['%s'] * len(dids))
            existing = self.main_db.fetch_all(
                f'SELECT did FROM tracked_follows WHERE did IN ({placeholders})',
                list(dids)
            )
            existing_set = {r['did'] for r in existing}
            new_dids = dids - existing_set

            if new_dids:
                insert_placeholders = ','.join(['(%s, NOW())'] * len(new_dids))
                self.main_db.execute(
                    f'INSERT INTO tracked_follows (did, added_at) VALUES {insert_placeholders} ON CONFLICT DO NOTHING',
                    list(new_dids)
                )
                # Bootstrap historical data for new DIDs in background
                # Cap at 200 to avoid overwhelming bsky-cache on first load
                import threading
                to_bootstrap = list(new_dids)[:200]
                threading.Thread(
                    target=self._bootstrap_new_tracked,
                    args=(to_bootstrap,),
                    daemon=True
                ).start()
        except Exception as e:
            print(f"[quiet-mindscape] ⚠️  tracked_follows upsert error: {e}")

    def _bootstrap_new_tracked(self, dids: list):
        """
        Background: seed post_freq and feed_posts for newly tracked DIDs
        by fetching their recent author feed from bsky-cache.

        Runs with max 5 concurrent workers so we don't swamp bsky-cache.
        """
        from concurrent.futures import ThreadPoolExecutor
        from datetime import datetime, timezone, timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

        def bootstrap_one(did: str):
            try:
                resp = requests.get(
                    f'{BSKY_CACHE}/xrpc/app.bsky.feed.getAuthorFeed',
                    params={'actor': did, 'limit': 50, 'filter': 'posts_no_replies'},
                    timeout=10
                )
                if resp.status_code != 200:
                    return
                data = resp.json()

                from core.database import DatabaseManager
                db = DatabaseManager()
                today = datetime.now(timezone.utc).date().isoformat()
                yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()

                for day in (today, yesterday):
                    db.execute('''
                        INSERT INTO post_freq (author_did, day, post_count)
                        VALUES (%s, %s, 0)
                        ON CONFLICT DO NOTHING
                    ''', (did, day))

                indexed_at = datetime.now(timezone.utc)
                for item in data.get('feed', []):
                    post = item.get('post', {})
                    record = post.get('record', {})

                    # Skip replies
                    if record.get('reply'):
                        continue

                    # Detect quote posts — index them but don't count toward frequency
                    embed_type = (record.get('embed') or {}).get('$type', '')
                    is_repost = 1 if embed_type in ('app.bsky.embed.record', 'app.bsky.embed.recordWithMedia') else 0

                    created_str = record.get('createdAt', '')
                    try:
                        created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    except Exception:
                        continue

                    # Only count original posts (not reposts) within 48h
                    if is_repost == 0 and created_dt >= cutoff:
                        post_date = created_dt.date().isoformat()
                        db.execute('''
                            INSERT INTO post_freq (author_did, day, post_count)
                            VALUES (%s, %s, 1)
                            ON CONFLICT (author_did, day) DO UPDATE SET
                                post_count = post_freq.post_count + 1
                        ''', (did, post_date))

                    # Store post regardless of age (for feed queries, up to last 7 days)
                    try:
                        if created_dt >= datetime.now(timezone.utc) - timedelta(days=7):
                            uri = post.get('uri', '')
                            cid = post.get('cid', '')
                            text = record.get('text', '')
                            if uri and cid:
                                db.execute('''
                                    INSERT INTO feed_posts (uri, cid, author_did, text, created_at, indexed_at, is_reply, is_repost)
                                    VALUES (%s, %s, %s, %s, %s, %s, 0, %s)
                                    ON CONFLICT (uri) DO NOTHING
                                ''', (uri, cid, did, text, created_str, indexed_at, is_repost))
                    except Exception:
                        pass

            except Exception as e:
                print(f"[quiet-mindscape] ⚠️  bootstrap failed for {did[:20]}: {e}")

        with ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(bootstrap_one, dids))

    def get_quiet_mindscape_feed(self, viewer_did: str, limit: int = 30,
                                  cursor: Optional[str] = None) -> tuple:
        """
        Return (posts, next_cursor) for the quiet-mindscape feed.

        Logic:
          1. Fetch viewer's follows (up to 2 000) via bsky-cache.
          2. Ensure all follows are in tracked_follows (lazy Jetstream bootstrap).
          3. Filter to accounts that posted ≤ 2 times in the last 48 h.
          4. Return recent non-reply feed_posts for those quiet accounts.
        """
        follows = self._get_viewer_follows(viewer_did)
        if not follows:
            return [], None

        self._ensure_tracked(follows)

        quiet_dids = self.feed_db.get_quiet_dids(follows)
        if not quiet_dids:
            return [], None

        posts, next_cursor = self.feed_db.get_quiet_feed_posts(quiet_dids, limit, cursor)
        return posts, next_cursor

    def sync_lore_labels(self, force: bool = False):
        """Sync indexed records from lore.farm indexer API"""
        now = datetime.now(timezone.utc)
        
        if not force and self._last_label_sync:
            elapsed = (now - self._last_label_sync).total_seconds()
            if elapsed < 300:  # 5 minutes
                return
        
        try:
            # Fetch validated content + canon from indexer API
            content_resp = requests.get(
                'https://lore.farm/api/worlds/reverie.house/content/indexed',
                params={'limit': 500},
                timeout=30
            )
            canon_resp = requests.get(
                'https://lore.farm/api/worlds/reverie.house/canon/indexed',
                timeout=30
            )

            if content_resp.status_code != 200 or canon_resp.status_code != 200:
                print(f"✗ Indexer API error: content={content_resp.status_code}, canon={canon_resp.status_code}")
                return

            content_records = content_resp.json().get('content', [])
            canon_records = canon_resp.json().get('canon', [])

            # Convert to label format for feed_labels table
            labels = []
            for r in content_records:
                if r.get('valid') and not r.get('removed'):
                    labels.append({
                        'uri': r['subjectUri'],
                        'val': 'lore:reverie.house',
                        'cts': r.get('indexedAt', now.isoformat()),
                        'neg': False,
                    })
            for r in canon_records:
                if r.get('valid'):
                    labels.append({
                        'uri': r['subjectUri'],
                        'val': 'canon:reverie.house',
                        'cts': r.get('indexedAt', now.isoformat()),
                        'neg': False,
                    })

            self.feed_db.full_label_resync(labels)
            self._last_label_sync = now
            self._last_full_resync = now
            print(f"✓ Indexer sync: {len(content_records)} content, {len(canon_records)} canon")
            self._update_lore_history(labels)
            
            # Reconcile events table: remove stale lore/canon entries
            # that no longer exist on lore.farm
            valid_uris = set()
            for r in content_records:
                if r.get('valid') and not r.get('removed'):
                    valid_uris.add(r['subjectUri'])
            for r in canon_records:
                if r.get('valid'):
                    valid_uris.add(r['subjectUri'])
            self._reconcile_lore_events(valid_uris)
        except Exception as e:
            print(f"✗ Failed to sync from indexer: {e}")
    
    def _update_lore_history(self, labels: List[Dict]):
        """Update events table with lore contributions"""
        # Filter for reverie.house labels only (exclude negated labels)
        reverie_labels = [
            label for label in labels
            if label.get('val', '').endswith(':reverie.house')
            and not label.get('neg', False)
        ]
        
        if not reverie_labels:
            return
        
        # Group labels by URI to handle lore+canon together, and fetch post timestamps
        import requests
        from datetime import datetime, timezone
        
        labels_by_uri = defaultdict(lambda: {'lore': False, 'canon': False, 'epoch': None})
        
        for label in reverie_labels:
            uri = label.get('uri', '')
            val = label.get('val', '')
            
            # Fetch post timestamp if we haven't already
            if labels_by_uri[uri]['epoch'] is None:
                # Prefer indexer timestamp as baseline (works for non-bsky collections).
                labels_by_uri[uri]['epoch'] = _parse_iso_to_epoch(label.get('cts'))

                try:
                    parts = uri.replace('at://', '').split('/')
                    if len(parts) >= 3:
                        post_response = requests.get(
                            f'{BSKY_CACHE}/xrpc/com.atproto.repo.getRecord',
                            params={
                                'repo': parts[0],
                                'collection': parts[1],
                                'rkey': parts[2]
                            },
                            timeout=10
                        )
                        if post_response.status_code == 200:
                            post_data = post_response.json()
                            created_at = post_data.get('value', {}).get('createdAt')
                            parsed_epoch = _parse_iso_to_epoch(created_at)
                            if parsed_epoch is not None:
                                labels_by_uri[uri]['epoch'] = parsed_epoch
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
        
        if processed > 0:
            print(f"📜 Processed {processed} new lore/canon events from {len(reverie_labels)} labels")
    
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
            collection = parts[1]
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
                
                # Create or skip canon event
                if not existing_canon:
                    handle = dreamer['handle'] or author_did[:20]
                    post_url = _build_record_url(author_did, handle, collection, rkey)
                    
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
                    post_url = _build_record_url(author_did, handle, collection, rkey)
                    
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
                
                if existing_canon:
                    self.main_db.execute('DELETE FROM events WHERE id = %s', (existing_canon['id'],))
                
                return True
            
            return False
                
        except Exception as e:
            print(f"✗ Lore event error: {uri[:60]}: {e}")
            return False

    def _reconcile_lore_events(self, valid_uris: set):
        """Remove events whose source URIs no longer exist on lore.farm."""
        try:
            existing = self.main_db.fetch_all(
                "SELECT id, uri FROM events WHERE type IN ('lore', 'canon')"
            )
            stale = [row for row in existing if row['uri'] not in valid_uris]
            if stale:
                for row in stale:
                    self.main_db.execute('DELETE FROM events WHERE id = %s', (row['id'],))
                print(f"✓ Reconciled events: removed {len(stale)} stale lore/canon entries")
        except Exception as e:
            print(f"✗ Event reconciliation error: {e}")

    def get_feed_skeleton(self, feed: str, limit: int = 50, cursor: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """
        Main endpoint for feed generation.
        Called by Bluesky AppView with feed URI.
        
        Supported feeds:
        - lore: Posts with lore/canon labels from lore.farm
        - dreaming: All posts from community members
        """
        # Extract feed name from URI: at://did:plc:.../app.bsky.feed.generator/{feed_name}
        feed_name = feed.split('/')[-1]
        
        if feed_name not in self.feeds:
            return {'error': 'UnknownFeed'}
        
        if feed_name == 'lore':
            posts, next_cursor = self.feed_db.get_lore_feed(limit, cursor)
        elif feed_name == 'dreaming':
            community_dids = self.get_community_dids()
            posts, next_cursor = self.feed_db.get_community_feed(community_dids, limit, cursor)
        elif feed_name == 'quiet-mindscape':
            viewer_did = kwargs.get('viewer_did')
            if not viewer_did:
                return {'error': 'AuthRequired', 'message': 'This feed requires authentication.'}
            posts, next_cursor = self.get_quiet_mindscape_feed(viewer_did, limit, cursor)
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
        feeds = [
            {
                'uri': f'at://did:web:reverie.house/app.bsky.feed.generator/lore',
                **self.feeds['lore']
            },
            {
                'uri': f'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
                **self.feeds['dreaming']
            },
            {
                # Published from the reverie.house service account (did:plc)
                'uri': 'at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.generator/quiet-mindscape',
                **self.feeds['quiet-mindscape']
            }
        ]
        
        return {
            'did': 'did:web:reverie.house',
            'feeds': feeds
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
