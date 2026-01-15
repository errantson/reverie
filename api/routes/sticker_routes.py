"""
Sticker Routes
Proxy endpoints for AtsumeAt sticker integration
"""

from flask import Blueprint, request, jsonify
import requests
import logging
from core.database import DatabaseManager
from core.admin_auth import validate_user_token

bp = Blueprint('sticker', __name__, url_prefix='/api/sticker')
logger = logging.getLogger(__name__)

# AtsumeAt API endpoint for signing stickers
ATSUMEAT_SIGN_SEAL_URL = 'https://atsumeat.suibari.com/api/sign-seal'


@bp.route('/sign-seal', methods=['POST'])
def proxy_sign_seal():
    """
    Proxy the AtsumeAt sign-seal API to avoid CORS issues.
    
    This allows browser-based sticker creation by proxying through our server.
    
    Expected body:
    {
        "userDid": "did:plc:...",
        "payload": {
            "model": "default",
            "image": "https://..."
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user_did = data.get('userDid')
        payload = data.get('payload')
        
        if not user_did:
            return jsonify({'error': 'userDid is required'}), 400
        if not payload:
            return jsonify({'error': 'payload is required'}), 400
        
        logger.info(f"[Sticker] Proxying sign-seal request for {user_did[:20]}...")
        
        # Forward request to AtsumeAt
        response = requests.post(
            ATSUMEAT_SIGN_SEAL_URL,
            json={
                'userDid': user_did,
                'payload': payload
            },
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout=30
        )
        
        if response.status_code != 200:
            logger.warning(f"[Sticker] AtsumeAt returned {response.status_code}: {response.text[:200]}")
            return jsonify({
                'error': 'AtsumeAt API error',
                'status': response.status_code,
                'detail': response.text[:500]
            }), response.status_code
        
        result = response.json()
        logger.info(f"[Sticker] Got signature for {user_did[:20]}")
        
        return jsonify(result)
        
    except requests.exceptions.Timeout:
        logger.error("[Sticker] AtsumeAt request timed out")
        return jsonify({'error': 'AtsumeAt request timed out'}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f"[Sticker] Request error: {e}")
        return jsonify({'error': f'Request failed: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"[Sticker] Unexpected error: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


# ============================================================================
# STICKER NEW BADGE TRACKING
# Simple approach: track which stickers user has already seen
# Any sticker NOT in acknowledged list = NEW
# ============================================================================

@bp.route('/acknowledged', methods=['GET'])
def get_acknowledged_stickers():
    """
    Get list of sticker subject DIDs that user has already seen.
    
    Returns:
        200: {"acknowledged": ["did:plc:subject1", "did:plc:subject2"]}
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization required'}), 401
        
        token = auth_header.replace('Bearer ', '')
        valid, user_did, _ = validate_user_token(token)
        
        if not valid or not user_did:
            return jsonify({'error': 'Invalid token'}), 401
        
        db = DatabaseManager()
        rows = db.fetch_all(
            'SELECT sticker_subject_did FROM sticker_acknowledged WHERE user_did = %s',
            (user_did,)
        )
        
        acknowledged = [row['sticker_subject_did'] for row in rows]
        logger.info(f"[Sticker] Found {len(acknowledged)} acknowledged stickers for {user_did[:20]}")
        return jsonify({'acknowledged': acknowledged})
        
    except Exception as e:
        logger.error(f"[Sticker] Error getting acknowledged stickers: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@bp.route('/acknowledge', methods=['POST'])
def acknowledge_stickers():
    """
    Mark stickers as acknowledged (seen by user).
    
    POST body: {"sticker_subject_dids": ["did:plc:...", "did:plc:..."]}
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization required'}), 401
        
        token = auth_header.replace('Bearer ', '')
        valid, user_did, _ = validate_user_token(token)
        
        if not valid or not user_did:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        sticker_subject_dids = data.get('sticker_subject_dids', [])
        if not sticker_subject_dids:
            return jsonify({'status': 'ok', 'added': 0})
        
        db = DatabaseManager()
        added = 0
        for subject_did in sticker_subject_dids:
            if subject_did:
                db.execute('''
                    INSERT INTO sticker_acknowledged (user_did, sticker_subject_did)
                    VALUES (%s, %s)
                    ON CONFLICT (user_did, sticker_subject_did) DO NOTHING
                ''', (user_did, subject_did))
                added += 1
        
        logger.info(f"[Sticker] Acknowledged {added} stickers for {user_did[:20]}")
        return jsonify({'status': 'ok', 'added': added})
        
    except Exception as e:
        logger.error(f"[Sticker] Error acknowledging stickers: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@bp.route('/unacknowledge', methods=['POST'])
def unacknowledge_stickers():
    """
    Remove stickers from acknowledged list (so they show as NEW again).
    Used when claiming stickers that were previously seen and deleted.
    
    POST body: {"sticker_subject_dids": ["did:plc:...", "did:plc:..."]}
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization required'}), 401
        
        token = auth_header.replace('Bearer ', '')
        valid, user_did, _ = validate_user_token(token)
        
        if not valid or not user_did:
            return jsonify({'error': 'Invalid token'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        sticker_subject_dids = data.get('sticker_subject_dids', [])
        if not sticker_subject_dids:
            return jsonify({'status': 'ok', 'removed': 0})
        
        db = DatabaseManager()
        removed = 0
        for subject_did in sticker_subject_dids:
            if subject_did:
                result = db.execute('''
                    DELETE FROM sticker_acknowledged 
                    WHERE user_did = %s AND sticker_subject_did = %s
                ''', (user_did, subject_did))
                if result:
                    removed += 1
        
        logger.info(f"[Sticker] Unacknowledged {removed} stickers for {user_did[:20]}")
        return jsonify({'status': 'ok', 'removed': removed})
        
    except Exception as e:
        logger.error(f"[Sticker] Error unacknowledging stickers: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500