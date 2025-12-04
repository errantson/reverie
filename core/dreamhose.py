#!/usr/bin/env python3
"""
Dream Detection Service

Dear Cogitarian,

This scans ALL Bluesky posts (not just our dreamers) looking for posts about actual dreams.
Uses keyword detection, filters out spam/politics/metaphors, and queues matching posts
to dream_queue table for the dreamviewer.

Processing ~1000-5000 events/sec. Multi-stage filtering keeps false positives low.
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, Set
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import CAR, FirehoseSubscribeReposClient, parse_subscribe_repos_message, models
from config import Config
from core.cursor_manager import CursorManager


class DreamhoseMonitor:
    """Monitor the ATProto firehose for dream-related posts from ALL users."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.cursor_manager = CursorManager('dreamhose', save_interval=1000, verbose=verbose)
        
        self.stats = {
            'total_events': 0,
            'posts_scanned': 0,
            'dreams_detected': 0,
            'dreams_queued': 0,
            'false_positives_filtered': 0,
            'start_time': datetime.now()
        }
        
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='dream-save')
        
        # Known dreamer DIDs for avatar caching (optional optimization)
        self.tracked_dids: Set[str] = set()
        self.dreamer_by_did: Dict[str, Dict] = {}
        self._load_dreamers_cache()
    
    def _load_dreamers_cache(self):
        """Load tracked dreamers for avatar caching (optional)."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute("SELECT did, handle, avatar, followers_count FROM dreamers")
            dreamers = cursor.fetchall()
            
            self.tracked_dids = {d['did'] for d in dreamers}
            self.dreamer_by_did = {d['did']: dict(d) for d in dreamers}
            
            if self.verbose:
                print(f"📊 Cached {len(self.tracked_dids)} dreamers for avatar lookup")
        except Exception as e:
            if self.verbose:
                print(f"⚠️  Could not cache dreamers: {e}")
    
    def on_message_handler(self, message) -> None:
        """Process each firehose message - scan ALL posts for dreams."""
        self.stats['total_events'] += 1
        
        # Progress logging every 5000 events
        if self.verbose and self.stats['total_events'] % 5000 == 0:
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            rate = self.stats['total_events'] / elapsed if elapsed > 0 else 0
            print(f"💭 Dreamhose: {self.stats['total_events']} events "
                  f"({rate:.0f}/sec) | "
                  f"Scanned: {self.stats['posts_scanned']} | "
                  f"Detected: {self.stats['dreams_detected']} | "
                  f"Queued: {self.stats['dreams_queued']} | "
                  f"Filtered: {self.stats['false_positives_filtered']}")
        
        commit = parse_subscribe_repos_message(message)
        
        # Update cursor if this is a sequenced message
        if hasattr(commit, 'seq'):
            self.cursor_manager.update_cursor(commit.seq)
        
        # Only care about commits (not identity events)
        if type(commit).__name__ != 'Commit':
            return
        
        if not hasattr(commit, 'repo') or not commit.ops:
            return
        
        repo_did = commit.repo
        
        # Check ALL posts for dream content (scan entire network)
        for op in commit.ops:
            if op.path.startswith('app.bsky.feed.post/') and op.action == 'create':
                self._check_for_dream_post(repo_did, op, commit)
    
    def _check_for_dream_post(self, repo_did: str, op, commit):
        """Process potential dream post from firehose (scan ALL posts, not just tracked dreamers)."""
        try:
            # Extract post data from CAR file
            if not op.cid:
                return
            
            car_data = CAR.from_bytes(commit.blocks)
            post_record = car_data.blocks.get(op.cid)
            
            if not post_record:
                return
            
            # Parse post_record into a dict
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
            if not text:
                return
            
            # Only count as "scanned" if we got this far (has text to analyze)
            self.stats['posts_scanned'] += 1
            
            # FILTER: Block specific spam accounts by handle
            author_handle = self._get_handle_for_did(repo_did)
            blocked_handles = ['werotic.bsky.social']
            
            if author_handle and author_handle.lower() in blocked_handles:
                if self.verbose:
                    print(f"   🚫 Blocked account: {author_handle}")
                self.stats['false_positives_filtered'] += 1
                return
            
            # FILTER: Block link-only posts
            text_without_urls = re.sub(r'https?://\S+', '', text).strip()
            text_without_urls = re.sub(r'www\.\S+', '', text_without_urls).strip()
            
            if len(text_without_urls) < 10:
                if self.verbose:
                    print(f"   🚫 Filtered link-only post")
                self.stats['false_positives_filtered'] += 1
                return
            
            # FILTER: Block spam phrases and adult content
            spam_blocklist = [
                'cam model', 'cammodel', 'onlyfans', 'of link', 'spicy content',
                'nsfw link', '18+ content', 'subscribe to my', 'link in bio',
                'mobi www.commondreams.org', 'mobi www.', 
                'awakari.com', 'activitypub.awakari.com',
                'breaking:', 'just in:', 'developing:', 'read more:', 'full story:',
                'like and repost', 'rt if you', 'boost if', 'retweet if',
                'follow for follow', 'f4f', 'gain followers', 'follow back',
                'crypto', 'bitcoin', 'nft', 'airdrop', 'presale',
                'invest now', 'limited time', 'click to claim',
            ]
            
            text_lower = text.lower()
            for spam_phrase in spam_blocklist:
                if spam_phrase in text_lower:
                    if self.verbose:
                        print(f"   🚫 Filtered spam phrase: {spam_phrase}")
                    self.stats['false_positives_filtered'] += 1
                    return
            
            # FILTER: Check for moderation labels
            labels = post_data.get('labels', [])
            if labels:
                blocked_labels = [
                    'porn', 'sexual', 'nudity', 'nsfw', 'sexual-content',
                    'csam', 'child-abuse', 'minor-sexualization', 'grooming',
                    'harassment', 'stalking', 'doxxing', 'threatening',
                    'spam', 'scam', 'impersonation', 'bot',
                    'gore', 'violence', 'graphic-media',
                ]
                
                for label_data in labels:
                    if isinstance(label_data, dict):
                        label_val = label_data.get('val', '')
                    else:
                        label_val = str(label_data)
                    
                    if label_val.lower() in blocked_labels:
                        if self.verbose:
                            print(f"   🚫 Filtered by label: {label_val}")
                        self.stats['false_positives_filtered'] += 1
                        return
            
            # Detect if this is actually a dream post
            detection = DreamPostDetector.detect_dream_post(text)
            
            if not detection['is_dream']:
                if self.verbose:
                    print(f"   🚫 {detection['reason']}")
                self.stats['false_positives_filtered'] += 1
                return
            
            # Found a dream! Queue it
            self.stats['dreams_detected'] += 1
            
            post_uri = f"at://{repo_did}/{op.path}"
            created_at = post_data.get('createdAt', datetime.now().isoformat())
            
            dream = {
                'post_uri': post_uri,
                'author_did': repo_did,
                'author_handle': author_handle or 'unknown',
                'text': text,
                'detected_at': created_at,
                'confidence_score': detection['confidence'],
                'dream_type': detection.get('dream_type', 'neutral'),
                'matched_keywords': detection.get('reason', '')
            }
            
            if self.verbose:
                print(f"💭 Dream detected! @{dream['author_handle']}: {text[:60]}...")
                print(f"   Confidence: {detection['confidence']:.0%} | Type: {detection['dream_type']}")
            
            # Save to queue asynchronously
            self.stats['dreams_queued'] += 1
            self.executor.submit(self._save_dream_to_queue, dream)
            
        except Exception as e:
            if self.verbose:
                print(f"⚠️ Error checking dream post: {e}")
    
    def _get_handle_for_did(self, did: str) -> str:
        """Get handle for DID (use cache if available)."""
        if did in self.dreamer_by_did:
            return self.dreamer_by_did[did].get('handle', 'unknown')
        
        # For unknown DIDs, try to resolve (optional - can be slow)
        # For now, just return None to skip
        return None
    
    def _save_dream_to_queue(self, dream: Dict):
        """Save detected dream to database queue."""
        try:
            from core.database import DatabaseManager
            
            db = DatabaseManager()
            
            # Calculate engagement score
            engagement_score = self._calculate_engagement_score(dream)
            
            # Try to fetch cached avatar/follower count
            author_avatar = None
            follower_count = None
            
            if dream['author_did'] in self.dreamer_by_did:
                dreamer_data = self.dreamer_by_did[dream['author_did']]
                author_avatar = dreamer_data.get('avatar')
                follower_count = dreamer_data.get('followers_count')
            
            # Calculate expiration time
            confidence = dream['confidence_score']
            
            if confidence >= 0.80:
                expire_hours = 48
            elif confidence >= 0.60:
                expire_hours = 36
            elif confidence >= 0.40:
                expire_hours = 24
            elif confidence >= 0.20:
                expire_hours = 16
            else:
                expire_hours = 8
            
            # Bonus time for high engagement
            if engagement_score >= 7:
                expire_hours += 12
            elif engagement_score >= 4:
                expire_hours += 6
            
            detected_at_dt = datetime.fromisoformat(dream['detected_at'])
            expires_at_dt = detected_at_dt + timedelta(hours=expire_hours)
            expires_at = int(expires_at_dt.timestamp())
            
            # Calculate relevance score
            relevance_score = (
                confidence * 0.4 + 
                (engagement_score / 10.0) * 0.3 + 
                0.3  # Full freshness initially
            )
            
            db.execute("""
                INSERT OR IGNORE INTO dream_queue 
                (post_uri, author_did, author_handle, post_text, detected_at, confidence_score, dream_type, 
                 engagement_score, follower_count, author_avatar, images, expires_at, relevance_score, matched_keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dream['post_uri'],
                dream['author_did'],
                dream['author_handle'],
                dream['text'],
                dream['detected_at'],
                dream['confidence_score'],
                dream.get('dream_type', 'neutral'),
                engagement_score,
                follower_count,
                author_avatar,
                None,  # images
                expires_at,
                relevance_score,
                dream.get('matched_keywords', '')
            ))
            db.commit()
            
        except Exception as e:
            if self.verbose:
                print(f"   ❌ Failed to save dream to queue: {e}")
    
    def _calculate_engagement_score(self, dream: Dict) -> int:
        """Calculate engagement-worthiness score (0-10)."""
        score = 5  # Base score
        
        text = dream['text'].lower()
        
        # Emotional content indicators
        if any(word in text for word in ['scared', 'terrified', 'afraid', 'anxious']):
            score += 2
        if any(word in text for word in ['happy', 'joyful', 'peaceful', 'wonderful']):
            score += 1
        if any(word in text for word in ['weird', 'strange', 'bizarre', 'surreal']):
            score += 1
        
        # Vivid/detailed dreams
        if len(dream['text']) > 200:
            score += 1
        if len(dream['text']) > 400:
            score += 1
        
        # Nightmare indicator
        if 'nightmare' in text:
            score += 2
        
        # Cap at 10
        return min(score, 10)
    
    def run(self):
        """Start monitoring the firehose for dreams."""
        print("\n💭 DREAMHOSE - Dream Detection Monitor")
        print("=" * 60)
        print(f"Scanning: ALL Bluesky posts (entire network)")
        print(f"Filtering: Dream keywords, confidence scoring")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Load saved cursor
        saved_cursor = self.cursor_manager.load_cursor()
        if saved_cursor:
            print(f"Cursor: Resuming from {saved_cursor}")
        else:
            print(f"Cursor: Starting fresh")
        
        print("=" * 60)
        print("\nListening to firehose for dreams... (Ctrl+C to stop)\n")
        
        # Create client with cursor if we have one
        params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=saved_cursor) if saved_cursor else None
        client = FirehoseSubscribeReposClient(params=params)
        
        try:
            client.start(self.on_message_handler)
        except KeyboardInterrupt:
            print("\n\n⚠️  Stopping dreamhose...")
        finally:
            print("\n⏳ Waiting for pending saves...")
            self.executor.shutdown(wait=True)
            
            # Save final cursor
            self.cursor_manager.finalize()
            
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            print("\n📊 DREAMHOSE STATS")
            print("=" * 60)
            print(f"Runtime: {elapsed:.0f} seconds")
            print(f"Total events processed: {self.stats['total_events']:,}")
            print(f"Events per second: {self.stats['total_events']/elapsed:.0f}")
            print(f"Posts scanned: {self.stats['posts_scanned']:,}")
            print(f"Dreams detected: {self.stats['dreams_detected']}")
            print(f"Dreams queued: {self.stats['dreams_queued']}")
            print(f"False positives filtered: {self.stats['false_positives_filtered']:,}")
            print("=" * 60)


