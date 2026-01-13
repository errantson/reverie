#!/usr/bin/env python3
"""
Cheerwatch - Automated like distribution for cheerful workers.
Polls community posts every 2 min, distributes likes across active workers.
"""

import json
import sys
import time
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from atproto import Client
from core.database import DatabaseManager
from core.encryption import decrypt_password
from core.log import get_logger, set_verbose

log = get_logger('cheerwatch')

HOURLY_LIMIT = 50
DAILY_LIMIT = 200
POLL_INTERVAL = 120
POSTS_PER_POLL = 20


class CheerfulWorker:
    def __init__(self, did: str, handle: str, passhash: str, pds_url: str = None):
        self.did = did
        self.handle = handle
        self.passhash = passhash
        self.pds_url = pds_url or 'https://bsky.social'
        self.hourly_count = 0
        self.daily_count = 0
        self.hourly_reset_at = datetime.now()
        self.daily_reset_at = datetime.now()
        self.cooldown_until = None
        self._client = None
    
    def can_cheer(self) -> bool:
        now = datetime.now()
        if self.cooldown_until and now < self.cooldown_until:
            return False
        if now >= self.hourly_reset_at:
            self.hourly_count = 0
            self.hourly_reset_at = now + timedelta(hours=1)
        if self.hourly_count >= HOURLY_LIMIT:
            return False
        if now >= self.daily_reset_at:
            self.daily_count = 0
            self.daily_reset_at = now + timedelta(days=1)
        if self.daily_count >= DAILY_LIMIT:
            return False
        return True
    
    def get_client(self) -> Optional[Client]:
        if self._client:
            return self._client
        try:
            app_password = decrypt_password(self.passhash)
            if not app_password:
                return None
            pds_url = self.pds_url
            if 'reverie.house' in (pds_url or ''):
                pds_url = 'https://reverie.house'
            elif not pds_url:
                pds_url = 'https://bsky.social'
            self._client = Client(base_url=pds_url)
            self._client.login(self.handle, app_password)
            return self._client
        except Exception as e:
            log.warning(f"auth failed @{self.handle}: {e}")
            return None
    
    def record_cheer(self):
        self.hourly_count += 1
        self.daily_count += 1
    
    def set_cooldown(self, seconds: int = 300):
        self.cooldown_until = datetime.now() + timedelta(seconds=seconds)


