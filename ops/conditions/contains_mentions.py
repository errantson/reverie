#!/usr/bin/env python3
"""
Quest Condition: contains_mentions
Check if replies contain @mentions.
"""

from typing import Dict


def contains_mentions(thread_result: Dict, quest_config: Dict) -> Dict:
    """Check if replies contain @mentions."""
    replies = thread_result.get('replies', [])
    
    matching_replies = []
    for reply in replies:
        reply_text = reply.get('record', {}).get('text', '')
        if '@' in reply_text:
            matching_replies.append(reply)
    
    return {
        'success': len(matching_replies) > 0,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies with mentions'
    }
