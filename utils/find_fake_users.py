#!/usr/bin/env python3
"""Find and delete test/fake users from the database"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager

db = DatabaseManager()

# Get all dreamers
dreamers = db.fetch_all('''
    SELECT did, handle, display_name 
    FROM dreamers 
    ORDER BY handle
''')

print(f'Total dreamers in database: {len(dreamers)}')
print('=' * 100)

# Find suspicious users
suspicious = []
for did, handle, display_name in dreamers:
    h = handle or "unknown"
    d = display_name or "(no name)"
    
    reason = None
    if 'test' in did.lower():
        reason = 'TEST DID'
    elif handle and 'test' in handle.lower():
        reason = 'TEST HANDLE'
    elif handle == 'unknown':
        reason = 'NO HANDLE'
    elif handle and 'blink' in handle:
        reason = 'FAILED PROFILE FETCH (blink user)'
    
    if reason:
        suspicious.append((did, h, d, reason))
        print(f'⚠️  {h:40} | {d:25} | {reason}')
        print(f'    DID: {did}')
        print()

print('=' * 100)
print(f'Found {len(suspicious)} suspicious users')

if suspicious:
    print('\nRecommended deletions:')
    for did, handle, display_name, reason in suspicious:
        print(f'  • {handle} - {reason}')
