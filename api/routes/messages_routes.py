"""
Messages Routes Blueprint
Handles message delivery, inbox management, and analytics
"""

from flask import Blueprint, request, jsonify
import time
import json

# Create blueprint
bp = Blueprint('messages', __name__, url_prefix='/api/messages')

# Import shared dependencies
from core.admin_auth import require_auth
from core.database import DatabaseManager
from core.messages import create_message


# ============================================================================
# MESSAGES CRUD ENDPOINTS
# ============================================================================

@bp.route('/send', methods=['POST'])
@require_auth()
def send_message():
    """
    Send a message to one or more users.
    
    Body: {
        "user_did": str or list of str,  // Recipient(s)
        "dialogue_key": str,              // Template to use
        "priority": int (optional),       // Priority (default: 50)
        "source": str (optional),         // 'admin', 'system', etc. (default: 'admin')
        "expires_at": int (optional)      // Unix timestamp for auto-expiration
    }
    """
    try:
        data = request.get_json()
        print(f"[MESSAGES_API] Sending message with data: {json.dumps(data, default=str)}")
        
        user_did = data.get('user_did')
        dialogue_key = data.get('dialogue_key')
        priority = data.get('priority', 50)
        source = data.get('source', 'admin')
        expires_at = data.get('expires_at')
        
        if not user_did:
            return jsonify({'status': 'error', 'error': 'user_did required'}), 400
        
        if not dialogue_key:
            return jsonify({'status': 'error', 'error': 'dialogue_key required'}), 400
        
        # Support sending to multiple users
        recipients = user_did if isinstance(user_did, list) else [user_did]
        
        sent_count = 0
        errors = []
        
        for did in recipients:
            try:
                result = create_message(
                    user_did=did,
                    dialogue_key=dialogue_key,
                    priority=priority,
                    source=source,
                    expires_at=expires_at
                )
                
                if result.get('success'):
                    sent_count += 1
                else:
                    errors.append(f"{did}: {result.get('error')}")
            except Exception as e:
                errors.append(f"{did}: {str(e)}")
        
        print(f"[MESSAGES_API] Sent {sent_count}/{len(recipients)} messages")
        
        if sent_count > 0:
            response = {
                'status': 'success',
                'sent': sent_count,
                'total': len(recipients)
            }
            if errors:
                response['errors'] = errors
            return jsonify(response), 200
        else:
            return jsonify({
                'status': 'error',
                'error': 'Failed to send any messages',
                'errors': errors
            }), 500
        
    except Exception as e:
        print(f"[MESSAGES_API] Error sending message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/recent', methods=['GET'])
@require_auth()
def get_recent_messages():
    """Get recent messages with optional filtering"""
    try:
        limit = request.args.get('limit', 100, type=int)
        status = request.args.get('status')  # 'unread', 'read', 'dismissed'
        user_did = request.args.get('user_did')
        
        print(f"[MESSAGES_API] Fetching recent messages (limit={limit}, status={status}, user_did={user_did})")
        
        db = DatabaseManager()
        
        query = '''
            SELECT 
                m.id, m.user_did, m.dialogue_key, m.messages_json,
                m.source, m.priority, m.status, m.title,
                m.created_at, m.read_at, m.dismissed_at, m.expires_at,
                d.handle, d.name, d.display_name, d.avatar
            FROM messages m
            LEFT JOIN dreamers d ON m.user_did = d.did
        '''
        
        conditions = []
        params = []
        
        if status:
            conditions.append('m.status = %s')
            params.append(status)
        
        if user_did:
            conditions.append('m.user_did = %s')
            params.append(user_did)
        
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)
        
        query += ' ORDER BY m.created_at DESC LIMIT %s'
        params.append(limit)
        
        cursor = db.execute(query, tuple(params))
        
        messages = []
        for row in cursor.fetchall():
            # Fix avatar URL - handle various formats and missing avatars
            avatar_url = row.get('avatar')
            if not avatar_url or avatar_url.startswith('blob:'):
                # No avatar or old blob reference - use default
                avatar_url = '/static/images/default-avatar.png'
            elif not avatar_url.startswith('http'):
                # Relative path, make it absolute to CDN
                avatar_url = f"https://cdn.bsky.app/img/avatar/plain/{row['user_did']}/{avatar_url}"
            # Otherwise it's already a full HTTP URL, use as-is
            
            messages.append({
                'id': row['id'],
                'user_did': row['user_did'],
                'handle': row['handle'],
                'name': row['name'],
                'display_name': row['display_name'],
                'avatar': avatar_url,  # Now properly formatted
                'dialogue_key': row['dialogue_key'],
                'title': row['title'],
                'source': row['source'],
                'priority': row['priority'],
                'status': row['status'],
                'created_at': row['created_at'],
                'read_at': row['read_at'],
                'dismissed_at': row['dismissed_at'],
                'expires_at': row['expires_at'],
                'messages_count': len(json.loads(row['messages_json'])) if row['messages_json'] else 0
            })
        
        print(f"[MESSAGES_API] Returning {len(messages)} messages")
        return jsonify({'status': 'success', 'messages': messages})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error fetching messages: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/analytics', methods=['GET'])
