#!/usr/bin/env python3
"""
Migrate passwords from base64 encoding to Fernet encryption.

This script:
1. Reads all credentials from the database
2. Decodes base64-encoded passwords
3. Re-encrypts them using Fernet
4. Updates the database
"""

import sys
import os
import base64

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager
from core.encryption import encrypt_password


def migrate_passwords():
    """Migrate all passwords from base64 to Fernet encryption"""
    db = DatabaseManager()
    
    print("🔍 Fetching all credentials...")
    credentials = db.fetch_all("SELECT did, password_hash FROM credentials")
    
    if not credentials:
        print("✅ No credentials found")
        return
    
    print(f"📊 Found {len(credentials)} credentials to migrate")
    
    for cred in credentials:
        did = cred['did']
        old_hash = cred['password_hash']
        
        try:
            # Try to decode as base64
            try:
                plaintext = base64.b64decode(old_hash.encode()).decode('utf-8')
                print(f"📝 {did}: Decoded from base64")
            except Exception:
                # Might already be encrypted, skip
                print(f"⏭️  {did}: Already encrypted or invalid, skipping")
                continue
            
            # Re-encrypt with Fernet
            encrypted = encrypt_password(plaintext)
            
            # Update database
            db.execute("""
                UPDATE credentials
                SET password_hash = %s
                WHERE did = %s
            """, (encrypted, did))
            
            print(f"✅ {did}: Migrated successfully")
            
        except Exception as e:
            print(f"❌ {did}: Migration failed - {e}")
    
    print("\n🎉 Migration complete!")


if __name__ == "__main__":
    migrate_passwords()
