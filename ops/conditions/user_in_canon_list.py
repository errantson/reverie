#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: user_in_canon_list

Checks if the replying user's canon value is in a list of allowed values.
Useful for multi-zone quests or quests that apply to several canon states.
"""

from core.database import DatabaseManager
from typing import Dict, List

def user_in_canon_list(thread_result: Dict, quest_config: Dict, canon_key: str, canon_values: List[str]) -> Dict:
    """
    Check if the replying user has a canon entry with key in a list of values.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_key: The canon key to check
        canon_values: List of acceptable values
        
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
    
    if not canon_values or not isinstance(canon_values, list):
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No canon values list specified'
        }
    
    matching_replies = []
    
    # Connect to database to check canon entries
    db = DatabaseManager()
    try:
        for reply in replies:
            author_did = reply.get('author', {}).get('did')
            if not author_did:
                continue
            
            # Check if this user's canon value is in the allowed list
            result = db.fetch_one(
                "SELECT event FROM canon WHERE did = %s AND key = %s",
                (author_did, canon_key)
            )
            
            if result and result['event'] in canon_values:
                matching_replies.append(reply)
    
    finally:
        success = len(matching_replies) > 0
        values_str = ', '.join(canon_values)
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users with {canon_key} in [{values_str}]' if success 
                  else f'No replies from users with {canon_key} in [{values_str}]'
    }
