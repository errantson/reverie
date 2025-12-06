#!/usr/bin/env python3
"""
Quest Condition: reply_contains
Check for replies containing specific text.
"""

import re
from typing import Dict


def reply_contains(thread_result: Dict, quest_config: Dict, search_text: str) -> Dict:
    """
    Check for replies containing specific text.
    search_text can use | for OR logic: "word1|word2|word3"
    Punctuation-tolerant: removes common punctuation before matching.
    """
    replies = thread_result.get('replies', [])
    
    search_terms = [term.strip().lower() for term in search_text.split('|')]
    
    matching_replies = []
    
    for reply in replies:
        reply_text = reply.get('record', {}).get('text', '').lower()
        
        # Remove common punctuation for more tolerant matching
        reply_text_normalized = re.sub(r'[.,!?;:\'"()\[\]{}]', '', reply_text)
        
        # Check both original and normalized text
        for term in search_terms:
            term_normalized = re.sub(r'[.,!?;:\'"()\[\]{}]', '', term)
            if term in reply_text or term_normalized in reply_text_normalized:
                matching_replies.append(reply)
                break
    
    return {
        'success': len(matching_replies) > 0,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} replies containing "{search_text}"'
    }
