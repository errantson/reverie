#!/usr/bin/env python3
"""
book_count_min condition
Checks if a user has read at least N books via biblio.bond

Usage: book_count_min:5
"""

import requests


def evaluate(context):
    """
    Check if user has read at least a minimum number of books.
    
    Args:
        context: Dict with author_did, condition_value (minimum count)
        
    Returns:
        bool: True if user has read at least N books
    """
    author_did = context.get('author_did')
    min_count_str = context.get('condition_value', '1')
    
    if not author_did:
        return False
    
    try:
        min_count = int(min_count_str)
    except ValueError:
        print(f"Invalid minimum count: {min_count_str}")
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
        
        # Check if count meets minimum
        return len(books) >= min_count
        
    except Exception as e:
        print(f"Error checking biblio.bond: {e}")
        return False
