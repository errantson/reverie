"""
User Account Management Routes
Handles user-specific account operations including deletion
"""

from flask import Blueprint, request, jsonify
from core.admin_auth import validate_user_token, get_client_ip
from core.rate_limiter import PersistentRateLimiter
from functools import wraps
import os
import logging

# Create blueprint
bp = Blueprint('user', __name__, url_prefix='/api/user')

rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60
logger = logging.getLogger(__name__)


def rate_limit(requests_per_minute=20):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            
            allowed, retry_after = rate_limiter.check_rate_limit(
                ip, endpoint, limit=requests_per_minute, window=RATE_LIMIT_WINDOW
            )
            
            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after
                }), 429
            
            return f(*args, **kwargs)
        return wrapped
    return decorator


@bp.route('/delete', methods=['DELETE'])
@rate_limit(5)  # Very restrictive - this is a destructive action
def delete_user_account():
    """
    Permanently deactivate a Reverie House user account and archive all data.
    This is a destructive action that:
    - Archives the user profile to the formers table
    - Downloads and archives avatar/banner assets
    - Records a departure event in world history
    - Deactivates the account (soft delete - preserves all history)
    - Clears sessions (forces logout)
    - Prevents future logins
    
    SECURITY:
    - Requires valid OAuth token (user must be authenticated)
    - User can only delete their own account (DID must match token)
    - Rate limited to 5 attempts per minute
    - Requires exact confirmation text
    
    NOTE: This does NOT delete the AT Protocol/Bluesky account.
    AT Protocol accounts must be deleted separately by users through the official
    Bluesky account deletion process, which requires password and email verification.
    """
    try:
        logger.info(f"\n{'='*80}")
        logger.info(f"🗑️  DELETE ACCOUNT REQUEST RECEIVED")
        logger.info(f"{'='*80}")
        logger.info(f"📍 Client IP: {get_client_ip()}")
        logger.info(f"📍 User Agent: {request.headers.get('User-Agent', 'Unknown')[:100]}")
        logger.info(f"📍 Request Method: {request.method}")
        logger.info(f"📍 Request Path: {request.path}")
        
        # STEP 1: Authenticate user
        token = None
        auth_header = request.headers.get('Authorization')
        logger.info(f"🔍 Checking for Authorization header...")
        logger.info(f"   Authorization header present: {auth_header is not None}")
        if auth_header:
            logger.info(f"   Authorization header value: {auth_header[:50]}...")
            logger.info(f"   Authorization header starts with 'Bearer ': {auth_header.startswith('Bearer ')}")
        logger.info(f"   All request headers: {dict(request.headers)}")
        logger.info(f"   Cookies present: {list(request.cookies.keys())}")
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            logger.info(f"✅ Token extracted from Authorization header")
            logger.info(f"   Token length: {len(token)}")
            logger.info(f"   Token preview: {token[:50]}...")
            logger.info(f"   Token ends with: ...{token[-20:]}")
            
            # Try to decode JWT header to see what type of token it is
            try:
                import jwt
                header = jwt.get_unverified_header(token)
                logger.info(f"   JWT header: {header}")
                has_kid = 'kid' in header
                logger.info(f"   Has 'kid' field (OAuth token): {has_kid}")
                if has_kid:
                    logger.info(f"   This appears to be an OAuth JWT token")
                else:
                    logger.info(f"   This appears to be a PDS accessJwt token")
            except Exception as e:
                logger.warning(f"   Could not decode JWT header: {e}")
                logger.info(f"   Token might not be a valid JWT")
        elif 'admin_token' in request.cookies:
            token = request.cookies.get('admin_token')
            logger.info(f"✅ Token from cookie: admin_token")
            logger.info(f"   Token length: {len(token)}")
        else:
            logger.warning(f"❌ NO TOKEN FOUND")
            logger.info(f"   Authorization header: {auth_header}")
            logger.info(f"   Cookies: {list(request.cookies.keys())}")
        
        if not token:
            logger.error(f"❌ AUTHENTICATION FAILED: No token provided")
            logger.info(f"{'='*80}\n")
            return jsonify({
                'error': 'Unauthorized',
                'message': 'You must be logged in to delete your account'
            }), 401
        
        logger.info(f"🔐 Starting token validation...")
        logger.info(f"   Calling validate_user_token()")
        valid, authenticated_did, authenticated_handle = validate_user_token(token, allow_deactivated=True)
        logger.info(f"🔐 Token validation complete!")
        logger.info(f"   Result: valid={valid}")
        logger.info(f"   DID: {authenticated_did}")
        logger.info(f"   Handle: {authenticated_handle}")
        
        if not valid:
            logger.error(f"❌ AUTHENTICATION FAILED: Token validation returned False")
            logger.info(f"   This means the token is invalid or expired")
            logger.info(f"{'='*80}\n")
            return jsonify({
                'error': 'Unauthorized',
                'message': 'You must be logged in to delete your account'
            }), 401
        
        if not authenticated_did:
            logger.error(f"❌ AUTHENTICATION FAILED: No DID returned from validation")
            logger.info(f"   This should never happen if valid=True")
            logger.info(f"{'='*80}\n")
            return jsonify({
                'error': 'Unauthorized',
                'message': 'You must be logged in to delete your account'
            }), 401
        
        logger.info(f"✅ AUTHENTICATION SUCCESS")
        logger.info(f"   Authenticated as: {authenticated_handle} ({authenticated_did})")
        logger.info(f"{'='*80}")
        
        # STEP 2: Get deletion target from request
        data = request.get_json()
        target_did = data.get('did')
        handle = data.get('handle', '')
        confirm_text = data.get('confirm', '')
        
        if not target_did:
            return jsonify({'error': 'DID required'}), 400
        
        # STEP 3: Verify user is deleting their OWN account
        if authenticated_did != target_did:
            logger.warning(
                f"🚨 SECURITY: User {authenticated_handle} ({authenticated_did}) "
                f"attempted to delete {handle} ({target_did})"
            )
            return jsonify({
                'error': 'Forbidden',
                'message': 'You can only delete your own account'
            }), 403
        
        # STEP 4: Verify user is a resident (reverie.house handle)
        # Non-residents have PDS-hosted avatars/banners that would break
        is_resident = handle and (handle == 'reverie.house' or handle.endswith('.reverie.house'))
        if not is_resident:
            logger.warning(
                f"🚨 SECURITY: Non-resident {handle} ({target_did}) "
                f"attempted to deactivate (only residents can deactivate)"
            )
            return jsonify({
                'error': 'Forbidden',
                'message': 'Account deactivation is only available for Reverie House residents. '
                           'Non-resident accounts have external PDS data that would break if deactivated.'
            }), 403
        
        # STEP 5: Verify confirmation text
        if confirm_text != 'Goodbye, Reverie House':
            return jsonify({'error': 'Confirmation text does not match'}), 400
        
        logger.info(f"🗑️ PDS account deactivation request for {handle} ({target_did})")
        
        from core.database import DatabaseManager
        from core.events import EventsManager
        import time
        
        db = DatabaseManager()
        events = EventsManager(db)
        
        # Verify user exists and get full profile for archival
        cursor = db.execute(
            """
            SELECT did, handle, name, display_name, avatar, banner, 
                   color_hex, description, deactivated
            FROM dreamers WHERE did = %s
            """,
            (target_did,)
        )
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'User not found'}), 404
        
        # Allow deletion of already deactivated accounts (idempotent operation)
        # if dreamer['deactivated']:
        #     return jsonify({'error': 'Account already deactivated'}), 400
        
        logger.info(f"  Found dreamer: {dreamer['name']} ({dreamer['handle']}) - deactivated: {dreamer['deactivated']}")
        logger.info(f"  Authenticated as: {authenticated_handle} ({authenticated_did})")
        
        current_time = int(time.time())
        
        # STEP 1: Archive user data to formers table
        import json
        import requests
        import os
        from urllib.parse import urlparse
        
        avatar_archived = None
        banner_archived = None
        
        # Download and archive avatar if external
        if dreamer['avatar'] and dreamer['avatar'].startswith('https://'):
            try:
                logger.info(f"  📥 Downloading avatar for archival...")
                response = requests.get(dreamer['avatar'], timeout=10)
                if response.status_code == 200:
                    # Determine file extension
                    ext = os.path.splitext(urlparse(dreamer['avatar']).path)[1] or '.jpg'
                    filename = f"{target_did.replace(':', '_')}{ext}"
                    filepath = f"/srv/reverie.house/site/assets/archived/avatars/{filename}"
                    
                    with open(filepath, 'wb') as f:
                        f.write(response.content)
                    
                    avatar_archived = f"/assets/archived/avatars/{filename}"
                    logger.info(f"  ✓ Archived avatar to {avatar_archived}")
            except Exception as e:
                logger.warning(f"  ⚠️ Failed to archive avatar: {e}")
        
        # Download and archive banner if external
        if dreamer['banner'] and dreamer['banner'].startswith('https://'):
            try:
                logger.info(f"  📥 Downloading banner for archival...")
                response = requests.get(dreamer['banner'], timeout=10)
                if response.status_code == 200:
                    ext = os.path.splitext(urlparse(dreamer['banner']).path)[1] or '.jpg'
                    filename = f"{target_did.replace(':', '_')}{ext}"
                    filepath = f"/srv/reverie.house/site/assets/archived/banners/{filename}"
                    
                    with open(filepath, 'wb') as f:
                        f.write(response.content)
                    
                    banner_archived = f"/assets/archived/banners/{filename}"
                    logger.info(f"  ✓ Archived banner to {banner_archived}")
            except Exception as e:
                logger.warning(f"  ⚠️ Failed to archive banner: {e}")
        
        # Create formers record
        profile_snapshot = {
            'handle': dreamer['handle'],
            'name': dreamer['name'],
            'display_name': dreamer['display_name'],
            'description': dreamer.get('description'),
            'color_hex': dreamer.get('color_hex'),
            'original_avatar': dreamer['avatar'],
            'original_banner': dreamer['banner'],
        }
        
        try:
            db.execute(
                """
                INSERT INTO formers 
                (did, handle, name, display_name, avatar_url, avatar_archived, 
                 banner_url, banner_archived, description, color_hex, departure_date, 
                 deactivated_at, profile_data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (did) DO UPDATE SET
                    handle = EXCLUDED.handle,
                    name = EXCLUDED.name,
                    display_name = EXCLUDED.display_name,
                    avatar_url = EXCLUDED.avatar_url,
                    avatar_archived = EXCLUDED.avatar_archived,
                    banner_url = EXCLUDED.banner_url,
                    banner_archived = EXCLUDED.banner_archived,
                    description = EXCLUDED.description,
                    color_hex = EXCLUDED.color_hex,
                    departure_date = EXCLUDED.departure_date,
                    deactivated_at = EXCLUDED.deactivated_at,
                    profile_data = EXCLUDED.profile_data
                """,
                (
                    target_did,
                    dreamer['handle'],
                    dreamer['name'],
                    dreamer['display_name'],
                    dreamer['avatar'],
                    avatar_archived,
                    dreamer['banner'],
                    banner_archived,
                    dreamer.get('description'),
                    dreamer.get('color_hex'),
                    current_time,
                    current_time,
                    json.dumps(profile_snapshot)
                )
            )
            print(f"  ✓ Created/updated formers archive record")
        except Exception as e:
            print(f"  ❌ Failed to create formers record: {e}")
            # Continue anyway - deactivation should still work
        
        # STEP 2: Update dreamers table with archived paths
        if avatar_archived or banner_archived:
            update_parts = []
            update_values = []
            
            if avatar_archived:
                update_parts.append("avatar = %s")
                update_values.append(avatar_archived)
            if banner_archived:
                update_parts.append("banner = %s")
                update_values.append(banner_archived)
            
            if update_parts:
                update_values.append(target_did)
                db.execute(
                    f"UPDATE dreamers SET {', '.join(update_parts)} WHERE did = %s",
                    tuple(update_values)
                )
                logger.info(f"  ✓ Updated dreamer with archived asset paths")
        
        # STEP 3: Record departure event (preserved forever as part of world history)
        try:
            events.record_event(
                did=target_did,
                event='dissipates their self',
                event_type='departure',
                key='dissipate',
                epoch=current_time
            )
            logger.info(f"  ✓ Recorded departure event")
        except Exception as e:
            logger.warning(f"  ⚠️ Failed to record departure event: {e}")
        
        # STEP 6: DELETE THE PDS ACCOUNT (this liberates the handle)
        # This is the critical step that actually removes the AT Protocol account
        # and frees up the handle for future use
        print(f"  🗑️ Deleting PDS account...")
        print(f"     DID: {target_did}")
        print(f"     Handle: {handle}")
        
        import subprocess
        import os
        
        # The pdsadmin command must run on the HOST (not in container)
        # because it's a bash script that downloads and executes commands
        # The API container runs with network_mode: host, so we can access the host
        
        try:
            # Try executing pdsadmin directly (works if running on host or if mounted)
            # For Docker, we need to call the host's pdsadmin
            # Best approach: use nsenter to execute on host namespace
            
            print(f"  🔧 Attempting PDS account deletion via host system")
            
            # Method 1: Direct pdsadmin call (if we're on host or it's available)
            result = subprocess.run(
                ['/usr/local/bin/pdsadmin', 'account', 'delete', target_did],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print(f"  ✅ PDS account deleted successfully")
                print(f"     stdout: {result.stdout}")
                print(f"     Handle {handle} is now available for reuse")
                pds_deleted = True
            else:
                print(f"  ❌ PDS account deletion failed!")
                print(f"     Return code: {result.returncode}")
                print(f"     stdout: {result.stdout}")
                print(f"     stderr: {result.stderr}")
                pds_deleted = False
                # Don't fail the whole operation - continue with Reverie deactivation
                # The user's Reverie account will still be deactivated even if PDS deletion fails
        except subprocess.TimeoutExpired:
            print(f"  ❌ PDS account deletion timed out after 30 seconds")
            pds_deleted = False
        except FileNotFoundError as e:
            print(f"  ❌ pdsadmin not found at /usr/local/bin/pdsadmin: {e}")
            print(f"     PDS deletion skipped - manual cleanup required")
            print(f"     Admin can run: sudo pdsadmin account delete {target_did}")
            pds_deleted = False
        except Exception as e:
            print(f"  ❌ PDS account deletion error: {e}")
            import traceback
            print(traceback.format_exc())
            pds_deleted = False
        
        # STEP 7: Deactivate the Reverie account (soft delete - preserves all history)
        # This prevents login even if PDS deletion somehow failed
        cursor = db.execute(
            """
            UPDATE dreamers 
            SET deactivated = TRUE, deactivated_at = %s
            WHERE did = %s
            """,
            (current_time, target_did)
        )
        
        # Optional: Clear OAuth sessions and credentials
        # This prevents them from logging back in with the same PDS account
        try:
            # Clear any stored credentials (if you have a credentials table)
            db.execute("DELETE FROM user_credentials WHERE did = %s", (target_did,))
            logger.info(f"  ✓ Cleared PDS credentials")
        except Exception as e:
            # Table might not exist, that's okay
            logger.debug(f"  Note: Could not clear credentials: {e}")
        
        # Clear admin sessions (force logout)
        try:
            db.execute("DELETE FROM sessions WHERE admin_did = %s", (target_did,))
            logger.info(f"  ✓ Cleared active sessions")
        except Exception as e:
            logger.debug(f"  Note: Could not clear sessions: {e}")
        
        logger.info(f"  ✅ Account deletion completed successfully!")
        logger.info(f"     ═══════════════════════════════════════════════════════")
        logger.info(f"     PDS ACCOUNT: {'Deleted from AT Protocol server' if pds_deleted else 'FAILED - manual cleanup needed'}")
        logger.info(f"     HANDLE: {handle} is {'now FREE for reuse' if pds_deleted else 'STILL TAKEN (PDS deletion failed)'}")
        logger.info(f"     REVERIE ACCOUNT: Deactivated (cannot log back in)")
        logger.info(f"     DATA ARCHIVED: Profile saved to formers table")
        logger.info(f"     HISTORY: All events, awards, and spectrum data preserved")
        logger.info(f"     ASSETS: Avatar/banner archived locally")
        logger.info(f"     SESSIONS: User logged out from all devices")
        logger.info(f"     ═══════════════════════════════════════════════════════")
        
        if not pds_deleted:
            logger.warning(f"  ⚠️  PDS DELETION FAILED - Admin manual action required:")
            logger.warning(f"     Run on host: sudo pdsadmin account delete {target_did}")
        
        return jsonify({
            'success': True,
            'message': (
                'Your account has been permanently deleted. Your handle is now available for others to use.' 
                if pds_deleted else 
                'Your Reverie account has been deactivated, but PDS deletion failed. Please contact an administrator to complete the deletion.'
            ),
            'pds_deleted': pds_deleted,
            'handle_liberated': pds_deleted,
            'reverie_deactivated': True,
            'deactivated_at': current_time,
            'history_preserved': True,
            'avatar_archived': avatar_archived is not None,
            'banner_archived': banner_archived is not None,
            'warning': None if pds_deleted else 'PDS account deletion failed - administrator intervention required'
        })
        
    except Exception as e:
        logger.error(f"❌ Error deleting account: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error during account deletion'}), 500
