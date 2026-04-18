#!/usr/bin/env python3
"""
Profile Refresh Utility
Refreshes profile data (avatar, display name, description) and designation
from Bluesky for dreamers with outdated information.
"""

import os
import sys
import time
sys.path.insert(0, '/srv/reverie.house')

from core.database import DatabaseManager

# AppView cache proxy (local)
BSKY_CACHE = 'http://127.0.0.1:2847'

# Inside Docker: /srv/reverie.house → /srv
AVATAR_CACHE_DIR = '/srv/site/assets/cached/avatars'
from core.network import NetworkClient
from datetime import datetime, timedelta


def cache_avatar(did: str, avatar_url: str, verbose: bool = False) -> bool:
    """Download and cache a CDN avatar locally for posterity."""
    if not avatar_url or not avatar_url.startswith('https://cdn.bsky.app/'):
        return False
    try:
        import requests
        safe_did = did.replace(':', '_')
        cache_path = os.path.join(AVATAR_CACHE_DIR, f"{safe_did}.jpg")
        resp = requests.get(avatar_url, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 100:
            with open(cache_path, 'wb') as f:
                f.write(resp.content)
            if verbose:
                print(f"   💾 Cached avatar locally ({len(resp.content)} bytes)")
            return True
        elif verbose:
            print(f"   ⚠️  Avatar cache failed: HTTP {resp.status_code}")
    except Exception as e:
        if verbose:
            print(f"   ⚠️  Avatar cache error: {e}")
    return False


def get_cached_avatar_path(did: str) -> str:
    """Return the local cached avatar path if it exists, else empty string."""
    safe_did = did.replace(':', '_')
    path = os.path.join(AVATAR_CACHE_DIR, f"{safe_did}.jpg")
    if os.path.exists(path):
        return f"/assets/cached/avatars/{safe_did}.jpg"
    return ''


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
                print(f"   ❌ Could not fetch profile — checking avatar health")
            # Profile unreachable — check if existing CDN avatar is still alive.
            # If CDN returns 404, fall back to local cache or default.
            existing = db.fetch_one(
                "SELECT avatar FROM dreamers WHERE did = %s", (did,)
            )
            existing_avatar = (existing or {}).get('avatar', '')
            if existing_avatar and existing_avatar.startswith('https://cdn.bsky.app/'):
                import requests as _req
                try:
                    head = _req.head(existing_avatar, timeout=8, allow_redirects=True)
                    if head.status_code >= 400:
                        cached = get_cached_avatar_path(did)
                        fallback = cached or '/assets/avatars/avatar001.png'
                        db.execute(
                            "UPDATE dreamers SET avatar = %s WHERE did = %s",
                            (fallback, did)
                        )
                        if verbose:
                            print(f"   🔄 CDN avatar gone (HTTP {head.status_code}), fell back to {fallback}")
                except Exception:
                    pass  # Network issue — leave as-is, will retry next cycle
            return False
        
        # Extract fields - only update if values are non-empty
        # This prevents overwriting valid data with empty responses
        updates = {}
        
        if 'displayName' in profile and profile['displayName']:
            updates['display_name'] = profile['displayName']
        
        if 'description' in profile:
            # Description can legitimately be empty, so always update
            updates['description'] = profile['description']
        
        from utils.identity import normalize_avatar_url
        
        if 'avatar' in profile and profile['avatar']:
            updates['avatar'] = normalize_avatar_url(profile['avatar'], did, 'avatar')
        
        if 'banner' in profile and profile['banner']:
            updates['banner'] = normalize_avatar_url(profile['banner'], did, 'banner')
        
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
        
        # Cache avatar locally for posterity
        avatar_url = updates.get('avatar')
        if avatar_url:
            cache_avatar(did, avatar_url, verbose=verbose)
        
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
    # Also always include dreamers with NULL/empty avatars — they may have set one
    # after registration and we want to pick it up promptly.
    query = """
        SELECT did, handle, name, updated_at
        FROM dreamers
        WHERE ((updated_at < %s OR updated_at IS NULL)
               OR (avatar IS NULL OR avatar = ''))
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


def dissipate_dreamer(did: str, handle: str, name: str, reason: str, verbose: bool = True) -> bool:
    """
    Dissipate a dreamer whose account is gone or permanently deactivated.
    Archives to formers, records canonical departure event, marks deactivated.
    Retains the dreamers row (FK integrity) and the local avatar cache.
    """
    import json
    import requests as _req
    db = DatabaseManager()

    dreamer = db.fetch_one("SELECT * FROM dreamers WHERE did = %s", (did,))
    if not dreamer:
        if verbose:
            print(f"   ❌ {handle}: not found in dreamers")
        return False

    if dreamer.get('deactivated'):
        if verbose:
            print(f"   ⏭️  {handle}: already dissipated")
        return True

    now = int(time.time())

    # Ensure we have a cached avatar before anything disappears
    avatar_url = dreamer.get('avatar') or ''
    if avatar_url.startswith('https://cdn.bsky.app/'):
        cache_avatar(did, avatar_url, verbose=verbose)

    # Determine archived avatar path: local cache > existing local > default
    cached = get_cached_avatar_path(did)
    if cached:
        avatar_archived = cached
    elif avatar_url.startswith('/'):
        avatar_archived = avatar_url
    else:
        avatar_archived = '/assets/avatars/avatar001.png'

    if verbose:
        print(f"   📦 Archiving @{handle} ({name}) — {reason}")
        print(f"      Avatar archived: {avatar_archived}")

    # Build snapshot
    snapshot = {
        'handle': dreamer['handle'],
        'name': dreamer['name'],
        'display_name': dreamer.get('display_name'),
        'description': dreamer.get('description'),
        'color_hex': dreamer.get('color_hex'),
        'original_avatar': avatar_url,
        'original_banner': dreamer.get('banner') or '',
        'reason': reason,
    }

    # Archive to formers
    db.execute("""
        INSERT INTO formers
        (did, handle, name, display_name, avatar_url, avatar_archived,
         banner_url, banner_archived, description, color_hex, departure_date,
         deactivated_at, profile_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (did) DO UPDATE SET
            avatar_archived = EXCLUDED.avatar_archived,
            departure_date = EXCLUDED.departure_date,
            deactivated_at = EXCLUDED.deactivated_at,
            profile_data = EXCLUDED.profile_data
    """, (
        did, dreamer['handle'], dreamer['name'], dreamer.get('display_name'),
        avatar_url, avatar_archived,
        dreamer.get('banner') or '', None,
        dreamer.get('description'), dreamer.get('color_hex'),
        now, now, json.dumps(snapshot)
    ))

    # Record canonical departure event
    db.execute("""
        INSERT INTO events (did, event, type, key, uri, url, epoch, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        did, 'dissipates their self', 'departure', 'dissipate',
        '', f"https://bsky.app/profile/{dreamer['handle']}",
        now, now
    ))

    # Mark deactivated, swap avatar to local
    db.execute("""
        UPDATE dreamers SET deactivated = TRUE, deactivated_at = %s, avatar = %s
        WHERE did = %s
    """, (now, avatar_archived, did))

    # Update designation
    try:
        from utils.designation import Designation
        designation = Designation.calculate_and_save(did, handle, dreamer.get('server'))
        if verbose:
            print(f"   🏷️  Designation: {designation}")
    except Exception:
        pass

    if verbose:
        print(f"   ✅ @{handle} dissipated")
    return True


def check_account_health(verbose: bool = True) -> dict:
    """
    Check all active dreamers for gone/deactivated accounts.
    Dissipates any that are confirmed unreachable.

    Returns dict with counts: {'checked', 'healthy', 'dissipated', 'errors'}.
    """
    import requests as _req
    db = DatabaseManager()

    dreamers = db.fetch_all("""
        SELECT did, handle, name, server, avatar
        FROM dreamers
        WHERE (deactivated IS NULL OR deactivated = FALSE)
        ORDER BY handle
    """)

    stats = {'checked': 0, 'healthy': 0, 'dissipated': 0, 'errors': 0}

    if verbose:
        print(f"🩺 Checking account health for {len(dreamers)} active dreamers...")
        print()

    for d in dreamers:
        did, handle, name = d['did'], d['handle'], d['name']
        server = d.get('server') or ''
        stats['checked'] += 1

        try:
            # Check public API
            r = _req.get(
                f"{BSKY_CACHE}/xrpc/app.bsky.actor.getProfile?actor={did}",
                timeout=10
            )

            if r.status_code == 200:
                stats['healthy'] += 1
                continue

            body = r.text.lower()

            # AccountDeactivated — account exists but is deactivated on its PDS
            if r.status_code == 400 and 'deactivated' in body:
                # Check if CDN avatar is still alive
                avatar = d.get('avatar') or ''
                avatar_gone = False
                if avatar.startswith('https://cdn.bsky.app/'):
                    try:
                        head = _req.head(avatar, timeout=8, allow_redirects=True)
                        avatar_gone = head.status_code >= 400
                    except Exception:
                        pass

                if avatar_gone:
                    # Avatar CDN is dead — cache if possible, set local fallback
                    cached = get_cached_avatar_path(did)
                    fallback = cached or '/assets/avatars/avatar001.png'
                    db.execute("UPDATE dreamers SET avatar = %s WHERE did = %s", (fallback, did))
                    if verbose:
                        print(f"   ⚠️  @{handle}: deactivated, avatar gone → {fallback}")
                else:
                    if verbose:
                        print(f"   ℹ️  @{handle}: deactivated (avatar still accessible)")
                # Don't dissipate — they chose to deactivate on their PDS,
                # may reactivate. Just ensure avatar is healthy.
                stats['healthy'] += 1
                continue

            # Profile not found — repo may be gone
            if r.status_code == 400 and 'not found' in body:
                # Double-check against their PDS directly
                repo_gone = True
                if server:
                    try:
                        r2 = _req.get(
                            f"{server}/xrpc/com.atproto.repo.describeRepo?repo={did}",
                            timeout=8
                        )
                        repo_gone = r2.status_code != 200
                    except Exception:
                        repo_gone = True

                if repo_gone:
                    if verbose:
                        print(f"   💀 @{handle}: repo gone — dissipating")
                    dissipate_dreamer(did, handle, name, 'PDS repo no longer exists', verbose=verbose)
                    stats['dissipated'] += 1
                else:
                    # PDS has the repo but public API can't see it — relay lag?
                    stats['healthy'] += 1
                continue

            # Other error codes — leave alone, may be transient
            stats['errors'] += 1
            if verbose:
                print(f"   ❓ @{handle}: unexpected status {r.status_code}")

        except _req.exceptions.Timeout:
            stats['errors'] += 1
            if verbose:
                print(f"   ⏱️  @{handle}: timeout")
        except Exception as e:
            stats['errors'] += 1
            if verbose:
                print(f"   ❌ @{handle}: {e}")

        time.sleep(0.15)

    if verbose:
        print()
        print("="*70)
        print(f"🩺 Health check complete")
        print(f"   ✅ Healthy: {stats['healthy']}")
        print(f"   💀 Dissipated: {stats['dissipated']}")
        print(f"   ❓ Errors: {stats['errors']}")
        print(f"   📊 Total checked: {stats['checked']}")

    return stats


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Refresh dreamer profiles from Bluesky')
    parser.add_argument('--all', action='store_true', help='Refresh all outdated profiles')
    parser.add_argument('--days', type=int, default=7, help='Consider profiles older than N days as outdated (default: 7)')
    parser.add_argument('--limit', type=int, help='Limit number of profiles to refresh')
    parser.add_argument('--handles', nargs='+', help='Specific handles to refresh')
    parser.add_argument('--check-health', action='store_true', help='Check all active dreamers for gone/deactivated accounts')
    parser.add_argument('--quiet', action='store_true', help='Less verbose output')
    
    args = parser.parse_args()
    
    verbose = not args.quiet
    
    if args.check_health:
        check_account_health(verbose=verbose)
    elif args.handles:
        refresh_specific_dreamers(args.handles, verbose=verbose)
    elif args.all:
        refresh_all_profiles(days_old=args.days, limit=args.limit, verbose=verbose)
    else:
        parser.print_help()
