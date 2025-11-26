#!/usr/bin/env python3
"""
Greeter Polling Service - Check namegiver quest replies every minute

This service polls the namegiver quest post for new replies every 60 seconds.
Unlike a firehose listener, this avoids ConsumerTooSlow errors by fetching
only the replies we care about via the getPostThread API.

Processing:
- Polls once per minute for new replies to namegiver quest
- Processes only replies we haven't seen before
- Lightweight and reliable - no firehose parsing overhead
- Tracks processed replies to avoid duplicates

This is an automated greeter machine that never sleeps.
"""

import json
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Set, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from config import Config


class GreeterhoseMonitor:
    """Poll the namegiver quest for new replies every minute."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        
        self.stats = {
            'total_checks': 0,
            'replies_found': 0,
            'greetings_sent': 0,
            'start_time': datetime.now()
        }
        
        # Track which reply URIs we've already processed
        self.processed_uris: Set[str] = set()
        self.processed_dids: Set[str] = set()
        self._load_processed_dreamers()
        
        # The namegiver quest URI - loaded from database
        self.namegiver_uri: Optional[str] = None
        self._load_namegiver_quest()
        
        # AT Protocol client for fetching threads
        # Use public API endpoint - no auth needed for reading public posts
        self.client = Client(base_url='https://public.api.bsky.app')
        # Still try to auth if possible (for higher rate limits)
        self._authenticate_client()
    
    def _load_namegiver_quest(self):
        """Load the namegiver quest URI from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute(
                "SELECT uri FROM quests WHERE title = 'namegiver' AND enabled = true"
            )
            result = cursor.fetchone()
            
            if result:
                self.namegiver_uri = result['uri']
                if self.verbose:
                    print(f"👋 GREETERHOSE - Automated Namegiver Quest Monitor")
                    print(f"=" * 70)
                    print(f"Quest URI: {self.namegiver_uri}")
                    print(f"Polling interval: 60 seconds")
                    print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"=" * 70)
            else:
                print(f"❌ Namegiver quest not found or disabled")
                
        except Exception as e:
            print(f"❌ Error loading namegiver quest: {e}")
            import traceback
            traceback.print_exc()
    
    def _authenticate_client(self):
        """Authenticate the AT Protocol client to fetch threads."""
        try:
            from core.database import DatabaseManager
            from core.encryption import decrypt_password
            db = DatabaseManager()
            
            # Get greeter credentials (isilme)
            cursor = db.execute("""
                SELECT d.handle, uc.app_password_hash 
                FROM dreamers d
                JOIN user_credentials uc ON d.did = uc.did
                JOIN user_roles ur ON d.did = ur.did
                WHERE ur.role = 'greeter' AND ur.status = 'active'
                LIMIT 1
            """)
            creds = cursor.fetchone()
            
            if creds:
                try:
                    # Decrypt the app password
                    app_password = decrypt_password(creds['app_password_hash'])
                    self.client.login(creds['handle'], app_password)
                    if self.verbose:
                        print(f"🔐 Authenticated as @{creds['handle']}")
                except FileNotFoundError:
                    # Encryption key not available - skip auth, use public API
                    if self.verbose:
                        print(f"⚠️  Encryption key not found - using public API")
            else:
                if self.verbose:
                    print(f"⚠️  No active greeter credentials found - using public API")
                
        except Exception as e:
            if self.verbose:
                print(f"⚠️  Could not authenticate: {e}")
                print(f"   Will use public API to fetch threads")
    
    def _load_processed_dreamers(self):
        """Load already-greeted dreamers from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            # Get all dreamers who have a canon entry with key='name'
            # This means they completed the namegiver quest
            cursor = db.execute(
                "SELECT DISTINCT did FROM canon WHERE key = 'name'"
            )
            rows = cursor.fetchall()
            
            for row in rows:
                if row['did']:
                    self.processed_dids.add(row['did'])
            
            if self.verbose and self.processed_dids:
                print(f"📝 Loaded {len(self.processed_dids)} already-greeted dreamers (with name canon)")
                
        except Exception as e:
            print(f"⚠️  Error loading processed dreamers: {e}")
    
    def _fetch_thread_replies(self):
        """Fetch all replies to the namegiver quest post."""
        if not self.namegiver_uri:
            return []
        
        try:
            # Use app.bsky.feed.getPostThread to get the post and all its replies
            response = self.client.app.bsky.feed.get_post_thread({
                'uri': self.namegiver_uri,
                'depth': 1000  # Get all direct replies
            })
            
            thread = response.thread
            if not hasattr(thread, 'replies'):
                return []
            
            return thread.replies or []
            
        except Exception as e:
            print(f"⚠️  Error fetching thread: {e}")
            return []
    
    def _process_reply(self, reply):
        """Process a single reply to the namegiver quest."""
        try:
            # Extract reply details
            post = reply.post
            post_uri = post.uri
            author_did = post.author.did
            post_text = post.record.text
            post_created_at = post.record.created_at
            
            # Skip if we've already processed this reply URI
            if post_uri in self.processed_uris:
                return
            
            # Skip if we've already greeted this DID
            if author_did in self.processed_dids:
                if self.verbose:
                    print(f"   ⏭️  Skipping @{post.author.handle} - already greeted")
                return
            
            # Skip if this is a reply to a reply (not direct to namegiver)
            if hasattr(post.record, 'reply'):
                parent_uri = post.record.reply.parent.uri
                if parent_uri != self.namegiver_uri:
                    return
            
            print(f"\n👋 NEW NAMEGIVER REPLY!")
            print(f"   Author: @{post.author.handle}")
            print(f"   DID: {author_did[:20]}...")
            print(f"   Post URI: {post_uri}")
            print(f"   Text: {post_text[:80]}...")
            
            # Process the greeting
            success = self._process_greeting(post_uri, author_did, post_text, post_created_at)
            
            # Only mark as processed if greeting was successful
            if success:
                self.processed_uris.add(post_uri)
                self.processed_dids.add(author_did)
                self.stats['replies_found'] += 1
            else:
                if self.verbose:
                    print(f"   ⚠️  Greeting failed - will retry on next poll")
            
        except Exception as e:
            print(f"⚠️  Error processing reply: {e}")
            import traceback
            traceback.print_exc()
    
    def _process_greeting(self, post_uri: str, author_did: str,
                         post_text: str, post_created_at: str) -> bool:
        """Process a namegiver reply and send greeting.
        
        Returns:
            bool: True if greeting was successful, False otherwise
        """
        try:
            from ops.quest_hooks import process_quest_reply
            
            print(f"   🔄 Processing greeting for @{author_did[:20]}...")
            
            result = process_quest_reply(
                reply_uri=post_uri,
                author_did=author_did,
                author_handle='unknown',  # Will be resolved by quest_hooks
                post_text=post_text,
                post_created_at=post_created_at,
                quest_uri=self.namegiver_uri,
                verbose=self.verbose
            )
            
            if result.get('success') and not result.get('skipped'):
                self.stats['greetings_sent'] += 1
                print(f"   ✅ Greeting sent! Total: {self.stats['greetings_sent']}")
                return True
            else:
                skip_reason = result.get('skip_reason', result.get('errors', ['unknown'])[0] if result.get('errors') else 'unknown')
                if self.verbose:
                    print(f"   ℹ️  Not processed: {skip_reason}")
                return False
                
        except Exception as e:
            print(f"❌ Error processing greeting: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def check_for_new_replies(self):
        """Check the namegiver post for new replies."""
        self.stats['total_checks'] += 1
        
        if self.verbose:
            now = datetime.now().strftime('%H:%M:%S')
            print(f"\n🔍 [{now}] Checking for new namegiver replies... (check #{self.stats['total_checks']})")
        
        replies = self._fetch_thread_replies()
        
        if replies:
            if self.verbose:
                new_count = sum(1 for r in replies if r.post.uri not in self.processed_uris)
                print(f"   Found {len(replies)} total replies ({new_count} new)")
            
            for reply in replies:
                self._process_reply(reply)
        else:
            if self.verbose:
                print(f"   No replies found")
    
    def run(self):
        """Start the polling loop."""
        if not self.namegiver_uri:
            print("❌ Cannot start: namegiver quest not loaded")
            return
        
        print(f"\n🔁 Starting polling loop (60 second interval)...\n")
        
        while True:
            try:
                self.check_for_new_replies()
                time.sleep(60)  # Wait 60 seconds before next check
                
            except KeyboardInterrupt:
                raise  # Let the main handler catch this
            except Exception as e:
                print(f"⚠️  Error in polling loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(60)  # Wait before retrying


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Greeterhose - Poll namegiver quest for new replies')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = GreeterhoseMonitor(verbose=args.verbose or True)
    
    try:
        monitor.run()
    except KeyboardInterrupt:
        print(f"\n\n👋 GREETERHOSE STATS")
        print(f"=" * 70)
        elapsed = (datetime.now() - monitor.stats['start_time']).total_seconds()
        print(f"Runtime: {int(elapsed)} seconds")
        print(f"Total checks: {monitor.stats['total_checks']}")
        print(f"Replies found: {monitor.stats['replies_found']}")
        print(f"Greetings sent: {monitor.stats['greetings_sent']}")
        print(f"=" * 70)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