@require_auth()
def get_analytics():
    """Get message analytics and stats"""
    try:
        print(f"[MESSAGES_API] Fetching analytics")
        
        db = DatabaseManager()
        
        # Get status counts
        cursor = db.execute('''
            SELECT status, COUNT(*) as count
            FROM messages
            GROUP BY status
        ''')
        
        status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
        
        # Get total count
        cursor = db.execute('SELECT COUNT(*) as total FROM messages')
        total = cursor.fetchone()['total']
        
        # Get recent activity (last 24 hours)
        one_day_ago = int(time.time()) - 86400
        cursor = db.execute('''
            SELECT COUNT(*) as count
            FROM messages
            WHERE created_at > %s
        ''', (one_day_ago,))
        recent_24h = cursor.fetchone()['count']
        
        # Get top dialogue keys
        cursor = db.execute('''
            SELECT dialogue_key, COUNT(*) as count
            FROM messages
            GROUP BY dialogue_key
            ORDER BY count DESC
            LIMIT 10
        ''')
        top_dialogues = [
            {'dialogue_key': row['dialogue_key'], 'count': row['count']}
            for row in cursor.fetchall()
        ]
        
        analytics = {
            'total': total,
            'unread': status_counts.get('unread', 0),
            'read': status_counts.get('read', 0),
            'dismissed': status_counts.get('dismissed', 0),
            'recent_24h': recent_24h,
            'top_dialogues': top_dialogues
        }
        
        print(f"[MESSAGES_API] Analytics: {analytics}")
        return jsonify({'status': 'success', 'data': analytics})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error fetching analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:message_id>', methods=['GET'])
def get_message(message_id):
    """Get full message details by ID (user must own the message)"""
    try:
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            print(f"⚠️ [MESSAGES_API] No user_did for message {message_id}")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"[MESSAGES_API] Fetching message {message_id} for user {user_did[:30]}...")
        
        db = DatabaseManager()
        # Only return message if it belongs to the requesting user
        cursor = db.execute('''
            SELECT 
                m.id, m.user_did, m.dialogue_key, m.messages_json,
                m.source, m.priority, m.status, m.title,
                m.created_at, m.read_at, m.dismissed_at, m.expires_at,
                d.handle, d.name, d.display_name
            FROM messages m
            LEFT JOIN dreamers d ON m.user_did = d.did
            WHERE m.id = %s AND m.user_did = %s
        ''', (message_id, user_did))
        
        row = cursor.fetchone()
        if not row:
            print(f"❌ [MESSAGES_API] Message {message_id} not found for user")
            return jsonify({'status': 'error', 'error': 'Message not found'}), 404
        
        print(f"✅ [MESSAGES_API] Found message {message_id}")
        
        message = {
            'id': row['id'],
            'user_did': row['user_did'],
            'handle': row['handle'],
            'name': row['name'],
            'display_name': row['display_name'],
            'dialogue_key': row['dialogue_key'],
            'title': row['title'],
            'messages': json.loads(row['messages_json']) if row['messages_json'] else [],
            'messages_json': row['messages_json'],  # Include raw JSON for compatibility
            'source': row['source'],
            'priority': row['priority'],
            'status': row['status'],
            'created_at': row['created_at'],
            'read_at': row['read_at'],
            'dismissed_at': row['dismissed_at'],
            'expires_at': row['expires_at']
        }
        
        return jsonify({'status': 'success', 'data': message})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error fetching message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:message_id>/read', methods=['POST'])
