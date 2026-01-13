#!/usr/bin/env python3
"""
Profile Refresh Utility
Refreshes profile data (avatar, display name, description) and designation
from Bluesky for dreamers with outdated information.
"""

import sys
import time
sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager
from core.network import NetworkClient
from datetime import datetime, timedelta


def refresh_profile(did: str, handle: str, verbose: bool = True, refresh_designation: bool = True) -> bool:
    """
    Refresh a single dreamer's profile from Bluesky.
    
    Args:
        did: User's DID
        handle: User's handle
        verbose: Print progress messages
        refresh_designation: Also recalculate and update designation
    
    Returns:
        True if successful, False otherwise
    """
    try:
        network = NetworkClient()
        db = DatabaseManager()
        
        # Check if user is deactivated - don't refresh deleted/dissipated accounts
        deactivated_check = db.fetch_one(
            "SELECT deactivated FROM dreamers WHERE did = %s", (did,)
        )
        if deactivated_check and deactivated_check.get('deactivated'):
            if verbose:
                print(f"⏭️  Skipping @{handle} (deactivated/dissipated)")
            return True  # Return True since skipping is intentional, not a failure
        
        if verbose:
            print(f"🔄 Refreshing @{handle} ({did[:20]}...)")
        
        # Fetch latest profile
        profile = network.get_profile(did)
        
        if not profile:
            if verbose:
                print(f"   ❌ Could not fetch profile")
            return False
        
        # Extract fields - only update if values are non-empty
        # This prevents overwriting valid data with empty responses
        updates = {}
        
        if 'displayName' in profile and profile['displayName']:
            updates['display_name'] = profile['displayName']
        
        if 'description' in profile:
            # Description can legitimately be empty, so always update
            updates['description'] = profile['description']
        
        if 'avatar' in profile and profile['avatar']:
            updates['avatar'] = profile['avatar']
        
        if 'banner' in profile and profile['banner']:
            updates['banner'] = profile['banner']
        
        if 'followersCount' in profile:
            updates['followers_count'] = profile['followersCount']
        
        if 'followsCount' in profile:
            updates['follows_count'] = profile['followsCount']
        
        if 'postsCount' in profile:
            updates['posts_count'] = profile['postsCount']
        
        if not updates:
            if verbose:
                print(f"   ℹ️  No changes detected")
            return True
        
        # Update database
        updates['updated_at'] = int(time.time())
        
        set_parts = []
        values = []
        
        for key, value in updates.items():
            set_parts.append(f"{key} = %s")
            values.append(value)
        
        values.append(did)
        
        sql = f"UPDATE dreamers SET {', '.join(set_parts)} WHERE did = %s"
        db.execute(sql, tuple(values))
        
        if verbose:
            changes = []
            if 'display_name' in updates:
                changes.append(f"name: {updates['display_name']}")
            if 'avatar' in updates:
                changes.append("avatar")
            if 'description' in updates:
                changes.append("bio")
            
            print(f"   ✅ Updated: {', '.join(changes)}")
        
        # Also refresh designation if requested
        if refresh_designation:
            try:
                from utils.designation import Designation
                
                # Get server from database
                server_row = db.fetch_one("SELECT server FROM dreamers WHERE did = %s", (did,))
                server = server_row['server'] if server_row else None
                
                old_designation_row = db.fetch_one("SELECT designation FROM dreamers WHERE did = %s", (did,))
                old_designation = old_designation_row['designation'] if old_designation_row else None
                
                new_designation = Designation.calculate_and_save(did, handle, server)
                
                if verbose and new_designation != old_designation:
                    print(f"   🏷️  Designation: {old_designation} → {new_designation}")
            except Exception as e:
                if verbose:
                    print(f"   ⚠️  Could not refresh designation: {e}")
        
        return True
        
    except Exception as e:
        if verbose:
            print(f"   ❌ Error: {e}")
        return False


