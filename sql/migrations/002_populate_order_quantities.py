#!/usr/bin/env python3
"""
Populate quantities field for existing order events
Parses the event text to extract the number and stores it as JSON.
Also updates URI to include quantity for documentation purposes.

Run date: 2025-12-07
"""

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.database import DatabaseManager


def extract_quantity_from_event(event_text):
    """
    Extract the quantity from an event text like 'realizes five books'
    Returns the numeric quantity.
    """
    number_words = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'twenty five': 25, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'seventy five': 75, 'eighty': 80,
        'ninety': 90, 'one hundred': 100
    }
    
    event_lower = event_text.lower()
    
    # Try to find number words in the text
    for word, num in sorted(number_words.items(), key=lambda x: -len(x[0])):
        if word in event_lower:
            return num
    
    # Try to extract a numeric value
    import re
    match = re.search(r'\b(\d+)\b', event_text)
    if match:
        return int(match.group(1))
    
    # Default to 1 if no number found
    return 1


def update_order_quantities():
    """Update all existing order events with quantities JSON and enhanced URI."""
    db = DatabaseManager()
    
    print("=" * 70)
    print("POPULATING ORDER QUANTITIES (JSON FORMAT)")
    print("=" * 70)
    
    # Get all order events
    cursor = db.execute("""
        SELECT id, event, uri FROM events WHERE type = 'order'
    """)
    orders = cursor.fetchall()
    
    print(f"Found {len(orders)} order events to process")
    print()
    
    updated = 0
    for order in orders:
        order_id = order['id']
        event_text = order['event']
        current_uri = order['uri'] or ''
        
        # Extract quantity
        book_count = extract_quantity_from_event(event_text)
        
        # Create quantities JSON
        quantities = {"books": book_count}
        quantities_json = json.dumps(quantities)
        
        # Update URI to include quantity (truncate stripe reference and append quantity)
        # Format: stripe:b1XX+books:5
        if current_uri.startswith('stripe:'):
            # Keep first 12 chars of stripe reference, add quantity
            stripe_ref = current_uri[:12]  # e.g., "stripe:b1oD7"
            new_uri = f"{stripe_ref}+books:{book_count}"
        else:
            # For non-stripe URIs, just append quantity
            new_uri = f"{current_uri}+books:{book_count}" if current_uri else f"order+books:{book_count}"
        
        # Update the record
        db.execute("""
            UPDATE events 
            SET quantities = %s::jsonb, uri = %s 
            WHERE id = %s
        """, (quantities_json, new_uri, order_id))
        
        updated += 1
        print(f"✓ Order #{order_id}: '{event_text}' → quantities={quantities_json}, uri={new_uri}")
    
    print()
    print(f"✓ Updated {updated} order events with quantities JSON and enhanced URI")
    print("=" * 70)
    
    return updated


if __name__ == '__main__':
    try:
        count = update_order_quantities()
        print(f"\n✅ Migration complete! Updated {count} records.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
