#!/usr/bin/env python3
"""
has_biblio_stamp condition
Checks if a user has a biblio.bond.stamps (or biblio.bond.completion) record for a specific list

Usage: has_biblio_stamp:at://did:plc:librarian/biblio.bond.list/3m6723l4dj22c
       has_biblio_stamp:3m6723l4dj22c  (short form - just the rkey)
"""

import requests
from typing import Dict, List


def evaluate(thread_result: Dict, quest_config: Dict, list_identifier: str) -> Dict:
    """
    Check if user has a biblio.bond stamp for a specific list.
    
    Args:
        thread_result: Dict with 'replies' list
        quest_config: Quest configuration dict
        list_identifier: Either full AT-URI or just the rkey of the list
        
    Returns:
        Dict with success, count, matching_replies, reason
    """
    replies = thread_result.get('replies', [])
    matching_replies = []
    
    if not list_identifier.strip():
        return {
            'success': False,
            'count': 0,
            'matching_replies': [],
            'reason': 'No list identifier provided'
        }
    
    # Parse list identifier (could be full AT-URI or just rkey)
    if list_identifier.startswith('at://'):
        # Full AT-URI provided
        list_uri = list_identifier
        # Extract rkey from URI: at://did:plc:xxx/biblio.bond.list/RKEY
        try:
            rkey = list_uri.split('/')[-1]
        except:
            rkey = list_identifier
    else:
        # Just rkey provided
        rkey = list_identifier
        list_uri = None  # Will construct per user
    
    # Check each reply to see if the author has a stamp for this list
    for reply in replies:
        author_did = reply.get('author', {}).get('did')
        
        if not author_did:
            continue
        
        try:
            # Query biblio.bond API for user's stamps
            # Note: This endpoint may need to be created on biblio.bond
            url = f'https://biblio.bond/api/stamps/{author_did}'
            response = requests.get(url, timeout=5)
            
            if response.status_code == 404:
                # Try alternate endpoint structure
                url = f'https://biblio.bond/api/users/{author_did}/stamps'
                response = requests.get(url, timeout=5)
            
            if not response.ok:
                # If API doesn't exist yet, try direct AT Protocol query
                # Query for biblio.bond.stamps collection
                stamps = _query_stamps_via_atproto(author_did, rkey)
                if stamps:
                    matching_replies.append(reply)
                continue
            
            stamps = response.json()
            
            if not stamps:
                continue
            
            # Check if any stamp matches the list
            for stamp in stamps:
                stamp_list_uri = stamp.get('list', '')
                
                # Match by rkey or full URI
                if rkey in stamp_list_uri or (list_uri and stamp_list_uri == list_uri):
                    matching_replies.append(reply)
                    break  # Found a match for this user
                    
        except Exception as e:
            # Log error but continue checking other replies
            print(f"has_biblio_stamp: Error checking {author_did}: {e}")
            continue
    
    success = len(matching_replies) > 0
    
    return {
        'success': success,
        'count': len(matching_replies),
        'matching_replies': matching_replies,
        'reason': f'Found {len(matching_replies)} users with stamp for list {rkey}' if success else f'No users found with stamp for list {rkey}'
    }


def _query_stamps_via_atproto(did: str, list_rkey: str) -> List[Dict]:
    """
    Query stamps directly via AT Protocol.
    
    This is a fallback if biblio.bond doesn't have an API endpoint yet.
    Uses AT Protocol's listRecords to query the user's biblio.bond.stamps collection.
    
    Args:
        did: User's DID
        list_rkey: The rkey of the list to check
        
    Returns:
        List of matching stamp records
    """
    try:
        # Query via PDS API
        # Note: This assumes the user's PDS is accessible and we know the endpoint
        # In practice, you'd need to resolve the DID to find the PDS endpoint
        
        # For now, use the public Bluesky PDS as a fallback
        url = f'https://bsky.social/xrpc/com.atproto.repo.listRecords'
        params = {
            'repo': did,
            'collection': 'biblio.bond.stamps',  # or biblio.bond.completion
            'limit': 100
        }
        
        response = requests.get(url, params=params, timeout=5)
        
        if not response.ok:
            # Try alternate collection name
            params['collection'] = 'biblio.bond.completion'
            response = requests.get(url, params=params, timeout=5)
        
        if not response.ok:
            return []
        
        data = response.json()
        records = data.get('records', [])
        
        # Filter for matching list
        matching = []
        for record in records:
            value = record.get('value', {})
            list_uri = value.get('list', '')
            
            if list_rkey in list_uri:
                matching.append(value)
        
        return matching
        
    except Exception as e:
        print(f"_query_stamps_via_atproto: Error querying {did}: {e}")
        return []


def query_user_stamps(did: str, list_rkey: str = None) -> Dict:
    """
    Standalone helper to query a user's biblio.bond stamps.
    
    Args:
        did: User's DID (e.g., 'did:plc:d5fnxwskloett4pb7dicp6c6')
        list_rkey: Optional - filter to specific list rkey (e.g., '3m6723l4dj22c')
        
    Returns:
        Dict with stamps and metadata
    """
    result = {
        'did': did,
        'stamps': [],
        'count': 0,
        'error': None
    }
    
    try:
        # Try biblio.bond API first
        url = f'https://biblio.bond/api/stamps/{did}'
        response = requests.get(url, timeout=10)
        
        if response.status_code == 404:
            # Try alternate structure
            url = f'https://biblio.bond/api/users/{did}/stamps'
            response = requests.get(url, timeout=10)
        
        if response.ok:
            stamps = response.json()
            result['stamps'] = stamps
            
            # Filter by list if specified
            if list_rkey:
                result['stamps'] = [
                    s for s in stamps 
                    if list_rkey in s.get('list', '')
                ]
        else:
            # Fallback to AT Protocol direct query
            stamps = _query_stamps_via_atproto(did, list_rkey)
            result['stamps'] = stamps
        
        result['count'] = len(result['stamps'])
        
    except Exception as e:
        result['error'] = str(e)
    
    return result


if __name__ == '__main__':
    import sys
    
    # Test the query function
    if len(sys.argv) < 2:
        print("Usage: python has_biblio_stamp.py <DID> [list_rkey]")
        print("Example: python has_biblio_stamp.py did:plc:d5fnxwskloett4pb7dicp6c6 3m6723l4dj22c")
        sys.exit(1)
    
    did = sys.argv[1]
    list_rkey = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"🔍 Querying stamps for {did}")
    if list_rkey:
        print(f"   Filtering for list: {list_rkey}")
    print()
    
    result = query_user_stamps(did, list_rkey)
    
    if result['error']:
        print(f"❌ Error: {result['error']}")
    else:
        print(f"✅ Found {result['count']} stamp(s)")
        for stamp in result['stamps']:
            print(f"\n  📚 Stamp:")
            print(f"     List: {stamp.get('list', 'N/A')}")
            print(f"     Badge: {stamp.get('badge', 'N/A')}")
            print(f"     Completed: {stamp.get('completedAt', 'N/A')}")
            if stamp.get('notes'):
                print(f"     Notes: {stamp.get('notes')}")
