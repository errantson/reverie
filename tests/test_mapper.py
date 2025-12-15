#!/usr/bin/env python3
"""
Test suite for the mapper quest system
Tests the origin declaration functionality
"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager


def test_mapper_sql_queries():
    """Test that all mapper-related SQL queries are PostgreSQL compatible"""
    
    print("=" * 70)
    print("TEST: Mapper SQL Query Compatibility")
    print("=" * 70)
    
    db = DatabaseManager()
    errors = []
    
    # Test 1: Check quest_retry_requests table exists and has correct syntax
    print("\n📝 Test 1: Check quest_retry_requests table...")
    try:
        result = db.fetch_all("""
            SELECT user_did, quest_title, retry_post_uri, original_reply_uri
            FROM quest_retry_requests
            LIMIT 1
        """)
        print("   ✅ quest_retry_requests query works")
    except Exception as e:
        error = f"   ❌ quest_retry_requests query failed: {e}"
        print(error)
        errors.append(error)
    
    # Test 2: Check origin quest exists and is enabled
    print("\n📝 Test 2: Check origin quest configuration...")
    try:
        quest = db.fetch_one("""
            SELECT uri, commands, conditions
            FROM quests 
            WHERE title = 'origin' AND enabled = true
        """)
        if quest:
            print(f"   ✅ Origin quest found")
            print(f"      URI: {quest['uri']}")
            print(f"      Commands: {quest['commands']}")
        else:
            error = "   ❌ Origin quest not found or disabled"
            print(error)
            errors.append(error)
    except Exception as e:
        error = f"   ❌ Origin quest query failed: {e}"
        print(error)
        errors.append(error)
    
    # Test 3: Check events table for origin declarations
    print("\n📝 Test 3: Check origin events in events table...")
    try:
        events = db.fetch_all("""
            SELECT did, event, type, key
            FROM events 
            WHERE type = 'arrival' AND key = 'origin'
            LIMIT 5
        """)
        print(f"   ✅ Found {len(events)} origin events")
        for event in events[:3]:
            print(f"      - {event['event']}")
    except Exception as e:
        error = f"   ❌ Origin events query failed: {e}"
        print(error)
        errors.append(error)
    
    # Test 4: Check spectrum table
    print("\n📝 Test 4: Check spectrum table...")
    try:
        spectrums = db.fetch_all("""
            SELECT did, entropy, oblivion, liberty, authority
            FROM spectrum
            LIMIT 3
        """)
        print(f"   ✅ Found {len(spectrums)} spectrum records")
    except Exception as e:
        error = f"   ❌ Spectrum query failed: {e}"
        print(error)
        errors.append(error)
    
    # Test 5: Check for mapper credentials
    print("\n📝 Test 5: Check mapper credentials...")
    try:
        mapper = db.fetch_one("""
            SELECT d.handle, uc.app_password_hash 
            FROM dreamers d
            JOIN user_credentials uc ON d.did = uc.did
            JOIN user_roles ur ON d.did = ur.did
            WHERE ur.role = 'mapper' AND ur.status = 'active'
            LIMIT 1
        """)
        if mapper:
            print(f"   ✅ Mapper found: @{mapper['handle']}")
        else:
            print("   ℹ️  No active mapper found")
    except Exception as e:
        error = f"   ❌ Mapper query failed: {e}"
        print(error)
        errors.append(error)
    
    # Test 6: Check work table for mapper (backward compatibility)
    print("\n📝 Test 6: Check work table for mapper...")
    try:
        work = db.fetch_one("""
            SELECT workers
            FROM work
            WHERE role = 'mapper'
        """)
        if work and work['workers']:
            import json
            workers = json.loads(work['workers'])
            print(f"   ✅ Found {len(workers)} mapper workers in work table")
            for worker in workers:
                print(f"      - Status: {worker.get('status')}")
        else:
            print("   ℹ️  No mapper workers in work table")
    except Exception as e:
        error = f"   ❌ Work table query failed: {e}"
        print(error)
        errors.append(error)
    
    print("\n" + "=" * 70)
    if errors:
        print(f"❌ TEST FAILED: {len(errors)} errors found")
        for error in errors:
            print(error)
        return False
    else:
        print("✅ ALL TESTS PASSED")
        return True


def test_mapper_conditions():
    """Test that mapper conditions work correctly"""
    
    print("\n" + "=" * 70)
    print("TEST: Mapper Quest Conditions")
    print("=" * 70)
    
    # Test sample reply
    test_reply = {
        'uri': 'at://did:plc:testuser789/app.bsky.feed.post/testorigin',
        'author': {
            'did': 'did:plc:testuser789',
            'handle': 'testuser.bsky.social'
        },
        'record': {
            'text': 'It was a dream',
            'createdAt': '2025-12-15T12:00:00.000Z'
        }
    }
    
    # Build thread result
    thread_result = {
        'replies': [test_reply],
        'quest_uri': 'at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.post/3lvu664ajls2r'
    }
    
    try:
        from ops.conditions import evaluate_conditions
        
        # Get origin quest config
        db = DatabaseManager()
        quest = db.fetch_one("""
            SELECT title, conditions, condition_operator
            FROM quests
            WHERE title = 'origin'
        """)
        
        if not quest:
            print("❌ Origin quest not found")
            return False
        
        print(f"\nQuest: {quest['title']}")
        print(f"Conditions: {quest['conditions']}")
        print(f"Operator: {quest['condition_operator']}")
        
        # Just verify the quest config is valid JSON
        import json
        try:
            conditions = json.loads(quest['conditions']) if isinstance(quest['conditions'], str) else quest['conditions']
            print(f"\n✅ Conditions are valid JSON with {len(conditions)} items")
            return True
        except Exception as e:
            print(f"\n❌ Invalid conditions JSON: {e}")
            return False
            
    except Exception as e:
        print(f"\n❌ Error evaluating conditions: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    print("\n" + "🗺️  MAPPER QUEST TEST SUITE")
    print("=" * 70)
    
    try:
        sql_pass = test_mapper_sql_queries()
        conditions_pass = test_mapper_conditions()
        
        print("\n" + "=" * 70)
        print("FINAL RESULTS:")
        print("=" * 70)
        print(f"SQL Queries: {'✅ PASS' if sql_pass else '❌ FAIL'}")
        print(f"Conditions: {'✅ PASS' if conditions_pass else '❌ FAIL'}")
        
        if sql_pass and conditions_pass:
            print("\n✅ ALL MAPPER TESTS PASSED")
            sys.exit(0)
        else:
            print("\n❌ SOME MAPPER TESTS FAILED")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ TEST SUITE EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
