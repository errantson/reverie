#!/usr/bin/env python3
"""
Quest Condition: new_reply
Check for replies from users NOT in the dreamers database.
"""

from typing import Dict
from core.database import DatabaseManager


def new_reply(thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Check for replies from users NOT in the dreamers database.
    This is used for registration/onboarding quests.
    """
    replies = thread_result.get('replies', [])
    
    db = DatabaseManager()
    rows = db.fetch_all("SELECT did, handle FROM dreamers")
    
    known_dids = {row['did'] for row in rows} if rows else set()
    known_handles = {row['handle'] for row in rows} if rows else set()
    
    matching_replies = []
    
    for reply in replies:
        author_did = reply.get('author', {}).get('did')
        author_handle = reply.get('author', {}).get('handle')
        
        is_new = (
            author_did and 
            author_handle and 
            author_did not in known_dids and
            author_handle not in known_handles
        )
        
        if is_new:
            matching_replies.append(reply)
    
    return {
        'success': len(matching_replies) > 0,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} new users'
    }
