#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: user_canon_equals

Checks if the replying user has a canon entry with a specific key AND value.
Useful for gating quests by canon state (e.g., zone membership, quest completion stages).
"""

from core.database import DatabaseManager
from typing import Dict

def user_canon_equals(thread_result: Dict, quest_config: Dict, canon_key: str, canon_value: str) -> Dict:
    """
    Check if the replying user has a canon entry with a specific key=value pair.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_key: The canon key to check
        canon_value: The expected value for that key
        
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
    
    if not canon_value:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No canon value specified'
        }
    
    matching_replies = []
    
    # Connect to database to check canon entries
    db = DatabaseManager()
    try:
        for reply in replies:
            author_did = reply.get('author', {}).get('did')
            if not author_did:
                continue
            
            # Check if this user has a canon entry with this key=value
            result = db.fetch_one(
                "SELECT event FROM canon WHERE did = %s AND key = %s",
                (author_did, canon_key)
            )
            
            if result and result['event'] == canon_value:
                matching_replies.append(reply)
    
    finally:
        success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users with {canon_key}={canon_value}' if success 
                  else f'No replies from users with {canon_key}={canon_value}'
    }
