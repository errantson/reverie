#!/usr/bin/env python3
"""
Bulk PLC Registration for Existing Users

Registers all existing .reverie.house users' DIDs with their handles in PLC.
This is a one-time operation to get all current users registered after the system is set up.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from utils.user_plc_registration import UserPLCRegistration


def register_all_existing_users():
    """Register all existing .reverie.house users in PLC"""
    
    db = DatabaseManager()
    registrar = UserPLCRegistration(verbose=True)
    
    # Get all reverie.house accounts
    cursor = db.execute("""
        SELECT did, handle, name, server
        FROM dreamers
        WHERE server = 'https://reverie.house'
        ORDER BY handle
    """)
    
    users = cursor.fetchall()
    
    if not users:
        print("\n❌ No reverie.house users found")
        return
    
    print(f"\n{'='*70}")
    print(f"Registering {len(users)} existing .reverie.house users in PLC")
    print(f"{'='*70}")
    
    registered = 0
    already_registered = 0
    errors = 0
    
    for user in users:
        did = user['did']
        handle = user['handle']
        name = user['name']
        
        print(f"\n📝 {handle} ({name})")
        
        # Check if already registered
        if registrar.user_has_handle_registered(did, handle):
            print(f"   ✅ Already registered in PLC")
            already_registered += 1
            continue
        
        # Queue for registration
        try:
            queue_status = registrar.queue_for_pds_registration(did, handle)
            print(f"   📋 Queued for PLC registration")
            print(f"      DID: {did}")
            registered += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            errors += 1
    
    print(f"\n{'='*70}")
    print(f"Summary:")
    print(f"  ✅ Queued for registration: {registered}")
    print(f"  ✅ Already registered: {already_registered}")
    print(f"  ❌ Errors: {errors}")
    print(f"  📊 Total: {len(users)}")
    print(f"{'='*70}\n")
    
    if registered > 0:
        print("📌 Next Steps:")
        print(f"   1. These {registered} users' handles need to be registered through the PDS")
        print("   2. The PDS has the @did-plc/lib library for proper PLC signing")
        print("   3. Each user's DID will be updated with their alsoKnownAs entry")
        print("   4. Once registered, handles will be discoverable on public Bluesky\n")


if __name__ == '__main__':
    try:
        register_all_existing_users()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
