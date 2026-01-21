#!/usr/bin/env python3
"""
Initialize PDS Profile
Creates initial Bluesky profile record for newly created PDS accounts
"""

import requests
import time
from typing import Dict
from pathlib import Path


def init_pds_profile(did: str, handle: str, password: str, pds_url: str = "https://reverie.house") -> Dict:
    """
    Initialize a new PDS account's profile with default avatar and display name.
    
    This creates the initial app.bsky.actor.profile record that makes the account
    visible on Bluesky with proper displayName and avatar.
    
    Args:
        did: User's DID
        handle: User's handle (e.g., "alice.reverie.house")
        password: User's account password (used to authenticate)
        pds_url: PDS server URL (default: https://reverie.house)
        
    Returns:
        dict with 'success' bool and optional 'error' message
    """
    try:
        # Step 1: Create session with password
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': handle,
                'password': password
            },
            timeout=10
        )
        
        if not session_response.ok:
            error_msg = session_response.text
            try:
                error_data = session_response.json()
                error_msg = error_data.get('message', error_msg)
            except:
                pass
            return {"success": False, "error": f"Authentication failed: {error_msg}"}
        
        session_data = session_response.json()
        access_jwt = session_data.get('accessJwt')
        
        # Step 2: Generate display name from handle
        # "alice.reverie.house" -> "Alice"
        name_part = handle.split('.')[0]
        display_name = name_part.capitalize()
        
        # Step 3: Upload default avatar blob
        avatar_ref = None
        try:
            # Read the default avatar (use avatar001.png as default)
            # Try container path first, then host path
            avatar_path = Path('/srv/site/assets/avatars/avatar001.png')
            if not avatar_path.exists():
                avatar_path = Path('/srv/reverie.house/site/assets/avatars/avatar001.png')
            if avatar_path.exists():
                with open(avatar_path, 'rb') as f:
                    avatar_bytes = f.read()
                
                # Upload blob to PDS
                upload_response = requests.post(
                    f'{pds_url}/xrpc/com.atproto.repo.uploadBlob',
                    headers={
                        'Authorization': f'Bearer {access_jwt}',
                        'Content-Type': 'image/png'
                    },
                    data=avatar_bytes,
                    timeout=15
                )
                
                if upload_response.ok:
                    upload_data = upload_response.json()
                    avatar_ref = upload_data.get('blob')
                    print(f"   📸 Avatar uploaded: {avatar_ref.get('ref', {}).get('$link', '')[:16]}...")
                else:
                    print(f"   ⚠️  Avatar upload failed: {upload_response.status_code}")
        except Exception as avatar_err:
            print(f"   ⚠️  Avatar upload error: {avatar_err}")
        
        # Step 4: Create profile record
        profile_data = {
            'displayName': display_name,
            '$type': 'app.bsky.actor.profile'
        }
        
        if avatar_ref:
            profile_data['avatar'] = avatar_ref
        
        create_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.putRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': did,
                'collection': 'app.bsky.actor.profile',
                'rkey': 'self',
                'record': profile_data
            },
            timeout=10
        )
        
        if not create_response.ok:
            error_msg = create_response.text
            try:
                error_data = create_response.json()
                error_msg = error_data.get('message', error_msg)
            except:
                pass
            return {"success": False, "error": f"Profile creation failed: {error_msg}"}
        
        print(f"   ✨ Profile created: {display_name}" + (" with avatar" if avatar_ref else ""))
        
        return {
            "success": True,
            "displayName": display_name,
            "avatar": bool(avatar_ref)
        }
        
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"Network error: {e}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {e}"}


def update_profile_avatar(did: str, handle: str, password: str, avatar_path: str, pds_url: str = "https://reverie.house") -> Dict:
    """
    Update an existing profile's avatar.
    
    Args:
        did: User's DID
        handle: User's handle
        password: User's account password
        avatar_path: Path to avatar image file
        pds_url: PDS server URL
        
    Returns:
        dict with 'success' bool and optional 'error' message
    """
    try:
        # Create session
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={'identifier': handle, 'password': password},
            timeout=10
        )
        
        if not session_response.ok:
            return {"success": False, "error": "Authentication failed"}
        
        access_jwt = session_response.json().get('accessJwt')
        
        # Upload new avatar
        with open(avatar_path, 'rb') as f:
            avatar_bytes = f.read()
        
        upload_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.uploadBlob',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'image/png'
            },
            data=avatar_bytes,
            timeout=15
        )
        
        if not upload_response.ok:
            return {"success": False, "error": "Avatar upload failed"}
        
        avatar_ref = upload_response.json().get('blob')
        
        # Get current profile
        get_response = requests.get(
            f'{pds_url}/xrpc/com.atproto.repo.getRecord',
            params={
                'repo': did,
                'collection': 'app.bsky.actor.profile',
                'rkey': 'self'
            },
            headers={'Authorization': f'Bearer {access_jwt}'},
            timeout=10
        )
        
        if not get_response.ok:
            return {"success": False, "error": "Failed to get current profile"}
        
        profile = get_response.json().get('value', {})
        profile['avatar'] = avatar_ref
        
        # Update profile
        put_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.putRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': did,
                'collection': 'app.bsky.actor.profile',
                'rkey': 'self',
                'record': profile
            },
            timeout=10
        )
        
        if not put_response.ok:
            return {"success": False, "error": "Profile update failed"}
        
        return {"success": True}
        
    except Exception as e:
        return {"success": False, "error": str(e)}
