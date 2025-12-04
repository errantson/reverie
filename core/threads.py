import requests
import json
import time
from typing import Optional, Dict, List, Set, Tuple
from config import Config
from .auth import AuthManager

class ThreadsManager:
    """Handles thread operations including fetching posts and processing replies."""
    
    def __init__(self):
        self.auth = AuthManager()
        self._request_cache = {}
    
    def extract_replies_from_thread(self, thread_data: Dict) -> List[Dict]:
        """Extract all replies from thread data recursively."""
        if not thread_data:
            return []
            
        thread = thread_data.get('thread', {})
        replies = thread.get('replies', [])
        
        flat_replies = []
        
        def collect_replies(reply_list):
            """Recursively collect all reply posts from nested structure."""
            for reply_item in reply_list:
                post = reply_item.get('post')
                if post:
                    flat_replies.append(post)
                    
                nested_replies = reply_item.get('replies', [])
                if nested_replies:
                    collect_replies(nested_replies)
                    
        collect_replies(replies)
        
        print(f"🔍 Extracted {len(flat_replies)} replies from thread")
        return flat_replies

    def get_thread_replies(self, post_uri: str, max_depth: int = 10, include_metadata: bool = True) -> Dict:
        """
        Get all replies to a post using getPostThread with comprehensive pagination support.
        Returns detailed statistics and all unique reply authors.
        """
        pass
        
        all_replies = []
        unique_authors = {}
        processed_uris = set()
        api_calls_made = 0
        max_depth_reached = 0
        
        thread_data = self._fetch_thread_with_fallback(post_uri, max_depth)
        if not thread_data:
            return self._empty_reply_result()
        
        api_calls_made += 1
        
        replies, authors, depth_reached = self._process_thread_data(
            thread_data, processed_uris, max_depth, include_metadata
        )
        
        all_replies.extend(replies)
        unique_authors.update(authors)
        max_depth_reached = max(max_depth_reached, depth_reached)
        
        cursor = self._extract_cursor(thread_data)
        page_count = 1
        
        while cursor and page_count < 10:
            print(f"📄 Fetching page {page_count + 1} with cursor: {cursor[:20]}...")
            
            paginated_data = self._fetch_thread_with_cursor(post_uri, cursor, max_depth)
            if not paginated_data:
                break
                
            api_calls_made += 1
            page_count += 1
            
            page_replies, page_authors, page_depth = self._process_thread_data(
                paginated_data, processed_uris, max_depth, include_metadata
            )
            
            all_replies.extend(page_replies)
            unique_authors.update(page_authors)
            max_depth_reached = max(max_depth_reached, page_depth)
            
            new_cursor = self._extract_cursor(paginated_data)
            if new_cursor == cursor:
                break
            cursor = new_cursor
        
        stats = {
            "total_replies": len(all_replies),
            "unique_authors": len(unique_authors),
            "max_depth_reached": max_depth_reached,
            "api_calls_made": api_calls_made,
            "pages_processed": page_count
        }
        
        pass
        
        return {
            "replies": all_replies,
            "authors": list(unique_authors.values()),
            "stats": stats
        }
    
    def _fetch_thread_with_fallback(self, post_uri: str, max_depth: int = 10) -> Optional[Dict]:
        """Fetch thread data with comprehensive fallback strategy."""
        token = self.auth.get_token()
        
        if token:
            result = self._try_authenticated_thread_request(post_uri, max_depth, token)
            if result:
                return result
        
        return self._try_public_thread_request(post_uri, max_depth)
    
    def _fetch_thread_with_cursor(self, post_uri: str, cursor: str, max_depth: int = 10) -> Optional[Dict]:
        """Fetch paginated thread data using cursor."""
        token = self.auth.get_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        params = {
            "uri": post_uri,
            "depth": max_depth,
            "cursor": cursor
        }
        
        pds_url = self._get_cached_pds_url()
        if pds_url and token:
            result = self._make_thread_request(pds_url, params, headers)
            if result:
                return result
        
        for server in ["https://public.api.bsky.app", "https://bsky.social"]:
            result = self._make_thread_request(server, params, {})
            if result:
                return result
        
        return None
    
    def _try_authenticated_thread_request(self, post_uri: str, max_depth: int, token: str) -> Optional[Dict]:
        """Try authenticated thread request with PDS fallback."""
        headers = {"Authorization": f"Bearer {token}"}
        params = {"uri": post_uri, "depth": max_depth}
        
        pds_url = self._get_cached_pds_url()
        if pds_url:
            result = self._make_thread_request(pds_url, params, headers)
            if result:
                return result
        
        for server in ["https://public.api.bsky.app", "https://bsky.social"]:
            result = self._make_thread_request(server, params, headers)
            if result:
                return result
        
        return None
    
    def _try_public_thread_request(self, post_uri: str, max_depth: int) -> Optional[Dict]:
        """Try public thread request without authentication."""
        params = {"uri": post_uri, "depth": max_depth}
        
        for server in ["https://public.api.bsky.app", "https://bsky.social"]:
            result = self._make_thread_request(server, params, {})
            if result:
                return result
        
        return None
    
    def _make_thread_request(self, server: str, params: Dict, headers: Dict) -> Optional[Dict]:
        """Make a single thread request with error handling."""
        url = f"{server}/xrpc/app.bsky.feed.getPostThread"
        
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"⚠️ Rate limited on {server}, waiting...")
                time.sleep(2)
                return None
            elif response.status_code == 401:
                print(f"🔑 Auth failed on {server}")
                return None
            else:
                pass
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error on {server}: {e}")
            return None
    
    def _process_thread_data(self, thread_data: Dict, processed_uris: Set[str], max_depth: int, include_metadata: bool) -> Tuple[List[Dict], Dict[str, Dict], int]:
        """Process thread data and extract replies with metadata."""
        if not thread_data:
            return [], {}, 0
        
        thread = thread_data.get('thread', {})
        if not thread:
            return [], {}, 0
        
        all_replies = []
        all_authors = {}
        max_depth_reached = 0
        
        replies = thread.get('replies', [])
        if replies:
            processed_replies, processed_authors, depth = self._process_replies_recursive(
                replies, processed_uris, 1, max_depth, include_metadata
            )
            all_replies.extend(processed_replies)
            all_authors.update(processed_authors)
            max_depth_reached = max(max_depth_reached, depth)
        
        return all_replies, all_authors, max_depth_reached
    
    def _process_replies_recursive(self, replies: List[Dict], processed_uris: Set[str], current_depth: int, max_depth: int, include_metadata: bool) -> Tuple[List[Dict], Dict[str, Dict], int]:
        """Recursively process replies at all depths."""
        if not replies or current_depth > max_depth:
            return [], {}, current_depth - 1
        
        processed_replies = []
        processed_authors = {}
        max_depth_reached = current_depth
        
        for reply_item in replies:
            post = reply_item.get('post')
            if not post:
                continue
            
            uri = post.get('uri', '')
            if not uri or uri in processed_uris:
                continue
            
            processed_uris.add(uri)
            
            author = post.get('author', {})
            author_did = author.get('did')
            author_handle = author.get('handle')
            
            if not author_did and not author_handle:
                continue
            
            author_key = author_did or author_handle
            if author_key not in processed_authors:
                processed_authors[author_key] = {
                    "did": author_did or "",
                    "handle": author_handle or "",
                    "displayName": author.get('displayName', ''),
                    "first_seen_depth": current_depth
                }
            
            reply_entry = {
                "uri": uri,
                "author": {
                    "did": author_did or "",
                    "handle": author_handle or "",
                    "displayName": author.get('displayName', '')
                },
                "record": post.get('record', {}),
                "metadata": {
                    "depth": current_depth,
                    "created_at": post.get('record', {}).get('createdAt', ''),
                    "reply_count": post.get('replyCount', 0),
                    "like_count": post.get('likeCount', 0),
                    "repost_count": post.get('repostCount', 0)
                } if include_metadata else {"depth": current_depth}
            }
            
            processed_replies.append(reply_entry)
            
            nested_replies = reply_item.get('replies', [])
            if nested_replies and current_depth < max_depth:
                nested_processed, nested_authors, nested_depth = self._process_replies_recursive(
                    nested_replies, processed_uris, current_depth + 1, max_depth, include_metadata
                )
                processed_replies.extend(nested_processed)
                processed_authors.update(nested_authors)
                max_depth_reached = max(max_depth_reached, nested_depth)
        
        return processed_replies, processed_authors, max_depth_reached
    
    def _extract_cursor(self, thread_data: Dict) -> Optional[str]:
        """Extract pagination cursor from thread data."""
        if not thread_data:
            return None
        
        cursor_locations = [
            thread_data.get('cursor'),
            thread_data.get('thread', {}).get('cursor'),
            thread_data.get('pagination', {}).get('cursor')
        ]
        
        for cursor in cursor_locations:
            if cursor and isinstance(cursor, str):
                return cursor
        
        return None
    
    def _get_cached_pds_url(self) -> Optional[str]:
        """Get cached PDS URL from auth session."""
        try:
            with open(self.auth.session_cache, 'r') as f:
                cache_data = json.load(f)
                return cache_data.get('pdsUrl')
        except:
            return None
    
    def _empty_reply_result(self) -> Dict:
        """Return empty result structure."""
        return {
            "replies": [],
            "authors": [],
            "stats": {
                "total_replies": 0,
                "unique_authors": 0,
                "max_depth_reached": 0,
                "api_calls_made": 0,
                "pages_processed": 0
            }
        }
