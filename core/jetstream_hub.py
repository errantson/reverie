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
import os
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
            if 'banner' in profile:
                updates['banner'] = profile['banner']
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
# Kindred Handler - Mutual Follow Detection
# ============================================================================

class KindredHandler(EventHandler):
    """
    Detects mutual follows between tracked dreamers to create kindred relationships.
    
    When a dreamer follows another dreamer:
    1. Check if the follow target is also a dreamer
    2. Check if the target already follows back
    3. If mutual, create a kindred relationship
    
    This replaces the old quest-based add_kindred command.
    """
    
    def __init__(self, verbose: bool = False):
        super().__init__('kindred', verbose)
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        self._load_dreamers()
    
    def _load_dreamers(self):
        """Load tracked dreamers from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("SELECT did, handle, name, server FROM dreamers")
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            self.log(f"📊 Tracking {len(self.tracked_dids)} dreamers for kindred detection")
        except Exception as e:
            print(f"[kindred] ❌ Error loading dreamers: {e}")
            self.tracked_dids = set()
    
    def get_wanted_dids(self) -> Set[str]:
        return self.tracked_dids
    
    def get_wanted_collections(self) -> Set[str]:
        return {'app.bsky.graph.follow'}
    
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Handle follow events to detect mutual follows."""
        self.stats['events_received'] += 1
        
        kind = event.get('kind')
        if kind != 'commit':
            return
        
        commit = event.get('commit', {})
        collection = commit.get('collection', '')
        operation = commit.get('operation', '')
        
        if collection != 'app.bsky.graph.follow':
            return
        
        follower_did = event.get('did', '')
        if follower_did not in self.tracked_dids:
            return
        
        if operation == 'create':
            # Someone we track is following someone
            record = commit.get('record', {})
            subject_did = record.get('subject', '')
            rkey = commit.get('rkey', '')
            
            # Build the AT-URI for this follow record
            follow_uri = f"at://{follower_did}/app.bsky.graph.follow/{rkey}" if rkey else None
            
            # Only care if they're following another dreamer
            if subject_did not in self.tracked_dids:
                return
            
            self.stats['events_processed'] += 1
            
            follower_handle = self.dreamer_by_did.get(follower_did, {}).get('handle', follower_did[:20])
            subject_handle = self.dreamer_by_did.get(subject_did, {}).get('handle', subject_did[:20])
            
            self.log(f"👀 @{follower_handle} followed @{subject_handle}")
            
            # Check for mutual follow in background (pass the follow URI in case this completes a mutual)
            self.executor.submit(self._check_mutual_follow, follower_did, subject_did, follow_uri)
        
        elif operation == 'delete':
            # Someone we track unfollowed someone
            # Re-verify all their kindred relationships
            self.stats['events_processed'] += 1
            follower_handle = self.dreamer_by_did.get(follower_did, {}).get('handle', follower_did[:20])
            self.log(f"👋 @{follower_handle} unfollowed someone - checking kindred...")
            
            # Re-check all kindred relationships for this user
            self.executor.submit(self._verify_user_kindred, follower_did)
    
    def _verify_user_kindred(self, user_did: str):
        """Background: verify all kindred relationships for a user after an unfollow."""
        try:
            from core.database import DatabaseManager
            import requests
            import time
            
            db = DatabaseManager()
            user_handle = self.dreamer_by_did.get(user_did, {}).get('handle', user_did[:20])
            
            # Get all kindred relationships for this user
            cursor = db.execute("""
                SELECT did_a, did_b, paired FROM kindred 
                WHERE (did_a = %s OR did_b = %s) AND paired = 1
            """, (user_did, user_did))
            kindred_rows = cursor.fetchall()
            
            if not kindred_rows:
                return
            
            # Get who this user currently follows
            user_follows: set = set()
            url = "https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows"
            params = {'actor': user_did, 'limit': 100}
            api_cursor = None
            
            for _ in range(10):  # Max 10 pages
                if api_cursor:
                    params['cursor'] = api_cursor
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code != 200:
                    self.log(f"   ⚠️ API error checking follows: {response.status_code}")
                    return
                
                data = response.json()
                for follow in data.get('follows', []):
                    user_follows.add(follow.get('did', ''))
                
                api_cursor = data.get('cursor')
                if not api_cursor:
                    break
            
            # Check each kindred relationship
            for row in kindred_rows:
                other_did = row['did_b'] if row['did_a'] == user_did else row['did_a']
                other_handle = self.dreamer_by_did.get(other_did, {}).get('handle', other_did[:20])
                
                # Check if still mutual
                if other_did not in user_follows:
                    # User no longer follows their kindred - unpair
                    self._unpair_kindred(row['did_a'], row['did_b'], user_handle, other_handle)
                else:
                    # Check if other still follows user
                    other_follows_user = self._check_follows(other_did, user_did)
                    if not other_follows_user:
                        self._unpair_kindred(row['did_a'], row['did_b'], user_handle, other_handle)
                        
        except Exception as e:
            self.log(f"   ❌ Error verifying kindred: {e}")
    
    def _check_follows(self, actor_did: str, target_did: str) -> bool:
        """Check if actor follows target."""
        try:
            import requests
            
            url = "https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows"
            params = {'actor': actor_did, 'limit': 100}
            cursor = None
            
            for _ in range(10):
                if cursor:
                    params['cursor'] = cursor
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code != 200:
                    return False
                
                data = response.json()
                for follow in data.get('follows', []):
                    if follow.get('did') == target_did:
                        return True
                
                cursor = data.get('cursor')
                if not cursor:
                    break
            
            return False
        except:
            return False
    
    def _unpair_kindred(self, did_a: str, did_b: str, unfollower_handle: str, other_handle: str):
        """Mark kindred as unpaired when mutual follow is lost.
        
        Creates a parted event attributed to the unfollower.
        """
        try:
            from core.database import DatabaseManager
            import time
            
            db = DatabaseManager()
            epoch = int(time.time())
            
            # Get unfollower's full info
            unfollower = db.execute(
                "SELECT did, handle, name FROM dreamers WHERE handle = %s", (unfollower_handle,)
            ).fetchone()
            other = db.execute(
                "SELECT did, handle, name FROM dreamers WHERE handle = %s", (other_handle,)
            ).fetchone()
            
            unfollower_did = unfollower['did'] if unfollower else did_a
            unfollower_name = (unfollower['name'] if unfollower and unfollower['name'] else unfollower_handle)
            other_did = other['did'] if other else did_b
            other_name = (other['name'] if other and other['name'] else other_handle)
            
            # Update paired status to 0 (unpaired)
            db.execute("""
                UPDATE kindred SET paired = 0
                WHERE did_a = %s AND did_b = %s
            """, (did_a, did_b))
            
            # Create a "parted" event for the unfollower
            # Profile URL for unfollower
            profile_url = f"https://bsky.app/profile/{unfollower_handle}"
            
            self._create_kindred_event(
                unfollower_did, other_did, unfollower_handle, other_handle, 
                first_name=unfollower_name, second_name=other_name,
                event_type='parted', epoch=epoch,
                uri=None, url=profile_url
            )
            
            self.log(f"   💔 KINDRED PARTED: @{unfollower_handle} ↔ @{other_handle}")
            
        except Exception as e:
            self.log(f"   ❌ Error unparing kindred: {e}")
    
    def _check_mutual_follow(self, follower_did: str, subject_did: str, follow_uri: str = None):
        """Background: check if this creates a mutual follow and create kindred."""
        try:
            import requests
            
            follower_info = self.dreamer_by_did.get(follower_did, {})
            subject_info = self.dreamer_by_did.get(subject_did, {})
            follower_handle = follower_info.get('handle', follower_did[:20])
            follower_name = follower_info.get('name') or follower_handle
            subject_handle = subject_info.get('handle', subject_did[:20])
            subject_name = subject_info.get('name') or subject_handle
            
            # Check if subject follows back the follower
            # Use getFollows API to check if subject follows follower
            url = "https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows"
            params = {
                'actor': subject_did,
                'limit': 100
            }
            
            # Paginate through follows to find if subject follows follower
            cursor = None
            mutual = False
            
            while True:
                if cursor:
                    params['cursor'] = cursor
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code != 200:
                    self.log(f"   ⚠️ API error checking follows: {response.status_code}")
                    return
                
                data = response.json()
                follows = data.get('follows', [])
                
                for follow in follows:
                    if follow.get('did') == follower_did:
                        mutual = True
                        break
                
                if mutual:
                    break
                
                cursor = data.get('cursor')
                if not cursor:
                    break
            
            if mutual:
                # mutual=True means subject was already following follower
                # So: subject followed first, follower completed the mutual (= follower just followed)
                # The follow_uri is from the follower (who just completed it)
                self._create_kindred(
                    first_did=subject_did, 
                    second_did=follower_did, 
                    first_handle=subject_handle, 
                    second_handle=follower_handle,
                    first_name=subject_name,
                    second_name=follower_name,
                    completing_follow_uri=follow_uri
                )
            else:
                self.log(f"   ℹ️ One-way follow: @{follower_handle} → @{subject_handle}")
                
        except Exception as e:
            self.log(f"   ❌ Error checking mutual follow: {e}")
    
    def _create_kindred(self, first_did: str, second_did: str, first_handle: str, second_handle: str,
                        first_name: str = None, second_name: str = None, completing_follow_uri: str = None):
        """Create kindred relationship if it doesn't exist.
        
        Args:
            first_did: DID of the first follower
            second_did: DID of the second follower (who completed the mutual)
            first_handle: Handle of the first follower
            second_handle: Handle of the second follower
            first_name: Display name of the first follower
            second_name: Display name of the second follower  
            completing_follow_uri: AT-URI of the follow record that completed the mutual
        """
        try:
            from core.database import DatabaseManager
            import time
            
            # Use handle as fallback for name
            first_name = first_name or first_handle
            second_name = second_name or second_handle
            
            # Canonical ordering for database (did_a < did_b)
            if first_did < second_did:
                did_a, did_b = first_did, second_did
            else:
                did_a, did_b = second_did, first_did
            
            db = DatabaseManager()
            epoch = int(time.time())
            
            # Check if already exists and paired
            existing = db.execute("""
                SELECT paired FROM kindred WHERE did_a = %s AND did_b = %s
            """, (did_a, did_b)).fetchone()
            
            if existing and existing['paired'] == 1:
                self.log(f"   ✓ Kindred already exists: @{first_handle} ↔ @{second_handle}")
                return
            
            # Insert with paired=1 since we detected mutual follow
            result = db.execute("""
                INSERT INTO kindred (did_a, did_b, discovered_epoch, paired, paired_epoch)
                VALUES (%s, %s, %s, 1, %s)
                ON CONFLICT (did_a, did_b) DO UPDATE SET
                    paired = 1,
                    paired_epoch = EXCLUDED.paired_epoch
                RETURNING (xmax = 0) AS inserted
            """, (did_a, did_b, epoch, epoch))
            
            row = result.fetchone()
            is_new = row and row['inserted']
            
            # Profile URL for first follower (inciting user)
            profile_url = f"https://bsky.app/profile/{first_handle}"
            
            # Create ONE kindred event (first_follower is kindred with second_follower)
            self._create_kindred_event(
                first_did, second_did, first_handle, second_handle, 
                first_name=first_name, second_name=second_name,
                event_type='paired', epoch=epoch,
                uri=completing_follow_uri, url=profile_url
            )
            
            if is_new:
                self.log(f"   🤝 NEW KINDRED: @{first_handle} ↔ @{second_handle}")
            else:
                self.log(f"   🔄 Kindred RE-PAIRED: @{first_handle} ↔ @{second_handle}")
                
        except Exception as e:
            self.log(f"   ❌ Error creating kindred: {e}")
    
    def _create_kindred_event(self, first_did: str, second_did: str, first_handle: str, second_handle: str, 
                               first_name: str = None, second_name: str = None,
                               event_type: str = 'paired', epoch: int = None,
                               uri: str = None, url: str = None):
        """Create a single event record for kindred pairing/parting.
        
        Creates ONE event attributed to first_follower about second_follower.
        
        Args:
            first_name: Display name of first user (for event text)
            second_name: Display name of second user (for event text)
            uri: AT-URI of the completing follow record
            url: Profile URL of the first follower
        """
        try:
            from core.database import DatabaseManager
            import time
            import json
            
            if epoch is None:
                epoch = int(time.time())
            
            # Use handle as fallback for name
            first_name = first_name or first_handle
            second_name = second_name or second_handle
            
            db = DatabaseManager()
            
            # Get colors for both users
            color_a = db.execute(
                "SELECT color_hex FROM dreamers WHERE did = %s", (first_did,)
            ).fetchone()
            color_b = db.execute(
                "SELECT color_hex FROM dreamers WHERE did = %s", (second_did,)
            ).fetchone()
            
            color_hex_a = color_a['color_hex'] if color_a and color_a['color_hex'] else '#888888'
            color_hex_b = color_b['color_hex'] if color_b and color_b['color_hex'] else '#888888'
            
            # Create event text using display names, not handles
            if event_type == 'paired':
                event_text = f"is kindred with {second_name}"
            else:
                event_text = f"parted ways with {second_name}"
            
            # Store both DIDs, handles, names and colors in quantities JSON for gradient rendering
            quantities = json.dumps({
                'kindred_did': second_did,
                'kindred_handle': second_handle,
                'kindred_name': second_name,
                'color_a': color_hex_a,
                'color_b': color_hex_b
            })
            
            # Create ONE event for first_follower (who initiated the kindred)
            db.execute("""
                INSERT INTO events (did, event, type, key, epoch, created_at, uri, url, quantities, color_source, color_intensity)
                VALUES (%s, %s, 'kindred', %s, %s, %s, %s, %s, %s, 'kindred-gradient', 'special')
            """, (first_did, event_text, event_type, epoch, epoch, uri, url, quantities))
            
            self.log(f"   📝 Created kindred event: {first_name} {event_type} {second_name}")
            
        except Exception as e:
            self.log(f"   ⚠️ Error creating kindred event: {e}")
    
    def refresh_dreamers(self):
        """Reload dreamer list (call when community changes)."""
        self._load_dreamers()


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
        
        # Check if reply is DIRECTLY to a quest post (not a nested reply in the thread)
        # We only match on parent_uri, NOT root_uri, to prevent triggering on
        # replies-to-replies within a quest thread (e.g., mapper replying to a user
        # should not trigger the quest again for the mapper)
        parent_uri = reply.get('parent', {}).get('uri', '')
        
        if parent_uri not in self.quest_uris:
            return
        
        quest_uri = parent_uri
        
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
# Feed Handler - Real-time Post Indexing
# ============================================================================

