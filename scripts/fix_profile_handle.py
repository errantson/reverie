#!/usr/bin/env python3
"""
Fix Profile Handle Script
Fixes user profiles that are missing the handle field
"""

import sys
import os

sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager
from utils.update_profile import fix_profile_handle

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_profile_handle.py <handle>")
        print("Example: python fix_profile_handle.py newcomer.reverie.house")
        sys.exit(1)
    
    handle = sys.argv[1].lower()
    
    db = DatabaseManager()
    
    # Look up user by handle
    user = db.fetch_one("SELECT did, handle FROM dreamers WHERE LOWER(handle) = %s", (handle.lower(),))
    
    if not user:
        print(f"❌ User not found: {handle}")
        sys.exit(1)
    
    did = user['did']
    current_handle = user['handle']
    
    print(f"🔧 Fixing profile handle for: @{current_handle}")
    print(f"   DID: {did}")
    
    result = fix_profile_handle(did, current_handle)
    
    if result.get('success'):
        print(f"✅ {result.get('message')}")
    else:
        print(f"❌ Error: {result.get('error')}")
        sys.exit(1)

if __name__ == '__main__':
    main()
