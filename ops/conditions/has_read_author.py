#!/usr/bin/env python3
"""
has_read_author condition
Checks if a user has read any books by a specific author via biblio.bond

Usage: has_read_author:Ursula K. Le Guin
"""

import requests


def evaluate(context):
    """
    Check if user has read any books by a specific author.
    
    Args:
        context: Dict with author_did, condition_value
        
    Returns:
        bool: True if user has read books by this author
    """
    author_did = context.get('author_did')
    search_author = context.get('condition_value', '')
    
    if not author_did or not search_author:
        return False
    
    try:
        # Query biblio.bond API for user's books
        response = requests.get(
            f'https://biblio.bond/api/books/{author_did}',
            timeout=5
        )
        
        if not response.ok:
            return False
        
        books = response.json()
        
        # Check if any book author matches (case-insensitive, partial match)
        for book in books:
            author = book.get('author', '').lower()
            if search_author.lower() in author:
                return True
        
        return False
        
    except Exception as e:
        print(f"Error checking biblio.bond: {e}")
        return False