class FeedHandler(EventHandler):
    """
    Indexes posts from community members in real-time for feed generation.
    Replaces: feedgen_updater.py polling (for post indexing)
    
    Benefits:
    - Real-time post indexing (no 2-minute delay)
    - Lower API usage (no polling author feeds)
    - Consistent with other handlers
    """
    
    def __init__(self, verbose: bool = False):
        super().__init__('feed', verbose)
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        self._load_dreamers()
        self._ensure_tables()
    
    def _load_dreamers(self):
        """Load tracked dreamers from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT did, handle, designation, first_post_celebrated 
                FROM dreamers
            """)
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            self.log(f"📊 Tracking {len(self.tracked_dids)} dreamers for feed indexing")
        except Exception as e:
            print(f"[feed] ❌ Error loading dreamers: {e}")
            self.tracked_dids = set()
    
    def _ensure_tables(self):
        """Ensure feed tables exist in PostgreSQL."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            # Create feed_posts table if not exists
            db.execute('''
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
            
            # Create indexes
            db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON feed_posts(author_did)')
            
            self.log("✓ Feed tables ready")
        except Exception as e:
            print(f"[feed] ❌ Error ensuring tables: {e}")
    
    def get_wanted_dids(self) -> Set[str]:
        return self.tracked_dids
    
    def get_wanted_collections(self) -> Set[str]:
        return {'app.bsky.feed.post'}
    
    async def handle_event(self, event: Dict[str, Any]) -> None:
        """Index posts from community members."""
        self.stats['events_received'] += 1
        
        kind = event.get('kind')
        if kind != 'commit':
            return
        
        commit = event.get('commit', {})
        collection = commit.get('collection', '')
        
        if collection != 'app.bsky.feed.post':
            return
        
        did = event.get('did', '')
        if did not in self.tracked_dids:
            return
        
        operation = commit.get('operation', '')
        rkey = commit.get('rkey', '')
        uri = f"at://{did}/{collection}/{rkey}"
        record = commit.get('record', {})
        
        if operation == 'create':
            self.stats['events_processed'] += 1
            
            cid = commit.get('cid', '')
            text = record.get('text', '')
            created_at = record.get('createdAt', '')
            
            handle = self.dreamer_by_did.get(did, {}).get('handle', did[:20])
            self.log(f"📝 New post from @{handle}: {text[:50]}...")
            
            # Index in background
            self.executor.submit(self._index_post, uri, cid, did, text, created_at)
            
        elif operation == 'delete':
            self.log(f"🗑️ Deleted post: {rkey}")
            self.executor.submit(self._delete_post, uri)
    
    def _index_post(self, uri: str, cid: str, did: str, text: str, created_at: str):
        """Background: add post to feed database and trigger celebrations."""
        try:
            from core.database import DatabaseManager
            from datetime import datetime, timezone
            
            db = DatabaseManager()
            indexed_at = datetime.now(timezone.utc)
            
            db.execute('''
                INSERT INTO feed_posts (uri, cid, author_did, text, created_at, indexed_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (uri) DO UPDATE SET
                    cid = EXCLUDED.cid,
                    text = EXCLUDED.text,
                    indexed_at = EXCLUDED.indexed_at
            ''', (uri, cid, did, text, created_at, indexed_at))
            
            # Get dreamer info for celebrations
            dreamer = self.dreamer_by_did.get(did, {})
            handle = dreamer.get('handle', '')
            
            # Trigger celebrations
            self._trigger_celebrations(did, handle, uri, cid, dreamer)
            
        except Exception as e:
            self.log(f"❌ Index error: {e}")
            self.stats['errors'] += 1
    
    def _trigger_celebrations(self, did: str, handle: str, uri: str, cid: str, dreamer: dict):
        """Trigger first_post and any_post celebrations if applicable."""
        try:
            from core.celebration import queue_first_post, queue_any_post, is_resident_or_reverie_handle
            
            # Check first_post (only once per dreamer)
            if not dreamer.get('first_post_celebrated'):
                queue_first_post(did, handle, uri, cid)
                # Update local cache
                dreamer['first_post_celebrated'] = True
                self.log(f"🎉 First post celebration queued for @{handle}")
            
            # Check any_post (residents and .reverie.house handles)
            designation = dreamer.get('designation', '')
            if is_resident_or_reverie_handle(handle, designation):
                queue_any_post(did, handle, uri, cid)
                self.log(f"💖 Any post celebration queued for @{handle}")
                
        except ImportError:
            self.log("⚠️ Celebration module not available")
        except Exception as e:
            self.log(f"❌ Celebration trigger error: {e}")
    
    def _delete_post(self, uri: str):
        """Background: remove post from feed database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            db.execute('DELETE FROM feed_posts WHERE uri = %s', (uri,))
        except Exception as e:
            self.log(f"❌ Delete error: {e}")
            self.stats['errors'] += 1
    
    def refresh_dreamers(self):
        """Reload dreamer list (call when community changes)."""
        self._load_dreamers()


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
        self.last_cursor: Optional[int] = None  # Track most recent cursor for time-based saving
        self.last_cursor_save: datetime = datetime.now()  # Track when we last saved
        
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
    
    def _save_cursor(self, cursor: int, force_log: bool = False):
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
            
            # Get password from env or file
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
                VALUES ('jetstream_hub', %s, %s, NOW())
                ON CONFLICT (service_name) DO UPDATE SET
                    cursor = EXCLUDED.cursor,
                    events_processed = EXCLUDED.events_processed,
                    updated_at = NOW()
            """, (cursor, self.stats['total_events']))
            conn.commit()
            cur.close()
            conn.close()
            if force_log:
                print(f"💾 Saved cursor: {cursor} ({self.stats['total_events']} events)")
        except Exception as e:
            print(f"⚠️ Could not save cursor to database: {e}")
    
    async def _dispatch_event(self, event: Dict[str, Any]):
        """Route event to appropriate handlers."""
        self.stats['total_events'] += 1
        self.stats['last_event_time'] = datetime.now()
        
        # Track last cursor for time-based saving
        time_us = event.get('time_us')
        if time_us:
            self.last_cursor = time_us
        
        # Save cursor every 100 events
        if time_us and self.stats['total_events'] % 100 == 0:
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
    
    async def _periodic_cursor_save(self):
        """Save cursor every 60 seconds to ensure monitoring shows active status."""
        while self.running:
            await asyncio.sleep(60)
            if self.running:
                # Save heartbeat even if no events received
                cursor_to_save = self.last_cursor if self.last_cursor else (self.cursor or 0)
                self._save_cursor(cursor_to_save, force_log=True)
                self.last_cursor_save = datetime.now()
    
    async def run(self):
        """Main run loop with reconnection."""
        print("\n" + "=" * 70)
        print("🌊 JETSTREAM HUB - Unified ATProto Event Consumer")
        print("=" * 70)
        print(f"Handlers: {[h.name for h in self.handlers]}")
        print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70 + "\n")
        
        # Start periodic cursor save task
        cursor_task = asyncio.create_task(self._periodic_cursor_save())
        
        try:
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
        finally:
            cursor_task.cancel()
            try:
                await cursor_task
            except asyncio.CancelledError:
                pass
    
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
    parser.add_argument('--handlers', nargs='+', default=['dreamer', 'quest', 'biblio', 'feed', 'kindred'],
                        choices=['dreamer', 'quest', 'biblio', 'feed', 'kindred'],
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
    
    if 'feed' in args.handlers:
        hub.register(FeedHandler(verbose=args.verbose))
    
    if 'kindred' in args.handlers:
        hub.register(KindredHandler(verbose=args.verbose))
    
    # Handle signals
    def signal_handler(sig, frame):
        print("\n🛑 Shutting down...")
        # Save cursor one last time before exiting
        if hub.cursor:
            hub._save_cursor(hub.cursor)
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
