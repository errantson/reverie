"""
🌜 REVERIE ESSENTIAL
Post Routes - Immediate Post Creation
Handles both OAuth and App Password authentication
"""

from flask import Blueprint, request, jsonify
import requests
from datetime import datetime
from core.database import DatabaseManager
from core.encryption import decrypt_password

bp = Blueprint('post', __name__, url_prefix='/api')

def get_user_credentials(user_did):
    """Fetch user's encrypted app password from database"""
    db = DatabaseManager()
    
    # First try user_credentials table (new structure)
    cursor = db.execute('''
        SELECT password_hash, pds 
        FROM user_credentials 
        WHERE did = %s AND valid = TRUE
    ''', (user_did,))
    row = cursor.fetchone()
    
    if row and row['password_hash']:
        # Get handle from dreamers table
        cursor2 = db.execute('SELECT handle FROM dreamers WHERE did = %s', (user_did,))
        dreamer = cursor2.fetchone()
        handle = dreamer['handle'] if dreamer else None
        return row['password_hash'], handle, row['pds']
    
    # Fallback to old dreamers table structure (if it exists)
    try:
        cursor = db.execute('''
            SELECT app_password_encrypted, handle 
            FROM dreamers 
            WHERE did = %s
        ''', (user_did,))
        row = cursor.fetchone()
        
        if row and row.get('app_password_encrypted'):
            return row['app_password_encrypted'], row['handle'], None
    except:
        pass
    
    return None, None, None

