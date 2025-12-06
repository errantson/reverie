#!/usr/bin/env python3
"""
has_read_book condition
Checks if a user has read a specific book via biblio.bond

Usage: has_read_book:Earthsea
"""

import requests


def evaluate(context):
    """
    Check if user has a book with matching title in biblio.bond.
    
    Args:
        context: Dict with author_did, condition_value
        
    Returns:
        bool: True if user has read the book
    """
    author_did = context.get('author_did')
    search_term = context.get('condition_value', '')
    
    if not author_did or not search_term:
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
        
        # Check if any book title contains the search term (case-insensitive)
        for book in books:
            title = book.get('title', '').lower()
            if search_term.lower() in title:
                return True
        
        return False
        
    except Exception as e:
        print(f"Error checking biblio.bond: {e}")
        return False
