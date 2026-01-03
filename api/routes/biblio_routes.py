"""
Biblio Routes Blueprint
Handles biblio.bond book operations using stored credentials
"""

from flask import Blueprint, request, jsonify
import requests
from datetime import datetime
from core.database import DatabaseManager
from core.encryption import decrypt_password
from api.rate_limit import rate_limit

# Create blueprint
bp = Blueprint('biblio', __name__, url_prefix='/api/biblio')


def resolve_pds_from_did(did: str) -> str:
    """
    Resolve PDS URL from a user's DID document.
    """
    try:
        did_response = requests.get(
            f"https://plc.directory/{did}",
            timeout=5
        )
        if did_response.status_code == 200:
            did_doc = did_response.json()
            services = did_doc.get('service', [])
            for service in services:
                if service.get('id') == '#atproto_pds':
                    return service.get('serviceEndpoint')
    except Exception as e:
        print(f"⚠️ [BIBLIO] Failed to resolve PDS from DID: {e}")
    
    return 'https://bsky.social'


@bp.route('/add-book', methods=['POST'])
@rate_limit(30)  # Max 30 books per hour
def add_book():
    """
    Add a book to user's biblio.bond library using stored credentials
    
    POST /api/biblio/add-book
    Headers: Authorization: Bearer <oauth_token>
    Body: { "title": "Book Title", "author": "Author Name" }
    
    Returns:
        200: {"status": "success", "uri": "at://...", "cid": "..."}
        400: {"status": "error", "error": "Invalid request"}
        401: {"status": "error", "error": "Not authenticated"}
        403: {"status": "error", "error": "No credentials"}
    """
    try:
        print(f"\n{'='*80}")
        print(f"📚 [BIBLIO] ADD BOOK REQUEST")
        print(f"{'='*80}")
        
        # Import validate_work_token from admin module
        import sys
        sys.path.insert(0, '/srv/reverie.house')
        from admin import validate_work_token
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        print(f"🔐 [BIBLIO] Token received: {token[:20] + '...' if token else 'NONE'}")
        
        if not token:
            print(f"❌ [BIBLIO] No authorization token provided")
            return jsonify({'status': 'error', 'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        print(f"🔍 [BIBLIO] Token validation:")
        print(f"   - Valid: {valid}")
        print(f"   - User DID: {user_did}")
        print(f"   - Handle: {handle}")
        
        if not valid or not user_did:
            print(f"❌ [BIBLIO] Invalid or expired token")
            return jsonify({'status': 'error', 'error': 'Invalid or expired token'}), 401
        
        # Get book data from request
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'error': 'No data provided'}), 400
        
        title = data.get('title', '').strip()
        author = data.get('author', '').strip()
        
        print(f"📚 [BIBLIO] Book: '{title}' by '{author}'")
        
        if not title or not author:
            return jsonify({'status': 'error', 'error': 'Title and author required'}), 400
        
        # Get user's stored credentials
        db = DatabaseManager()
        cred = db.fetch_one('''
            SELECT app_password_hash, pds_url FROM user_credentials
            WHERE did = %s AND app_password_hash IS NOT NULL AND app_password_hash != ''
        ''', (user_did,))
        
        if not cred or not cred.get('app_password_hash'):
            print(f"❌ [BIBLIO] No stored credentials found")
            return jsonify({
                'status': 'error', 
                'error': 'No stored credentials. Please connect your app password first.',
                'needs_credentials': True
            }), 403
        
        # Get user's handle from dreamers table
        dreamer = db.fetch_one('SELECT handle FROM dreamers WHERE did = %s', (user_did,))
        if not dreamer:
            return jsonify({'status': 'error', 'error': 'User not found'}), 404
        
        user_handle = dreamer['handle']
        
        # Decrypt app password
        app_password = decrypt_password(cred['app_password_hash'])
        
        # Resolve PDS URL
        pds_url = cred.get('pds_url') or resolve_pds_from_did(user_did)
        print(f"📚 [BIBLIO] PDS URL: {pds_url}")
        
        # Create session with PDS
        print(f"📚 [BIBLIO] Creating session...")
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': user_handle,
                'password': app_password
            },
            timeout=10
        )
        
        if session_response.status_code != 200:
            print(f"❌ [BIBLIO] Session creation failed: {session_response.status_code}")
            error_data = session_response.json() if session_response.text else {}
            
            # Check if it's an invalid password error
            if 'Invalid' in str(error_data) or session_response.status_code == 401:
                # Mark credentials as invalid
                db.execute('''
                    UPDATE user_credentials 
                    SET app_password_hash = NULL, is_valid = FALSE 
                    WHERE did = %s
                ''', (user_did,))
                return jsonify({
                    'status': 'error',
                    'error': 'Stored credentials are invalid. Please reconnect your app password.',
                    'needs_credentials': True
                }), 401
            
            return jsonify({
                'status': 'error',
                'error': f'Failed to authenticate with PDS: {error_data.get("message", "Unknown error")}'
            }), 500
        
        session_data = session_response.json()
        access_jwt = session_data.get('accessJwt')
        
        if not access_jwt:
            return jsonify({'status': 'error', 'error': 'No access token received'}), 500
        
        # Create the book record
        now = datetime.utcnow().isoformat() + 'Z'
        record = {
            '$type': 'biblio.bond.book',
            'title': title,
            'authors': author,  # v2.0 schema uses 'authors'
            'createdAt': now
        }
        
        print(f"📚 [BIBLIO] Creating record: {record}")
        
        # Create record via XRPC
        create_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.createRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': user_did,
                'collection': 'biblio.bond.book',
                'record': record
            },
            timeout=10
        )
        
        if create_response.status_code != 200:
            error_data = create_response.json() if create_response.text else {}
            print(f"❌ [BIBLIO] Record creation failed: {create_response.status_code} - {error_data}")
            return jsonify({
                'status': 'error',
                'error': f'Failed to create book record: {error_data.get("message", "Unknown error")}'
            }), 500
        
        result = create_response.json()
        print(f"✅ [BIBLIO] Book created: {result}")
        print(f"{'='*80}\n")
        
        return jsonify({
            'status': 'success',
            'uri': result.get('uri'),
            'cid': result.get('cid')
        })
        
    except Exception as e:
        print(f"❌ [BIBLIO] Error: {e}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/delete-book', methods=['POST'])
@rate_limit(30)  # Max 30 deletes per hour
def delete_book():
    """
    Delete a book from user's biblio.bond library using stored credentials
    
    POST /api/biblio/delete-book
    Headers: Authorization: Bearer <oauth_token>
    Body: { "uri": "at://did:plc:.../biblio.bond.book/rkey" }
    """
    try:
        print(f"\n{'='*80}")
        print(f"🗑️ [BIBLIO] DELETE BOOK REQUEST")
        print(f"{'='*80}")
        
        import sys
        sys.path.insert(0, '/srv/reverie.house')
        from admin import validate_work_token
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'status': 'error', 'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        
        if not valid or not user_did:
            return jsonify({'status': 'error', 'error': 'Invalid or expired token'}), 401
        
        # Get URI from request
        data = request.get_json()
        uri = data.get('uri', '').strip()
        
        if not uri:
            return jsonify({'status': 'error', 'error': 'URI required'}), 400
        
        # Parse URI to get rkey
        # Format: at://did:plc:xxx/biblio.bond.book/rkey
        parts = uri.split('/')
        if len(parts) < 5:
            return jsonify({'status': 'error', 'error': 'Invalid URI format'}), 400
        
        rkey = parts[-1]
        collection = parts[-2]
        
        # Verify the URI belongs to this user
        if user_did not in uri:
            return jsonify({'status': 'error', 'error': 'Cannot delete records you do not own'}), 403
        
        # Get user's stored credentials
        db = DatabaseManager()
        cred = db.fetch_one('''
            SELECT app_password_hash, pds_url FROM user_credentials
            WHERE did = %s AND app_password_hash IS NOT NULL AND app_password_hash != ''
        ''', (user_did,))
        
        if not cred or not cred.get('app_password_hash'):
            return jsonify({
                'status': 'error', 
                'error': 'No stored credentials',
                'needs_credentials': True
            }), 403
        
        dreamer = db.fetch_one('SELECT handle FROM dreamers WHERE did = %s', (user_did,))
        if not dreamer:
            return jsonify({'status': 'error', 'error': 'User not found'}), 404
        
        user_handle = dreamer['handle']
        app_password = decrypt_password(cred['app_password_hash'])
        pds_url = cred.get('pds_url') or resolve_pds_from_did(user_did)
        
        # Create session
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={'identifier': user_handle, 'password': app_password},
            timeout=10
        )
        
        if session_response.status_code != 200:
            return jsonify({'status': 'error', 'error': 'Authentication failed'}), 401
        
        access_jwt = session_response.json().get('accessJwt')
        
        # Delete the record
        delete_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.deleteRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': user_did,
                'collection': collection,
                'rkey': rkey
            },
            timeout=10
        )
        
        if delete_response.status_code != 200:
            error_data = delete_response.json() if delete_response.text else {}
            return jsonify({
                'status': 'error',
                'error': f'Failed to delete: {error_data.get("message", "Unknown error")}'
            }), 500
        
        print(f"✅ [BIBLIO] Book deleted: {uri}")
        print(f"{'='*80}\n")
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"❌ [BIBLIO] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500
