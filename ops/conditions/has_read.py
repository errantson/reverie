#!/usr/bin/env python3
"""
has_read condition
Checks if a user has a biblio.bond.book record matching a title

Usage: has_read:Earthsea
       has_read:Wizard of Earthsea
"""

import requests


def evaluate(thread_result, quest_config, book_title):
    """
    Check if user has read a book matching the given title.
    
    Args:
        thread_result: Dict with 'replies' list
        quest_config: Quest configuration dict
        book_title: Book title to search for
        
    Returns:
        Dict with success, count, matching_replies, reason
    """
    replies = thread_result.get('replies', [])
    matching_replies = []
    
    if not book_title.strip():
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No book title provided'
        }
    
    title_lower = book_title.strip().lower()
    
    # Check each reply to see if the author has read the book
    for reply in replies:
        author_did = reply.get('author', {}).get('did')
        
        if not author_did:
            continue
        
        try:
            # Query biblio.bond API for user's books
            url = f'https://biblio.bond/api/books/{author_did}'
            response = requests.get(url, timeout=5)
            
            if not response.ok:
                continue
            
            books = response.json()
            
            if not books:
                continue
            
            # Case-insensitive partial match on title
            for book in books:
                book_title_check = book.get('title', '').lower()
                if title_lower in book_title_check:
                    matching_replies.append(reply)
                    break  # Found a match for this user, move to next reply
                    
        except Exception as e:
            # Log error but continue checking other replies
            print(f"has_read: Error checking {author_did}: {e}")
            continue
    
    success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} readers who have read "{book_title}"' if success else f'No readers found who have read "{book_title}"'
    }
