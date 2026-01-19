"""
Interactions Routes Blueprint
Handles AT Protocol interactions (like, unlike, repost, unrepost) using stored credentials.

This is used by OAuth-only sessions (atproto scope) that don't have direct write access.
The server uses stored app passwords to execute actions on behalf of the user.
"""

from flask import Blueprint, request, jsonify
import requests
from core.database import DatabaseManager
from core.encryption import decrypt_password
from api.rate_limit import rate_limit

bp = Blueprint('interactions', __name__, url_prefix='/api/interactions')


def get_user_credentials(user_did):
    """Fetch user's credentials from database"""
    db = DatabaseManager()
    
    # Get credentials from user_credentials table
    cursor = db.execute('''
        SELECT password_hash, pds_url 
        FROM user_credentials 
        WHERE did = %s AND (valid = TRUE OR is_valid = TRUE)
    ''', (user_did,))
    row = cursor.fetchone()
    
    if not row or not row['password_hash']:
        return None, None, None
    
    # Get handle from dreamers table
    cursor2 = db.execute('SELECT handle FROM dreamers WHERE did = %s', (user_did,))
    dreamer = cursor2.fetchone()
    handle = dreamer['handle'] if dreamer else None
    
    pds_url = row['pds_url'] or 'https://bsky.social'
    
    return row['password_hash'], handle, pds_url


def create_pds_session(handle, app_password, pds_url):
    """Create a session with the user's PDS"""
    try:
        response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': handle,
                'password': app_password
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ [INTERACTIONS] Session creation failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ [INTERACTIONS] Session creation error: {e}")
        return None


