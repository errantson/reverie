from typing import Optional, Dict, List, Tuple
from config import Config
from .auth import AuthManager
from .reactions import ReactionsManager
from .threads import ThreadsManager
from utils.identity import IdentityManager

class NetworkClient:
    """Unified network client orchestrating identity, threads, and engagement operations."""
    
    def __init__(self):
        self.auth = AuthManager()
        self.identity = IdentityManager()
        self.threads = ThreadsManager()
        self.reactions = ReactionsManager(self.auth)
    
    
    def resolve_handle(self, handle: str) -> Optional[str]:
        return self.identity.resolve_handle(handle)
    
    def get_handle_from_did(self, did: str) -> Tuple[Optional[str], Optional[str]]:
        return self.identity.get_handle_from_did(did)
    
    def get_profile(self, did: str, server: Optional[str] = None) -> Optional[Dict]:
        return self.identity.get_profile(did, server)
    
    def get_pds_from_profile(self, profile_data: Dict) -> Optional[str]:
        return self.identity.get_pds_from_profile(profile_data)
    
    def resolve_identity_complete(self, identifier: str) -> Dict:
        return self.identity.resolve_identity_complete(identifier)
    
    def batch_resolve_identities(self, identifiers: List[str]) -> Dict[str, Dict]:
        return self.identity.batch_resolve_identities(identifiers)
    
    def validate_identity(self, identifier: str) -> Tuple[bool, str]:
        return self.identity.validate_identity(identifier)
    
    
    def extract_replies_from_thread(self, thread_data: Dict) -> List[Dict]:
        return self.threads.extract_replies_from_thread(thread_data)
    
    def get_thread_replies(self, post_uri: str, max_depth: int = 10, include_metadata: bool = True) -> Dict:
        return self.threads.get_thread_replies(post_uri, max_depth, include_metadata)
    
    
    def get_post_likes(self, post_uri: str, cursor: Optional[str] = None, limit: int = 100) -> Optional[Dict]:
        return self.reactions.get_post_likes(post_uri, cursor, limit)
    
    def get_post_reposts(self, post_uri: str, cursor: Optional[str] = None, limit: int = 100) -> Optional[Dict]:
        return self.reactions.get_post_reposts(post_uri, cursor, limit)
    
    def get_engagement_stats(self, post_uri: str) -> Dict:
        return self.reactions.get_engagement_stats(post_uri)
    
    def create_like(self, post_uri: str) -> bool:
        """Create a like for a specific post."""
        return self.reactions.create_like(post_uri)
    
    def create_follow(self, target_did: str) -> bool:
        """Create a follow for a specific user."""
        return self.reactions.create_follow(target_did)
    
    def unfollow_user(self, target_did: str) -> bool:
        """Remove a follow from a specific user."""
        return self.reactions.unfollow_user(target_did)
    
    def unlike_post(self, post_uri: str) -> bool:
        """Remove a like from a specific post."""
        return self.reactions.unlike_post(post_uri)
    
    def create_post(self, text: str, reply_to: Optional[str] = None, facets: Optional[List] = None) -> Optional[Dict]:
        """
        Create a post (or reply if reply_to is specified).
        
        Args:
            text: The text content of the post
            reply_to: Optional AT URI of post to reply to
            facets: Optional list of facets for mentions, links, etc.
            
        Returns:
            Dict with 'uri' and 'cid' if successful, None if failed
        """
        return self.reactions.create_post(text, reply_to, facets)
