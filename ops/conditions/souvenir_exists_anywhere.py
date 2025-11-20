#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: souvenir_exists_anywhere

Checks if ANY user in the system has earned a specific souvenir.
Useful for unlocking quests after the first person completes something.
"""

from core.database import DatabaseManager
from typing import Dict

def souvenir_exists_anywhere(thread_result: Dict, quest_config: Dict, souvenir_key: str) -> Dict:
    """
    Check if ANY user has earned a specific souvenir.
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        souvenir_key: The souvenir key to check for
        
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
    
    # Connect to database to check if souvenir exists anywhere
    db = DatabaseManager()
    try:
        # Check if anyone has this souvenir
        result = db.fetch_one(
            "SELECT COUNT(*) as count FROM dreamer_souvenirs WHERE souvenir_key = %s",
            (souvenir_key,)
        )
        
        count = result['count'] if result else 0
        exists = count > 0
        
    finally:
        # If the souvenir exists anywhere, match all replies
        # This allows the quest to trigger for anyone when global condition is met
        matching_replies = replies if exists else []
    
    return {
        'success': exists,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Souvenir "{souvenir_key}" has been earned by {count} user(s)' if exists 
                  else f'Souvenir "{souvenir_key}" has not been earned by anyone yet'
    }
