"""
Update Profile Description Utility
Handles profile description/bio updates on Bluesky using app passwords
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
    import json
    from core.encryption import decrypt_password
    
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
        "SELECT app_password_hash, pds_url FROM user_credentials WHERE did = %s AND app_password_hash IS NOT NULL AND app_password_hash != ''",
        (did,)
    )
    
    if cred:
        app_password = decrypt_password(cred['app_password_hash'])
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
                    app_password = decrypt_password(worker['passhash'])
                    break
            if app_password:
                break
    
    return handle, app_password, pds_url


def update_profile_description(did: str, description: str) -> dict:
    """
    Update a user's profile description/bio on Bluesky
    
    Args:
        did: User's DID
        description: New profile description text
        
    Returns:
        dict with success status and optional error message
    """
    try:
        handle, app_password, pds_url = _get_user_credentials(did)
        
        if not handle:
            return {"success": False, "error": "User not found"}
        
        if not app_password:
            return {"success": False, "error": "No app password connected"}
        
        # Use direct session creation
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
        
        # Update description
        profile['description'] = description
        
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
        
        return {"success": True, "message": "Profile description updated successfully"}
        
    except Exception as e:
        print(f"Error updating profile description for {did}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def fix_profile_handle(did: str, handle: str) -> dict:
    """
    Fix a user's profile by ensuring the handle field is set.
    This fixes profiles created before the handle field was added to init_profile.
    
    Args:
        did: User's DID
        handle: User's handle (e.g., "alice.reverie.house")
        
    Returns:
        dict with success status and optional error message
    """
    try:
        user_handle, app_password, pds_url = _get_user_credentials(did)
        
        if not user_handle:
            return {"success": False, "error": "User not found"}
        
        if not app_password:
            return {"success": False, "error": "No app password connected"}
        
        # Create session
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': user_handle,
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
        
        # Check if handle already set
        if profile.get('handle') == handle:
            return {"success": True, "message": "Handle already set correctly"}
        
        # Set the handle field
        profile['handle'] = handle
        
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
        
        return {"success": True, "message": f"Profile handle fixed to {handle}"}
        
    except Exception as e:
        print(f"Error fixing profile handle for {did}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def set_profile_banner(did: str, banner_path: str = None, pds_url: str = "https://reverie.house") -> dict:
    """
    Set a user's profile banner.
    
    Args:
        did: User's DID
        banner_path: Path to banner image file. If None, uses default banner01.png
        pds_url: PDS server URL
        
    Returns:
        dict with success status and optional error message
    """
    try:
        user_handle, app_password, pds_url_from_db = _get_user_credentials(did)
        
        if not user_handle:
            return {"success": False, "error": "User not found"}
        
        if not app_password:
            return {"success": False, "error": "No app password connected"}
        
        # Use PDS URL from DB if available
        if pds_url_from_db:
            pds_url = pds_url_from_db
        
        # Determine banner path
        if not banner_path:
            # Try container path first, then host path
            if os.path.exists('/srv/site/assets/banners/banner01.png'):
                banner_path = '/srv/site/assets/banners/banner01.png'
            elif os.path.exists('/srv/reverie.house/site/assets/banners/banner01.png'):
                banner_path = '/srv/reverie.house/site/assets/banners/banner01.png'
            else:
                return {"success": False, "error": "Default banner file not found"}
        
        # Create session
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': user_handle,
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
        
        # Upload banner blob
        with open(banner_path, 'rb') as f:
            banner_bytes = f.read()
        
        upload_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.uploadBlob',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'image/png'
            },
            data=banner_bytes,
            timeout=15
        )
        
        if not upload_response.ok:
            return {"success": False, "error": f"Banner upload failed: {upload_response.text}"}
        
        upload_data = upload_response.json()
        banner_ref = upload_data.get('blob')
        
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
        
        # Set the banner
        profile['banner'] = banner_ref
        
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
        
        return {"success": True, "message": f"Profile banner updated successfully"}
        
    except Exception as e:
        print(f"Error setting profile banner for {did}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


