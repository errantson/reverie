#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: user_canon_not_equals

Checks if the replying user does NOT have a canon entry with a specific key=value pair.
Useful for excluding certain canon states from quest eligibility.
"""

from core.database import DatabaseManager
from typing import Dict

def user_canon_not_equals(thread_result: Dict, quest_config: Dict, canon_key: str, canon_value: str) -> Dict:
    """
    Check if the replying user does NOT have a canon entry with key=value.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_key: The canon key to check
        canon_value: The value to exclude
        
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
            
            # Check if this user's event entry has a DIFFERENT value or doesn't exist
            result = db.fetch_one(
                "SELECT event FROM events WHERE did = %s AND key = %s ORDER BY epoch DESC LIMIT 1",
                (author_did, canon_key)
            )
            
            # Match if: no entry exists, OR entry exists but has different value
            if not result or result['event'] != canon_value:
                matching_replies.append(reply)
    
    finally:
        success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users without {canon_key}={canon_value}' if success 
                  else f'All replying users have {canon_key}={canon_value}'
    }
