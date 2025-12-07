"""
Courier Routes Blueprint
Handles scheduled Bluesky posts with lore integration
"""

from flask import Blueprint, request, jsonify
import time
import json
from core.database import DatabaseManager
from core.encryption import encrypt_password, decrypt_password
from api.rate_limit import rate_limit

# Create blueprint
bp = Blueprint('courier', __name__, url_prefix='/api/courier')


@bp.route('/schedule', methods=['POST'])
@rate_limit(20)  # Low limit for scheduled posts
def schedule_post():
    """Schedule a Bluesky post for later delivery"""
    try:
        print(f"\n{'='*80}")
        print(f"📬 [COURIER] NEW SCHEDULE REQUEST")
        print(f"{'='*80}")
        
        data = request.get_json()
        print(f"📬 [COURIER] Request data: {data}")
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        print(f"📬 [COURIER] User DID from query: {request.args.get('user_did')}")
        print(f"📬 [COURIER] User DID from cookie: {request.cookies.get('user_did')}")
        print(f"📬 [COURIER] Final User DID: {user_did}")
        
        if not user_did:
            print(f"❌ [COURIER] No user DID - not authenticated")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        # CHECK: User must have app password to schedule posts
        db = DatabaseManager()
        print(f"📬 [COURIER] Checking credentials for DID: {user_did}")
        cred = db.fetch_one('''
            SELECT password_hash FROM user_credentials
            WHERE did = %s AND valid = TRUE
        ''', (user_did,))
        print(f"📬 [COURIER] Credential query result: {cred}")
        print(f"📬 [COURIER] Has password_hash: {bool(cred and cred.get('password_hash'))}")
        
        if not cred or not cred['password_hash']:
            print(f"❌ [COURIER] No valid credentials found")
            return jsonify({
                'status': 'error', 
                'error': 'App password required to schedule posts. Please connect your credentials first.'
            }), 403
        
        # Validate required fields
        post_text = data.get('post_text', '').strip()
        scheduled_for = data.get('scheduled_for')
        
        print(f"📬 [COURIER] Post text: '{post_text[:50]}...' ({len(post_text)} chars)")
        print(f"📬 [COURIER] Scheduled for (raw): {scheduled_for} (type: {type(scheduled_for)})")
        
        if not post_text:
            print(f"❌ [COURIER] Empty post text")
            return jsonify({'status': 'error', 'error': 'post_text required'}), 400
        
        if not scheduled_for:
            print(f"❌ [COURIER] No schedule time")
            return jsonify({'status': 'error', 'error': 'scheduled_for required'}), 400
        
        # Validate scheduled_for is in the future
        now = int(time.time())
        print(f"📬 [COURIER] Current time: {now}")
        print(f"📬 [COURIER] Time difference: {scheduled_for - now} seconds")
        
        if scheduled_for <= now:
            print(f"❌ [COURIER] Schedule time is not in future")
            return jsonify({'status': 'error', 'error': 'scheduled_for must be in the future'}), 400
        
        # Optional fields
        post_images = data.get('post_images')  # Array of image URLs
        is_lore = bool(data.get('is_lore'))
        lore_type = data.get('lore_type')
        canon_id = data.get('canon_id')
        
        print(f"📬 [COURIER] Post images: {post_images}")
        print(f"📬 [COURIER] Is lore: {is_lore} (type: {type(is_lore)})")
        print(f"📬 [COURIER] Lore type: {lore_type}")
        print(f"📬 [COURIER] Canon ID: {canon_id}")
        
        # Encrypt post text
        post_text_encrypted = encrypt_password(post_text)
        print(f"📬 [COURIER] Text encrypted: {len(post_text_encrypted)} bytes")
        
        # Prepare images JSON
        images_json = json.dumps(post_images) if post_images else None
        
        print(f"\n📬 [COURIER] === INSERTING INTO DATABASE ===")
        print(f"📬 [COURIER] DID: {user_did[:40]}...")
        print(f"📬 [COURIER] Scheduled for: {scheduled_for}")
        print(f"📬 [COURIER] Created at: {now}")
        print(f"📬 [COURIER] Is lore: {is_lore}")
        
        # Insert into courier table (note: table uses 'did' not 'user_did')
        # Use execute() for INSERT, then fetch the result before connection closes
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO courier 
                (did, post_text_encrypted, post_images, scheduled_for, created_at, 
                 is_lore, lore_type, canon_id, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            ''', (user_did, post_text_encrypted, images_json, scheduled_for, now,
                  is_lore, lore_type, canon_id))
            result = cursor.fetchone()
            courier_id = result['id']
            print(f"✅ [COURIER] INSERT successful - Courier ID: {courier_id}")
        
        # Verify the insert by querying back
        verify = db.fetch_one('SELECT id, did, scheduled_for, status FROM courier WHERE id = %s', (courier_id,))
        print(f"✅ [COURIER] Verification query: {verify}")
        
        print(f"✅ [COURIER] Post scheduled successfully!")
        print(f"{'='*80}\n")
        
        return jsonify({
            'status': 'success',
            'courier_id': courier_id,
            'scheduled_for': scheduled_for
        })
        
    except Exception as e:
        print(f"❌ [COURIER] ERROR: {e}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/scheduled', methods=['GET'])
def get_scheduled_posts():
    """Get user's scheduled posts"""
    try:
        print(f"\n{'='*80}")
        print(f"📋 [COURIER] GET SCHEDULED POSTS")
        print(f"{'='*80}")
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        print(f"📋 [COURIER] User DID: {user_did}")
        
        if not user_did:
            print(f"❌ [COURIER] No user DID - not authenticated")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        status_filter = request.args.get('status', 'pending')  # 'pending', 'sent', 'failed', 'all'
        limit = int(request.args.get('limit', 50))
        
        print(f"📋 [COURIER] Status filter: {status_filter}")
        print(f"📋 [COURIER] Limit: {limit}")
        
        db = DatabaseManager()
        
        # Build query
        query = '''
            SELECT id, did, post_text_encrypted, post_images, 
                   scheduled_for, created_at, sent_at,
                   is_lore, lore_type, canon_id,
                   status, error_message, post_uri, post_cid
            FROM courier
            WHERE did = %s
        '''
        params = [user_did]
        
        if status_filter != 'all':
            query += ' AND status = %s'
            params.append(status_filter)
        
        query += ' ORDER BY scheduled_for DESC LIMIT %s'
        params.append(limit)
        
        print(f"📋 [COURIER] Query: {query}")
        print(f"📋 [COURIER] Params: {params}")
        
        rows = db.fetch_all(query, tuple(params))
        
        print(f"📋 [COURIER] Rows returned: {len(rows)}")
        print(f"📋 [COURIER] Raw rows: {rows}")
        
        posts = []
        for row in rows:
            # Decrypt post text for preview
            try:
                post_text = decrypt_password(row['post_text_encrypted'])
            except:
                post_text = '[encrypted]'
            
            # Truncate for list view
            post_preview = post_text[:100] + '...' if len(post_text) > 100 else post_text
            
            posts.append({
                'id': row['id'],
                'post_preview': post_preview,
                'post_text': post_text,  # Full text for editing
                'post_images': json.loads(row['post_images']) if row['post_images'] else [],
                'scheduled_for': row['scheduled_for'],
                'created_at': row['created_at'],
                'sent_at': row['sent_at'],
                'is_lore': bool(row['is_lore']),
                'lore_type': row['lore_type'],
                'canon_id': row['canon_id'],
                'status': row['status'],
                'error_message': row['error_message'],
                'post_uri': row['post_uri'],
                'post_cid': row['post_cid']
            })
        
        print(f"✅ [COURIER] Returning {len(posts)} posts")
        print(f"{'='*80}\n")
        
        return jsonify({
            'status': 'success',
            'posts': posts,
            'count': len(posts)
        })
        
    except Exception as e:
        print(f"❌ [COURIER] Error: {e}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:courier_id>', methods=['DELETE'])
def cancel_post(courier_id):
    """Cancel a scheduled post"""
    try:
        print(f"🗑️ [COURIER] DELETE request for courier_id: {courier_id}")
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        if not user_did:
            print(f"❌ [COURIER] No user_did provided")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"🔍 [COURIER] Deleting post {courier_id} for user {user_did[:30]}...")
        
        db = DatabaseManager()
        
        # Update status to cancelled (only if user owns it and it's pending)
        # Note: table uses 'did' not 'user_did'
        result = db.execute('''
            UPDATE courier
            SET status = 'cancelled'
            WHERE id = %s AND did = %s AND status = 'pending'
        ''', (courier_id, user_did))
        
        print(f"✅ [COURIER] Post {courier_id} marked as cancelled")
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"❌ [COURIER] Error cancelling post: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:courier_id>', methods=['PUT'])
def update_post(courier_id):
    """Update a scheduled post (only if still pending)"""
    try:
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        if not user_did:
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        data = request.get_json()
        
        db = DatabaseManager()
        
        # Check ownership and status (note: table uses 'did' not 'user_did')
        row = db.fetch_one('''
            SELECT status FROM courier
            WHERE id = %s AND did = %s
        ''', (courier_id, user_did))
        if not row:
            return jsonify({'status': 'error', 'error': 'Post not found'}), 404
        
        if row['status'] != 'pending':
            return jsonify({'status': 'error', 'error': 'Can only edit pending posts'}), 400
        
        # Build update query dynamically
        updates = []
        params = []
        
        if 'post_text' in data:
            updates.append('post_text_encrypted = %s')
            params.append(encrypt_password(data['post_text']))
        
        if 'post_images' in data:
            updates.append('post_images = %s')
            params.append(json.dumps(data['post_images']) if data['post_images'] else None)
        
        if 'scheduled_for' in data:
            if data['scheduled_for'] <= int(time.time()):
                return jsonify({'status': 'error', 'error': 'scheduled_for must be in the future'}), 400
            updates.append('scheduled_for = %s')
            params.append(data['scheduled_for'])
        
        if 'is_lore' in data:
            updates.append('is_lore = %s')
            params.append(bool(data['is_lore']))
        
        if 'lore_type' in data:
            updates.append('lore_type = %s')
            params.append(data['lore_type'])
        
        if 'canon_id' in data:
            updates.append('canon_id = %s')
            params.append(data['canon_id'])
        
        if not updates:
            return jsonify({'status': 'error', 'error': 'No fields to update'}), 400
        
        # Execute update
        query = f'''
            UPDATE courier
            SET {', '.join(updates)}
            WHERE id = %s AND did = %s
        '''
        params.extend([courier_id, user_did])
        
        db.execute(query, tuple(params))
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"❌ [COURIER] Error updating post: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/retry-auth-failed', methods=['POST'])
@rate_limit(10)
def retry_auth_failed_posts():
    """
    Reset all auth_failed posts to pending status after user reconnects credentials.
    Called automatically when user re-enters their app password.
    """
    try:
        # Get user DID
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        db = DatabaseManager()
        
        # Verify user has valid credentials now
        cred = db.execute('''
            SELECT is_valid FROM user_credentials WHERE did = ?
        ''', (user_did,)).fetchone()
        
        if not cred or not cred['is_valid']:
            return jsonify({
                'status': 'error',
                'error': 'Please reconnect your app password first'
            }), 400
        
        # Reset all auth_failed posts to pending
        db.execute('''
            UPDATE courier
            SET status = 'pending',
                error_message = NULL
            WHERE did = ? AND status = 'auth_failed'
        ''', (user_did,))
        
        # Count how many posts were reset
        reset_count = db.execute('''
            SELECT COUNT(*) as count
            FROM courier
            WHERE did = ? AND status = 'pending' AND error_message IS NULL
        ''', (user_did,)).fetchone()
        
        count = reset_count['count'] if reset_count else 0
        
        print(f"✅ [COURIER] Reset {count} auth_failed posts to pending for {user_did}")
        
        return jsonify({
            'status': 'success',
            'posts_reset': count
        })
        
    except Exception as e:
        print(f"❌ [COURIER] Error retrying auth-failed posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500

