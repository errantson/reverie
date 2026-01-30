#!/usr/bin/env python3
"""
🎉 Celebration Engine v2 - Thoughtful Like Distribution

Reasons (all must have a post URI):
1. quest_complete - 80% of cheerful like quest replies
2. first_post - 50% like dreamer's first post after joining db
3. lore_added - 60% like posts added as lore
4. canon_added - 95% like posts added as canon
5. positivity_wave - 25% like random recent posts (cron every 4hrs)
6. any_post - 0% (1 random worker) likes every post from residents/.reverie.house

Rate limiting is PER USER (target), not per system.
If user daily limit is hit, skip them in worker selection so someone else can do it.

Worker selection: percentage of total cheerful, minimum 1
- 0% = 1 random worker
- Formula: max(1, ceil(total_cheerful * percentage / 100))
"""

import json
import math
import sys
import time
import random
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from core.database import DatabaseManager
from core.encryption import decrypt_password
from core.log import get_logger, set_verbose

log = get_logger('celebration')

# Per-user rate limits
MAX_CHEERS_PER_USER_PER_DAY = 10
MAX_CHEERS_PER_USER_PER_WEEK = 50

# Processing
PROCESS_INTERVAL_SECONDS = 30
LIKE_DELAY_SECONDS = 2


def queue_celebration(
    reason_key: str,
    target_did: str,
    post_uri: str,
    post_cid: Optional[str] = None,
    target_handle: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Optional[int]:
    """
    Queue a celebration for processing.
    
    Args:
        reason_key: One of quest_complete, first_post, lore_added, canon_added, positivity_wave, any_post
        target_did: DID of the dreamer to celebrate
        post_uri: AT URI of the post to like (REQUIRED)
        post_cid: CID of the post (optional)
        target_handle: Handle of the dreamer (optional)
        metadata: Extra context
        
    Returns:
        Queue ID if successful, None if rate limited or error
    """
    if not post_uri:
        log.warning(f"Cannot queue celebration without post_uri")
        return None
    
    try:
        db = DatabaseManager()
        
        # Check if reason is enabled
        cursor = db.execute("""
            SELECT reason_key, enabled FROM cheer_reasons WHERE reason_key = %s
        """, (reason_key,))
        reason = cursor.fetchone()
        
        if not reason or not reason['enabled']:
            log.debug(f"Reason disabled or unknown: {reason_key}")
            return None
        
        # Note: Rate limit check happens during processing, not queueing
        # This allows us to skip rate-limited workers and use others instead
        
        # Insert into queue
        cursor = db.execute("""
            INSERT INTO cheer_queue (reason_key, target_did, target_handle, post_uri, post_cid, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (reason_key, target_did, target_handle, post_uri, post_cid,
              json.dumps(metadata) if metadata else '{}'))
        
        queue_id = cursor.fetchone()['id']
        log.info(f"Queued {reason_key} for @{target_handle or target_did[:20]} (#{queue_id})")
        return queue_id
        
    except Exception as e:
        log.error(f"Failed to queue: {e}")
        return None


def _update_user_rate_limit(db: DatabaseManager, target_did: str):
    """Update rate limit counters after a successful cheer."""
    today = datetime.now().date()
    
    db.execute("""
        INSERT INTO cheer_user_limits (target_did, last_cheered_at, cheers_today, cheers_this_week, week_start)
        VALUES (%s, CURRENT_TIMESTAMP, 1, 1, %s)
        ON CONFLICT (target_did) DO UPDATE SET
            last_cheered_at = CURRENT_TIMESTAMP,
            cheers_today = CASE 
                WHEN cheer_user_limits.last_cheered_at::date < %s THEN 1
                ELSE cheer_user_limits.cheers_today + 1
            END,
            cheers_this_week = CASE
                WHEN (%s - cheer_user_limits.week_start) >= 7 THEN 1
                ELSE cheer_user_limits.cheers_this_week + 1
            END,
            week_start = CASE
                WHEN (%s - cheer_user_limits.week_start) >= 7 THEN %s
                ELSE cheer_user_limits.week_start
            END
    """, (target_did, today, today, today, today, today))


class CelebrationProcessor:
    """Processes the celebration queue."""
    
    def __init__(self, verbose: bool = False):
        set_verbose(log, verbose)
        self.verbose = verbose
        self.running = True
        self.workers: List[Dict] = []
        self.stats = {
            'processed': 0,
            'likes_sent': 0,
            'errors': 0,
            'start_time': datetime.now()
        }
    
    def _load_workers(self) -> int:
        """Load all cheerful workers with credentials from user_roles + user_credentials."""
        try:
            db = DatabaseManager()
            
            # Get cheerful workers directly from user_roles joined with credentials
            # This is the authoritative source - no legacy work.workers JSON needed
            cursor = db.execute("""
                SELECT ur.did, d.handle, uc.app_password_hash, uc.pds_url
                FROM user_roles ur
                JOIN dreamers d ON ur.did = d.did
                JOIN user_credentials uc ON ur.did = uc.did
                WHERE ur.role = 'cheerful' 
                  AND ur.status = 'active'
                  AND uc.app_password_hash IS NOT NULL 
                  AND uc.app_password_hash != ''
            """)
            results = cursor.fetchall()
            
            new_workers = []
            for row in results:
                new_workers.append({
                    'did': row['did'],
                    'handle': row['handle'],
                    'passhash': row['app_password_hash'],
                    'pds_url': row.get('pds_url'),
                    'client': None
                })
            
            self.workers = new_workers
            return len(self.workers)
            
        except Exception as e:
            log.error(f"Loading workers: {e}")
            return 0
    
    def _get_client(self, worker: Dict) -> Optional[Client]:
        """Get authenticated client for worker."""
        if worker.get('client'):
            return worker['client']
        
        try:
            password = decrypt_password(worker['passhash'])
            if not password:
                return None
            
            pds_url = worker.get('pds_url')
            if 'reverie.house' in (pds_url or ''):
                pds_url = 'https://reverie.house'
            elif not pds_url:
                pds_url = 'https://bsky.social'
            
            client = Client(base_url=pds_url)
            client.login(worker['handle'], password)
            worker['client'] = client
            return client
            
        except Exception as e:
            log.warning(f"Auth failed for {worker['handle']}: {e}")
            return None
    
    def _select_workers(self, cheerful_percent: int, target_did: str) -> List[Dict]:
        """
        Select workers based on percentage, skipping rate-limited ones.
        Formula: max(1, ceil(total * percent / 100))
        
        If a worker is rate-limited for this target, skip them and try another.
        Also skips the target user themselves (no self-liking).
        """
        total = len(self.workers)
        if total == 0:
            return []
        
        # Calculate count: minimum 1 (0% means 1 random), otherwise ceil(total * percent / 100)
        if cheerful_percent == 0:
            count = 1
        else:
            count = max(1, math.ceil(total * cheerful_percent / 100))
        count = min(count, total)  # Can't exceed total
        
        # Get rate-limited worker DIDs for this target
        db = DatabaseManager()
        rate_limited = self._get_rate_limited_workers(db, target_did)
        
        # Filter out rate-limited workers AND the target themselves (no self-liking)
        available = [w for w in self.workers if w['did'] not in rate_limited and w['did'] != target_did]
        
        if not available:
            log.debug(f"All workers rate-limited or target is self for {target_did[:20]}")
            return []
        
        # Select from available workers
        return random.sample(available, min(count, len(available)))
    
    def _get_rate_limited_workers(self, db: DatabaseManager, target_did: str) -> Set[str]:
        """Get set of worker DIDs that have hit their daily limit for this target."""
        today = datetime.now().date()
        
        # Count how many times each worker has cheered this target today
        cursor = db.execute("""
            SELECT cheerful_did, COUNT(*) as count
            FROM cheer_log
            WHERE target_did = %s
              AND success = TRUE
              AND liked_at::date = %s
            GROUP BY cheerful_did
            HAVING COUNT(*) >= %s
        """, (target_did, today, MAX_CHEERS_PER_USER_PER_DAY))
        
        return {row['cheerful_did'] for row in cursor.fetchall()}
    
    def _perform_like(self, worker: Dict, post_uri: str, post_cid: str,
                      reason_key: str, target_did: str, target_handle: str) -> bool:
        """Perform the like and record it."""
        try:
            client = self._get_client(worker)
            if not client:
                return False
            
            # Need CID to like - fetch if missing
            if not post_cid:
                post_cid = self._fetch_post_cid(post_uri)
                if not post_cid:
                    log.warning(f"Could not get CID for {post_uri}")
                    return False
            
            client.like(uri=post_uri, cid=post_cid)
            
            # Record to log
            db = DatabaseManager()
            db.execute("""
                INSERT INTO cheer_log 
                (reason_key, target_did, target_handle, post_uri, cheerful_did, cheerful_handle, success)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (reason_key, target_did, target_handle, post_uri, worker['did'], worker['handle'], True))
            
            self.stats['likes_sent'] += 1
            log.info(f"💖 @{worker['handle']} → @{target_handle or target_did[:15]} ({reason_key})")
            return True
            
        except Exception as e:
            # Record failure
            try:
                db = DatabaseManager()
                db.execute("""
                    INSERT INTO cheer_log 
                    (reason_key, target_did, target_handle, post_uri, cheerful_did, cheerful_handle, success, error_message)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (reason_key, target_did, target_handle, post_uri, worker['did'], worker['handle'], False, str(e)[:200]))
            except:
                pass
            
            self.stats['errors'] += 1
            log.warning(f"Like failed: {e}")
            return False
    
    def _fetch_post_cid(self, post_uri: str) -> Optional[str]:
        """Fetch post CID from public API."""
        try:
            resp = requests.get(
                'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread',
                params={'uri': post_uri, 'depth': 0},
                timeout=10
            )
            if resp.status_code == 200:
                return resp.json().get('thread', {}).get('post', {}).get('cid')
            return None
        except:
            return None
    
    def _process_queue_item(self, item: Dict) -> bool:
        """Process a single queue item."""
        db = DatabaseManager()
        
        try:
            # For any_post reason, 30% chance we skip entirely (adds natural variability)
            if item['reason_key'] == 'any_post' and random.random() < 0.30:
                log.debug(f"Skipping any_post for {item.get('target_handle', item['target_did'][:15])} (30% skip)")
                return True  # Return True so it's marked as processed, not retried
            
            # Get reason config
            cursor = db.execute("""
                SELECT cheerful_percent FROM cheer_reasons WHERE reason_key = %s
            """, (item['reason_key'],))
            reason = cursor.fetchone()
            
            if not reason:
                return False
            
            # Select workers (passes target_did for rate limit filtering, excludes self-liking)
            workers = self._select_workers(reason['cheerful_percent'], item['target_did'])
            if not workers:
                log.debug(f"No available workers for {item.get('target_handle', item['target_did'][:15])}")
                return True  # No workers available (all rate-limited or self) - mark as done, don't retry
            
            # Perform likes
            success_count = 0
            for worker in workers:
                if self._perform_like(
                    worker, item['post_uri'], item.get('post_cid'),
                    item['reason_key'], item['target_did'],
                    item.get('target_handle') or ''
                ):
                    success_count += 1
                    time.sleep(LIKE_DELAY_SECONDS)
            
            # Update user rate limits if any likes succeeded
            if success_count > 0:
                _update_user_rate_limit(db, item['target_did'])
            
            return success_count > 0
            
        except Exception as e:
            log.error(f"Processing item: {e}")
            return False
    
    def _process_queue(self):
        """Process pending queue items."""
        total_workers = self._load_workers()
        
        if total_workers == 0:
            return
        
        db = DatabaseManager()
        
        # Get pending items
        cursor = db.execute("""
            SELECT * FROM cheer_queue
            WHERE status = 'pending'
            ORDER BY queued_at ASC
            LIMIT 5
        """)
        items = cursor.fetchall()
        
        if not items:
            return
        
        log.debug(f"Processing {len(items)} items with {total_workers} workers")
        
        for item in items:
            # Mark as processing
            db.execute("UPDATE cheer_queue SET status = 'processing' WHERE id = %s", (item['id'],))
            
            success = self._process_queue_item(dict(item))
            
            # Update status
            new_status = 'completed' if success else 'failed'
            db.execute("""
                UPDATE cheer_queue 
                SET status = %s, processed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (new_status, item['id']))
            
            self.stats['processed'] += 1
    
    def run(self):
        """Main loop."""
        log.info(f"🎉 Celebration Engine v2 started")
        log.info(f"   Per-user limits: {MAX_CHEERS_PER_USER_PER_DAY}/day, {MAX_CHEERS_PER_USER_PER_WEEK}/week")
        
        while self.running:
            try:
                self._process_queue()
                time.sleep(PROCESS_INTERVAL_SECONDS)
            except KeyboardInterrupt:
                log.info(f"Stopped - {self.stats}")
                break
            except Exception as e:
                log.error(f"Main loop: {e}")
                time.sleep(PROCESS_INTERVAL_SECONDS)


# ============================================================================
# POSITIVITY WAVE - Random community boost trigger
# ============================================================================

def trigger_positivity_wave(count: int = 3, max_age_hours: int = 24):
    """
    Trigger a positivity wave - randomly like recent community posts.
    
    Args:
        count: Number of posts to boost (small-medium: 2-5)
        max_age_hours: Only consider posts from last N hours
    """
    log.info(f"🌊 Triggering positivity wave (count={count})")
    
    db = DatabaseManager()
    
    # Get random community members who haven't been cheered recently
    cursor = db.execute("""
        SELECT d.did, d.handle
        FROM dreamers d
        WHERE d.did IS NOT NULL
        AND d.deactivated = false
        AND d.did NOT IN (
            SELECT target_did FROM cheer_queue 
            WHERE reason_key = 'positivity_wave'
            AND queued_at > NOW() - INTERVAL '48 hours'
        )
        ORDER BY RANDOM()
        LIMIT %s
    """, (count * 3,))  # Get more candidates than needed
    
    candidates = cursor.fetchall()
    
    if not candidates:
        log.info("No candidates for wave")
        return 0
    
    queued = 0
    for dreamer in candidates:
        if queued >= count:
            break
        
        # Find a recent post
        try:
            resp = requests.get(
                'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed',
                params={'actor': dreamer['did'], 'limit': 5, 'filter': 'posts_no_replies'},
                timeout=10
            )
            if resp.status_code != 200:
                continue
            
            feed = resp.json().get('feed', [])
            if not feed:
                continue
            
            # Find a post within the time window
            for item in feed:
                post = item.get('post', {})
                post_uri = post.get('uri')
                post_cid = post.get('cid')
                created_at = post.get('record', {}).get('createdAt', '')
                
                if not post_uri or not created_at:
                    continue
                
                # Check recency
                try:
                    post_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    age_hours = (datetime.now(post_time.tzinfo) - post_time).total_seconds() / 3600
                    if age_hours > max_age_hours:
                        continue
                except:
                    continue
                
                # Queue it
                queue_id = queue_celebration(
                    reason_key='positivity_wave',
                    target_did=dreamer['did'],
                    target_handle=dreamer['handle'],
                    post_uri=post_uri,
                    post_cid=post_cid,
                    metadata={'wave_triggered': True}
                )
                
                if queue_id:
                    queued += 1
                    log.info(f"  Wave: @{dreamer['handle']} ({age_hours:.1f}h old)")
                break
                
        except Exception as e:
            log.warning(f"Wave candidate {dreamer['handle']}: {e}")
            continue
    
    log.info(f"✓ Positivity wave queued {queued} posts")
    return queued


# ============================================================================
# FIRST POST - Dreamer's first post after being added to db
# ============================================================================

def queue_first_post(target_did: str, target_handle: str, post_uri: str, post_cid: str = None):
    """
    Queue celebration for a dreamer's first post after joining.
    Called from jetstream_hub when a new post is detected from a dreamer.
    
    Only triggers ONCE per dreamer (checks first_post_celebrated flag).
    """
    try:
        db = DatabaseManager()
        
        # Check if already celebrated
        cursor = db.execute("""
            SELECT first_post_celebrated FROM dreamers WHERE did = %s
        """, (target_did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return None
        
        if dreamer.get('first_post_celebrated'):
            return None  # Already celebrated
        
        # Mark as celebrated and record the post
        db.execute("""
            UPDATE dreamers 
            SET first_post_celebrated = TRUE,
                first_post_uri = %s,
                first_post_at = EXTRACT(EPOCH FROM NOW())::INTEGER
            WHERE did = %s
        """, (post_uri, target_did))
        
        # Queue the celebration
        return queue_celebration(
            reason_key='first_post',
            target_did=target_did,
            target_handle=target_handle,
            post_uri=post_uri,
            post_cid=post_cid,
            metadata={'first_post': True}
        )
        
    except Exception as e:
        log.error(f"First post queue error: {e}")
        return None


# ============================================================================
# LORE/CANON ADDED - When posts are labeled as lore or canon
# ============================================================================

def queue_lore_added(target_did: str, target_handle: str, post_uri: str, post_cid: str = None,
                     lore_type: str = None):
    """Queue celebration for a post added as lore."""
    return queue_celebration(
        reason_key='lore_added',
        target_did=target_did,
        target_handle=target_handle,
        post_uri=post_uri,
        post_cid=post_cid,
        metadata={'lore_type': lore_type}
    )


def queue_canon_added(target_did: str, target_handle: str, post_uri: str, post_cid: str = None,
                      canon_id: str = None):
    """Queue celebration for a post added as canon."""
    return queue_celebration(
        reason_key='canon_added',
        target_did=target_did,
        target_handle=target_handle,
        post_uri=post_uri,
        post_cid=post_cid,
        metadata={'canon_id': canon_id}
    )


# ============================================================================
# ANY POST - Residents and .reverie.house handles
# ============================================================================

def queue_any_post(target_did: str, target_handle: str, post_uri: str, post_cid: str = None):
    """
    Queue celebration for any post from a resident or .reverie.house handle.
    Only 1 random cheerful worker will like it (0% = 1 worker).
    
    Called from jetstream_hub for every post from qualifying users.
    """
    return queue_celebration(
        reason_key='any_post',
        target_did=target_did,
        target_handle=target_handle,
        post_uri=post_uri,
        post_cid=post_cid,
        metadata={'any_post': True}
    )


def is_resident_or_reverie_handle(handle: str, designation: str = None) -> bool:
    """Check if user qualifies for any_post celebrations."""
    if handle and handle.endswith('.reverie.house'):
        return True
    if designation and designation.lower() == 'resident':
        return True
    return False


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('-v', '--verbose', action='store_true')
    parser.add_argument('--wave', type=int, nargs='?', const=3, 
                       help='Trigger positivity wave (default: 3 posts)')
    args = parser.parse_args()
    
    if args.wave:
        trigger_positivity_wave(count=args.wave)
    else:
        CelebrationProcessor(verbose=args.verbose).run()
