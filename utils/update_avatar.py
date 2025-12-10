"""
Update Avatar Utility
Handles avatar updates on Bluesky using app passwords
"""

import requests
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager

def get_db_connection():
    """Get DatabaseManager instance."""
    return DatabaseManager()


def _get_user_credentials(did: str):
    """
    Get user credentials from database.
    
    Returns:
        tuple: (handle, app_password, pds_url) or (None, None, None) if not found
    """
    import base64
    import json
    
    db = get_db_connection()
    
    # Get user handle and server
    dreamer = db.fetch_one("SELECT handle, server FROM dreamers WHERE did = %s", (did,))
    
    if not dreamer:
        return None, None, None
    
    handle = dreamer['handle']
    pds_url = dreamer['server']  # Get PDS from dreamers table as fallback
    app_password = None
    
    # Try new user_credentials table first
    cred = db.fetch_one(
        "SELECT app_password_hash, pds_url FROM user_credentials WHERE did = %s AND is_valid = TRUE",
        (did,)
    )
    
    if cred:
        # Decode base64 password
        app_password = base64.b64decode(cred['app_password_hash']).decode('utf-8')
        # Use PDS from credentials if available
        if cred['pds_url']:
            pds_url = cred['pds_url']
    else:
        # Fall back to legacy work table
        work_rows = db.fetch_all("SELECT role, workers FROM work")
        
        for row in work_rows:
            workers = json.loads(row['workers'])
            for worker in workers:
                if worker.get('did') == did and worker.get('passhash'):
                    app_password = base64.b64decode(worker['passhash']).decode('utf-8')
                    break
            if app_password:
                break
    
    return handle, app_password, pds_url


def update_profile(did: str, display_name: str = None) -> dict:
    """
    Update a user's profile (display name) on Bluesky
    
    Args:
        did: User's DID
        display_name: New display name
        
    Returns:
        dict with success status and optional error message
    """
    try:
        handle, app_password, pds_url = _get_user_credentials(did)
        
        if not handle:
            return {"success": False, "error": "User not found"}
        
        if not app_password:
            return {"success": False, "error": "No app password connected"}
        
        # Use direct session creation instead of client.login()
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': handle,
                'password': app_password
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
            return {"success": False, "error": f"Failed to get profile: {get_response.text}"}
        
        profile_data = get_response.json()
        profile = profile_data.get('value', {})
        
        # Update display name if provided
        if display_name is not None:
            profile['displayName'] = display_name
        
        # Put updated profile
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
            return {"success": False, "error": f"Failed to update profile: {put_response.text}"}
        
        return {"success": True, "message": "Profile updated successfully"}
        
    except Exception as e:
        print(f"Error updating profile for {did}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def update_avatar(did: str, image_data: bytes) -> dict:
    """
    Update a user's avatar on Bluesky
    
    Args:
        did: User's DID
        image_data: Raw image bytes
        
    Returns:
        dict with success status and optional error message
    """
    try:
        handle, app_password, pds_url = _get_user_credentials(did)
        
        if not handle:
            return {"success": False, "error": "User not found"}
        
        if not app_password:
            return {"success": False, "error": "No app password connected"}
        
        # Use direct session creation instead of client.login() to avoid app.bsky.actor.getProfile call
        # which requires AppView and isn't available on PDS
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': handle,
                'password': app_password
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
        
        # Upload blob
        upload_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.uploadBlob',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'image/png'
            },
            data=image_data,
            timeout=10
        )
        
        if not upload_response.ok:
            return {"success": False, "error": f"Failed to upload avatar: {upload_response.text}"}
        
        blob_data = upload_response.json().get('blob')
        
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
            return {"success": False, "error": f"Failed to get profile: {get_response.text}"}
        
        profile_data = get_response.json()
        profile = profile_data.get('value', {})
        
        # Update avatar
        profile['avatar'] = blob_data
        
        # Put updated profile
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
            return {"success": False, "error": f"Failed to update profile: {put_response.text}"}
        
        return {"success": True, "message": "Avatar updated successfully"}
        
    except Exception as e:
        print(f"Error updating avatar for {did}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def get_current_avatar(did: str) -> dict:
    """
    Get the current avatar URL for a user
    
    Args:
        did: User's DID
        
    Returns:
        dict with avatar URL or error
    """
    try:
        # Query Bluesky API for profile
        response = requests.get(
            f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
            params={"actor": did}
        )
        
        if response.status_code == 200:
            data = response.json()
            avatar_url = data.get('avatar')
            return {"success": True, "avatar": avatar_url}
        else:
            return {"success": False, "error": "Failed to fetch profile"}
            
    except Exception as e:
        print(f"Error fetching avatar for {did}: {str(e)}")
        return {"success": False, "error": str(e)}
