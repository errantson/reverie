#!/usr/bin/env python3
"""
Reset PDS account password by directly updating the account.sqlite database
Uses scrypt hashing compatible with the PDS
"""

import hashlib
import secrets
import base64
import sqlite3
import sys
from pathlib import Path

def generate_scrypt_hash(password: str) -> str:
    """
    Generate scrypt hash compatible with PDS format
    Format: salt:hash (both in hex)
    """
    # Generate 32-byte random salt
    salt = secrets.token_bytes(16)
    
    # Scrypt parameters (matching PDS defaults)
    # N=2^14, r=8, p=1, dkLen=64
    hash_bytes = hashlib.scrypt(
        password.encode('utf-8'),
        salt=salt,
        n=2**14,  # CPU/memory cost
        r=8,      # Block size
        p=1,      # Parallelization
        dklen=64  # Desired key length
    )
    
    # Format as salt:hash in hex
    salt_hex = salt.hex()
    hash_hex = hash_bytes.hex()
    
    return f"{salt_hex}:{hash_hex}"

def reset_password(db_path: str, did: str, new_password: str) -> bool:
    """Reset password in the PDS account database"""
    
    try:
        # Generate new password hash
        print(f"🔐 Generating scrypt hash for new password...")
        password_hash = generate_scrypt_hash(new_password)
        
        # Connect to database
        print(f"📂 Opening database: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verify account exists
        cursor.execute("SELECT email FROM account WHERE did = ?", (did,))
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Account not found: {did}")
            return False
        
        email = result[0]
        print(f"✅ Found account: {email}")
        
        # Update password
        print(f"🔑 Updating password...")
        cursor.execute(
            "UPDATE account SET passwordScrypt = ? WHERE did = ?",
            (password_hash, did)
        )
        conn.commit()
        
        print(f"✅ Password updated successfully!")
        print(f"   DID: {did}")
        print(f"   Email: {email}")
        print(f"   New password: {new_password}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python reset_pds_account.py <did> <new_password>")
        print("Example: python reset_pds_account.py did:plc:xxx mynewpass123")
        sys.exit(1)
    
    did = sys.argv[1]
    new_password = sys.argv[2]
    db_path = "/tmp/pds_account.sqlite"
    
    # Check if we need to copy the database
    if not Path(db_path).exists():
        print(f"⚠️  Database not found at {db_path}")
        print(f"   Run: docker cp reverie_pds:/pds/account.sqlite {db_path}")
        sys.exit(1)
    
    success = reset_password(db_path, did, new_password)
    
    if success:
        print(f"\n📋 Next steps:")
        print(f"   1. Copy database back: docker cp {db_path} reverie_pds:/pds/account.sqlite")
        print(f"   2. Restart PDS: docker restart reverie_pds")
        print(f"   3. Login with: {new_password}")
    
    sys.exit(0 if success else 1)
