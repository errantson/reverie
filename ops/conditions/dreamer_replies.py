#!/usr/bin/env python3
"""
Quest Condition: dreamer_replies
Check for replies from existing dreamers (users IN the database).
"""

from typing import Dict
from core.database import DatabaseManager


def dreamer_replies(thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Check for replies from existing dreamers (users IN the database).
    This is used for quests that only registered users can participate in.
    """
    replies = thread_result.get('replies', [])
    
    db = DatabaseManager()
    rows = db.fetch_all("SELECT did, handle FROM dreamers")
    
    known_dids = {row['did'] for row in rows} if rows else set()
    
    matching_replies = []
    
    for reply in replies:
        author_did = reply.get('author', {}).get('did')
        
        if author_did and author_did in known_dids:
            matching_replies.append(reply)
    
    return {
        'success': len(matching_replies) > 0,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} dreamer replies'
    }
