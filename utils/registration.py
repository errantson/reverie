#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Registration Utilities - Shared dreamer registration logic

Provides unified registration methods used by:
- Namegiver quest (ops/commands.py)
- OAuth auto-register (admin.py)
- Manual registration endpoints
"""

import time
import subprocess
import requests
from typing import Dict, Optional, Tuple
from datetime import datetime
from core.database import DatabaseManager
from core.network import NetworkClient
from utils.names import NameManager
from utils.spectrum import SpectrumManager
from utils.identity import IdentityManager


def register_dreamer(
    did: str,
    handle: str,
    profile: Optional[Dict] = None,
    proposed_name: Optional[str] = None,
    canon_entries: Optional[list] = None,
    verbose: bool = False
) -> Dict:
    """
    Universal dreamer registration function.
    
    Args:
        did: Decentralized identifier
        handle: Bluesky handle
        profile: Optional pre-fetched profile data (will fetch if None)
        proposed_name: Optional proposed name (will generate from handle if None)
        canon_entries: List of canon entry dicts to create. Each should have:
            - event: str (e.g., "gained a name", "found our wild mindscape")
            - type: str (e.g., "namegiver", "arrival")
            - key: str (e.g., "namegiver,registration", "arrival")
            - uri: Optional[str] (defaults to synthetic profile URI)
            - url: Optional[str] (defaults to profile URL)
        verbose: Whether to print detailed output
        
    Returns:
        {
            'success': bool,
            'dreamer': {
                'did': str,
                'handle': str,
                'name': str,
                'display_name': str,
                'avatar': str,
                ...
            },
            'errors': List[str]
        }
    """
    result = {'success': False, 'dreamer': {}, 'errors': []}
    
    db = DatabaseManager()
    names = NameManager()
    network = NetworkClient()
    identity = IdentityManager()
    spectrum_mgr = SpectrumManager(db)
    
    try:
        # Check if this DID is tombstoned (deleted account)
        cursor = db.execute("SELECT did, handle, deleted_at FROM deleted_accounts WHERE did = %s", (did,))
        tombstone = cursor.fetchone()
        if tombstone:
            if verbose:
                print(f"   🪦 Blocked: DID {did} is tombstoned (deleted on {tombstone['deleted_at']})")
            result['errors'].append('This account has been deleted and cannot be recreated')
            return result
        
        cursor = db.execute("SELECT did, name, handle, alts FROM dreamers WHERE did = %s", (did,))
        existing = cursor.fetchone()
        
        if existing:
            if proposed_name and canon_entries:
                is_namegiver = any(entry.get('type') == 'namegiver' for entry in canon_entries)
                
                if is_namegiver:
                    current_alts = existing['alts'] or ''
                    if current_alts.strip():
                        if verbose:
                            print(f"   ⚠️  Name change denied: {existing['name']} already has alternate names ({current_alts})")
                            print(f"      Namegiver can only be used once per dreamer")
                        result['success'] = False
                        result['errors'].append('Name change denied: You have already used the namegiver quest')
                        result['dreamer'] = {
                            'did': existing['did'],
                            'name': existing['name'],
                            'handle': existing['handle'],
                            'alts': current_alts,
                            'already_registered': True,
                            'name_change_denied': True
                        }
                        return result
                    
                    current_name = existing['name']
                    new_name = names.suggest_unique_name(proposed_name)
                    
                    if current_name != new_name:
                        current_alts = existing['alts'] or ''
                        alt_list = [alt.strip() for alt in current_alts.split(',') if alt.strip()]
                        
                        if current_name not in alt_list:
                            alt_list.append(current_name)
                        
                        new_alts = ','.join(alt_list)
                        
                        now = int(time.time())
                        db.execute("""
                            UPDATE dreamers 
                            SET name = %s, alts = %s, updated_at = %s
                            WHERE did = %s
                        """, (new_name, new_alts, now, did))
                        
                        arrival_timestamp = int(time.time())
                        for canon_entry in canon_entries:
                            if canon_entry.get('type') == 'namegiver':
                                event = canon_entry.get('event', 'gained a new name')
                                key = canon_entry.get('key', 'namegiver')
                                uri = canon_entry.get('uri') or f"{did}/app.bsky.actor.profile/self"
                                url = canon_entry.get('url') or f"https://bsky.app/profile/{did}"
                                
                                db.execute("""
                                    INSERT INTO events (did, event, epoch, uri, url, type, key, created_at, color_source, color_intensity)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """, (did, event, arrival_timestamp, uri, url, 'namegiver', key, now, 'user', 'highlight'))
                        
                        if verbose:
                            print(f"   🔄 NAME UPDATED: {current_name} → {new_name}")
                            print(f"      Previous name moved to alts: {new_alts}")
                        
                        try:
                            result_code = subprocess.run(
                                ['python3', '/srv/caddy/caddybuilder.py'],
                                capture_output=True,
                                text=True,
                                timeout=30
                            )
                            if result_code.returncode == 0:
                                if verbose:
                                    print(f"   ✅ Caddy rebuilt - {new_name}.reverie.house and {current_name}.reverie.house both active")
                            else:
                                if verbose:
                                    print(f"   ⚠️  Caddy rebuild failed: {result_code.stderr}")
                        except Exception as e:
                            if verbose:
                                print(f"   ⚠️  Caddy rebuild error: {e}")
                        
                        result['success'] = True
                        result['dreamer'] = {
                            'did': did,
                            'name': new_name,
                            'handle': existing['handle'],
                            'alts': new_alts,
                            'name_updated': True,
                            'previous_name': current_name
                        }
                        return result
            
            # Check if this is an incomplete stub record (created by /api/create-account
            # for the FK constraint, but never fully set up with events/spectrum/caddy).
            # If so, complete the setup instead of short-circuiting.
            events_cursor = db.execute("SELECT COUNT(*) as count FROM events WHERE did = %s", (did,))
            events_count = events_cursor.fetchone()['count']
            spectrum_cursor = db.execute("SELECT COUNT(*) as count FROM spectrum WHERE did = %s", (did,))
            spectrum_exists = spectrum_cursor.fetchone()['count'] > 0
            
            is_incomplete_stub = (events_count == 0 and not spectrum_exists) or \
                                 (not spectrum_exists and existing['handle'] and existing['handle'].endswith('.reverie.house'))
            
            if is_incomplete_stub:
                if verbose:
                    print(f"   🔧 Incomplete dreamer stub detected for {existing['name']} — completing setup...")
                    print(f"      Events: {events_count}, Spectrum: {spectrum_exists}")
                # Fall through to full registration logic below.
                # Update the existing record rather than INSERT a new one.
                # We'll use a flag to indicate we're completing a stub.
                _completing_stub = True
                _stub_name = existing['name']
            else:
                if verbose:
                    print(f"   ℹ️  Dreamer already registered: {existing['name']} (@{existing['handle']})")
                result['success'] = True
                result['dreamer'] = {
                    'did': existing['did'],
                    'name': existing['name'],
                    'handle': existing['handle'],
                    'alts': existing['alts'],
                    'already_registered': True
                }
                return result
        else:
            _completing_stub = False
            _stub_name = None
        
        if not profile:
            if verbose:
                print(f"   🔍 Fetching profile for DID {did}...")
            profile = network.get_profile(did)
            # For brand new accounts, profile may not exist yet - that's OK!
            if not profile:
                if verbose:
                    print(f"   ℹ️  No profile record found (brand new account)")
                    print(f"   ℹ️  Proceeding with minimal registration data")
                # Create empty profile dict to avoid errors below
                profile = {}
        
        # For brand new reverie.house accounts, the profile may have just been initialized
        # Refetch after a short delay to get the avatar and display name
        if handle and handle.endswith('.reverie.house') and not profile.get('avatar'):
            if verbose:
                print(f"   ⏳ Reverie.house account without avatar - refetching from PDS...")
            
            # Try multiple times with increasing delays
            for attempt in range(3):
                time.sleep(1.0 + (attempt * 0.5))  # 1s, 1.5s, 2s delays
                
                # Fetch directly from reverie.house PDS (no caching)
                try:
                    response = requests.get(
                        'https://reverie.house/xrpc/com.atproto.repo.getRecord',
                        params={
                            'repo': did,
                            'collection': 'app.bsky.actor.profile',
                            'rkey': 'self'
                        },
                        timeout=5
                    )
                    
                    if response.status_code == 200:
                        pds_profile = response.json().get('value', {})
                        if pds_profile.get('avatar'):
                            # Build full avatar URL from blob reference
                            avatar_data = pds_profile.get('avatar', {})
                            if isinstance(avatar_data, dict):
                                avatar_cid = avatar_data.get('ref', {}).get('$link', '')
                                if avatar_cid:
                                    profile['avatar'] = f"https://cdn.bsky.app/img/avatar/plain/{did}/{avatar_cid}@jpeg"
                                    profile['displayName'] = pds_profile.get('displayName', '')
                                    if verbose:
                                        print(f"   ✅ Profile fetched from PDS (attempt {attempt + 1}) - Avatar: Yes")
                                    break
                except Exception as e:
                    if verbose and attempt == 2:  # Only log on last attempt
                        print(f"   ⚠️  PDS profile fetch failed: {e}")
            
            if not profile.get('avatar'):
                if verbose:
                    print(f"   ⚠️  Avatar not available after 3 attempts - continuing without it")
        
        # Extract handle from profile if not provided or if it's a DID
        if not handle or handle.startswith('did:'):
            handle = profile.get('handle')
            if not handle:
                result['errors'].append(f"No handle found in profile for {did}")
                return result
            if verbose:
                print(f"   📎 Extracted handle from profile: {handle}")
        
        # CRITICAL SAFEGUARD: Never allow DIDs to be used as handles
        # This prevents the bug where DIDs get split as names (e.g., "didplcz3jm7cyj3g73c2")
        if handle and handle.startswith('did:'):
            result['errors'].append(f"CRITICAL ERROR: DID passed as handle ({handle}). This should never happen.")
            if verbose:
                print(f"   ❌ BLOCKED: Attempted to use DID as handle")
                print(f"      DID: {did}")
                print(f"      Handle: {handle}")
                print(f"      This is a bug in the calling code - handle resolution failed")
            return result
        
        # Get display name from profile, or capitalize handle as fallback
        display_name = profile.get('displayName') or profile.get('display_name', '')
        
        # For reverie.house accounts, if no display name yet, capitalize the handle prefix
        if not display_name and handle and handle.endswith('.reverie.house'):
            handle_prefix = handle.split('.')[0] if '.' in handle else handle
            # Capitalize intelligently (e.g., "test-user" -> "Test-User")
            parts = handle_prefix.split('-')
            display_name = '-'.join(part.capitalize() for part in parts)
            if verbose:
                print(f"   🎨 Auto-capitalized display name: {display_name}")
        
        description = profile.get('description', '')
        
        from utils.identity import normalize_avatar_url
        avatar = normalize_avatar_url(profile.get('avatar', ''), did, 'avatar')
        
        # Set default avatar for reverie.house accounts if none available
        if not avatar and handle and handle.endswith('.reverie.house'):
            avatar = '/assets/avatars/avatar001.png'
            if verbose:
                print(f"   🎨 Using default avatar for reverie.house account")
        
        banner = normalize_avatar_url(profile.get('banner', ''), did, 'banner')
        
        followers_count = profile.get('followersCount') or profile.get('followers_count', 0)
        follows_count = profile.get('followsCount') or profile.get('follows_count', 0)
        posts_count = profile.get('postsCount') or profile.get('posts_count', 0)
        created_at_str = profile.get('createdAt') or profile.get('created_at')
        
        if _completing_stub and _stub_name:
            # Keep the existing name from the stub (but normalize case)
            dreamer_name = _stub_name.lower() if _stub_name else None
            if not dreamer_name:
                handle_prefix = handle.split('.')[0] if '.' in handle else handle
                dreamer_name = names.suggest_unique_name(handle_prefix)
        elif proposed_name:
            dreamer_name = names.suggest_unique_name(proposed_name)
        else:
            handle_prefix = handle.split('.')[0] if '.' in handle else handle
            dreamer_name = names.suggest_unique_name(handle_prefix)
        
        if verbose:
            print(f"   📝 Generated name: {dreamer_name}")
        
        arrival_timestamp = int(time.time())
        if created_at_str:
            try:
                # Validate year is not 0 or negative before parsing
                # PDS sometimes returns year 0 for newly created accounts
                if created_at_str.startswith('0000-') or created_at_str.startswith('-') or created_at_str.startswith('0001-'):
                    if verbose:
                        print(f"   ⚠️  Invalid creation date '{created_at_str}' (year 0/1 or negative)")
                        print(f"   Using current time as fallback: {arrival_timestamp}")
                    # Keep arrival_timestamp = current time (set above)
                else:
                    dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                    arrival_timestamp = int(dt.timestamp())
                    if verbose:
                        print(f"   📅 Using account creation date as arrival: {created_at_str} ({arrival_timestamp})")
            except Exception as e:
                if verbose:
                    print(f"   ⚠️  Could not parse creation date '{created_at_str}': {e}")
                    print(f"   Using current time as fallback: {arrival_timestamp}")
                # Keep arrival_timestamp = current time (set above)
        else:
            if verbose:
                print(f"   ⚠️  No creation date available, using current time as arrival: {arrival_timestamp}")
        
        server = ""
        try:
            _, pds_server = identity.get_handle_from_did(did)
            if pds_server:
                server = pds_server
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Could not get PDS from DID: {e}")
            server = network.get_pds_from_profile(profile) or ""
        
        now = int(time.time())
        
        # Set default color for new dreamers (Reverie purple)
        default_color = '#734ba1'
        
        db.execute("""
            INSERT INTO dreamers 
            (did, handle, name, display_name, description, avatar, banner, color_hex,
             followers_count, follows_count, posts_count, server, arrival, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (did) DO UPDATE SET
                handle = EXCLUDED.handle,
                name = EXCLUDED.name,
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                avatar = EXCLUDED.avatar,
                banner = EXCLUDED.banner,
                color_hex = COALESCE(dreamers.color_hex, EXCLUDED.color_hex),
                followers_count = EXCLUDED.followers_count,
                follows_count = EXCLUDED.follows_count,
                posts_count = EXCLUDED.posts_count,
                server = EXCLUDED.server,
                arrival = EXCLUDED.arrival,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
        """, (did, handle, dreamer_name, display_name, description, avatar, banner, default_color,
              followers_count, follows_count, posts_count, server, arrival_timestamp, created_at_str, now))
        
        if verbose:
            action = "UPDATED (stub completed)" if _completing_stub else "CREATED"
            print(f"   ✅ DREAMER RECORD {action}: {dreamer_name} (@{handle})")
            print(f"      DID: {did}")
            # Handle negative/invalid timestamps (year 0)
            try:
                arrival_date = datetime.fromtimestamp(arrival_timestamp).isoformat() if arrival_timestamp > 0 else 'invalid'
            except (ValueError, OSError):
                arrival_date = 'invalid'
            print(f"      Arrival: {arrival_timestamp} ({arrival_date})")
        
        # Create user invite slots
        # PDS residents and users who used a free pool invite code get 3 slots (core audience).
        # Everyone else (general OAuth logins, personally invited) gets 1 slot.
        try:
            # Check if PDS resident
            pds_resident = db.execute(
                "SELECT 1 FROM dreamers WHERE did = %s AND server = 'https://reverie.house' LIMIT 1",
                (did,)
            ).fetchone()
            if pds_resident:
                max_slots = 3
            else:
                free_pool_check = db.execute(
                    "SELECT 1 FROM invites WHERE used_by = %s AND is_personal = FALSE LIMIT 1",
                    (did,)
                ).fetchone()
                max_slots = 3 if free_pool_check else 1

            for slot in range(1, max_slots + 1):
                db.execute("""
                    INSERT INTO user_invites (owner_did, slot)
                    VALUES (%s, %s)
                    ON CONFLICT (owner_did, slot) DO NOTHING
                """, (did, slot))
            if verbose:
                print(f"   🎫 User invite slots ensured for {dreamer_name} ({max_slots} slot{'s' if max_slots > 1 else ''})")
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Failed to create invite slots (non-fatal): {e}")
        
        if not canon_entries:
            canon_entries = [{
                'event': 'found our wild mindscape',
                'type': 'arrival',
                'key': 'arrival'
            }]
        
        for canon_entry in canon_entries:
            event = canon_entry.get('event', 'arrived')
            entry_type = canon_entry.get('type', 'arrival')
            key = canon_entry.get('key', entry_type)
            uri = canon_entry.get('uri') or f"{did}/app.bsky.actor.profile/self"
            url = canon_entry.get('url') or f"https://bsky.app/profile/{did}"
            # Use epoch from canon_entry if provided, otherwise use arrival_timestamp
            epoch = canon_entry.get('epoch', arrival_timestamp)
            
            # Skip if this event type+key already exists (e.g. invitation souvenir
            # created by /api/create-account before register_dreamer runs)
            existing_event = db.execute(
                "SELECT id FROM events WHERE did = %s AND type = %s AND key = %s LIMIT 1",
                (did, entry_type, key)
            ).fetchone()
            if existing_event:
                if verbose:
                    print(f"   ℹ️  Event already exists: '{event}' (type={entry_type}, key={key}) — skipping")
                continue
            
            db.execute("""
                INSERT INTO events (did, event, epoch, uri, url, type, key, created_at, color_source, color_intensity)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (did, event, epoch, uri, url, entry_type, key, now, 'user', 'highlight'))
            
            if verbose:
                print(f"   ✅ TIMELINE EVENT CREATED: '{event}'")
                print(f"      Type: {entry_type}, Key: {key}")
                # Handle negative/invalid timestamps (year 0)
                try:
                    epoch_date = datetime.fromtimestamp(epoch).isoformat() if epoch > 0 else 'invalid'
                except (ValueError, OSError):
                    epoch_date = 'invalid'
                print(f"      Epoch: {epoch} ({epoch_date})")
                print(f"      URI: {uri}")
        
        try:
            spectrum = spectrum_mgr.generate_spectrum(did, server)
            spectrum_mgr.save_spectrum_to_db(did, spectrum)
            if verbose:
                print(f"   ✅ Generated spectrum for {dreamer_name}")
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Failed to generate spectrum: {e}")
        
        # Assign residence souvenir for reverie.house accounts
        if server == 'https://reverie.house':
            try:
                # Use arrival_timestamp + 1 to ensure chronological ordering
                # (must find the mindscape before staying at the house)
                residence_timestamp = arrival_timestamp + 1
                
                db.execute("""
                    INSERT INTO awards (did, souvenir_key, earned_epoch)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (did, souvenir_key) DO NOTHING
                """, (did, 'residence', residence_timestamp))
                
                # Create timeline event for residence souvenir (with duplicate guard)
                existing_residence_event = db.execute(
                    "SELECT id FROM events WHERE did = %s AND type = %s AND key = %s LIMIT 1",
                    (did, 'souvenir', 'residence')
                ).fetchone()
                if not existing_residence_event:
                    db.execute("""
                        INSERT INTO events (did, event, epoch, uri, url, type, key, created_at, color_source, color_intensity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (did, 'stayed at Reverie House', residence_timestamp, 
                          'self', 
                          'https://reverie.house/souvenirs?key=residence',
                          'souvenir', 'residence', now, 'souvenir', 'highlight'))
                elif verbose:
                    print(f"   ℹ️  Residence event already exists — skipping")
                
                if verbose:
                    print(f"   🏡 Assigned residence souvenir to {dreamer_name}")
                    print(f"   ✅ TIMELINE EVENT CREATED: 'stayed at Reverie House'")
                    print(f"      Type: souvenir, Key: residence")
            except Exception as e:
                if verbose:
                    print(f"   ⚠️  Failed to assign residence souvenir: {e}")
        
        # Register user's handle in PLC (for reverie.house accounts)
        if server == 'https://reverie.house':
            try:
                from utils.user_plc_registration import register_handle_on_namegiver_completion
                reverie_handle = f"{dreamer_name}.reverie.house"
                register_handle_on_namegiver_completion(did, handle, dreamer_name)
                if verbose:
                    print(f"   ✅ Handle queued for PLC registration: {reverie_handle}")
            except Exception as plc_err:
                if verbose:
                    print(f"   ⚠️  PLC registration queue failed (non-fatal): {plc_err}")
        
        try:
            result_code = subprocess.run(
                ['python3', '/srv/caddy/caddybuilder.py'],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result_code.returncode == 0:
                if verbose:
                    print(f"   ✅ Caddy rebuilt for {dreamer_name}.reverie.house")
            else:
                if verbose:
                    print(f"   ⚠️  Caddy rebuild failed: {result_code.stderr}")
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Caddy rebuild error: {e}")
        
        result['success'] = True
        result['dreamer'] = {
            'did': did,
            'handle': handle,
            'name': dreamer_name,
            'display_name': display_name,
            'avatar': avatar,
            'banner': banner,
            'server': server,
            'arrival': arrival_timestamp,
            'already_registered': False
        }
        
        if verbose:
            print(f"   ✨ Registration complete for {dreamer_name}")
        
    except Exception as e:
        result['errors'].append(f"Registration failed: {e}")
        if verbose:
            print(f"   ❌ Registration error: {e}")
            import traceback
            traceback.print_exc()
    
    return result
