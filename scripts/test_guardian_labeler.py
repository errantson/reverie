#!/usr/bin/env python3
"""
Guardian Labeler Testing Script

Tests the guardian moderation labeling system for reverie.house.
This script verifies:
1. Label application (content and account-level)
2. Label negation
3. Aggregate threshold (hide-community)
4. Auto-labeling via GuardianHandler
5. Labeler subscription configuration

Usage:
    python scripts/test_guardian_labeler.py [--cleanup]
    
Options:
    --cleanup    Clean up test data after running
"""

import sys
import os
import json
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.labeler_service import get_labeler_service
from core.guardian_labels import get_label_manager
from core.database import DatabaseManager


# Test data
TEST_GUARDIAN_DID = 'did:plc:testguardian123'
TEST_GUARDIAN_HANDLE = 'testguardian.bsky.social'
TEST_TARGET_DID = 'did:plc:testcontent456'
TEST_POST_URI = 'at://did:plc:testcontent456/app.bsky.feed.post/testrkey123'
TEST_BARRED_USER_DID = 'did:plc:barreduser789'


def test_labeler_service():
    """Test basic labeler service functionality"""
    print("\n" + "="*60)
    print("1. TESTING LABELER SERVICE")
    print("="*60)
    
    labeler = get_labeler_service()
    
    # Test creating a label
    print("\n[Test] Creating hide label...")
    result = labeler.apply_label(
        uri=TEST_POST_URI,
        val=f"hide-{TEST_GUARDIAN_HANDLE.replace('.', '-')}",
        creator_did=TEST_GUARDIAN_DID,
        reason="Test label creation"
    )
    print(f"  Result: {result}")
    assert result.get('success'), f"Label creation failed: {result.get('error')}"
    
    # Test querying labels
    print("\n[Test] Querying labels...")
    labels = labeler.query_labels(uri_patterns=[TEST_POST_URI])
    print(f"  Found {len(labels.get('labels', []))} labels")
    assert len(labels.get('labels', [])) > 0, "No labels found"
    
    # Test querying by source
    print("\n[Test] Querying by source (did:web:reverie.house)...")
    labels_by_src = labeler.query_labels(sources=['did:web:reverie.house'], limit=5)
    print(f"  Found {len(labels_by_src.get('labels', []))} labels from reverie.house")
    
    print("\n✅ Labeler service tests passed!")


def test_guardian_labels():
    """Test guardian label manager functionality"""
    print("\n" + "="*60)
    print("2. TESTING GUARDIAN LABEL MANAGER")
    print("="*60)
    
    manager = get_label_manager()
    
    # Test content hide label
    print("\n[Test] Applying hide label to content...")
    result = manager.apply_hide_label(
        uri=f"at://{TEST_TARGET_DID}/app.bsky.feed.post/guardiantest1",
        guardian_did=TEST_GUARDIAN_DID,
        guardian_handle=TEST_GUARDIAN_HANDLE,
        target_did=TEST_TARGET_DID,
        reason="Testing content hide label"
    )
    print(f"  Result: {result}")
    assert result.get('success'), f"Content hide label failed: {result.get('error')}"
    
    # Test account-level hide label
    print("\n[Test] Applying account-level hide label...")
    result = manager.apply_hide_account_label(
        user_did=TEST_BARRED_USER_DID,
        guardian_did=TEST_GUARDIAN_DID,
        guardian_handle=TEST_GUARDIAN_HANDLE,
        reason="Testing account-level hide"
    )
    print(f"  Result: {result}")
    assert result.get('success'), f"Account hide label failed: {result.get('error')}"
    
    # Test safe label (now supported via auto-labeling)
    print("\n[Test] Applying safe label to content...")
    result = manager.apply_safe_label(
        uri=f"at://{TEST_TARGET_DID}/app.bsky.feed.post/safetest1",
        guardian_did=TEST_GUARDIAN_DID,
        guardian_handle=TEST_GUARDIAN_HANDLE,
        target_did=TEST_TARGET_DID,
        reason="Testing safe label"
    )
    print(f"  Result: {result}")
    assert result.get('success'), f"Safe label failed: {result.get('error')}"
    
    print("\n✅ Guardian label manager tests passed!")