def mark_message_read(message_id):
    """Mark a message as read (user must own the message)"""
    try:
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            print(f"⚠️ [MESSAGES_API] No user_did for marking read {message_id}")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"[MESSAGES_API] Marking message {message_id} as read for {user_did[:30]}...")
        
        db = DatabaseManager()
        # Only mark as read if message belongs to user
        db.execute('''
            UPDATE messages
            SET status = 'read', read_at = %s
            WHERE id = %s AND user_did = %s
        ''', (int(time.time()), message_id, user_did))
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error marking message read: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:message_id>/dismiss', methods=['POST'])
def dismiss_message(message_id):
    """Mark a message as dismissed (user must own the message)"""
    try:
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            print(f"⚠️ [MESSAGES_API] No user_did for dismissing {message_id}")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"[MESSAGES_API] Dismissing message {message_id} for {user_did[:30]}...")
        
        db = DatabaseManager()
        # Only dismiss if message belongs to user
        db.execute('''
            UPDATE messages
            SET status = 'dismissed', dismissed_at = %s
            WHERE id = %s AND user_did = %s
        ''', (int(time.time()), message_id, user_did))
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error dismissing message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:message_id>', methods=['DELETE'])
@require_auth()
def delete_message(message_id):
    """Delete a message"""
    try:
        print(f"[MESSAGES_API] Deleting message {message_id}")
        
        db = DatabaseManager()
        db.execute('DELETE FROM messages WHERE id = %s', (message_id,))
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error deleting message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


# ============================================================================
# BULK OPERATIONS
# ============================================================================

@bp.route('/bulk-dismiss', methods=['POST'])
@require_auth()
def bulk_dismiss():
    """Dismiss multiple messages at once"""
    try:
        data = request.get_json()
        message_ids = data.get('message_ids', [])
        
        if not message_ids:
            return jsonify({'status': 'error', 'error': 'message_ids required'}), 400
        
        print(f"[MESSAGES_API] Bulk dismissing {len(message_ids)} messages")
        
        db = DatabaseManager()
        placeholders = ','.join(['%s' for _ in message_ids])
        db.execute(f'''
            UPDATE messages
            SET status = 'dismissed', dismissed_at = %s
            WHERE id IN ({placeholders})
        ''', (int(time.time()), *message_ids))
        
        return jsonify({'status': 'success', 'dismissed': len(message_ids)})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error in bulk dismiss: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/bulk-delete', methods=['POST'])
@require_auth()
def bulk_delete():
    """Delete multiple messages at once"""
    try:
        data = request.get_json()
        message_ids = data.get('message_ids', [])
        
        if not message_ids:
            return jsonify({'status': 'error', 'error': 'message_ids required'}), 400
        
        print(f"[MESSAGES_API] Bulk deleting {len(message_ids)} messages")
        
        db = DatabaseManager()
        placeholders = ','.join(['%s' for _ in message_ids])
        db.execute(f'DELETE FROM messages WHERE id IN ({placeholders})', message_ids)
        
        return jsonify({'status': 'success', 'deleted': len(message_ids)})
        
    except Exception as e:
        print(f"[MESSAGES_API] Error in bulk delete: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500