def create_bsky_session_with_app_password(handle, app_password):
    """Create a Bluesky session using app password"""
    try:
        # Try bsky.social first
        response = requests.post(
            'https://bsky.social/xrpc/com.atproto.server.createSession',
            json={
                'identifier': handle,
                'password': app_password
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        
        # If user is on reverie.house PDS, try that
        if handle.endswith('.reverie.house'):
            response = requests.post(
                'https://reverie.house/xrpc/com.atproto.server.createSession',
                json={
                    'identifier': handle,
                    'password': app_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
        
        return None
    except Exception as e:
        print(f"❌ [Post] Session creation failed: {e}")
        return None

def create_post_with_token(access_jwt, pds, did, text, facets=None, reply_to=None):
    """Create a post using an access token (OAuth or app password session)"""
    try:
        record = {
            '$type': 'app.bsky.feed.post',
            'text': text,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        if facets:
            record['facets'] = facets
        
        if reply_to:
            # Would need to fetch parent CID - simplified for now
            pass
        
        print(f"📤 [Post] Sending to {pds}/xrpc/com.atproto.repo.createRecord")
        print(f"📤 [Post] Repo: {did}")
        print(f"📤 [Post] Text preview: {text[:100]}...")
        
        response = requests.post(
            f'{pds}/xrpc/com.atproto.repo.createRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': did,
                'collection': 'app.bsky.feed.post',
                'record': record
            },
            timeout=15
        )
        
        print(f"📥 [Post] Response status: {response.status_code}")
        
        if response.status_code == 200:
            print(f"✅ [Post] Success!")
            return response.json()
        else:
            print(f"❌ [Post] Create failed: {response.status_code}")
            print(f"❌ [Post] Response headers: {dict(response.headers)}")
            print(f"❌ [Post] Response body: {response.text}")
            return None
    except requests.exceptions.Timeout as e:
        print(f"❌ [Post] Timeout exception: {e}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"❌ [Post] Connection exception: {e}")
        return None
    except Exception as e:
        print(f"❌ [Post] Unexpected exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None

def apply_lore_label(post_uri, user_did, lore_type='observation', canon_id=None):
    """Apply lore label to a post via lore.farm"""
    try:
        # Construct label value
        label_val = f'lore:reverie.house'
        if lore_type and lore_type != 'observation':
            label_val = f'lore:{lore_type}'
        
        # Apply label via lore.farm
        response = requests.post(
            'https://lore.farm/xrpc/com.atproto.label.subscribeLabels',
            json={
                'uri': post_uri,
                'val': label_val
            },
            timeout=10
        )
        
        print(f"✅ [Post] Lore label applied: {label_val} to {post_uri}")
        return True
    except Exception as e:
        print(f"❌ [Post] Lore label failed: {e}")
        return False

@bp.route('/post', methods=['POST'])
def create_immediate_post():
    """
    Create an immediate post - handles both OAuth and App Password auth
    
    Query params:
        user_did: User's DID (required)
    
    Body:
        text: Post text (required)
        is_lore: Whether to apply lore label (optional, default false)
        lore_type: Type of lore (optional, default 'observation')
        canon_id: Canon event ID to link (optional)
        
    Auth:
        - OAuth: Reads accessJwt from session (via cookie or header)
        - App Password: Uses stored encrypted app password
    """
    try:
        data = request.json
        user_did = request.args.get('user_did')
        
        if not user_did:
            return jsonify({
                'status': 'error',
                'error': 'user_did is required'
            }), 400
        
        text = data.get('text', '').strip()
        if not text:
            return jsonify({
                'status': 'error',
                'error': 'Post text is required'
            }), 400
        
        is_lore = data.get('is_lore', False)
        lore_type = data.get('lore_type', 'observation')
        canon_id = data.get('canon_id')
        
        # Try to get OAuth session first (preferred method)
        access_jwt = None
        pds = 'https://bsky.social'  # Default PDS
        use_app_password = True  # Default to app password (OAuth tokens from frontend are NOT Bluesky access tokens)
        
        # Check for Authorization header (Reverie OAuth token - NOT a Bluesky access token)
        # NOTE: The frontend sends a Reverie OAuth token, which is for auth with Reverie API,
        # but we need a Bluesky access JWT to post. So we always use app password for now.
        auth_header = request.headers.get('Authorization')
        
        # Determine user's PDS
        db = DatabaseManager()
        cursor = db.execute('SELECT server, handle FROM dreamers WHERE did = %s', (user_did,))
        row = cursor.fetchone()
        
        if row and row['server']:
            server = row['server']
            if not server.startswith('http'):
                server = f'https://{server}'
            pds = server
            print(f"🏠 [Post] User's PDS: {pds}")
        
        print(f"🔐 [Post] Using app password authentication (OAuth token from frontend is not a Bluesky access JWT)")
        
        # If we need app password (either no OAuth or wrong PDS), get it
        if use_app_password:
            print(f"🔐 [Post] Fetching app password credentials")
            encrypted_password, handle, stored_pds = get_user_credentials(user_did)
            
            if not encrypted_password or not handle:
                return jsonify({
                    'status': 'error',
                    'error': 'No credentials available. Please connect an app password or log in with OAuth.'
                }), 401
            
            # Use stored PDS if available
            if stored_pds:
                pds = stored_pds
                print(f"🏠 [Post] Using stored PDS: {pds}")
            
            # Decrypt app password
            try:
                app_password = decrypt_password(encrypted_password)
            except Exception as e:
                print(f"❌ [Post] Decryption failed: {e}")
                return jsonify({
                    'status': 'error',
                    'error': 'App password needs to be reconnected. Please go to Dashboard → Details tab and connect your app password again.',
                    'error_code': 'INVALID_CREDENTIALS'
                }), 401
            
            # Create session with app password
            session_data = create_bsky_session_with_app_password(handle, app_password)
            if not session_data:
                return jsonify({
                    'status': 'error',
                    'error': 'Failed to create session with app password'
                }), 401
            
            access_jwt = session_data.get('accessJwt')
            # Only override PDS from session if we don't have stored_pds
            if not stored_pds:
                pds = session_data.get('didDoc', {}).get('service', [{}])[0].get('serviceEndpoint', pds)
            print(f"✅ [Post] Created session with app password, PDS: {pds}")
        
        # Create the post
        print(f"📝 [Post] Creating post on {pds} for {user_did}")
        print(f"📝 [Post] Post text length: {len(text)} chars")
        print(f"📝 [Post] Access JWT present: {bool(access_jwt)}")
        print(f"📝 [Post] PDS URL: {pds}")
        result = create_post_with_token(access_jwt, pds, user_did, text)
        
        if not result:
            print(f"❌ [Post] create_post_with_token returned None")
            return jsonify({
                'status': 'error',
                'error': 'Failed to create post on Bluesky. Check server logs for details.'
            }), 500
        
        post_uri = result.get('uri')
        post_cid = result.get('cid')
        
        print(f"✅ [Post] Created: {post_uri}")
        
        # Apply lore label if requested
        if is_lore and post_uri:
            apply_lore_label(post_uri, user_did, lore_type, canon_id)
        
        return jsonify({
            'status': 'success',
            'uri': post_uri,
            'cid': post_cid,
            'message': 'Post created successfully'
        }), 200
        
    except Exception as e:
        print(f"❌ [Post] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
