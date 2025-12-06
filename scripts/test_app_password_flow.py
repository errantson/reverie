#!/usr/bin/env python3
"""
test_app_password_flow.py - Test complete app password extraction/decryption/use
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from core.workers import WorkerNetworkClient
from core.encryption import encrypt_password, decrypt_password

def test_encryption_roundtrip():
    """Test encryption/decryption works correctly."""
    print("\n[1] TESTING ENCRYPTION ROUNDTRIP")
    print("-" * 50)
    
    test_password = "test-app-password-1234"
    
    try:
        # Encrypt
        encrypted = encrypt_password(test_password)
        print(f"✅ Encryption successful")
        print(f"   Encrypted length: {len(encrypted)} chars")
        
        # Decrypt
        decrypted = decrypt_password(encrypted)
        print(f"✅ Decryption successful")
        
        # Verify
        if decrypted == test_password:
            print(f"✅ Roundtrip verified - passwords match")
            return True
        else:
            print(f"❌ Roundtrip FAILED - passwords don't match")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_worker_credential_loading(role: str):
    """Test loading worker credentials from database."""
    print(f"\n[2] TESTING {role.upper()} CREDENTIAL LOADING")
    print("-" * 50)
    
    db = DatabaseManager()
    
    # Get active worker for role
    active_worker = db.fetch_one(f"""
        SELECT did FROM user_roles 
        WHERE role = %s AND status = 'active'
        LIMIT 1
    """, (role,))
    
    if not active_worker:
        print(f"❌ No active {role} found in user_roles")
        return False
    
    worker_did = active_worker['did']
    print(f"✅ Found active {role}: {worker_did}")
    
    # Load credential
    worker_client = WorkerNetworkClient.from_credentials(db, worker_did, role)
    
    if not worker_client:
        print(f"❌ Failed to create WorkerNetworkClient")
        return False
    
    print(f"✅ WorkerNetworkClient created")
    print(f"   Worker DID: {worker_client.worker_did}")
    print(f"   Worker Handle: {worker_client.worker_handle}")
    print(f"   Has encrypted password: {bool(worker_client.app_password_base64)}")
    
    return True

def test_worker_authentication(role: str, dry_run: bool = True):
    """Test worker authentication flow."""
    print(f"\n[3] TESTING {role.upper()} AUTHENTICATION")
    print("-" * 50)
    
    if dry_run:
        print("⚠️  DRY RUN MODE - Will decrypt but not authenticate")
    
    db = DatabaseManager()
    
    # Get active worker
    active_worker = db.fetch_one(f"""
        SELECT did FROM user_roles 
        WHERE role = %s AND status = 'active'
        LIMIT 1
    """, (role,))
    
    if not active_worker:
        print(f"❌ No active {role} found")
        return False
    
    worker_did = active_worker['did']
    
    # Load credential
    worker_client = WorkerNetworkClient.from_credentials(db, worker_did, role)
    
    if not worker_client:
        print(f"❌ Failed to load credentials")
        return False
    
    print(f"✅ Credentials loaded")
    
    # Test decryption (without auth)
    try:
        decrypted_password = decrypt_password(worker_client.app_password_base64)
        print(f"✅ Password decryption successful")
        print(f"   Decrypted password length: {len(decrypted_password)} chars")
        print(f"   Password starts with: {decrypted_password[:4]}...")
    except Exception as e:
        print(f"❌ Decryption failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    if dry_run:
        print("⏭️  Skipping actual authentication (dry run)")
        return True
    
    # Attempt authentication
    print(f"\n🔐 Attempting authentication...")
    try:
        if worker_client.authenticate():
            print(f"✅ Authentication successful!")
            print(f"   PDS URL: {worker_client.pds_url}")
            print(f"   Session token: {worker_client.session_token[:20]}...")
            
            # Update last_verified in database
            db.execute("""
                UPDATE user_credentials 
                SET last_verified = EXTRACT(EPOCH FROM NOW())::INTEGER
                WHERE did = %s
            """, (worker_did,))
            print(f"   Updated last_verified timestamp")
            
            return True
        else:
            print(f"❌ Authentication failed")
            return False
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_credential_validity_check():
    """Test credential validity flag system."""
    print(f"\n[4] TESTING CREDENTIAL VALIDITY SYSTEM")
    print("-" * 50)
    
    db = DatabaseManager()
    
    # Check for any invalid credentials
    invalid_creds = db.execute("""
        SELECT uc.did, d.handle, uc.last_verified,
               EXTRACT(EPOCH FROM NOW())::INTEGER - uc.last_verified as seconds_since_verified
        FROM user_credentials uc
        JOIN dreamers d ON uc.did = d.did
        WHERE uc.is_valid = false
    """)
    
    invalid_list = invalid_creds.fetchall()
    
    if not invalid_list:
        print("✅ No invalid credentials found")
    else:
        print(f"⚠️  Found {len(invalid_list)} invalid credentials:")
        for cred in invalid_list:
            print(f"   - {cred['handle']} ({cred['did']})")
            if cred['last_verified']:
                print(f"     Last verified: {cred['seconds_since_verified']} seconds ago")
    
    # Check credentials without recent verification
    old_creds = db.execute("""
        SELECT uc.did, d.handle, uc.last_verified,
               EXTRACT(EPOCH FROM NOW())::INTEGER - uc.last_verified as days_since_verified
        FROM user_credentials uc
        JOIN dreamers d ON uc.did = d.did
        WHERE uc.is_valid = true
        AND uc.last_verified < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::INTEGER
    """)
    
    old_list = old_creds.fetchall()
    
    if not old_list:
        print("✅ All valid credentials recently verified")
    else:
        print(f"⚠️  Found {len(old_list)} credentials not verified in 30+ days:")
        for cred in old_list:
            days = cred['days_since_verified'] // 86400
            print(f"   - {cred['handle']}: {days} days ago")
    
    return True

if __name__ == '__main__':
    print("\n" + "=" * 70)
    print("APP PASSWORD FLOW TEST SUITE")
    print("=" * 70)
    
    # Test 1: Encryption roundtrip
    test_encryption_roundtrip()
    
    # Test 2: Credential loading
    for role in ['greeter', 'mapper']:
        test_worker_credential_loading(role)
    
    # Test 3: Authentication (dry run by default)
    dry_run = '--live' not in sys.argv
    for role in ['greeter', 'mapper']:
        test_worker_authentication(role, dry_run=dry_run)
    
    # Test 4: Credential validity checks
    test_credential_validity_check()
    
    print("\n" + "=" * 70)
    print("TEST SUITE COMPLETE")
    if dry_run:
        print("(Run with --live to test actual authentication)")
    print("=" * 70)
