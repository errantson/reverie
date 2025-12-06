#!/usr/bin/env python3
"""
Quick Test Runner for Work Roles

Run this to quickly test all work roles are functional:
- Authentication works
- App passwords are valid
- Workers can create/delete posts
- Service endpoints are accessible

Requirements:
- PostgreSQL must be running (docker or localhost)
- Set POSTGRES_HOST env var if needed: export POSTGRES_HOST=localhost

Usage:
    python3 tests/run_work_tests.py              # Run all tests
    python3 tests/run_work_tests.py --role greeter  # Test specific role
    python3 tests/run_work_tests.py --quick        # Skip write tests
"""

import sys
import argparse
import os
from pathlib import Path

# Ensure we're using localhost for DB connection when running outside Docker
if 'POSTGRES_HOST' not in os.environ:
    os.environ['POSTGRES_HOST'] = 'localhost'

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.workers import WorkerNetworkClient
from core.encryption import decrypt_password
import time


def test_role(role: str, skip_write: bool = False):
    """Test a specific work role"""
    print(f"\n{'='*70}")
    print(f"Testing {role.upper()} Role")
    print(f"{'='*70}\n")
    
    db = DatabaseManager()
    
    # 1. Check role exists
    print(f"[1/6] Checking role definition...")
    role_def = db.fetch_one("""
        SELECT role, worker_limit, requires_password 
        FROM work 
        WHERE role = %s
    """, (role,))
    
    if not role_def:
        print(f"❌ Role '{role}' not found in work table")
        return False
    
    print(f"✅ Role exists (limit: {role_def['worker_limit']}, requires_password: {role_def['requires_password']})")
    
    # 2. Check for active worker
    print(f"\n[2/6] Checking for active workers...")
    worker = db.fetch_one("""
        SELECT ur.did, d.handle, d.name
        FROM user_roles ur
        JOIN dreamers d ON ur.did = d.did
        WHERE ur.role = %s AND ur.status = 'active'
        LIMIT 1
    """, (role,))
    
    if not worker:
        print(f"⚠️  No active {role} found - skipping authentication tests")
        return True
    
    print(f"✅ Active {role}: @{worker['handle']} ({worker['name']})")
    
    # 3. Check credentials exist
    print(f"\n[3/6] Checking stored credentials...")
    cred = db.fetch_one("""
        SELECT password_hash, valid 
        FROM user_credentials 
        WHERE did = %s
    """, (worker['did'],))
    
    if not cred:
        print(f"❌ No credentials found for {worker['handle']}")
        return False
    
    if not cred['valid']:
        print(f"❌ Credentials marked as invalid for {worker['handle']}")
        return False
    
    print(f"✅ Credentials exist and marked valid")
    
    # 4. Test password decryption
    print(f"\n[4/6] Testing password decryption...")
    try:
        decrypted = decrypt_password(cred['password_hash'])
        print(f"✅ Password decrypted successfully")
    except Exception as e:
        print(f"❌ Failed to decrypt password: {e}")
        return False
    
    # 5. Test authentication
    print(f"\n[5/6] Testing ATProto authentication...")
    client = WorkerNetworkClient.from_credentials(db, worker['did'], role)
    
    if not client:
        print(f"❌ Failed to create WorkerNetworkClient")
        return False
    
    auth_success = client.authenticate()
    
    if not auth_success:
        print(f"❌ Authentication failed")
        return False
    
    print(f"✅ Authenticated successfully")
    print(f"   PDS: {client.pds_url}")
    print(f"   Session token: {'*' * 20}...{client.session_token[-10:] if client.session_token else 'None'}")
    
    # 6. Test create/delete post (proof of write access)
    if not skip_write:
        print(f"\n[6/6] Testing create/delete post (proof of write access)...")
        
        try:
            # Create test post
            test_text = f"🧪 Test post from work role integration test\nRole: {role}\nTimestamp: {int(time.time())}"
            post_result = client.create_post(text=test_text)
            
            if not post_result:
                print(f"❌ Failed to create test post")
                return False
            
            post_uri = post_result.get('uri')
            print(f"✅ Created test post: {post_uri}")
            
            # Wait a moment
            time.sleep(1)
            
            # Delete test post
            delete_success = client.delete_post(post_uri)
            
            if not delete_success:
                print(f"⚠️  Failed to delete test post (post may still exist)")
                print(f"   Manual cleanup needed: {post_uri}")
                return False
            
            print(f"✅ Deleted test post successfully")
            
        except Exception as e:
            print(f"❌ Error during write test: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print(f"\n[6/6] Skipping write test (--quick mode)")
    
    print(f"\n{'='*70}")
    print(f"✅ ALL TESTS PASSED FOR {role.upper()}")
    print(f"{'='*70}\n")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='Test work role functionality')
    parser.add_argument('--role', type=str, help='Test specific role only')
    parser.add_argument('--quick', action='store_true', help='Skip write tests')
    args = parser.parse_args()
    
    # Determine which roles to test
    if args.role:
        roles = [args.role]
    else:
        roles = ['greeter', 'mapper', 'cogitarian']
    
    print("\n" + "="*70)
    print("WORK ROLES INTEGRATION TEST SUITE")
    print("="*70)
    
    if args.quick:
        print("⚡ QUICK MODE: Skipping write tests")
    
    results = {}
    
    for role in roles:
        try:
            success = test_role(role, skip_write=args.quick)
            results[role] = success
        except Exception as e:
            print(f"\n❌ UNEXPECTED ERROR testing {role}: {e}")
            import traceback
            traceback.print_exc()
            results[role] = False
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    for role, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {role}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())
