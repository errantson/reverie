#!/usr/bin/env python3
"""Delete specific users from the database"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager

def delete_user(did: str):
    """Delete a user and all their associated data"""
    db = DatabaseManager()
    
    # First check if user exists
    user = db.fetch_one('SELECT did, handle, display_name FROM dreamers WHERE did = %s', (did,))
    
    if not user:
        print(f'❌ User not found: {did}')
        return False
    
    print(f'Found user:')
    print(f'  DID: {user["did"]}')
    print(f'  Handle: {user["handle"]}')
    print(f'  Name: {user["display_name"]}')
    print()
    
    # Delete from related tables (only events exists)
    db.execute('DELETE FROM events WHERE did = %s', (did,))
    print(f'  🗑️  Deleted from events table')
    
    # Finally delete the dreamer
    db.execute('DELETE FROM dreamers WHERE did = %s', (did,))
    print(f'  🗑️  Deleted dreamer record')
    
    print()
    print(f'✅ Successfully deleted user and {total_deleted} associated records')
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 delete_user.py <did>')
        print('Example: python3 delete_user.py did:plc:test123')
        sys.exit(1)
    
    did = sys.argv[1]
    delete_user(did)
