#!/usr/bin/env python3
"""List all dreamers and flag suspicious/test users"""

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

print('All dreamers in database:')
print('=' * 100)
for did, handle, display_name in dreamers:
    # Flag suspicious ones
    flag = ''
    if 'test' in did.lower() or (handle and 'test' in handle.lower()):
        flag = ' ⚠️  TEST'
    elif handle == 'unknown':
        flag = ' ⚠️  UNKNOWN'
    elif handle and 'blink' in handle:
        flag = ' ⚠️  FAILED'
        
    h = handle or "unknown"
    d = display_name or "(no name)"
    print(f'{h:40} | {d:25} | {did}{flag}')

print()
print('SUSPICIOUS USERS TO REVIEW:')
print('=' * 100)
suspicious = [
    (did, handle, display_name) 
    for did, handle, display_name in dreamers 
    if 'test' in did.lower() or (handle and 'test' in handle.lower()) 
    or handle == 'unknown' or (handle and 'blink' in handle)
]

if suspicious:
    for did, handle, display_name in suspicious:
        h = handle or "unknown"
        d = display_name or "(no name)"
        print(f'  • {h:40} ({d:25}) - {did}')
    print(f'\nTotal suspicious users: {len(suspicious)}')
else:
    print('  No suspicious users found.')
