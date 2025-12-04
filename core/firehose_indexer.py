#!/usr/bin/env python3
"""
Firehose Indexer for Feed Generator

Subscribes to the AT Protocol firehose and indexes posts from Reverie House community members.
This runs continuously and stores posts in the feed database.
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message
from core.feedgen import FeedGenerator, FeedDatabase
from core.database import DatabaseManager


class FirehoseIndexer:
    """Subscribes to Bluesky firehose and indexes community posts"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.feed_db = FeedDatabase()
        self.main_db = DatabaseManager()
        self.generator = FeedGenerator()
        
        # Get community DIDs to filter
        self.community_dids = self.generator.get_community_dids()
        
        # Stats
        self.stats = {
            'total_events': 0,
            'posts_indexed': 0,
            'start_time': datetime.now()
        }
        
        if self.verbose:
            print(f"📡 Firehose Indexer initialized")
            print(f"   Watching {len(self.community_dids)} community DIDs")
            print(f"   Sample DIDs: {list(self.community_dids)[:3]}")
    
    def on_message_handler(self, message) -> None:
        """Process each firehose message"""
        self.stats['total_events'] += 1
        
        # Progress logging every 5000 events
        if self.stats['total_events'] % 5000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"📡 Indexer: {self.stats['total_events']} events "
                  f"({rate:.0f}/sec) | "
                  f"Indexed: {self.stats['posts_indexed']}")
        
        commit = parse_subscribe_repos_message(message)
        
        # Only care about commits
        if type(commit).__name__ != 'Commit':
            return
        
        if not hasattr(commit, 'repo') or not commit.ops:
            return
        
        repo_did = commit.repo
        
        # Only index posts from community members
        if repo_did not in self.community_dids:
            return
        
        # We found a community member posting!
        if self.verbose:
            print(f"   🎯 Community member activity: {repo_did[:30]}...")
        
        # Process each operation in the commit
        for op in commit.ops:
            if op.path.startswith('app.bsky.feed.post/') and op.action == 'create':
                self._index_post(repo_did, op, commit)
    
    def _index_post(self, repo_did: str, op, commit):
        """Index a post from a community member"""
        try:
            # Extract post data from CAR file
            if not op.cid:
                return
            
            car_data = CAR.from_bytes(commit.blocks)
            post_record = car_data.blocks.get(op.cid)
            
            if not post_record:
                return
            
            # Parse post record
            if isinstance(post_record, dict):
                post_data = post_record
            elif isinstance(post_record, (str, bytes)):
                try:
                    if isinstance(post_record, bytes):
                        post_record = post_record.decode('utf-8')
                    post_data = json.loads(post_record)
                except:
                    return
            else:
                return
            
            text = post_data.get('text', '')
            created_at = post_data.get('createdAt', datetime.now(timezone.utc).isoformat())
            
            # Build post URI
            rkey = op.path.split('/')[-1]
            uri = f"at://{repo_did}/app.bsky.feed.post/{rkey}"
            
            # Store in database
            self.feed_db.add_post(uri, str(op.cid), repo_did, text, created_at)
            
            self.stats['posts_indexed'] += 1
            
            if self.verbose:
                print(f"   + Indexed post from {repo_did[:20]}... ({len(text)} chars)")
        
        except Exception as e:
            if self.verbose:
                print(f"   ✗ Error indexing post: {e}")
    
    def start(self):
        """Start subscribing to the firehose"""
        if self.verbose:
            print(f"\n🌊 Connecting to firehose...")
            print(f"   Using atproto FirehoseSubscribeReposClient")
        
        client = FirehoseSubscribeReposClient()
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            if self.verbose:
                print("\n\n   ⚠ Shutting down...")
        finally:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print(f"\n📊 INDEXER STATS")
            print(f"=" * 60)
            print(f"Runtime: {elapsed:.0f} seconds")
            print(f"Total events: {self.stats['total_events']:,}")
            print(f"Posts indexed: {self.stats['posts_indexed']}")
            print(f"=" * 60)


def main():
    """Run the firehose indexer"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reverie House Firehose Indexer')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    args = parser.parse_args()
    
    print("🔥 Reverie House Firehose Indexer")
    print("=" * 60)
    
    indexer = FirehoseIndexer(verbose=args.verbose)
    
    print("\n⏸️  Starting in 3 seconds... (Ctrl+C to stop)")
    time.sleep(3)
    
    indexer.start()


if __name__ == '__main__':
    main()
