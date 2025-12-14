#!/usr/bin/env python3
"""
Manual test script for app password endpoints.

Run this to test the credential flow manually in the live system.
"""

import requests
import json
import sys


def test_credentials_flow(base_url='http://localhost:5000', token=None):
    """Test the complete credential flow."""
    
    if not token:
        print("❌ No auth token provided")
        print("Usage: python3 test_apppass_manual.py <oauth_token>")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    print("\n" + "=" * 80)
    print("TESTING APP PASSWORD CREDENTIAL FLOW")
    print("=" * 80 + "\n")
    
    # Test 1: Check credential status (should work whether credentials exist or not)
    print("1️⃣  Testing GET /api/user/credentials/status")
    print("-" * 80)
    try:
        response = requests.get(f'{base_url}/api/user/credentials/status', headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify correct field names
            if 'connected' in data:
                print("✅ Has 'connected' field")
            else:
                print("❌ Missing 'connected' field")
            
            if 'has_credentials' in data or 'exists' in data:
                print("❌ Has deprecated field names!")
                return False
            else:
                print("✅ No deprecated field names")
            
            print(f"\nCredentials connected: {data.get('connected', False)}")
        else:
            print(f"❌ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    print("\n")
    
    # Test 2: Test provisioner status (if available)
    print("2️⃣  Testing GET /api/work/provisioner/status")
    print("-" * 80)
    try:
        response = requests.get(f'{base_url}/api/work/provisioner/status', headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('active_provisioner'):
                print(f"\n✅ Active provisioner found: @{data['active_provisioner'].get('handle')}")
            else:
                print("\nℹ️  No active provisioner")
        else:
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n")
    
    # Summary
    print("=" * 80)
    print("✅ CREDENTIAL STATUS CHECK COMPLETED")
    print("=" * 80)
    print("\nNext steps:")
    print("  • If credentials are NOT connected, create app password widget should appear")
    print("  • If credentials ARE connected, city modal should appear directly")
    print("  • Verify frontend checks 'connected' field (not 'has_credentials')")
    print()
    
    return True


def test_database_direct():
    """Test database directly to verify schema."""
    print("\n" + "=" * 80)
    print("TESTING DATABASE SCHEMA")
    print("=" * 80 + "\n")
    
    try:
        import sqlite3
        conn = sqlite3.connect('/srv/reverie.house/data/reverie.db')
        conn.row_factory = sqlite3.Row
        
        # Check schema
        cursor = conn.execute("PRAGMA table_info(user_credentials)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print("user_credentials columns:")
        for col in columns:
            print(f"  • {col}")
        
        # Check for any credentials
        cursor = conn.execute("SELECT COUNT(*) as count FROM user_credentials WHERE is_valid = 1")
        count = cursor.fetchone()['count']
        print(f"\n✅ Found {count} valid credential(s)")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run tests."""
    # First test database
    db_ok = test_database_direct()
    
    # Then test API if token provided
    if len(sys.argv) > 1:
        token = sys.argv[1]
        api_ok = test_credentials_flow(token=token)
    else:
        print("\nℹ️  Skipping API tests (no token provided)")
        print("To test API endpoints, run:")
        print("  python3 test_apppass_manual.py <your_oauth_token>")
        print()
        api_ok = True
    
    return 0 if (db_ok and api_ok) else 1


if __name__ == '__main__':
    sys.exit(main())
