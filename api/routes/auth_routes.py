"""
Auth Routes Blueprint
Handles user authentication, registration, and session management
"""

from flask import Blueprint, request, jsonify
import os

# Create blueprint
bp = Blueprint('auth', __name__, url_prefix='/api')

# Import shared dependencies
from core.admin_auth import auth, get_client_ip
from core.rate_limiter import PersistentRateLimiter
from functools import wraps

rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60


def rate_limit(requests_per_minute=100):
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


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@bp.route('/reverie-login', methods=['POST'])
def reverie_login():
    """
    Smart authentication for .reverie.house handles:
    - First tries PDS authentication (for real reverie.house accounts)
    - If account is hosted elsewhere (e.g., bsky.social with .reverie.house handle),
      falls back to OAuth flow
    
    Expects: {
        "handle": "username.reverie.house",
        "password": "app-password"  (optional if using OAuth fallback)
    }
    
    Returns: {
        "success": true,
        "method": "pds" | "oauth",  // Which auth method succeeded
        "session": {...},
        "redirect": "/dreamers?name=..." | null
    }
    """
    try:
        data = request.get_json()
        handle = data.get('handle', '').strip().lower()
        password = data.get('password', '')
        
        if not handle:
            return jsonify({'error': 'Handle required'}), 400
        
        print(f"Reverie login attempt: handle={handle}")
        
        # Resolve handle to DID and check PDS service endpoint
        import requests
        
        # Step 1: Resolve handle to DID
        try:
            handle_response = requests.get(
                f"https://bsky.social/xrpc/com.atproto.identity.resolveHandle",
                params={'handle': handle},
                timeout=30
            )
            if handle_response.status_code != 200:
                return jsonify({'error': 'Handle not found'}), 404
            
            did = handle_response.json()['did']
            print(f"Resolved handle {handle} to DID: {did}")
        except Exception as e:
            print(f"Handle resolution error: {e}")
            return jsonify({'error': 'Unable to resolve handle'}), 400
        
        # Step 2: Fetch DID document to find PDS service endpoint
        try:
            did_doc_response = requests.get(
                f"https://plc.directory/{did}",
                timeout=30
            )
            if did_doc_response.status_code != 200:
                return jsonify({'error': 'DID document not found'}), 404
            
            did_doc = did_doc_response.json()
            service = next((s for s in did_doc.get('service', []) if s.get('id') == '#atproto_pds'), None)
            service_endpoint = service.get('serviceEndpoint', '') if service else ''
            print(f"DID {did} has PDS endpoint: {service_endpoint}")
        except Exception as e:
            print(f"DID document fetch error: {e}")
            return jsonify({'error': 'Unable to fetch account information'}), 400
        
        # Step 3: Validate it's a reverie.house PDS account
        if service_endpoint != 'https://reverie.house':
            print(f"Account is not on reverie.house PDS (endpoint: {service_endpoint})")
            return jsonify({'error': 'oauth_required'}), 403
        
        # Step 3.5: Check if account is deactivated BEFORE attempting PDS auth
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT deactivated 
            FROM dreamers 
            WHERE did = %s
        """, (did,))
        dreamer = cursor.fetchone()
        
        if dreamer and dreamer.get('deactivated'):
            print(f"❌ Login blocked: Account {handle} is deactivated")
            return jsonify({'error': 'Account has been deactivated'}), 403
        
        # Try PDS authentication
        pds = "https://reverie.house"
        
        print(f"🔐 Attempting PDS authentication for {handle} at {pds}")
        
        response = requests.post(
            f"{pds}/xrpc/com.atproto.server.createSession",
            json={
                "identifier": handle,
                "password": password
            },
            timeout=10
        )
        
        print(f"PDS response: {response.status_code}")
        
        # If PDS auth succeeds, return the session
        if response.status_code == 200:
            session_data = response.json()
            print(f"✅ PDS auth successful for {handle} (DID: {session_data['did']})")
            
            # Get dreamer info from database (deactivation already checked above)
            cursor = db.execute("""
                SELECT name, avatar, display_name 
                FROM dreamers 
                WHERE did = %s
            """, (session_data['did'],))
            dreamer = cursor.fetchone()
            
            # Create backend session token for authenticated requests
            backend_token = auth.create_session(
                did=session_data['did'],
                handle=session_data['handle'],
                ip_address=get_client_ip(),
                user_agent=request.headers.get('User-Agent')
            )
            
            # Enhance session with dreamer data
            enhanced_session = {
                'did': session_data['did'],
                'sub': session_data['did'],  # OAuth compatibility
                'handle': session_data['handle'],
                'accessJwt': session_data['accessJwt'],
                'refreshJwt': session_data['refreshJwt'],
                'displayName': session_data.get('displayName', '') or (dreamer['display_name'] if dreamer else ''),
                'avatar': session_data.get('avatar', '') or (dreamer['avatar'] if dreamer else ''),
                'email': session_data.get('email'),
                'emailConfirmed': session_data.get('emailConfirmed'),
                'profile': {
                    'did': session_data['did'],
                    'handle': session_data['handle'],
                    'displayName': session_data.get('displayName', '') or (dreamer['display_name'] if dreamer else ''),
                    'avatar': session_data.get('avatar', '') or (dreamer['avatar'] if dreamer else '')
                }
            }
            
            redirect_url = "/story"
            
            return jsonify({
                'success': True,
                'method': 'pds',
                'session': enhanced_session,
                'token': backend_token,  # Backend session token for authenticated API calls
                'redirect': redirect_url
            })
        
        # If account not found (404/400), check if handle resolves to a different server
        if response.status_code in [400, 404]:
            try:
                error_data = response.json()
                error_msg = error_data.get('message', '')
                print(f"PDS auth failed: {error_msg}")
                
                # Check if this handle resolves to a DID on another server
                # Use ATProto identity resolution
                try:
                    resolve_response = requests.get(
                        f"https://bsky.social/xrpc/com.atproto.identity.resolveHandle",
                        params={"handle": handle},
                        timeout=30
                    )
                    
                    if resolve_response.status_code == 200:
                        resolve_data = resolve_response.json()
                        did = resolve_data.get('did')
                        
                        if did:
                            print(f"Handle resolves to {did} on another server - using OAuth fallback")
                            
                            # This is a valid handle on another server
                            # Signal to frontend to use OAuth instead
                            return jsonify({
                                'success': False,
                                'error': 'oauth_required',
                                'message': 'This account is hosted on another server. Please use Bluesky login.',
                                'handle': handle,
                                'did': did
                            }), 400
                except Exception as resolve_error:
                    print(f"Handle resolution failed: {resolve_error}")
                
                # Handle doesn't exist anywhere
                if 'not found' in error_msg.lower() or 'does not exist' in error_msg.lower():
                    return jsonify({'error': 'Account not found'}), 404
                return jsonify({'error': error_msg}), 400
            except:
                return jsonify({'error': 'Invalid credentials'}), 400
        
        # Invalid password
        if response.status_code == 401:
            return jsonify({'error': 'Invalid password'}), 401
        
        # Other errors
        error_detail = 'Authentication failed'
        try:
            error_data = response.json()
            error_detail = error_data.get('message', error_detail)
            print(f"PDS error: {error_detail}")
        except:
            pass
        
        return jsonify({'error': error_detail}), response.status_code
        
        print(f"Authentication successful")
        
        session_data = response.json()
        
        # Fetch profile from Bluesky public API
        did = session_data['did']
        profile_url = f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}"
        
        profile = {}
        try:
            profile_response = requests.get(profile_url, timeout=30)
            if profile_response.status_code == 200:
                profile = profile_response.json()
        except Exception as e:
            print(f"Could not fetch profile: {e}")
        
        # Return session in OAuth-compatible format
        return jsonify({
            'success': True,
            'session': {
                'did': session_data['did'],
                'sub': session_data['did'],  # OAuth compatibility
                'handle': session_data['handle'],
                'accessJwt': session_data['accessJwt'],
                'refreshJwt': session_data.get('refreshJwt'),
                'expiresAt': session_data.get('accessJwtExpiresAt'),
                'displayName': profile.get('displayName', session_data['handle']),
                'avatar': profile.get('avatar'),
                'profile': profile if profile else None
            }
        })
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Connection timeout'}), 504
    except requests.exceptions.RequestException as e:
        print(f"Network error in reverie-login: {e}")
        return jsonify({'error': 'Network error communicating with PDS'}), 503
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# REGISTRATION ENDPOINTS
# ============================================================================

@bp.route('/check-handle', methods=['GET'])
@rate_limit(requests_per_minute=30)
def check_handle():
    """
    Check if a handle is available on Reverie House PDS.
    
    Query params:
        handle: The full handle to check (e.g., "username.reverie.house")
    
    Returns: {
        "available": true/false,
        "reason": "available" | "handle_taken" | "name_conflict" | "invalid_handle"
    }
    """
    try:
        handle = request.args.get('handle', '').strip().lower()
        
        if not handle:
            return jsonify({'error': 'Handle parameter required'}), 400
        
        if not handle.endswith('.reverie.house'):
            return jsonify({
                'available': False,
                'reason': 'invalid_handle'
            }), 200
        
        # Extract username from handle
        username = handle.replace('.reverie.house', '')
        
        # Check if handle exists on PDS
        import requests
        pds = "https://reverie.house"
        
        try:
            # Try to resolve the DID for this handle
            response = requests.get(
                f"{pds}/xrpc/com.atproto.identity.resolveHandle",
                params={"handle": handle},
                timeout=30
            )
            
            if response.status_code == 200:
                # Handle exists on PDS
                return jsonify({
                    'available': False,
                    'reason': 'handle_taken'
                }), 200
            elif response.status_code == 400:
                # Handle doesn't exist - check for name conflicts in database
                from core.database import DatabaseManager
                db = DatabaseManager()
                
                try:
                    # Check if username is taken by any dreamer's primary name OR alternate names
                    # This protects {name}.reverie.house subdomains that route via Caddy
                    # alts can be: "altname" or "alt1,alt2,alt3"
                    cursor = db.execute("""
                        SELECT COUNT(*) as count 
                        FROM dreamers 
                        WHERE LOWER(name) = %s
                           OR LOWER(alts) = %s
                           OR LOWER(alts) LIKE %s
                           OR LOWER(alts) LIKE %s
                           OR LOWER(alts) LIKE %s
                    """, (username, username, f"{username},%", f"%,{username},%", f"%,{username}"))
                    
                    count = cursor.fetchone()['count']
                    
                    if count > 0:
                        return jsonify({
                            'available': False,
                            'reason': 'name_conflict'
                        }), 200
                    
                except Exception as db_err:
                    print(f"⚠️ Database check failed: {db_err}")
                    # Continue - assume available if DB check fails
                
                # Available!
                return jsonify({
                    'available': True,
                    'reason': 'available'
                }), 200
            else:
                # Unknown error - assume unavailable to be safe
                return jsonify({
                    'available': False,
                    'reason': 'handle_taken'
                }), 200
                
        except requests.Timeout:
            return jsonify({'error': 'Request timeout'}), 504
        except requests.RequestException as e:
            print(f"❌ PDS request failed: {e}")
            return jsonify({'error': 'Service temporarily unavailable'}), 503
            
    except Exception as e:
        print(f"❌ Error in /api/check-handle: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500


@bp.route('/create-account', methods=['POST'])
@rate_limit(requests_per_minute=10)
def create_account():
    """
    Create a new account on Reverie House PDS.
    Proxies to the PDS createAccount endpoint with validation.
    
    Expects: {
        "handle": "username.reverie.house",
        "email": "user@example.com" (optional),
        "password": "secure-password",
        "inviteCode": "reverie-house-xxxxx-xxxxx"
    }
    
    Returns PDS session data on success.
    """
    try:
        data = request.get_json()
        handle = data.get('handle', '').strip().lower()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        invite_code = data.get('inviteCode', '').strip()
        
        # Validate inputs
        if not handle:
            return jsonify({'error': 'Handle required'}), 400
        
        if not handle.endswith('.reverie.house'):
            return jsonify({'error': 'Only reverie.house handles are supported'}), 400
        
        if not password:
            return jsonify({'error': 'Password required'}), 400
        
        if not email:
            return jsonify({'error': 'Email required'}), 400
        
        if not invite_code:
            return jsonify({'error': 'Invite code required'}), 400
        
        # Validate invite code format
        if not invite_code.startswith('reverie-house-'):
            return jsonify({'error': 'Invalid invite code format'}), 400
        
        # Check if invite code exists and is available in our database
        from core.database import DatabaseManager
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT code, used_by, used_at 
            FROM invites 
            WHERE code = %s
        """, (invite_code,))
        invite_record = cursor.fetchone()
        
        if not invite_record:
            return jsonify({'error': 'Invalid invite code'}), 400
        
        if invite_record['used_by']:
            return jsonify({'error': 'This invite code has already been used'}), 400
        
        print(f"\n🎫 Creating account: {handle}")
        print(f"   Invite code: {invite_code} (verified available in database)")
        
        # Call PDS createAccount endpoint with the real invite code
        import requests
        pds = "https://reverie.house"
        
        pds_payload = {
            'handle': handle,
            'email': email,
            'password': password,
            'inviteCode': invite_code
        }
        
        response = requests.post(
            f"{pds}/xrpc/com.atproto.server.createAccount",
            json=pds_payload,
            timeout=30
        )
        
        if not response.ok:
            error_data = {}
            try:
                error_data = response.json()
            except:
                error_data = {'message': response.text or 'Account creation failed'}
            
            error_msg = error_data.get('message') or error_data.get('error') or 'Account creation failed'
            print(f"   ❌ PDS error: {error_msg}")
            return jsonify({'error': error_msg}), response.status_code
        
        result = response.json()
        did = result.get('did')
        access_jwt = result.get('accessJwt')
        print(f"   ✅ PDS account created: {did}")
        
        # Initialize PDS profile with default avatar and capitalized display name
        # This uses the user's password to authenticate and set the profile properly
        try:
            from utils.init_profile import init_pds_profile
            profile_result = init_pds_profile(did, handle, password, pds)
            if profile_result.get('success'):
                print(f"   ✅ PDS profile initialized")
                # Add a small delay to allow profile to propagate
                import time
                time.sleep(0.5)
            else:
                print(f"   ⚠️  Profile initialization failed (non-fatal): {profile_result.get('error')}")
        except Exception as profile_err:
            print(f"   ⚠️  Profile initialization error (non-fatal): {profile_err}")
            import traceback
            traceback.print_exc()
        
        # Auto-generate and store app password for reverie.house accounts
        try:
            import secrets
            import base64
            from core.database import DatabaseManager
            
            # Generate app password (format: xxxx-xxxx-xxxx-xxxx)
            app_password = '-'.join([
                ''.join(secrets.choice('abcdefghjkmnpqrstuvwxyz23456789') for _ in range(4))
                for _ in range(4)
            ])
            
            print(f"   🔑 Generated app password for {handle}")
            
            # Create app password via PDS
            app_password_response = requests.post(
                f"{pds}/xrpc/com.atproto.server.createAppPassword",
                json={'name': 'reverie-auto'},
                headers={'Authorization': f"Bearer {access_jwt}"},
                timeout=10
            )
            
            if app_password_response.ok:
                app_pass_data = app_password_response.json()
                actual_app_password = app_pass_data.get('password')
                
                # Store app password hash in database
                db = DatabaseManager()
                password_hash = base64.b64encode(actual_app_password.encode()).decode()
                
                db.execute("""
                    INSERT OR REPLACE INTO credentials 
                    (did, password_hash, pds, valid, last_verified)
                    VALUES (%s, %s, %s, TRUE, CURRENT_TIMESTAMP)
                """, (did, password_hash, pds))
        # Auto-committed by DatabaseManager
                
                print(f"   ✅ App password stored for {handle}")
            else:
                print(f"   ⚠️  Failed to create app password: {app_password_response.status_code}")
                
        except Exception as app_pass_error:
            print(f"   ⚠️  App password generation failed (non-fatal): {app_pass_error}")
            # Don't fail the whole registration if app password fails
        
        # Mark invite code as used - do this at the very end after all potential failpoints
        try:
            from core.database import DatabaseManager
            import time
            db = DatabaseManager()
            now = int(time.time())
            db.execute("""
                UPDATE invites
                SET used_by = %s, used_at = %s, use_count = use_count + 1
                WHERE code = %s AND used_by IS NULL
            """, (did, now, invite_code))
        # Auto-committed by DatabaseManager
            print(f"   ✅ Invite code marked as used: {invite_code}")
        except Exception as invite_err:
            print(f"   ⚠️  Failed to mark invite code as used (non-fatal): {invite_err}")
        
        # Return the PDS session data
        # Note: The frontend will dispatch oauth:login event which will trigger auto-registration
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error in /api/create-account: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/register', methods=['POST'])
def register():
    """
    Auto-register a new dreamer when they log in via OAuth.
    Uses shared registration utility for consistency with namegiver quest.
    - Assigns name based on handle prefix (e.g., alice.bsky.social -> alice or alice_01 if taken)
    - Records 'arrival' canon entry (with account creation date)
    - Generates spectrum
    - Triggers Caddy rebuild for subdomain routing
    """
    try:
        data = request.get_json()
        did = data.get('did')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        print(f"\n🔵 REGISTER called for DID: {did}")
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from utils.registration import register_dreamer
        
        # Get profile data from frontend (if provided)
        profile = data.get('profile')
        handle = None
        
        if profile:
            print(f"Using profile data from frontend")
            handle = profile.get('handle', '')
        
        # If no handle yet, resolve it from DID before registration
        if not handle:
            print(f"⚠️  No handle in payload, resolving from DID...")
            from utils.identity import IdentityManager
            identity = IdentityManager()
            try:
                resolved_handle, _ = identity.get_handle_from_did(did)
                if resolved_handle:
                    handle = resolved_handle
                    print(f"   ✅ Resolved handle: {handle}")
                else:
                    print(f"   ❌ CRITICAL: Could not resolve handle from DID")
                    print(f"      DID: {did}")
                    print(f"      This will cause register_dreamer to fetch the profile")
                    print(f"      If profile fetch also fails, registration will fail (as intended)")
            except Exception as e:
                print(f"   ❌ CRITICAL: Error resolving handle from DID: {e}")
                print(f"      DID: {did}")
                print(f"      Exception type: {type(e).__name__}")
                import traceback
                traceback.print_exc()
        else:
            print(f"✅ Handle provided in payload: {handle}")
            # SAFEGUARD: Verify it's not a DID
            if handle.startswith('did:'):
                print(f"   ❌ CRITICAL ERROR: Handle is actually a DID!")
                print(f"      This should never happen - indicates a bug in the calling code")
                return jsonify({
                    'error': 'Invalid handle',
                    'message': 'Handle resolution failed. Please try again or contact support.'
                }), 400
        
        # Prepare canon entries for OAuth registration
        canon_entries = [{
            'event': 'found our wild mindscape',
            'type': 'arrival',
            'key': 'arrival'
        }]
        
        # Register dreamer using shared utility
        # Note: If handle is still None, register_dreamer will fetch the profile
        reg_result = register_dreamer(
            did=did,
            handle=handle,  # Pass None if not resolved, let register_dreamer handle it
            profile=profile,
            proposed_name=None,  # Will generate from handle
            canon_entries=canon_entries,
            verbose=True
        )
        
        if not reg_result['success']:
            return jsonify({
                'error': ', '.join(reg_result['errors']) if reg_result['errors'] else 'Registration failed'
            }), 500
        
        dreamer = reg_result['dreamer']
        
        if dreamer.get('already_registered'):
            return jsonify({
                'success': True,
                'already_registered': True,
                'newly_registered': False,
                'dreamer': {
                    'did': dreamer['did'],
                    'name': dreamer['name'],
                    'handle': dreamer['handle'],
                    'has_name': True
                }
            })
        
        print(f"Registered OAuth user: {dreamer['name']} (@{dreamer['handle']})")
        
        return jsonify({
            'success': True,
            'newly_registered': True,
            'already_registered': False,
            'dreamer': {
                'did': dreamer['did'],
                'name': dreamer['name'],
                'handle': dreamer['handle'],
                'avatar': dreamer.get('avatar', ''),
                'display_name': dreamer.get('display_name', ''),
                'has_name': True
            }
        })
        
    except Exception as e:
        print(f"Error in /api/register: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/auto-register', methods=['POST'])
def auto_register():
    """
    Auto-register a new dreamer when they log in via OAuth.
    Uses shared registration utility for consistency with namegiver quest.
    - Assigns name based on handle prefix (e.g., alice.bsky.social -> alice or alice_01 if taken)
    - Records 'arrival' canon entry (with account creation date)
    - Generates spectrum
    - Triggers Caddy rebuild for subdomain routing
    """
    try:
        data = request.get_json()
        did = data.get('did')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from utils.registration import register_dreamer
        
        # Get profile data from frontend (if provided)
        profile = data.get('profile')
        handle = profile.get('handle', '') if profile else None
        
        # Prepare canon entries for OAuth registration
        canon_entries = [{
            'event': 'found our wild mindscape',
            'type': 'arrival',
            'key': 'arrival'
        }]
        
        # Register dreamer using shared utility
        reg_result = register_dreamer(
            did=did,
            handle=handle or did,  # Use DID as fallback, will be resolved
            profile=profile,
            proposed_name=None,  # Will generate from handle
            canon_entries=canon_entries,
            verbose=True
        )
        
        if not reg_result['success']:
            return jsonify({
                'error': ', '.join(reg_result['errors']) if reg_result['errors'] else 'Registration failed'
            }), 500
        
        dreamer = reg_result['dreamer']
        
        # Create session token for this OAuth user
        session_token = auth.create_session(
            did=dreamer['did'],
            handle=dreamer.get('handle', ''),
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        if dreamer.get('already_registered'):
            return jsonify({
                'success': True,
                'already_registered': True,
                'newly_registered': False,
                'token': session_token,
                'dreamer': {
                    'did': dreamer['did'],
                    'name': dreamer['name'],
                    'handle': dreamer['handle'],
                    'has_name': True
                }
            })
        
        return jsonify({
            'success': True,
            'newly_registered': True,
            'already_registered': False,
            'token': session_token,
            'dreamer': {
                'did': dreamer['did'],
                'name': dreamer['name'],
                'handle': dreamer['handle'],
                'avatar': dreamer.get('avatar', ''),
                'display_name': dreamer.get('display_name', ''),
                'has_name': True
            }
        })
        
    except Exception as e:
        print(f"Error in /api/auto-register: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/post-registration', methods=['POST'])
@rate_limit(10)  # Restrictive - prevent spam registrations
def post_registration():
    """
    Process registration after frontend has posted the reply.
    Frontend posts using OAuth, then sends us the reply URI to process.
    """
    try:
        data = request.get_json()
        did = data.get('did')
        name = data.get('name', '').strip()
        reply_uri = data.get('reply_uri', '').strip()
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        if not name:
            return jsonify({'error': 'Name required'}), 400
            
        if not reply_uri:
            return jsonify({'error': 'Reply URI required'}), 400
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.network import NetworkClient
        from ops.commands import name_dreamer
        
        # Check if user already registered
        from core.database import DatabaseManager
        db = DatabaseManager()
        cursor = db.execute("SELECT did, name, handle FROM dreamers WHERE did = %s", (did,))
        existing = cursor.fetchone()
        
        if existing:
            return jsonify({
                'success': True,
                'message': 'Already registered',
                'dreamer': {
                    'did': existing['did'],
                    'name': existing['name'],
                    'handle': existing['handle']
                }
            })
        
        # Get user profile info
        from ops.bsky_get import BlueskyAPI
        api = BlueskyAPI()
        profile = api.get_profile(did)
        
        if not profile:
            return jsonify({'error': 'Could not fetch user profile'}), 500
        
        handle = profile.get('handle', '')
        display_name = profile.get('displayName', '')
        
        # Build reply object structure that name_dreamer expects
        from datetime import datetime, timezone
        matching_reply = {
            'uri': reply_uri,
            'cid': '',  # We don't need CID for processing
            'author': {
                'did': did,
                'handle': handle,
                'displayName': display_name
            },
            'record': {
                'text': name,
                'createdAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            }
        }
        
        # Process through name_dreamer command (same as quest)
        quest_config = {
            "canon": {
                "event": "gained a name",
                "keys": ["registration"]
            }
        }
        
        print(f"Processing registration for {handle}: {name} ({reply_uri})")
        results = name_dreamer([matching_reply], quest_config)
        
        if not results or len(results) == 0:
            return jsonify({'error': 'Processing failed'}), 500
        
        result = results[0]
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'message': 'Registered successfully',
                'dreamer': {
                    'did': did,
                    'name': result.get('name'),
                    'handle': result.get('handle'),
                    'reply_uri': reply_uri
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Registration failed')
            }), 400
        
    except Exception as e:
        print(f"Error in /api/post-registration: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# USER ENDPOINTS
# ============================================================================

@bp.route('/user/color', methods=['GET'])
def get_user_color():
    """Get color for currently logged-in user (works with both OAuth and PDS sessions)"""
    try:
        # Try to get DID from query parameter (passed by frontend)
        did = request.args.get('did')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        from core.database import DatabaseManager
        db = DatabaseManager()
        
        cursor = db.execute("SELECT color_hex FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer or not dreamer['color_hex']:
            return jsonify({'color': None}), 200
        
        return jsonify({'color': dreamer['color_hex']})
        
    except Exception as e:
        print(f"Error in /api/user/color: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# AUTH STATUS CHECK
# ============================================================================

@bp.route('/auth-status', methods=['GET'])
def check_auth_status():
    """
    Check if user has credential issues and pending auth-failed posts.
    Called on dashboard load to proactively notify users.
    """
    try:
        user_did = request.args.get('did')
        
        if not user_did:
            return jsonify({'error': 'DID required'}), 400
        
        from core.database import DatabaseManager
        db = DatabaseManager()
        
        # Check credential validity and last failure time
        creds = db.execute('''
            SELECT is_valid, last_failure_at 
            FROM user_credentials 
            WHERE did = ?
        ''', (user_did,)).fetchone()
        
        # Count auth-failed posts
        failed_count = db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'auth_failed'
        ''', (user_did,)).fetchone()
        
        count = failed_count['count'] if failed_count else 0
        
        return jsonify({
            'has_invalid_credentials': creds is not None and not creds['is_valid'],
            'failed_posts_count': count,
            'last_failure_at': creds['last_failure_at'] if creds else None
        })
        
    except Exception as e:
        print(f"Error in /api/auth-status: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

