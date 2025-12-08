#!/usr/bin/env python3
"""
Setup Test Worker

Registers a user's credentials and assigns them to a work role for testing.
This is for TESTING ONLY - production should use the proper role application workflow.

Usage:
    python scripts/setup_test_worker.py <did> <handle> <app_password> <role>

Example:
    python scripts/setup_test_worker.py did:plc:abc123 mappy.reverie.house app-xxxx-xxxx-xxxx mapper

Roles:
    - mapper: Helps users with quest mapping/retry
    - greeter: Welcomes new users to the instance
    - cogitarian: Advanced role (currently disabled)
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.encryption import encrypt_password
from core.workers import WorkerNetworkClient


def verify_credentials(did: str, handle: str, app_password: str) -> bool:
    """
    Verify app password works by attempting authentication
    
    Args:
        did: User's DID
        handle: User's handle
        app_password: App password (plaintext)
        
    Returns:
        True if authentication succeeds
    """
    print(f"🔐 Verifying credentials for {handle}...")
    
    # This is a simplified check - real verification would use WorkerNetworkClient
    # after credentials are stored
    try:
        # For now, just check format
        if not app_password.startswith('app-') or len(app_password) < 20:
            print("⚠️  Warning: App password format looks incorrect")
            print("   Should be: app-xxxx-xxxx-xxxx-xxxx")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False


def setup_test_worker(did: str, handle: str, app_password: str, role: str) -> bool:
    """
    Register test worker credentials and assign role
    
    Args:
        did: User's DID
        handle: User's handle (for display only)
        app_password: App password (plaintext, will be encrypted)
        role: Work role to assign (mapper, greeter, cogitarian)
        
    Returns:
        True if successful
    """
    valid_roles = ['mapper', 'greeter', 'cogitarian']
    
    if role not in valid_roles:
        print(f"❌ Invalid role: {role}")
        print(f"   Valid roles: {', '.join(valid_roles)}")
        return False
    
    # Verify credentials first
    if not verify_credentials(did, handle, app_password):
        response = input("Continue anyway? [y/N]: ")
        if response.lower() != 'y':
            print("Aborted.")
            return False
    
    db = DatabaseManager()
    
    try:
        # Check if role is accepting workers
        cursor = db.execute("""
            SELECT worker_limit, array_length(workers, 1) as current_count
            FROM work
            WHERE role = %s
        """, (role,))
        
        work_status = cursor.fetchone()
        if not work_status:
            print(f"❌ Role '{role}' not found in work table")
            return False
        
        current_count = work_status['current_count'] or 0
        if current_count >= work_status['worker_limit']:
            print(f"❌ Role '{role}' is full ({current_count}/{work_status['worker_limit']})")
            print(f"   Increase worker_limit or remove existing worker")
            return False
        
        # Encrypt and store credentials
        print(f"🔒 Encrypting app password...")
        encrypted = encrypt_password(app_password)
        
        db.execute("""
            INSERT INTO user_credentials (did, app_password_hash, is_valid)
            VALUES (%s, %s, true)
            ON CONFLICT (did) DO UPDATE 
            SET app_password_hash = EXCLUDED.app_password_hash,
                is_valid = true
        """, (did, encrypted))
        print(f"✅ Credentials stored for {did}")
        
        # Assign role
        db.execute("""
            INSERT INTO user_roles (did, role, status, activated_at)
            VALUES (%s, %s, 'active', NOW())
            ON CONFLICT (did, role) DO UPDATE
            SET status = 'active',
                activated_at = NOW(),
                deactivated_at = NULL
        """, (did, role))
        print(f"✅ Role '{role}' assigned to {handle}")
        
        # Update work table
        db.execute("""
            UPDATE work 
            SET workers = workers || jsonb_build_array(%s)::jsonb,
                status = CASE 
                    WHEN array_length(workers, 1) + 1 >= worker_limit THEN 'fulfilled'
                    ELSE 'seeking'
                END,
                updated_at = NOW()
            WHERE role = %s
              AND NOT workers @> jsonb_build_array(%s)::jsonb
        """, (did, role, did))
        print(f"✅ Work table updated")
        
        # Verify the setup
        cursor = db.execute("""
            SELECT ur.role, ur.status, w.workers
            FROM user_roles ur
            JOIN work w ON ur.role = w.role
            WHERE ur.did = %s AND ur.role = %s
        """, (did, role))
        
        result = cursor.fetchone()
        if result and result['status'] == 'active':
            print(f"\n🎉 Success! {handle} is now an active {role}")
            print(f"   Workers for {role}: {result['workers']}")
            return True
        else:
            print(f"⚠️  Setup completed but verification failed")
            return False
            
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point"""
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)
    
    did = sys.argv[1]
    handle = sys.argv[2]
    app_password = sys.argv[3]
    role = sys.argv[4]
    
    print(f"\n🔧 Setting up test worker")
    print(f"   DID: {did}")
    print(f"   Handle: {handle}")
    print(f"   Role: {role}")
    print()
    
    success = setup_test_worker(did, handle, app_password, role)
    
    if success:
        print(f"\n✅ Test worker setup complete!")
        print(f"\nNext steps:")
        print(f"1. Run tests: pytest tests/test_work_roles.py -v")
        print(f"2. Start {role}watch container if needed")
        print(f"3. Monitor logs for worker activity")
        sys.exit(0)
    else:
        print(f"\n❌ Test worker setup failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
