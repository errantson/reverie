#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: has_canon

Checks if the replying user has a specific canon entry (by key).
Useful for checking quest completion or milestone tracking.
"""

from core.database import DatabaseManager
from typing import Dict

def has_canon(thread_result: Dict, quest_config: Dict, canon_key: str) -> Dict:
    """
    Check if the replying user has a specific canon entry.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_key: The canon key to check for
        
    Returns:
        {
            'success': bool,
            'count': int,
            'matching_replies': List[Dict],
            'reason': str
        }
    """
    replies = thread_result.get('replies', [])
    
    if not replies:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No replies found'
        }
    
    if not canon_key:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No canon key specified'
        }
    
    matching_replies = []
    
    # Connect to database to check canon entries
    db = DatabaseManager()
    try:
        for reply in replies:
            author_did = reply.get('author', {}).get('did')
            if not author_did:
                continue
            
            # Check if this user has a canon entry with this key
            # Note: add_canon writes to the EVENTS table, not the canon table
            if db.fetch_one(
                "SELECT 1 FROM events WHERE did = %s AND key = %s",
                (author_did, canon_key)
            ):
                matching_replies.append(reply)
    
    finally:
        pass  # DatabaseManager auto-closes
    
    success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users with canon entry "{canon_key}"' if success 
                  else f'No replies from users with canon entry "{canon_key}"'
    }
