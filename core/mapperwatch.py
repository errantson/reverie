#!/usr/bin/env python3
"""
Mapper Polling Service - Check origin quest replies every minute

This service polls the origin quest post for new replies every 60 seconds.
Unlike a firehose listener, this avoids ConsumerTooSlow errors by fetching
only the replies we care about via the getPostThread API.

Processing:
- Polls once per minute for new replies to origin quest
- Processes only replies we haven't seen before
- Checks hasnt_canon:origin condition
- Executes declare_origin command for new declarations
- Lightweight and reliable - no firehose parsing overhead

This is the automated mapper machine that declares spectrum origins.
"""

import json
import sys
import time
import random
from pathlib import Path
from datetime import datetime
from typing import Set, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from config import Config


class MapperhoseMonitor:
    """Poll the origin quest for new replies every minute."""
    
    # Retry messages when user doesn't include trigger words
    RETRY_MESSAGES = [
        "Hmmm... I'm having a hard time tracing this phanera.\n\nWas it a dream, or a nightmare?",
        "Apologies... your phanera still eludes me.\n\nWould you call it a dream, or a nightmare?",
        "There's some difficulty tracing your phanera still.\n\nWould you describe it as a dream, or a nightmare?",
        "We can't find your phanera for some reason.\n\nDo you think it's a dream, or a nightmare?",
        "We're still looking for your phanera.\n\nWas it a dream, or more like a nightmare?",
        "I need a bit more to track your phanera properly.\n\nDo you think it's a dream, or moreso a nightmare?"
    ]
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        
        self.stats = {
            'total_checks': 0,
            'replies_found': 0,
            'origins_declared': 0,
            'retry_requests_sent': 0,
            'start_time': datetime.now()
        }
        
        # Track which reply URIs we've already processed
        self.processed_uris: Set[str] = set()
        self.processed_dids: Set[str] = set()
        
        # Track retry requests we've sent (user DID -> retry post URI)
        self.retry_requests: dict = {}
        
        self._load_processed_dreamers()
        self._load_retry_requests()
        
        # The origin quest URI - loaded from database
        self.origin_uri: Optional[str] = None
        self._load_origin_quest()
        
        # AT Protocol client for fetching threads
        # Use public API endpoint - no auth needed for reading public posts
        self.client = Client(base_url='https://public.api.bsky.app')
        
        # Mapper client for posting retry requests
        self.mapper_client = None
        self.mapper_unavailable_logged = False
        self._init_mapper_client()
    
    def _load_origin_quest(self):
        """Load the origin quest URI from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute(
                "SELECT uri FROM quests WHERE title = 'origin' AND enabled = true"
            )
            result = cursor.fetchone()
            
            if result:
                self.origin_uri = result['uri']
                if self.verbose:
                    print(f"🗺️  MAPPERHOSE - Automated Origin Quest Monitor")
                    print(f"=" * 70)
                    print(f"Quest URI: {self.origin_uri}")
                    print(f"Polling interval: 60 seconds")
                    print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"=" * 70)
            else:
                print(f"❌ Origin quest not found or disabled")
                
        except Exception as e:
            print(f"❌ Error loading origin quest: {e}")
            import traceback
            traceback.print_exc()
    
    def _load_processed_dreamers(self):
        """Load dreamers who already have origin canon entries."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            # Load DIDs of dreamers who have already declared their origin
            cursor = db.execute(
                "SELECT DISTINCT did FROM canon WHERE key = 'origin'"
            )
            results = cursor.fetchall()
            
            for row in results:
                self.processed_dids.add(row['did'])
            
            if self.verbose:
                print(f"📊 Loaded {len(self.processed_dids)} dreamers with origin canons")
                
        except Exception as e:
            print(f"⚠️  Error loading processed dreamers: {e}")
            import traceback
            traceback.print_exc()
    
    def _load_retry_requests(self):
        """Load any existing retry requests from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            # Create retry_requests table if it doesn't exist
            db.execute("""
                CREATE TABLE IF NOT EXISTS quest_retry_requests (
                    id SERIAL PRIMARY KEY,
                    user_did TEXT NOT NULL,
                    quest_title TEXT NOT NULL,
                    retry_post_uri TEXT NOT NULL,
                    original_reply_uri TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_did, quest_title)
                )
            """)
            
            # Load existing retry requests for origin quest
            cursor = db.execute(
                "SELECT user_did, retry_post_uri FROM quest_retry_requests WHERE quest_title = 'origin'"
            )
            results = cursor.fetchall()
            
            for row in results:
                self.retry_requests[row['user_did']] = row['retry_post_uri']
            
            if self.verbose and self.retry_requests:
                print(f"📨 Loaded {len(self.retry_requests)} pending retry requests")
                
        except Exception as e:
            print(f"⚠️  Error loading retry requests: {e}")
            import traceback
            traceback.print_exc()
    
    def _init_mapper_client(self):
        """Initialize authenticated Bluesky client for mapper account."""
        try:
            from core.database import DatabaseManager
            from core.encryption import decrypt_password
            
            db = DatabaseManager()
            
            # Get the current mapper from the work table
            cursor = db.execute("""
                SELECT workers FROM work WHERE role = 'mapper'
            """)
            work_result = cursor.fetchone()
            
            if not work_result or not work_result['workers']:
                print(f"ℹ️  No mapper assigned - retry messages disabled")
                print(f"   To assign a mapper, have someone with credentials apply for the 'mapper' role")
                return
            
            import json
            workers = json.loads(work_result['workers'])
            if not workers:
                print(f"ℹ️  No mapper assigned - retry messages disabled")
                return
            
            mapper_did = workers[0].get('did')  # Get first worker
            
            # Get mapper DID and encrypted password
            cursor = db.execute("""
                SELECT d.did, d.handle, c.app_password_hash
                FROM dreamers d
                JOIN user_credentials c ON d.did = c.did
                WHERE d.did = %s
            """, (mapper_did,))
            result = cursor.fetchone()
            
            if not result or not result['app_password_hash']:
                print(f"⚠️  No credentials found for mapper {result['handle'] if result else mapper_did} - retry messages disabled")
                return
            
            # Decrypt the password
            app_password = decrypt_password(result['app_password_hash'])
            
            if app_password:
                self.mapper_client = Client()
                self.mapper_client.login('mappy.reverie.house', app_password)
                if self.verbose:
                    print(f"🔐 Mapper client authenticated as mappy.reverie.house")
            else:
                print(f"⚠️  Failed to decrypt credentials for mappy.reverie.house - retry messages disabled")
                
        except Exception as e:
            print(f"⚠️  Error initializing mapper client: {e}")
            import traceback
            traceback.print_exc()
    
    def _fetch_thread_replies(self) -> list:
        """Fetch all replies to the origin quest post."""
        if not self.origin_uri:
            return []
        
        try:
            # Parse the AT URI to get thread parameters
            # Format: at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.post/3lvu664ajls2r
            parts = self.origin_uri.replace('at://', '').split('/')
            repo_did = parts[0]
            rkey = parts[-1]
            
            # Fetch the thread
            thread = self.client.app.bsky.feed.get_post_thread({
                'uri': self.origin_uri,
                'depth': 1000  # Get all replies
            })
            
            # Extract replies from the thread
            replies = []
            if hasattr(thread, 'thread') and hasattr(thread.thread, 'replies'):
                for reply in thread.thread.replies:
                    if hasattr(reply, 'post'):
                        post = reply.post
                        replies.append({
                            'uri': post.uri,
                            'cid': post.cid,
                            'author': {
                                'did': post.author.did,
                                'handle': post.author.handle
                            },
                            'record': {
                                'text': post.record.text,
                                'createdAt': post.record.created_at
                            }
                        })
            
            return replies
            
        except Exception as e:
            print(f"⚠️  Error fetching thread: {e}")
            return []
    
    def _process_reply(self, reply: dict) -> None:
        """Process a single reply to check if it's a new origin declaration."""
        author_did = reply['author']['did']
        author_handle = reply['author']['handle']
        reply_uri = reply['uri']
        post_text = reply['record']['text']
        post_created_at = reply['record']['createdAt']
        
        # Skip if already processed
        if author_did in self.processed_dids:
            if self.verbose:
                print(f"   ⏭️  Already declared: @{author_handle}")
            return
        
        if reply_uri in self.processed_uris:
            if self.verbose:
                print(f"   ⏭️  Already processed: {reply_uri}")
            return
        
        # Found a new origin declaration!
        print(f"🆕 NEW ORIGIN DECLARATION: @{author_handle}")
        print(f"   URI: {reply_uri}")
        print(f"   Text: {post_text[:80]}...")
        
        # Process through quest system
        success, skip_reason = self._process_origin_declaration(
            reply_uri, author_did, author_handle,
            post_text, post_created_at
        )
        
        # Only mark as processed if declaration succeeds
        if success:
            self.processed_dids.add(author_did)
            self.processed_uris.add(reply_uri)
            self.stats['origins_declared'] += 1
            print(f"   ✅ Origin declared successfully")
            
            # Remove from retry requests if they had one
            if author_did in self.retry_requests:
                self._remove_retry_request(author_did)
        else:
            # Send retry request if not already sent
            if author_did not in self.retry_requests:
                self._send_retry_request(reply_uri, author_did, author_handle, skip_reason)
            else:
                print(f"   ⏭️  Retry request already sent, waiting for response")
    
    def _process_origin_declaration(self, reply_uri: str, author_did: str,
                                    author_handle: str, post_text: str,
                                    post_created_at: str) -> tuple:
        """
        Process an origin declaration through the quest system.
        
        Returns:
            (success: bool, skip_reason: str or None)
        """
        try:
            from ops.quest_hooks import process_quest_reply
            
            result = process_quest_reply(
                reply_uri=reply_uri,
                author_did=author_did,
                author_handle=author_handle,
                post_text=post_text,
                post_created_at=post_created_at,
                quest_uri=self.origin_uri,
                verbose=self.verbose
            )
            
            # Check if the quest processing was successful
            if not result.get('success'):
                return False, result.get('skip_reason', 'Processing failed')
            
            # Check if it was skipped (conditions not met)
            if result.get('skipped'):
                return False, result.get('skip_reason', 'Conditions not met')
            
            # Success!
            return True, None
            
        except Exception as e:
            print(f"   ❌ Error processing origin declaration: {e}")
            import traceback
            traceback.print_exc()
            return False, str(e)
    
    def _send_retry_request(self, reply_uri: str, user_did: str, user_handle: str, skip_reason: str):
        """Send a retry request reply asking the user to clarify."""
        if not self.mapper_client:
            if not self.mapper_unavailable_logged:
                print(f"   ℹ️  Skipping retry requests - no mapper assigned")
                self.mapper_unavailable_logged = True
            return
        
        try:
            # Pick a random retry message
            message = random.choice(self.RETRY_MESSAGES)
            
            # Parse the reply URI to get the post reference
            # Format: at://did:plc:xxx/app.bsky.feed.post/xxx
            parts = reply_uri.replace('at://', '').split('/')
            repo_did = parts[0]
            rkey = parts[-1]
            
            # Create the reply
            from atproto import models
            
            reply_ref = models.AppBskyFeedPost.ReplyRef(
                parent=models.create_strong_ref(
                    models.ComAtprotoRepoStrongRef.Main(
                        uri=reply_uri,
                        cid='bafyreihsu5v5t6yvd4tkfixl3bfhzlvdcwfbh72cj2xocczqe4xo3kzfwq'  # Placeholder, will be replaced
                    )
                ),
                root=models.create_strong_ref(
                    models.ComAtprotoRepoStrongRef.Main(
                        uri=self.origin_uri,
                        cid='bafyreihsu5v5t6yvd4tkfixl3bfhzlvdcwfbh72cj2xocczqe4xo3kzfwq'  # Placeholder
                    )
                )
            )
            
            # Post the retry request
            response = self.mapper_client.send_post(
                text=message,
                reply_to=models.AppBskyFeedPost.ReplyRef(
                    parent=models.ComAtprotoRepoStrongRef.Main(uri=reply_uri, cid=''),
                    root=models.ComAtprotoRepoStrongRef.Main(uri=self.origin_uri, cid='')
                )
            )
            
            retry_post_uri = response.uri
            
            # Save retry request to database
            from core.database import DatabaseManager
            db = DatabaseManager()
            db.execute(
                """INSERT OR REPLACE INTO quest_retry_requests 
                   (user_did, quest_title, retry_post_uri, original_reply_uri)
                   VALUES (?, ?, ?, ?)""",
                (user_did, 'origin', retry_post_uri, reply_uri)
            )
            
            # Track in memory
            self.retry_requests[user_did] = retry_post_uri
            self.stats['retry_requests_sent'] += 1
            
            print(f"   📨 Sent retry request to @{user_handle}")
            print(f"   Reason: {skip_reason}")
            
        except Exception as e:
            print(f"   ❌ Failed to send retry request: {e}")
            import traceback
            traceback.print_exc()
    
    def _remove_retry_request(self, user_did: str):
        """Remove a retry request after successful declaration."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            db.execute(
                "DELETE FROM quest_retry_requests WHERE user_did = ? AND quest_title = 'origin'",
                (user_did,)
            )
            
            if user_did in self.retry_requests:
                del self.retry_requests[user_did]
            
            if self.verbose:
                print(f"   🗑️  Removed retry request")
                
        except Exception as e:
            print(f"   ⚠️  Error removing retry request: {e}")
    
    def _check_retry_responses(self):
        """Check if any users have replied to our retry requests."""
        if not self.retry_requests:
            return
        
        for user_did, retry_post_uri in list(self.retry_requests.items()):
            try:
                # Fetch the thread for this retry post
                thread = self.client.app.bsky.feed.get_post_thread({
                    'uri': retry_post_uri,
                    'depth': 10
                })
                
                # Check for replies
                if hasattr(thread, 'thread') and hasattr(thread.thread, 'replies'):
                    for reply in thread.thread.replies:
                        if hasattr(reply, 'post'):
                            post = reply.post
                            
                            # Only process replies from the user we're waiting for
                            if post.author.did == user_did:
                                if self.verbose:
                                    print(f"💬 Retry response from @{post.author.handle}")
                                
                                # Process this as a new origin declaration
                                success, skip_reason = self._process_origin_declaration(
                                    post.uri,
                                    post.author.did,
                                    post.author.handle,
                                    post.record.text,
                                    post.record.created_at
                                )
                                
                                if success:
                                    self.processed_dids.add(user_did)
                                    self.processed_uris.add(post.uri)
                                    self.stats['origins_declared'] += 1
                                    print(f"   ✅ Origin declared successfully (via retry)")
                                    self._remove_retry_request(user_did)
                                else:
                                    print(f"   ⚠️  Still doesn't meet conditions: {skip_reason}")
                                    # They'll get another retry message on next cycle
                                
                                break  # Only process first reply
                            
            except Exception as e:
                if self.verbose:
                    print(f"   ⚠️  Error checking retry response: {e}")
    
    def run(self):
        """Start the polling loop - check for new replies every 60 seconds."""
        if not self.origin_uri:
            print("❌ No origin quest URI configured - cannot start")
            return
        
        print(f"\n🗺️  Mapperhose started - monitoring origin quest")
        print(f"Checking every 60 seconds for new origin declarations...\n")
        
        try:
            while True:
                self.stats['total_checks'] += 1
                
                if self.verbose:
                    print(f"📊 Mapperhose poll #{self.stats['total_checks']} at {datetime.now().strftime('%H:%M:%S')}")
                
                # Fetch all replies
                replies = self._fetch_thread_replies()
                self.stats['replies_found'] = len(replies)
                
                if self.verbose:
                    print(f"📬 Found {len(replies)} replies to origin quest")
                
                # Process each reply
                for reply in replies:
                    self._process_reply(reply)
                
                # Also check for replies to our retry requests
                self._check_retry_responses()
                
                # Wait 60 seconds before next poll
                time.sleep(60)
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Stopping mapperhose...")
        finally:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print("\n📊 MAPPERHOSE STATS")
            print("=" * 70)
            print(f"Runtime: {elapsed:.0f} seconds ({elapsed/3600:.1f} hours)")
            print(f"Total checks: {self.stats['total_checks']}")
            print(f"Replies found (last check): {self.stats['replies_found']}")
            print(f"Origins declared: {self.stats['origins_declared']}")
            print(f"Retry requests sent: {self.stats['retry_requests_sent']}")
            print(f"Pending retry requests: {len(self.retry_requests)}")
            print("=" * 70)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Mapperhose - Origin Quest Monitor')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = MapperhoseMonitor(verbose=args.verbose)
    monitor.run()


if __name__ == '__main__':
    main()