def refresh_all_profiles(days_old: int = 7, limit: int = None, verbose: bool = True):
    """
    Refresh profiles for dreamers that haven't been updated recently.
    
    Args:
        days_old: Only refresh profiles older than this many days (default: 7)
        limit: Maximum number of profiles to refresh (None = all)
        verbose: Print progress
    """
    db = DatabaseManager()
    
    cutoff_timestamp = int((datetime.now() - timedelta(days=days_old)).timestamp())
    
    # Get dreamers with outdated profiles (excluding deactivated/dissipated accounts)
    query = """
        SELECT did, handle, name, updated_at
        FROM dreamers
        WHERE (updated_at < %s OR updated_at IS NULL)
          AND (deactivated IS NULL OR deactivated = FALSE)
        ORDER BY updated_at ASC NULLS FIRST
    """
    
    params = [cutoff_timestamp]
    if limit:
        query += " LIMIT %s"
        params.append(limit)
    
    dreamers = db.fetch_all(query, tuple(params))
    
    if not dreamers:
        print(f"✅ All profiles are up to date (within {days_old} days)")
        return
    
    print(f"📋 Found {len(dreamers)} dreamers with outdated profiles")
    print(f"   Cutoff: {days_old} days ago (timestamp: {cutoff_timestamp})")
    print()
    
    success_count = 0
    fail_count = 0
    
    for i, dreamer in enumerate(dreamers, 1):
        if verbose:
            print(f"[{i}/{len(dreamers)}] ", end='')
        
        if refresh_profile(dreamer['did'], dreamer['handle'], verbose):
            success_count += 1
        else:
            fail_count += 1
        
        # Small delay to avoid rate limiting
        if i < len(dreamers):
            time.sleep(0.5)
    
    print()
    print("="*70)
    print(f"✅ Refreshed: {success_count}")
    print(f"❌ Failed: {fail_count}")
    print(f"📊 Total: {len(dreamers)}")


def refresh_specific_dreamers(handles: list, verbose: bool = True):
    """
    Refresh specific dreamers by handle.
    
    Args:
        handles: List of handles to refresh
        verbose: Print progress
    """
    db = DatabaseManager()
    
    print(f"📋 Refreshing {len(handles)} specific dreamers")
    print()
    
    success_count = 0
    fail_count = 0
    
    for i, handle in enumerate(handles, 1):
        # Look up DID
        dreamer = db.fetch_one(
            "SELECT did, handle FROM dreamers WHERE handle = %s",
            (handle,)
        )
        
        if not dreamer:
            print(f"[{i}/{len(handles)}] ❌ @{handle} not found in database")
            fail_count += 1
            continue
        
        if verbose:
            print(f"[{i}/{len(handles)}] ", end='')
        
        if refresh_profile(dreamer['did'], dreamer['handle'], verbose):
            success_count += 1
        else:
            fail_count += 1
        
        # Small delay
        if i < len(handles):
            time.sleep(0.5)
    
    print()
    print("="*70)
    print(f"✅ Refreshed: {success_count}")
    print(f"❌ Failed: {fail_count}")
    print(f"📊 Total: {len(handles)}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Refresh dreamer profiles from Bluesky')
    parser.add_argument('--all', action='store_true', help='Refresh all outdated profiles')
    parser.add_argument('--days', type=int, default=7, help='Consider profiles older than N days as outdated (default: 7)')
    parser.add_argument('--limit', type=int, help='Limit number of profiles to refresh')
    parser.add_argument('--handles', nargs='+', help='Specific handles to refresh')
    parser.add_argument('--quiet', action='store_true', help='Less verbose output')
    
    args = parser.parse_args()
    
    verbose = not args.quiet
    
    if args.handles:
        refresh_specific_dreamers(args.handles, verbose=verbose)
    elif args.all:
        refresh_all_profiles(days_old=args.days, limit=args.limit, verbose=verbose)
    else:
        parser.print_help()
