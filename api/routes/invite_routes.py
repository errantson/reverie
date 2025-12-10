"""
Invite Code Management Routes
Handles public invite code pool for Reverie House
"""

from flask import Blueprint, jsonify, request
from core.database import DatabaseManager
from datetime import datetime

invite_bp = Blueprint('invite', __name__)

def get_db():
    """Get database connection"""
    return DatabaseManager()

@invite_bp.route('/api/invite-codes/available', methods=['GET'])
def get_available_count():
    """
    Get the count of available (unused) invite codes
    
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
def take_public_key():
    """
    Take an available invite code from the public pool
    
    Returns:
        {
            "code": "reverie-house-xxxxx-xxxxx"
        }
    """
    try:
        db = get_db()
        
        # Find an unused invite code
        cursor = db.execute("""
            SELECT code FROM invites
            WHERE used_by IS NULL
            ORDER BY created_at ASC
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

@invite_bp.route('/api/invite-codes/list-available', methods=['GET'])
def list_available_codes():
    """
    Get all available (unused) invite codes for random selection
    
    Returns:
        {
            "codes": ["reverie-house-xxxxx-xxxxx", ...]
        }
    """
    try:
        db = get_db()
        
        cursor = db.execute("""
            SELECT code FROM invites
            WHERE used_by IS NULL
            ORDER BY created_at ASC
        """)
        
        codes = [row['code'] for row in cursor.fetchall()]
        
        return jsonify({'codes': codes})
        
    except Exception as e:
        print(f"❌ Error listing available codes: {e}")
        return jsonify({'error': 'Failed to list available codes'}), 500

@invite_bp.route('/api/invite-codes/mark-used', methods=['POST'])
def mark_code_used():
    """
    Mark an invite code as used
    
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
        cursor = db.execute("""
            UPDATE invites
            SET used_by = %s, used_at = %s, use_count = use_count + 1
            WHERE code = %s AND used_by IS NULL
        """, (used_by, now, code))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Code not found or already used'}), 404
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Invite code marked as used: {code} by {used_by}")
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error marking invite code as used: {e}")
        return jsonify({'error': 'Failed to mark code as used'}), 500
