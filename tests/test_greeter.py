#!/usr/bin/env python3
"""
Test suite for the greeter quest command
Tests the greet_newcomer functionality
"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from ops.commands.greet_newcomer import greet_newcomer


def test_greet_newcomer():
    """Test greeting a newly named dreamer"""
    
    print("=" * 70)
    print("TEST: Greet Newcomer")
    print("=" * 70)
    
    # Sample reply from a newly named dreamer
    test_reply = {
        'uri': 'at://did:plc:testuser123/app.bsky.feed.post/test123',
        'author': {
            'did': 'did:plc:testuser123',
            'handle': 'testuser.bsky.social'
        },
        'record': {
            'text': 'TestName',
            'createdAt': '2025-12-15T12:00:00.000Z'
        }
    }
    
    # First, create a dreamer record with name canon
    # (In production, this would be done by name_dreamer)
    from core.database import DatabaseManager
    db = DatabaseManager()
    
    # Check if test user exists
    existing = db.fetch_one(
        "SELECT did FROM dreamers WHERE did = %s",
        (test_reply['author']['did'],)
    )
    
    if not existing:
        print("\n📝 Creating test dreamer record...")
        db.execute("""
            INSERT INTO dreamers (did, name, handle, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            test_reply['author']['did'],
            'testname',
            test_reply['author']['handle'],
            1734264000,
            1734264000
        ))
        
        # Add name canon entry
        db.execute("""
            INSERT INTO events (did, event, type, key, uri, url, epoch, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            test_reply['author']['did'],
            'spoke their name',
            'name',
            'name',
            test_reply['uri'],
            test_reply['uri'].replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/'),
            1734264000,
            1734264000
        ))
        print("✅ Test dreamer created")
    else:
        print("ℹ️  Test dreamer already exists")
    
    # Test the greeting function
    print("\n" + "=" * 70)
    print("Running greet_newcomer command...")
    print("=" * 70 + "\n")
    
    result = greet_newcomer([test_reply], {}, verbose=True)
    
    print("\n" + "=" * 70)
    print("RESULT:")
    print("=" * 70)
    print(f"Success: {result['success']}")
    print(f"Errors: {result['errors']}")
    
    if result['success']:
        print("\n✅ TEST PASSED: Greeting posted successfully")
    else:
        print("\n❌ TEST FAILED: Greeting was not posted")
        for error in result['errors']:
            print(f"   Error: {error}")
    
    return result['success']


if __name__ == '__main__':
    try:
        success = test_greet_newcomer()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
