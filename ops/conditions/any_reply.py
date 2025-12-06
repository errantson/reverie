#!/usr/bin/env python3
"""
Quest Condition: any_reply
Accept any reply to the quest post.
"""

from typing import Dict


def any_reply(thread_result: Dict, quest_config: Dict) -> Dict:
    """
    Accept any reply to the quest post.
    This allows both new users and existing dreamers to participate.
    """
    replies = thread_result.get('replies', [])
    
    return {
        'success': len(replies) > 0,
        'count': len(replies),
        'matching_replies': replies,
        'reason': f'Found {len(replies)} replies'
    }
