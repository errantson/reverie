#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Condition: count_canon

Checks how many dreamers have a specific canon entry and compares against a threshold.
Useful for global "first N people" quests or limiting access based on completion counts.

Examples:
  - count_canon:found_glinda<1  (only if fewer than 1 person found it - i.e., no one)
  - count_canon:completed_quest>=5  (only after 5+ people completed)
  - count_canon:early_access<=10  (only first 10 people)
"""

from core.database import DatabaseManager
import re
from typing import Dict

def count_canon(thread_result: Dict, quest_config: Dict, canon_condition: str) -> Dict:
    """
    Check how many dreamers have a canon key and compare with a threshold.
    
    Format: key<operator><threshold>
    Examples: "found_glinda<1", "completed>=5", "beta_access<=100"
    
    Operators: <, <=, ==, !=, >=, >
    
    Args:
        thread_result: Dictionary with 'replies' list
        quest_config: Quest configuration dict
        canon_condition: The condition string (e.g., 'found_glinda<1', 'completed>=5')
        
    Returns:
        {
            'success': bool,
            'count': int,
            'matching_replies': List[Dict],
            'reason': str,
            'global_count': int  # Number of users who have this canon key
        }
    """
    replies = thread_result.get('replies', [])
    
    if not replies:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'global_count': 0,
            'reason': 'No replies found'
        }
    
    if not canon_condition:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'global_count': 0,
            'reason': 'No canon condition specified'
        }
    
    # Parse the condition: key<operator><threshold>
    # Operators: >=, <=, ==, !=, >, <
    # Check longest operators first to avoid false matches
    canon_key = None
    operator = None
    threshold = None
    
    for op in ['>=', '<=', '==', '!=', '>', '<']:
        if op in canon_condition:
            parts = canon_condition.split(op, 1)
            if len(parts) == 2:
                canon_key = parts[0].strip()
                operator = op
                try:
                    threshold = int(parts[1].strip())
                    break
                except ValueError:
                    pass
    
    if not canon_key or operator is None or threshold is None:
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'global_count': 0,
            'reason': f'Invalid condition format: "{canon_condition}". Expected: key<operator><number> (e.g., found_glinda<1, completed>=5)'
        }
    
    # Connect to database to check how many users have this canon entry
    db = DatabaseManager()
    try:
        # Count how many distinct users have this canon key
        result = db.fetch_one(
            "SELECT COUNT(DISTINCT did) as count FROM canon WHERE key = %s",
            (canon_key,)
        )
        
        global_count = result['count'] if result else 0
        
        # Evaluate the comparison
        if operator == '<':
            success = (global_count < threshold)
        elif operator == '<=':
            success = (global_count <= threshold)
        elif operator == '==':
            success = (global_count == threshold)
        elif operator == '!=':
            success = (global_count != threshold)
        elif operator == '>=':
            success = (global_count >= threshold)
        elif operator == '>':
            success = (global_count > threshold)
        else:
            success = False
        
        # If condition passes, all replies are valid candidates
        matching_replies = replies if success else []
    
    finally:
        pass
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'global_count': global_count,
        'reason': f'Quest can run - {global_count} dreamer(s) have "{canon_key}" ({operator} {threshold})' if success 
                  else f'Quest blocked - {global_count} dreamer(s) have "{canon_key}" (needs {operator} {threshold})'
    }