class DreamPostDetector:
    """Detect dream-related posts with confidence scoring."""
    
    STRONG_DREAM_KEYWORDS = [
        'last night i dreamed', 'had a dream', 'i dreamt', 'weird dream',
        'strange dream', 'recurring dream', 'lucid dream', 'nightmare',
        'in my dream',
    ]
    
    WEAK_DREAM_KEYWORDS = [
        'dream', 'dreaming', 'dreamed', 'dreamt', 'dreams',
        'sleep', 'sleeping', 'slept', 'asleep',
        'nap', 'napping', 'napped',
    ]
    
    EXCLUDE_PATTERNS = [
        'american dream', 'dream team', 'dream job', 'dream come true',
        'pipe dream', 'day dream', 'daydream', 'wildest dreams',
        'beyond my wildest dreams', 'dream big', 'chase your dreams',
        'follow your dreams', 'living the dream',
    ]
    
    POLITICAL_BLOCKLIST = [
        'trump', 'biden', 'harris', 'election', 'vote for', 'candidate',
        'democrat', 'republican', 'congress', 'senate', 'maga',
    ]
    
    @staticmethod
    def detect_dream_post(text: str) -> Dict:
        """Analyze post text to determine if it's about an actual dream."""
        text_lower = text.lower()
        
        # HARD BLOCK: Political content
        for blocked_term in DreamPostDetector.POLITICAL_BLOCKLIST:
            if blocked_term in text_lower:
                return {'is_dream': False, 'confidence': 0.0, 'reason': 'Political content', 'dream_type': 'neutral'}
        
        # Check exclusions
        for exclude in DreamPostDetector.EXCLUDE_PATTERNS:
            if exclude in text_lower:
                return {'is_dream': False, 'confidence': 0.0, 'reason': f'Excluded: "{exclude}"', 'dream_type': 'neutral'}
        
        # Metaphor detection for "nightmare"
        metaphor_patterns = [
            ' is a nightmare', ' is nightmare', ' was a nightmare',
            'nightmare fuel', 'nightmare scenario', 'worst nightmare',
            'living nightmare', 'logistical nightmare',
        ]
        
        has_metaphor = any(pattern in text_lower for pattern in metaphor_patterns)
        
        # Check for strong keywords
        strong_matches = []
        for keyword in DreamPostDetector.STRONG_DREAM_KEYWORDS:
            if keyword in text_lower:
                strong_matches.append(keyword)
        
        # Check for weak keywords
        has_weak = any(kw in text_lower for kw in DreamPostDetector.WEAK_DREAM_KEYWORDS)
        
        # Scoring logic
        if strong_matches:
            if has_metaphor:
                return {'is_dream': False, 'confidence': 0.0, 'reason': 'Metaphorical usage', 'dream_type': 'neutral'}
            
            confidence = 0.75 + (len(strong_matches) * 0.05)
            confidence = min(confidence, 0.95)
            
            # Classify dream type
            dream_type = 'neutral'
            if 'nightmare' in text_lower:
                dream_type = 'negative'
            elif any(word in text_lower for word in ['good', 'wonderful', 'happy', 'peaceful']):
                dream_type = 'positive'
            
            return {
                'is_dream': True,
                'confidence': confidence,
                'reason': f'Strong: {", ".join(strong_matches)}',
                'dream_type': dream_type
            }
        
        elif has_weak:
            # Weak keyword only - lower confidence
            confidence = 0.20
            return {
                'is_dream': True,
                'confidence': confidence,
                'reason': 'Weak dream indicator',
                'dream_type': 'neutral'
            }
        
        return {'is_dream': False, 'confidence': 0.0, 'reason': 'No dream terminology', 'dream_type': 'neutral'}


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Dreamhose - Dream Detection Monitor')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = DreamhoseMonitor(verbose=args.verbose)
    monitor.run()


if __name__ == '__main__':
    main()
