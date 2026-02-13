"""
Invite Code Management Routes
Handles public invite code pool for Reverie House
Only serves the FREE pool — personal invite codes are managed separately.
"""

from flask import Blueprint, jsonify, request
from core.database import DatabaseManager
from core.rate_limiter import PersistentRateLimiter
from core.admin_auth import get_client_ip
from functools import wraps
from datetime import datetime

invite_bp = Blueprint('invite', __name__)

rate_limiter = PersistentRateLimiter()

def rate_limit(requests_per_minute=10):
    """Rate limiting decorator for invite endpoints"""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            allowed, retry_after = rate_limiter.check_rate_limit(
                ip, endpoint, limit=requests_per_minute, window=60
            )
            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after
                }), 429
            return f(*args, **kwargs)
        return wrapped
    return decorator

def get_db():
    """Get database connection"""
    return DatabaseManager()

@invite_bp.route('/api/invite-codes/available', methods=['GET'])
@rate_limit(requests_per_minute=20)
def get_available_count():
    """
    Get the count of available (unused) FREE POOL invite codes.
    Personal invite codes are excluded from this count.
    
    Returns:
        {
            "total": 10,
            "used": 3,
            "available": 7
        }
    """
    try:
        db = get_db()
        
        cursor = db.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(used_by) as used,
                COUNT(*) - COUNT(used_by) as available
            FROM invites
            WHERE is_personal = FALSE
        """)
        
        row = cursor.fetchone()
        
        return jsonify({
            'total': row['total'],
            'used': row['used'],
            'available': row['available']
        })
        
    except Exception as e:
        print(f"❌ Error fetching invite code count: {e}")
        return jsonify({'error': 'Failed to fetch invite code count'}), 500

@invite_bp.route('/api/invite-codes/take', methods=['POST'])
@rate_limit(requests_per_minute=5)
def take_public_key():
    """
    Take a random available invite code from the FREE POOL.
    Returns a single randomly-selected code. Personal invite codes
    are never served here.
    
    Returns:
        {
            "code": "reverie-house-xxxxx-xxxxx"
        }
    """
    try:
        db = get_db()
        
        # Pick a random unused FREE POOL invite code
        cursor = db.execute("""
            SELECT code FROM invites
            WHERE used_by IS NULL AND is_personal = FALSE
            ORDER BY RANDOM()
            LIMIT 1
        """)
        
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'No public keys available'}), 404
        
        code = row['code']
        
        print(f"🔑 Public invite code taken: {code}")
        
        return jsonify({'code': code})
        
    except Exception as e:
        print(f"❌ Error taking invite code: {e}")
        return jsonify({'error': 'Failed to take invite code'}), 500

# list-available endpoint REMOVED for security.
# Exposing the full list of invite codes in a single unauthenticated
# request allows an attacker to harvest the entire pool.
# Frontend now uses /api/invite-codes/take which returns a single random code.

@invite_bp.route('/api/invite-codes/mark-used', methods=['POST'])
@rate_limit(requests_per_minute=5)
def mark_code_used():
    """
    Mark a FREE POOL invite code as used.
    Personal codes cannot be marked used through this endpoint.
    
    Request body:
        {
            "code": "reverie-house-xxxxx-xxxxx",
            "used_by": "did:plc:..."
        }
    """
    try:
        data = request.get_json()
        code = data.get('code', '').strip()
        used_by = data.get('used_by', '').strip()
        
        if not code or not used_by:
            return jsonify({'error': 'Code and used_by required'}), 400
        
        db = get_db()
        
        import time
        now = int(time.time())
        
        # Update the invite code - increment use_count and set timestamps
        # Only allow marking FREE POOL codes through this endpoint
        cursor = db.execute("""
            UPDATE invites
            SET used_by = %s, used_at = %s, use_count = use_count + 1
            WHERE code = %s AND used_by IS NULL AND is_personal = FALSE
        """, (used_by, now, code))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Code not found or already used'}), 404
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Invite code marked as used: {code} by {used_by}")
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error marking invite code as used: {e}")
        return jsonify({'error': 'Failed to mark code as used'}), 500