class CheerwatchMonitor:
    def __init__(self, verbose: bool = False):
        set_verbose(log, verbose)
        self.workers: Dict[str, CheerfulWorker] = {}
        self.cheered_posts: Set[str] = set()
        self.community_dids: Set[str] = set()
        self.stats = {'polls': 0, 'cheers': 0, 'failed': 0}
    
    def _load_workers(self):
        try:
            db = DatabaseManager()
            cursor = db.execute("SELECT workers FROM work WHERE role = 'cheerful'")
            result = cursor.fetchone()
            if not result or not result['workers']:
                self.workers = {}
                return
            
            workers_data = json.loads(result['workers'])
            new_workers = {}
            
            for w in workers_data:
                did = w.get('did')
                # Accept 'active' or 'working' status (admin.py uses 'working')
                if not did or w.get('status') not in ('active', 'working'):
                    continue
                cursor = db.execute("""
                    SELECT d.handle, uc.app_password_hash, uc.pds_url
                    FROM dreamers d JOIN user_credentials uc ON d.did = uc.did
                    WHERE d.did = %s AND uc.app_password_hash IS NOT NULL
                """, (did,))
                creds = cursor.fetchone()
                if creds:
                    new_workers[did] = CheerfulWorker(
                        did=did, handle=creds['handle'],
                        passhash=creds['app_password_hash'],
                        pds_url=creds.get('pds_url')
                    )
            self.workers = new_workers
        except Exception as e:
            print(f"Error loading workers: {e}")
    
    def _load_community_dids(self):
        try:
            db = DatabaseManager()
            cursor = db.execute("SELECT did FROM dreamers WHERE did IS NOT NULL")
            self.community_dids = {row['did'] for row in cursor.fetchall()}
        except Exception as e:
            log.error(f"loading community: {e}")
    
    def _load_already_cheered(self):
        try:
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT post_uri FROM cheer_record 
                WHERE cheered_at > NOW() - INTERVAL '24 hours' AND success = TRUE
            """)
            self.cheered_posts = {row['post_uri'] for row in cursor.fetchall()}
        except:
            pass
    
    def _fetch_community_posts(self) -> List[Dict]:
        posts = []
        try:
            sample_dids = random.sample(list(self.community_dids), min(10, len(self.community_dids)))
            for did in sample_dids:
                try:
                    resp = requests.get(
                        'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed',
                        params={'actor': did, 'limit': 5, 'filter': 'posts_no_replies'},
                        timeout=10
                    )
                    if resp.status_code != 200:
                        continue
                    for item in resp.json().get('feed', []):
                        post = item.get('post', {})
                        uri, cid = post.get('uri'), post.get('cid')
                        author = post.get('author', {})
                        if uri and cid and uri not in self.cheered_posts and author.get('did') in self.community_dids:
                            posts.append({'uri': uri, 'cid': cid, 'author_did': author.get('did')})
                except:
                    continue
            random.shuffle(posts)
            return posts[:POSTS_PER_POLL]
        except:
            return []
    
    def _perform_cheer(self, worker: CheerfulWorker, post: Dict) -> bool:
        try:
            client = worker.get_client()
            if not client:
                return False
            like_resp = client.like(uri=post['uri'], cid=post['cid'])
            like_uri = getattr(like_resp, 'uri', None)
            self._record_cheer(worker.did, post['uri'], post['author_did'], True, like_uri)
            worker.record_cheer()
            self.cheered_posts.add(post['uri'])
            self.stats['cheers'] += 1
            log.debug(f"@{worker.handle} liked {post['uri'][:50]}")
            return True
        except Exception as e:
            if '429' in str(e).lower() or 'rate' in str(e).lower():
                worker.set_cooldown(300)
            self._record_cheer(worker.did, post['uri'], post['author_did'], False, error=str(e)[:200])
            self.stats['failed'] += 1
            return False
    
    def _record_cheer(self, worker_did: str, post_uri: str, author_did: str, 
                      success: bool, like_uri: str = None, error: str = None):
        try:
            db = DatabaseManager()
            db.execute("""
                INSERT INTO cheer_record (cheerful_did, post_uri, post_author_did, like_uri, success, error_message)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (cheerful_did, post_uri) DO UPDATE SET
                    success = EXCLUDED.success, error_message = EXCLUDED.error_message, cheered_at = CURRENT_TIMESTAMP
            """, (worker_did, post_uri, author_did, like_uri, success, error))
        except:
            pass
    
    def _poll(self):
        self.stats['polls'] += 1
        self._load_workers()
        if not self.workers:
            return
        
        available = [w for w in self.workers.values() if w.can_cheer()]
        if not available:
            return
        
        posts = self._fetch_community_posts()
        if not posts:
            return
        
        log.debug(f"{len(available)} workers, {len(posts)} posts")
        
        for post in posts[:len(available) * 3]:
            worker = random.choice([w for w in self.workers.values() if w.can_cheer()])
            if not worker:
                break
            self._perform_cheer(worker, post)
            time.sleep(0.5)
    
    def run(self):
        log.info(f"started - {HOURLY_LIMIT}/hr, {DAILY_LIMIT}/day per worker")
        self._load_community_dids()
        self._load_already_cheered()
        
        while True:
            try:
                self._poll()
                time.sleep(POLL_INTERVAL)
            except KeyboardInterrupt:
                log.info(f"stopped - {self.stats}")
                break
            except Exception as e:
                log.error(f"poll: {e}")
                time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args()
    CheerwatchMonitor(verbose=args.verbose).run()
