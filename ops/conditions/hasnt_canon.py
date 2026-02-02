#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: hasnt_canon

Checks if the replying user does NOT have a specific canon entry (inverse of has_canon).
Useful for first-time quest triggers and preventing duplicates.
"""

from typing import Dict

def hasnt_canon(thread_result: Dict, quest_config: Dict, canon_key: str) -> Dict:
    """
    Check if the replying user does NOT have a specific canon entry.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_key: The canon key to check for absence
        
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
    
    # Use DatabaseManager to get proper connection
    from core.database import DatabaseManager
    db = DatabaseManager()
    
    try:
        for reply in replies:
            author_did = reply.get('author', {}).get('did')
            if not author_did:
                continue
            
            # Check if this user does NOT have a canon entry with this key
            # Note: add_canon writes to the EVENTS table, not the canon table
            if not db.fetch_one(
                "SELECT 1 FROM events WHERE did = %s AND key = %s",
                (author_did, canon_key)
            ):
                # User does NOT have the canon entry - this is what we want
                matching_replies.append(reply)
    
    except Exception as e:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': f'Database error: {e}'
        }
    
    success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users without canon entry "{canon_key}"' if success 
                  else f'All replying users already have canon entry "{canon_key}"'
    }
