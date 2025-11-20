#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: user_missing_souvenir

Checks if the replying user does NOT have a specific souvenir (inverse of user_has_souvenir).
Useful for one-time quest rewards.
"""

from core.database import DatabaseManager
from typing import Dict

def user_missing_souvenir(thread_result: Dict, quest_config: Dict, souvenir_key: str) -> Dict:
    """
    Check if the replying user does NOT have a specific souvenir.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        souvenir_key: The souvenir key to check for absence
        
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
    
    if not souvenir_key:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No souvenir key specified'
        }
    
    matching_replies = []
    
    # Connect to database to check souvenirs
    db = DatabaseManager()
    try:
        for reply in replies:
            author_did = reply.get('author', {}).get('did')
            if not author_did:
                continue
            
            # Check if this user does NOT have the souvenir
            if not db.fetch_one(
                "SELECT 1 FROM dreamer_souvenirs WHERE did = %s AND souvenir_key = %s",
                (author_did, souvenir_key)
            ):
                # User does NOT have the souvenir - this is what we want
                matching_replies.append(reply)
    
    finally:
        success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies from users without souvenir "{souvenir_key}"' if success 
                  else f'All replying users already have souvenir "{souvenir_key}"'
    }