@bp.route('/execute', methods=['POST'])
@rate_limit(60)  # Max 60 interactions per hour
def execute_interaction():
    """
    Execute an AT Protocol interaction using stored credentials.
    
    POST /api/interactions/execute
    Body: {
        "action": "like" | "unlike" | "repost" | "unrepost",
        "user_did": "did:plc:xxx",
        "uri": "at://...",
        "cid": "bafyrei..." (for like/repost)
    }
    
    Returns:
        200: {"status": "success", "result": {...}}
        401: {"status": "error", "error": "No credentials"}
        500: {"status": "error", "error": "..."}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'error': 'No data provided'}), 400
        
        action = data.get('action')
        user_did = data.get('user_did')
        uri = data.get('uri')
        cid = data.get('cid')
        
        if not action or not user_did:
            return jsonify({'status': 'error', 'error': 'Missing required fields'}), 400
        
        if action in ('like', 'repost') and (not uri or not cid):
            return jsonify({'status': 'error', 'error': 'URI and CID required for like/repost'}), 400
        
        if action in ('unlike', 'unrepost') and not uri:
            return jsonify({'status': 'error', 'error': 'URI required for unlike/unrepost'}), 400
        
        # Get user credentials
        encrypted_password, handle, pds_url = get_user_credentials(user_did)
        
        if not encrypted_password or not handle:
            return jsonify({
                'status': 'error',
                'error': 'No stored credentials',
                'code': 'credentials_required'
            }), 401
        
        # Decrypt password
        app_password = decrypt_password(encrypted_password)
        
        # Create PDS session
        session = create_pds_session(handle, app_password, pds_url)
        if not session:
            return jsonify({
                'status': 'error',
                'error': 'Failed to authenticate with PDS',
                'code': 'auth_failed'
            }), 401
        
        access_jwt = session.get('accessJwt')
        
        # Execute the action
        if action == 'like':
            result = create_record(
                pds_url, access_jwt, user_did,
                'app.bsky.feed.like',
                {'subject': {'uri': uri, 'cid': cid}, 'createdAt': get_timestamp()}
            )
        elif action == 'repost':
            result = create_record(
                pds_url, access_jwt, user_did,
                'app.bsky.feed.repost',
                {'subject': {'uri': uri, 'cid': cid}, 'createdAt': get_timestamp()}
            )
        elif action == 'unlike':
            result = delete_record_by_subject(
                pds_url, access_jwt, user_did,
                'app.bsky.feed.like', uri
            )
        elif action == 'unrepost':
            result = delete_record_by_subject(
                pds_url, access_jwt, user_did,
                'app.bsky.feed.repost', uri
            )
        elif action == 'deletePost':
            # Delete user's own post by rkey
            rkey = data.get('rkey')
            collection = data.get('collection', 'app.bsky.feed.post')
            if not rkey:
                return jsonify({'status': 'error', 'error': 'rkey required for deletePost'}), 400
            result = delete_record_by_rkey(
                pds_url, access_jwt, user_did,
                collection, rkey
            )
        else:
            return jsonify({'status': 'error', 'error': f'Unknown action: {action}'}), 400
        
        if result.get('error'):
            return jsonify({'status': 'error', 'error': result['error']}), 500
        
        return jsonify({'status': 'success', 'result': result})
        
    except Exception as e:
        print(f"❌ [INTERACTIONS] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


def get_timestamp():
    """Get current ISO timestamp"""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def create_record(pds_url, access_jwt, repo, collection, record):
    """Create a record in the user's repo"""
    try:
        response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.createRecord',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_jwt}'
            },
            json={
                'repo': repo,
                'collection': collection,
                'record': record
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            error_text = response.text
            print(f"❌ [INTERACTIONS] Create record failed: {response.status_code} - {error_text}")
            return {'error': f'Failed to create record: {response.status_code}'}
    except Exception as e:
        print(f"❌ [INTERACTIONS] Create record error: {e}")
        return {'error': str(e)}


def delete_record_by_subject(pds_url, access_jwt, repo, collection, subject_uri):
    """Find and delete a record by its subject URI"""
    try:
        # List records to find the one to delete
        list_response = requests.get(
            f'{pds_url}/xrpc/com.atproto.repo.listRecords',
            params={
                'repo': repo,
                'collection': collection,
                'limit': 100
            },
            headers={'Authorization': f'Bearer {access_jwt}'},
            timeout=10
        )
        
        if list_response.status_code != 200:
            return {'error': f'Failed to list records: {list_response.status_code}'}
        
        records = list_response.json().get('records', [])
        target_record = None
        
        for record in records:
            if record.get('value', {}).get('subject', {}).get('uri') == subject_uri:
                target_record = record
                break
        
        if not target_record:
            return {'message': 'Record not found (may already be deleted)'}
        
        # Extract rkey from URI
        rkey = target_record['uri'].split('/')[-1]
        
        # Delete the record
        delete_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.deleteRecord',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_jwt}'
            },
            json={
                'repo': repo,
                'collection': collection,
                'rkey': rkey
            },
            timeout=10
        )
        
        if delete_response.status_code == 200:
            return {'deleted': True, 'uri': target_record['uri']}
        else:
            return {'error': f'Failed to delete record: {delete_response.status_code}'}
    
    except Exception as e:
        print(f"❌ [INTERACTIONS] Delete record error: {e}")
        return {'error': str(e)}


def delete_record_by_rkey(pds_url, access_jwt, repo, collection, rkey):
    """Delete a record directly by its rkey (for deleting own posts)"""
    try:
        delete_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.deleteRecord',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_jwt}'
            },
            json={
                'repo': repo,
                'collection': collection,
                'rkey': rkey
            },
            timeout=10
        )
        
        if delete_response.status_code == 200:
            return {'deleted': True, 'rkey': rkey}
        else:
            error_text = delete_response.text
            print(f"❌ [INTERACTIONS] Delete record by rkey failed: {delete_response.status_code} - {error_text}")
            return {'error': f'Failed to delete record: {delete_response.status_code}'}
    
    except Exception as e:
        print(f"❌ [INTERACTIONS] Delete record by rkey error: {e}")
        return {'error': str(e)}
