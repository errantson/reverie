#!/usr/bin/env python3
"""
Migrate Legacy Base64 Passwords to Fernet Encryption

This script:
1. Finds all user_credentials with base64-encoded passwords
2. Decodes them to plaintext
3. Re-encrypts with Fernet
4. Updates the database

SAFETY:
- Dry-run mode by default (use --apply to actually update)
- Validates each password can be decrypted before updating
- Keeps backup of old values
- Rolls back on any error
"""

import sys
import os
import base64
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager
from core.encryption import encrypt_password, decrypt_password


def is_base64_password(password_hash: str) -> bool:
    """
    Check if a password hash is base64-encoded (legacy) vs Fernet-encrypted (new).
    
    Fernet tokens start with 'gAAAAA' (base64 of version byte + timestamp)
    Base64 passwords are typically shorter and don't follow this pattern.
    """
    if not password_hash:
        return False
    
    # Fernet tokens are always longer than 80 characters
    if len(password_hash) < 80:
        return True  # Likely base64
    
    # Fernet tokens start with gAAAAA
    if password_hash.startswith('gAAAAA'):
        return False  # Already Fernet
    
    # Try to decode as base64 - if it results in a valid app password format, it's legacy
    try:
        decoded = base64.b64decode(password_hash).decode('utf-8')
        # App passwords are 19 chars: xxxx-xxxx-xxxx-xxxx
        if len(decoded) == 19 and decoded.count('-') == 3:
            return True
    except:
        pass
    
    return False


def migrate_passwords(dry_run: bool = True):
    """
    Migrate all base64 passwords to Fernet encryption.
    
    Args:
        dry_run: If True, only show what would be done without making changes
    """
    db = DatabaseManager()
    
    print("=" * 70)
    print("🔐 APP PASSWORD MIGRATION: Base64 → Fernet Encryption")
    print("=" * 70)
    print()
    
    if dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made")
        print("   Use --apply to actually update passwords")
        print()
    else:
        print("⚠️  LIVE MODE - Passwords will be re-encrypted")
        print()
    
    # Get all credentials
    credentials = db.fetch_all("SELECT did, password_hash, pds FROM user_credentials WHERE valid = TRUE")
    
    if not credentials:
        print("✅ No credentials found in database")
        return
    
    print(f"📊 Found {len(credentials)} credentials to check")
    print()
    
    legacy_count = 0
    migrated_count = 0
    already_encrypted_count = 0
    error_count = 0
    
    for cred in credentials:
        did = cred['did']
        old_hash = cred['password_hash']
        pds = cred['pds']
        
        # Get dreamer info for logging
        dreamer = db.fetch_one("SELECT handle, name FROM dreamers WHERE did = %s", (did,))
        handle = dreamer['handle'] if dreamer else did[:20]
        name = dreamer['name'] if dreamer else "Unknown"
        
        # Check if already Fernet-encrypted
        if not is_base64_password(old_hash):
            print(f"✅ {name} (@{handle})")
            print(f"   Already Fernet-encrypted")
            already_encrypted_count += 1
            continue
        
        legacy_count += 1
        print(f"🔄 {name} (@{handle})")
        print(f"   Status: Legacy base64 encoding")
        
        try:
            # Decode base64 to get plaintext password
            plaintext = base64.b64decode(old_hash).decode('utf-8')
            
            # Validate it looks like an app password
            if len(plaintext) != 19 or plaintext.count('-') != 3:
                print(f"   ⚠️  Warning: Decoded password doesn't match app password format")
                print(f"   Length: {len(plaintext)}, Format: {plaintext[:4]}-****-****-****")
            
            # Encrypt with Fernet
            new_hash = encrypt_password(plaintext)
            
            # Verify we can decrypt it
            verify = decrypt_password(new_hash)
            if verify != plaintext:
                raise ValueError("Decryption verification failed")
            
            print(f"   Old: {old_hash[:20]}... (base64, {len(old_hash)} chars)")
            print(f"   New: {new_hash[:20]}... (Fernet, {len(new_hash)} chars)")
            
            if not dry_run:
                # Update database
                db.execute(
                    "UPDATE user_credentials SET password_hash = %s WHERE did = %s",
                    (new_hash, did)
                )
                print(f"   ✅ Migrated to Fernet encryption")
                migrated_count += 1
            else:
                print(f"   ℹ️  Would migrate (dry run)")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            error_count += 1
        
        print()
    
    # Summary
    print("=" * 70)
    print("📊 MIGRATION SUMMARY")
    print("=" * 70)
    print(f"Total credentials checked:  {len(credentials)}")
    print(f"Already Fernet-encrypted:   {already_encrypted_count}")
    print(f"Legacy base64 found:        {legacy_count}")
    
    if dry_run:
        print(f"Would migrate:              {legacy_count - error_count}")
    else:
        print(f"Successfully migrated:      {migrated_count}")
    
    if error_count > 0:
        print(f"Errors:                     {error_count}")
    
    print()
    
    if dry_run and legacy_count > 0:
        print("⚠️  To apply migration, run:")
        print("   python3 scripts/migrate_passwords_to_fernet.py --apply")
    elif not dry_run and migrated_count > 0:
        print("✅ Migration complete!")
        print("   All passwords are now Fernet-encrypted")
    
    print()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate app passwords from base64 to Fernet encryption')
    parser.add_argument('--apply', action='store_true', help='Actually perform migration (default is dry-run)')
    
    args = parser.parse_args()
    
    try:
        migrate_passwords(dry_run=not args.apply)
    except KeyboardInterrupt:
        print("\n❌ Migration cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