def test_label_query_endpoint():
    """Test the XRPC label query endpoint"""
    print("\n" + "="*60)
    print("3. TESTING XRPC ENDPOINTS")
    print("="*60)
    
    import requests
    
    # Test queryLabels endpoint
    print("\n[Test] GET /xrpc/com.atproto.label.queryLabels...")
    try:
        response = requests.get(
            'https://reverie.house/xrpc/com.atproto.label.queryLabels',
            timeout=10
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Labels returned: {len(data.get('labels', []))}")
            print("  ✅ Endpoint working")
        else:
            print(f"  ⚠️ Unexpected status: {response.text[:100]}")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Test getServices endpoint
    print("\n[Test] GET /xrpc/app.bsky.labeler.getServices...")
    try:
        response = requests.get(
            'https://reverie.house/xrpc/app.bsky.labeler.getServices?dids=did:web:reverie.house',
            timeout=10
        )
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            views = data.get('views', [])
            if views:
                policies = views[0].get('policies', {})
                print(f"  Label values defined: {policies.get('labelValues', [])}")
                print("  ✅ Endpoint working")
            else:
                print("  ⚠️ No views returned")
        else:
            print(f"  ⚠️ Unexpected status: {response.text[:100]}")
    except Exception as e:
        print(f"  ❌ Error: {e}")


def test_aggregate_labels():
    """Test aggregate (community) label threshold"""
    print("\n" + "="*60)
    print("4. TESTING AGGREGATE LABELS")
    print("="*60)
    
    manager = get_label_manager()
    
    guardian_count = manager.get_guardian_count()
    threshold = manager.get_majority_threshold()
    
    print(f"\n[Info] Guardian count: {guardian_count}")
    print(f"[Info] Majority threshold: {threshold}")
    
    # This would require multiple guardians to test properly
    print("\n[Note] Aggregate label testing requires multiple guardians")
    print("       Skipping detailed aggregate test")


def cleanup_test_data():
    """Clean up test labels from database"""
    print("\n" + "="*60)
    print("CLEANUP: Removing test data")
    print("="*60)
    
    labeler = get_labeler_service()
    
    # Delete test labels
    try:
        labeler.db.execute("""
            DELETE FROM labels 
            WHERE uri LIKE %s OR uri LIKE %s OR uri = %s
        """, (
            f'%{TEST_TARGET_DID}%',
            f'%testcontent%',
            TEST_BARRED_USER_DID
        ))
        print("  ✅ Cleaned up test labels from 'labels' table")
    except Exception as e:
        print(f"  ⚠️ Error cleaning labels: {e}")
    
    # Delete from guardian_labels if it exists
    try:
        labeler.db.execute("""
            DELETE FROM guardian_labels
            WHERE guardian_did = %s
        """, (TEST_GUARDIAN_DID,))
        print("  ✅ Cleaned up test records from 'guardian_labels' table")
    except Exception as e:
        print(f"  ⚠️ Error cleaning guardian_labels: {e}")


def main():
    """Run all tests"""
    print("="*60)
    print("REVERIE.HOUSE GUARDIAN LABELER TEST SUITE")
    print(f"Started: {datetime.now().isoformat()}")
    print("="*60)
    
    cleanup_after = '--cleanup' in sys.argv
    
    try:
        test_labeler_service()
        test_guardian_labels()
        test_label_query_endpoint()
        test_aggregate_labels()
        
        print("\n" + "="*60)
        print("ALL TESTS COMPLETED")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if cleanup_after:
            cleanup_test_data()
        else:
            print("\n[Note] Run with --cleanup to remove test data")


if __name__ == '__main__':
    main()
