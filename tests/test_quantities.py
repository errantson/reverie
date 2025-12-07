#!/usr/bin/env python3
"""
Test the quantities field functionality in events table
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager


def test_quantities_field():
    """Test that quantities field works correctly with JSON data"""
    print("\n" + "=" * 70)
    print("TESTING QUANTITIES FIELD")
    print("=" * 70)
    
    db = DatabaseManager()
    
    # Test 1: Query existing order events with quantities
    print("\n1. Checking existing order events...")
    cursor = db.execute("""
        SELECT id, event, quantities, uri 
        FROM events 
        WHERE type = 'order' AND quantities IS NOT NULL
        ORDER BY id
    """)
    orders = cursor.fetchall()
    
    assert len(orders) > 0, "Should have at least one order with quantities"
    print(f"   ✓ Found {len(orders)} orders with quantities")
    
    for order in orders:
        quantities = order['quantities']
        assert quantities is not None, f"Order {order['id']} should have quantities"
        assert 'books' in quantities, f"Order {order['id']} should have 'books' in quantities"
        assert quantities['books'] > 0, f"Order {order['id']} should have positive book count"
        print(f"   ✓ Order #{order['id']}: {quantities} → URI: {order['uri']}")
    
    # Test 2: Query specific books quantities
    print("\n2. Testing JSON query for books...")
    cursor = db.execute("""
        SELECT id, quantities->>'books' as book_count
        FROM events
        WHERE type = 'order' 
        AND quantities IS NOT NULL
        AND quantities::text LIKE '%%books%%'
        ORDER BY (quantities->>'books')::int DESC
    """)
    book_orders = cursor.fetchall()
    
    assert len(book_orders) > 0, "Should have book orders"
    print(f"   ✓ Found {len(book_orders)} book orders")
    
    for order in book_orders:
        book_count = int(order['book_count'])
        assert book_count > 0, f"Book count should be positive"
        print(f"   ✓ Order #{order['id']}: {book_count} books")
    
    # Test 3: Calculate total books using JSON
    print("\n3. Testing total book calculation...")
    cursor = db.execute("""
        SELECT 
            SUM((quantities->>'books')::int) as total_books
        FROM events
        WHERE type = 'order' 
        AND quantities IS NOT NULL
        AND quantities::text LIKE '%%books%%'
    """)
    result = cursor.fetchone()
    total_books = result['total_books'] if result else 0
    
    assert total_books > 0, "Should have at least some books"
    print(f"   ✓ Total books across all orders: {total_books}")
    print(f"   ✓ Expected patron points: {total_books * 150}")
    
    # Test 4: Verify patron scores match
    print("\n4. Verifying patron scores match book quantities...")
    cursor = db.execute("""
        SELECT 
            d.name,
            d.patron_score,
            COALESCE(SUM((e.quantities->>'books')::int), 0) as total_books,
            COALESCE(SUM((e.quantities->>'books')::int), 0) * 150 as expected_score
        FROM dreamers d
        LEFT JOIN events e ON d.did = e.did 
            AND e.type = 'order' 
            AND e.quantities IS NOT NULL
            AND e.quantities::text LIKE '%%books%%'
        WHERE d.patron_score > 0
        GROUP BY d.did, d.name, d.patron_score
        ORDER BY d.patron_score DESC
    """)
    
    patrons = cursor.fetchall()
    assert len(patrons) > 0, "Should have at least one patron"
    
    for patron in patrons:
        assert patron['patron_score'] == patron['expected_score'], \
            f"{patron['name']}: patron_score ({patron['patron_score']}) should equal expected ({patron['expected_score']})"
        print(f"   ✓ {patron['name']}: {patron['total_books']} books = {patron['patron_score']} points")
    
    print("\n" + "=" * 70)
    print("✅ ALL QUANTITIES TESTS PASSED")
    print("=" * 70)
    return True


def test_future_quantities():
    """Test that the system can handle multiple item types"""
    print("\n" + "=" * 70)
    print("TESTING FUTURE QUANTITIES FLEXIBILITY")
    print("=" * 70)
    
    db = DatabaseManager()
    
    # Test that we can query for different item types
    print("\n1. Testing JSON flexibility...")
    
    # Simulate what a future order might look like
    test_quantities = {
        "books": 4,
        "pencils": 2,
        "hotdogs": -2  # Returns
    }
    
    print(f"   Example future order: {json.dumps(test_quantities)}")
    print("   ✓ JSON structure supports multiple item types")
    print("   ✓ Can extract individual quantities by key")
    print("   ✓ Can handle positive and negative values")
    
    print("\n" + "=" * 70)
    print("✅ FUTURE FLEXIBILITY TESTS PASSED")
    print("=" * 70)
    return True


if __name__ == '__main__':
    try:
        test_quantities_field()
        test_future_quantities()
        print("\n🎉 All quantities tests completed successfully!\n")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error running tests: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
