#!/usr/bin/env python3
"""
Feed Generator Updater - Scheduled Feed Refresh

Polls community member timelines every minute to refresh feed contents.
This is more reliable than a continuous firehose and prevents ConsumerTooSlow errors.

Architecture:
- Runs on a loop, checking every 60 seconds
- Fetches latest posts from each community member via getAuthorFeed
- Updates feed_posts table with new posts (PostgreSQL)
- Syncs lore.farm labels
- Cleans up old posts (7+ days)

This replaces the unreliable firehose_indexer with scheduled polling.
"""

import sys
import time
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Set, List, Dict, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from core.feedgen import FeedGenerator, FeedDatabase
from core.database import DatabaseManager


class FeedUpdater:
    """Scheduled feed content updater"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.feed_db = FeedDatabase()
        self.main_db = DatabaseManager()
        self.generator = FeedGenerator()
        
        # AT Protocol client for fetching posts
        self.client = Client(base_url='http://127.0.0.1:2847')
        
        # Get community DIDs (will be refreshed each cycle)
        self.community_dids = self.generator.get_community_dids(force_refresh=True)
        
        # Stats
        self.stats = {
            'cycles': 0,
            'posts_added': 0,
            'posts_updated': 0,
            'errors': 0,
            'start_time': datetime.now()
        }

        # Round-robin offset for post_freq polling
        self._postfreq_offset = 0
        
        self.log(f"🔄 Feed Updater initialized", force=True)
        self.log(f"   Community: {len(self.community_dids)} dreamers", force=True)
    
    def log(self, message: str, force: bool = False):
        """Log with timestamp"""
        if self.verbose or force:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {message}")
    
    def run(self):
        """Main run loop - update feeds every minute"""
        self.log("✅ Feed updater running. Refreshing every minute...", force=True)
        self.log("   Press Ctrl+C to stop", force=True)
        
        try:
            while True:
                cycle_start = time.time()
                self.stats['cycles'] += 1
                
                self.log(f"\n🔄 Update cycle #{self.stats['cycles']} starting", force=True)
                
                # 1. Sync labels from lore.farm (every 5 cycles = ~5 min)
                # Lore feed now proxies to lore.farm directly; this sync is
                # only needed for the events/history system on reverie.house.
                if self.stats['cycles'] % 5 == 1:
                    self.sync_labels()
                
                # 2. Fetch recent posts from community members
                self.update_community_posts()

                # 3. Refresh post_freq for tracked quiet-mindscape follows (every cycle)
                self.update_post_freq(batch_size=200)

                # 4. Clean up old posts (every 10 cycles = ~20 minutes)
                if self.stats['cycles'] % 10 == 0:
                    self.cleanup_old_posts()
                
                cycle_time = time.time() - cycle_start
                self.log(f"✅ Cycle complete in {cycle_time:.1f}s", force=True)
                self.print_stats()
                
                # Wait until next cycle (1 minute total)
                sleep_time = max(0, 60 - cycle_time)
                if sleep_time > 0:
                    self.log(f"⏸️  Sleeping {sleep_time:.0f}s until next cycle...")
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            self.log("\n🛑 Feed updater shutting down...", force=True)
            self.print_final_stats()
    
    def sync_labels(self):
        """Sync labels from lore.farm and fetch any missing labeled posts"""
        try:
            self.log("📚 Syncing labels from lore.farm...")
            self.generator.sync_lore_labels(force=True)
            self.log("   ✓ Labels synced")
            
            # Fetch any labeled posts that aren't in our database yet
            num_fetched = self.fetch_labeled_posts()
            
            # If we fetched new posts, update the label flags again
            if num_fetched > 0:
                self.generator.sync_lore_labels(force=True)
            
        except Exception as e:
            self.log(f"   ✗ Label sync failed: {e}", force=True)
            self.stats['errors'] += 1
    
    def fetch_labeled_posts(self):
        """Fetch posts that have labels but aren't in our database
        
        Returns:
            int: Number of posts fetched
        """
        try:
            # Get list of labeled URIs that don't exist in posts table
            result = self.feed_db.db.fetch_all('''
                SELECT DISTINCT l.uri 
                FROM feed_labels l 
                LEFT JOIN feed_posts p ON l.uri = p.uri 
                WHERE p.uri IS NULL
            ''')
            missing_uris = [row['uri'] for row in result]
            
            if not missing_uris:
                return 0
            
            self.log(f"   📥 Fetching {len(missing_uris)} labeled posts...")
            
            fetched = 0
            for uri in missing_uris:
                try:
                    # Fetch the post from AT Protocol
                    response = self.client.app.bsky.feed.get_posts({'uris': [uri]})
                    
                    if not response or not hasattr(response, 'posts') or not response.posts:
                        continue
                    
                    post = response.posts[0]
                    
                    # Extract post data
                    cid = post.cid
                    author_did = post.author.did
                    text = post.record.text if hasattr(post.record, 'text') else ''
                    created_at = post.record.created_at if hasattr(post.record, 'created_at') else ''
                    is_reply = 1 if hasattr(post.record, 'reply') and post.record.reply else 0
                    embed = getattr(post.record, 'embed', None)
                    embed_type = getattr(embed, 'py_type', '') if embed else ''
                    is_repost = 1 if embed_type in (
                        'app.bsky.embed.record', 'app.bsky.embed.recordWithMedia',
                    ) else 0

                    # Add to database
                    if self.feed_db.add_post(uri, cid, author_did, text, created_at, is_reply, is_repost):
                        fetched += 1
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.05)
                    
                except Exception as e:
                    if self.verbose:
                        self.log(f"   ✗ Could not fetch labeled post {uri}: {e}")
            
            if fetched > 0:
                self.log(f"   ✓ Fetched {fetched} labeled posts")
            
            return fetched
                
        except Exception as e:
            self.log(f"   ✗ Error fetching labeled posts: {e}", force=True)
            return 0
    
    def update_community_posts(self):
        """Fetch latest posts from all community members"""
        # Refresh community DIDs each cycle to pick up new members/deactivations
        self.community_dids = self.generator.get_community_dids(force_refresh=True)
        
        self.log(f"👥 Updating posts from {len(self.community_dids)} community members...")
        
        posts_this_cycle = 0
        errors_this_cycle = 0
        
        # Get handles for community members from database
        dreamer_rows = self.main_db.fetch_all("SELECT did, handle FROM dreamers WHERE deactivated IS NOT TRUE")
        dreamer_map = {row['did']: row['handle'] for row in dreamer_rows}
        
        for idx, did in enumerate(self.community_dids, 1):
            handle = dreamer_map.get(did, 'unknown')
            
            if self.verbose and idx % 10 == 0:
                self.log(f"   Processing {idx}/{len(self.community_dids)}...")
            
            try:
                # Fetch author's recent posts (limit 25 = last ~2-3 days)
                response = self.client.app.bsky.feed.get_author_feed({
                    'actor': did,
                    'limit': 25
                })
                
                if not hasattr(response, 'feed'):
                    continue
                
                # Process each post
                for feed_item in response.feed:
                    if not hasattr(feed_item, 'post'):
                        continue

                    post = feed_item.post

                    # Extract post data
                    uri = post.uri
                    cid = post.cid
                    text = post.record.text if hasattr(post.record, 'text') else ''
                    created_at = post.record.created_at if hasattr(post.record, 'created_at') else ''

                    # Detect reply and repost flags
                    is_reply = 1 if hasattr(post.record, 'reply') and post.record.reply else 0
                    embed = getattr(post.record, 'embed', None)
                    embed_type = getattr(embed, 'py_type', '') if embed else ''
                    is_repost = 1 if embed_type in (
                        'app.bsky.embed.record',
                        'app.bsky.embed.recordWithMedia',
                    ) else 0

                    # Add to database (returns True if new post)
                    if self.feed_db.add_post(uri, cid, did, text, created_at, is_reply, is_repost):
                        posts_this_cycle += 1
                
                # Small delay to avoid rate limiting
                time.sleep(0.1)
                
            except Exception as e:
                if self.verbose:
                    self.log(f"   ✗ Error fetching posts for @{handle}: {e}")
                errors_this_cycle += 1
                self.stats['errors'] += 1
        
        self.stats['posts_added'] += posts_this_cycle
        self.log(f"   ✓ Processed {posts_this_cycle} posts ({errors_this_cycle} errors)")
    
    def update_post_freq(self, batch_size: int = 200):
        """
        Poll a batch of tracked_follows DIDs and refresh their post_freq and feed_posts entries.

        Replaces the Jetstream PostFreqHandler, which couldn't scale beyond ~200 DIDs
        in the URL without hitting WebSocket HTTP 400 errors.

        Processes DIDs round-robin so full coverage happens every (total/batch_size) cycles.
        """
        import requests as req
        from datetime import date, timedelta

        BSKY_CACHE = 'http://127.0.0.1:2847'

        try:
            rows = self.main_db.fetch_all("SELECT did FROM tracked_follows ORDER BY added_at")
            all_dids = [r['did'] for r in rows]
        except Exception as e:
            self.log(f"   ✗ post_freq: could not load tracked_follows: {e}", force=True)
            return

        if not all_dids:
            return

        total = len(all_dids)
        batch = all_dids[self._postfreq_offset:self._postfreq_offset + batch_size]
        self._postfreq_offset = (self._postfreq_offset + batch_size) % total

        self.log(f"📊 Refreshing post_freq for {len(batch)}/{total} tracked follows (offset {self._postfreq_offset})...")

        now = datetime.now(timezone.utc)
        cutoff_48h = now - timedelta(hours=48)
        cutoff_7d  = now - timedelta(days=7)
        indexed_at = now

        EMBED_REPOST = {'app.bsky.embed.record', 'app.bsky.embed.recordWithMedia'}

        processed = 0
        errors = 0

        for did in batch:
            try:
                resp = req.get(
                    f'{BSKY_CACHE}/xrpc/app.bsky.feed.getAuthorFeed',
                    params={'actor': did, 'limit': 50, 'filter': 'posts_no_replies'},
                    timeout=8,
                )
                if resp.status_code != 200:
                    continue

                items = resp.json().get('feed', [])

                # Tally non-repost originals per day for the 48h window
                counts: dict[str, int] = {}
                for item in items:
                    post   = item.get('post', {})
                    record = post.get('record', {})

                    if record.get('reply'):
                        continue  # replies filtered by posts_no_replies but double-check

                    embed_type = (record.get('embed') or {}).get('$type', '')
                    is_repost  = 1 if embed_type in EMBED_REPOST else 0

                    created_str = record.get('createdAt', '')
                    try:
                        created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    except Exception:
                        continue

                    # Post freq: count originals within 48h
                    if is_repost == 0 and created_dt >= cutoff_48h:
                        day_str = created_dt.date().isoformat()
                        counts[day_str] = counts.get(day_str, 0) + 1

                    # Keep feed_posts up to date (last 7 days)
                    if created_dt >= cutoff_7d:
                        uri = post.get('uri', '')
                        cid = post.get('cid', '')
                        text = record.get('text', '')
                        if uri and cid:
                            try:
                                self.feed_db.db.execute('''
                                    INSERT INTO feed_posts
                                        (uri, cid, author_did, text, created_at, indexed_at, is_reply, is_repost)
                                    VALUES (%s, %s, %s, %s, %s, %s, 0, %s)
                                    ON CONFLICT (uri) DO UPDATE SET
                                        cid       = EXCLUDED.cid,
                                        text      = EXCLUDED.text,
                                        indexed_at = EXCLUDED.indexed_at,
                                        is_repost  = EXCLUDED.is_repost
                                ''', (uri, cid, did, text, created_str, indexed_at, is_repost))
                            except Exception:
                                pass

                # Ensure bootstrap rows exist for today + yesterday
                today     = date.today().isoformat()
                yesterday = (date.today() - timedelta(days=1)).isoformat()
                for day in (today, yesterday):
                    self.main_db.execute('''
                        INSERT INTO post_freq (author_did, day, post_count)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (author_did, day) DO UPDATE SET
                            post_count = EXCLUDED.post_count
                    ''', (did, day, counts.get(day, 0)))

                processed += 1

            except Exception as e:
                errors += 1
                if self.verbose:
                    self.log(f"   ✗ post_freq error for {did[:20]}: {e}")

        self.log(f"   ✓ post_freq: {processed} updated, {errors} errors")

    def cleanup_old_posts(self, days: int = 30):
        """Remove posts that haven't been re-indexed in N days"""
        self.log(f"🧹 Cleaning up posts not seen in {days} days...")
        try:
            deleted = self.feed_db.cleanup_old_posts(days)
            self.log(f"   ✓ Cleanup complete ({deleted} old posts removed)")
        except Exception as e:
            self.log(f"   ✗ Cleanup failed: {e}", force=True)
            self.stats['errors'] += 1
    
    def print_stats(self):
        """Print current stats"""
        if not self.verbose:
            return
        
        elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
        uptime_mins = int(elapsed / 60)
        
        self.log(f"📊 Stats: {self.stats['cycles']} cycles | "
                f"{self.stats['posts_added']} posts | "
                f"{self.stats['errors']} errors | "
                f"Uptime: {uptime_mins}m")
    
    def print_final_stats(self):
        """Print final stats on shutdown"""
        elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
        uptime = f"{int(elapsed/3600)}h {int((elapsed%3600)/60)}m"
        
        print("\n📊 FINAL STATS")
        print("=" * 60)
        print(f"Uptime: {uptime}")
        print(f"Update cycles: {self.stats['cycles']}")
        print(f"Posts processed: {self.stats['posts_added']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"Community size: {len(self.community_dids)} dreamers")
        print("=" * 60)


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Feed Generator Updater')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    parser.add_argument('--once', action='store_true', help='Run once then exit')
    
    args = parser.parse_args()
    
    print("🔄 Reverie House Feed Updater")
    print("=" * 60)
    
    updater = FeedUpdater(verbose=args.verbose)
    
    if args.once:
        # Single run mode for testing
        print("\n🧪 Running single update cycle...")
        updater.sync_labels()
        updater.update_community_posts()
        updater.cleanup_old_posts()
        print("✅ Single cycle complete")
        updater.print_final_stats()
    else:
        # Continuous mode
        updater.run()


if __name__ == '__main__':
    main()
