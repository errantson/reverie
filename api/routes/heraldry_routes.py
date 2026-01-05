"""
Heraldry Routes Blueprint
Handles heraldry/PDS community management for the Heraldry system
"""

from flask import Blueprint, request, jsonify, current_app
from functools import wraps
import os
import time
import traceback

# Create blueprint
bp = Blueprint('heraldry', __name__, url_prefix='/api')

# ============================================================================
# HELPERS
# ============================================================================

def get_ambassador_did():
    """Get ambassador DID from request header or Authorization token"""
    # Check Authorization header (Bearer token)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        # For now, we trust the X-Ambassador-DID header when a token is present
        # In production, decode JWT or validate token against database
        pass
    
    return request.headers.get('X-Ambassador-DID', '')


def require_ambassador(f):
    """Decorator to verify ambassador authentication"""
    @wraps(f)
    def wrapped(*args, **kwargs):
        # Get DID from X-Ambassador-DID header
        ambassador_did = request.headers.get('X-Ambassador-DID', '')
        
        # Also check for OAuth session via cookie or Authorization header
        if not ambassador_did:
            # Try to get from OAuth token
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                # For OAuth authenticated users, we need to extract DID from session
                # This would need to integrate with the OAuth system
                pass
        
        if not ambassador_did:
            return jsonify({'error': 'Ambassador authentication required'}), 401
        
        # Inject ambassador_did into kwargs
        kwargs['ambassador_did'] = ambassador_did
        return f(*args, **kwargs)
    return wrapped


def get_db():
    """Get database connection"""
    from core.database import DatabaseManager
    return DatabaseManager()


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@bp.route('/heraldry/auth/verify', methods=['POST'])
def verify_ambassador_auth():
    """
    Verify ambassador authentication via app password.
    This calls the user's PDS to verify their identity.
    """
    import requests
    import secrets
    
    try:
        data = request.get_json()
        handle = data.get('handle', '').strip()
        app_password = data.get('appPassword', '').strip()
        claimed_did = data.get('did', '').strip()
        
        if not handle or not app_password:
            return jsonify({'error': 'Handle and app password required'}), 400
        
        # Resolve handle to DID and PDS
        try:
            did_response = requests.get(
                f'https://bsky.social/xrpc/com.atproto.identity.resolveHandle',
                params={'handle': handle},
                timeout=10
            )
            if not did_response.ok:
                return jsonify({'error': 'Could not resolve handle'}), 400
            
            resolved_did = did_response.json().get('did')
            
            # Verify DID matches claim
            if claimed_did and resolved_did != claimed_did:
                return jsonify({'error': 'DID mismatch'}), 401
                
        except Exception as e:
            print(f"Error resolving handle: {e}")
            return jsonify({'error': 'Could not resolve handle'}), 400
        
        # Get PDS endpoint from DID document
        try:
            if resolved_did.startswith('did:web:'):
                domain = resolved_did.replace('did:web:', '')
                did_doc_response = requests.get(f'https://{domain}/.well-known/did.json', timeout=10)
            else:
                did_doc_response = requests.get(f'https://plc.directory/{resolved_did}', timeout=10)
            
            if not did_doc_response.ok:
                return jsonify({'error': 'Could not fetch DID document'}), 400
            
            did_doc = did_doc_response.json()
            service = next((s for s in did_doc.get('service', []) if s.get('id') == '#atproto_pds'), None)
            pds_endpoint = service.get('serviceEndpoint') if service else None
            
            if not pds_endpoint:
                return jsonify({'error': 'Could not determine PDS endpoint'}), 400
                
        except Exception as e:
            print(f"Error fetching DID document: {e}")
            return jsonify({'error': 'Could not fetch identity information'}), 400
        
        # Verify app password by creating a session with the PDS
        try:
            session_response = requests.post(
                f'{pds_endpoint}/xrpc/com.atproto.server.createSession',
                json={
                    'identifier': handle,
                    'password': app_password
                },
                timeout=10
            )
            
            if session_response.status_code != 200:
                return jsonify({'error': 'Invalid app password'}), 401
            
            session_data = session_response.json()
            verified_did = session_data.get('did')
            
            # Verify DID matches
            if verified_did != resolved_did:
                return jsonify({'error': 'Authentication DID mismatch'}), 401
                
        except requests.exceptions.RequestException as e:
            print(f"Error authenticating with PDS: {e}")
            return jsonify({'error': 'Could not verify app password'}), 500
        
        # Get PDS domain and check if user is ambassador
        pds_domain = pds_endpoint.replace('https://', '').replace('http://', '').split('/')[0]
        
        db = get_db()
        cursor = db.execute("""
            SELECT h.id, h.name, h.ambassador_did
            FROM heraldry h
            JOIN heraldry_domains hd ON h.id = hd.heraldry_id
            WHERE hd.domain = %s AND h.ambassador_did = %s
        """, (pds_domain, verified_did))
        
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'You are not an ambassador for any PDS community'}), 403
        
        # Generate a simple token for this session
        # In production, use proper JWT or session management
        token = secrets.token_urlsafe(32)
        
        # Store token in database for verification (optional - could use stateless JWT)
        # For now, we'll trust the frontend to send the right DID
        
        print(f"✅ Ambassador authenticated: {handle} ({verified_did}) for {row['name']}")
        
        return jsonify({
            'success': True,
            'did': verified_did,
            'handle': handle,
            'heraldry_id': row['id'],
            'heraldry_name': row['name'],
            'token': token
        })
        
    except Exception as e:
        print(f"❌ Error in ambassador auth: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Authentication failed'}), 500


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

@bp.route('/heraldry')
def list_heraldry():
    """Get all heraldry entries"""
    try:
        db = get_db()
        cursor = db.execute("""
            SELECT h.id, h.name, h.description, h.color_primary, h.color_secondary,
                   h.icon_path, h.ambassador_did, h.created_at, h.updated_at,
                   array_agg(hd.domain) FILTER (WHERE hd.domain IS NOT NULL) as domains
            FROM heraldry h
            LEFT JOIN heraldry_domains hd ON h.id = hd.heraldry_id
            GROUP BY h.id
            ORDER BY h.name
        """)
        
        rows = cursor.fetchall()
        heraldry_list = []
        
        for row in rows:
            created_at = row['created_at']
            updated_at = row['updated_at']
            heraldry_list.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'color_primary': row['color_primary'],
                'color_secondary': row['color_secondary'],
                'icon_path': row['icon_path'],
                'ambassador_did': row['ambassador_did'],
                'created_at': created_at.isoformat() if created_at else None,
                'updated_at': updated_at.isoformat() if updated_at else None,
                'domains': row['domains'] or []
            })
        
        return jsonify(heraldry_list)
        
    except Exception as e:
        print(f"❌ Error listing heraldry: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to list heraldry'}), 500


@bp.route('/heraldry/<int:heraldry_id>')
def get_heraldry(heraldry_id):
    """Get a specific heraldry entry"""
    try:
        db = get_db()
        cursor = db.execute("""
            SELECT h.id, h.name, h.description, h.color_primary, h.color_secondary,
                   h.icon_path, h.ambassador_did, h.created_at, h.updated_at,
                   array_agg(hd.domain) FILTER (WHERE hd.domain IS NOT NULL) as domains
            FROM heraldry h
            LEFT JOIN heraldry_domains hd ON h.id = hd.heraldry_id
            WHERE h.id = %s
            GROUP BY h.id
        """, (heraldry_id,))
        
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        created_at = row['created_at']
        updated_at = row['updated_at']
        return jsonify({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'color_primary': row['color_primary'],
            'color_secondary': row['color_secondary'],
            'icon_path': row['icon_path'],
            'ambassador_did': row['ambassador_did'],
            'created_at': created_at.isoformat() if created_at else None,
            'updated_at': updated_at.isoformat() if updated_at else None,
            'domains': row['domains'] or []
        })
        
    except Exception as e:
        print(f"❌ Error getting heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to get heraldry'}), 500


@bp.route('/heraldry/for-domain/<path:domain>')
def get_heraldry_for_domain(domain):
    """Get heraldry for a specific domain"""
    try:
        db = get_db()
        
        # First try exact match
        cursor = db.execute("""
            SELECT h.id, h.name, h.description, h.color_primary, h.color_secondary,
                   h.icon_path, h.ambassador_did, h.created_at, h.updated_at
            FROM heraldry h
            JOIN heraldry_domains hd ON h.id = hd.heraldry_id
            WHERE hd.domain = %s
        """, (domain.lower(),))
        
        row = cursor.fetchone()
        
        # If no exact match, try wildcard pattern match
        if not row:
            cursor = db.execute("""
                SELECT h.id, h.name, h.description, h.color_primary, h.color_secondary,
                       h.icon_path, h.ambassador_did, h.created_at, h.updated_at
                FROM heraldry h
                JOIN heraldry_domains hd ON h.id = hd.heraldry_id
                WHERE hd.is_pattern = true 
                  AND %s LIKE REPLACE(hd.domain, '*.', '%%.')
            """, (domain.lower(),))
            row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': f'No heraldry found for domain {domain}'}), 404
        
        heraldry_id = row['id']
        
        # Get all domains for this heraldry
        cursor = db.execute("""
            SELECT domain FROM heraldry_domains WHERE heraldry_id = %s
        """, (heraldry_id,))
        domains = [r['domain'] for r in cursor.fetchall()]
        
        created_at = row['created_at']
        updated_at = row['updated_at']
        return jsonify({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'color_primary': row['color_primary'],
            'color_secondary': row['color_secondary'],
            'icon_path': row['icon_path'],
            'ambassador_did': row['ambassador_did'],
            'created_at': created_at.isoformat() if created_at else None,
            'updated_at': updated_at.isoformat() if updated_at else None,
            'domains': domains
        })
        
    except Exception as e:
        print(f"❌ Error getting heraldry for domain {domain}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to get heraldry'}), 500


@bp.route('/heraldry/<int:heraldry_id>/coterie')
def get_coterie(heraldry_id):
    """Get all dreamers (coterie) from a heraldry's domains"""
    try:
        db = get_db()
        
        # Get domains for this heraldry
        cursor = db.execute("""
            SELECT domain, is_pattern FROM heraldry_domains WHERE heraldry_id = %s
        """, (heraldry_id,))
        domains = cursor.fetchall()
        
        if not domains:
            return jsonify([])
        
        # Build query for matching dreamers by server domain
        domain_conditions = []
        params = []
        
        for domain_row in domains:
            domain = domain_row['domain']
            is_pattern = domain_row['is_pattern']
            if is_pattern:
                # Wildcard pattern - match subdomains
                domain_conditions.append("d.server LIKE %s")
                params.append(f"%{domain.replace('*.', '%.')}")
            else:
                # Exact match
                domain_conditions.append("d.server LIKE %s")
                params.append(f"%{domain}%")
        
        where_clause = " OR ".join(domain_conditions)
        
        cursor = db.execute(f"""
            SELECT d.did, d.handle, d.name, d.display_name, d.avatar, d.server,
                   d.updated_at, d.arrival,
                   COALESCE(d.canon_score, 0) + COALESCE(d.lore_score, 0) as activity_score
            FROM dreamers d
            WHERE ({where_clause})
            ORDER BY d.updated_at DESC NULLS LAST
            LIMIT 100
        """, params)
        
        coterie = []
        for row in cursor.fetchall():
            updated_at = row['updated_at']
            arrival = row['arrival']
            coterie.append({
                'did': row['did'],
                'handle': row['handle'],
                'name': row['name'] or row['display_name'],
                'avatar': row['avatar'],
                'server': row['server'],
                'updated_at': updated_at.isoformat() if hasattr(updated_at, 'isoformat') else updated_at,
                'arrival': arrival.isoformat() if hasattr(arrival, 'isoformat') else arrival,
                'activity_score': float(row['activity_score']) if row['activity_score'] else 0
            })
        
        return jsonify(coterie)
        
    except Exception as e:
        print(f"❌ Error getting coterie for heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to get coterie'}), 500


# ============================================================================
# AMBASSADOR ENDPOINTS (require authentication)
# ============================================================================

@bp.route('/heraldry/<int:heraldry_id>', methods=['PUT'])
@require_ambassador
def update_heraldry(heraldry_id, ambassador_did):
    """Update heraldry (ambassador only)"""
    try:
        db = get_db()
        
        # Verify ambassador owns this heraldry
        cursor = db.execute("""
            SELECT ambassador_did FROM heraldry WHERE id = %s
        """, (heraldry_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        if row['ambassador_did'] != ambassador_did:
            return jsonify({'error': 'You are not the ambassador for this heraldry'}), 403
        
        data = request.get_json()
        
        # Build update query
        updates = []
        params = []
        
        if 'name' in data:
            updates.append("name = %s")
            params.append(data['name'])
        
        if 'description' in data:
            updates.append("description = %s")
            params.append(data['description'])
        
        if 'color_primary' in data:
            # Validate hex color
            color = data['color_primary']
            if not color.startswith('#') or len(color) != 7:
                return jsonify({'error': 'Invalid color format'}), 400
            updates.append("color_primary = %s")
            params.append(color)
        
        if 'color_secondary' in data:
            color = data['color_secondary']
            if color and (not color.startswith('#') or len(color) != 7):
                return jsonify({'error': 'Invalid secondary color format'}), 400
            updates.append("color_secondary = %s")
            params.append(color)
        
        if not updates:
            return jsonify({'error': 'No updates provided'}), 400
        
        updates.append("updated_at = NOW()")
        params.append(heraldry_id)
        
        db.execute(f"""
            UPDATE heraldry SET {', '.join(updates)} WHERE id = %s
        """, params)
        
        # Log change
        db.execute("""
            INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
            VALUES (%s, %s, 'update', %s)
        """, (heraldry_id, ambassador_did, str(data)))
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error updating heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to update heraldry'}), 500


@bp.route('/heraldry/<int:heraldry_id>/icon', methods=['POST'])
@require_ambassador
def upload_icon(heraldry_id, ambassador_did):
    """Upload heraldry icon (ambassador only)"""
    try:
        from PIL import Image
        import io
        
        db = get_db()
        
        # Verify ambassador owns this heraldry
        cursor = db.execute("""
            SELECT ambassador_did, name FROM heraldry WHERE id = %s
        """, (heraldry_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        if row['ambassador_did'] != ambassador_did:
            return jsonify({'error': 'You are not the ambassador for this heraldry'}), 403
        
        heraldry_name = row['name']
        
        if 'icon' not in request.files:
            return jsonify({'error': 'No icon file provided'}), 400
        
        file = request.files['icon']
        
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file
        file_data = file.read()
        
        # Validate size (5MB max)
        if len(file_data) > 5 * 1024 * 1024:
            return jsonify({'error': 'File too large. Maximum size is 5MB'}), 400
        
        # Validate it's a valid PNG
        try:
            img = Image.open(io.BytesIO(file_data))
            
            if img.format != 'PNG':
                return jsonify({'error': 'Only PNG images are allowed'}), 400
            
            # Resize to 512x512 if needed
            if img.size != (512, 512):
                img = img.resize((512, 512), Image.Resampling.LANCZOS)
                
                # Save resized image
                output = io.BytesIO()
                img.save(output, format='PNG')
                file_data = output.getvalue()
        
        except Exception as img_error:
            return jsonify({'error': f'Invalid image file: {str(img_error)}'}), 400
        
        # Generate filename from heraldry name
        safe_name = heraldry_name.lower().replace(' ', '-').replace('.', '-')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '-')
        filename = f"{safe_name}.png"
        
        # Save file
        heraldry_dir = os.path.join(current_app.root_path, 'site', 'assets', 'heraldry')
        os.makedirs(heraldry_dir, exist_ok=True)
        
        filepath = os.path.join(heraldry_dir, filename)
        print(f"📁 Saving heraldry icon to: {filepath}")
        
        with open(filepath, 'wb') as f:
            f.write(file_data)
        
        print(f"✅ Icon saved successfully: {len(file_data)} bytes")
        
        # Add timestamp for cache busting
        import time
        icon_path = f'/assets/heraldry/{filename}?v={int(time.time())}'
        
        # Update database
        db.execute("""
            UPDATE heraldry SET icon_path = %s, updated_at = NOW() WHERE id = %s
        """, (icon_path, heraldry_id))
        
        # Log change
        db.execute("""
            INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
            VALUES (%s, %s, 'icon_upload', %s)
        """, (heraldry_id, ambassador_did, icon_path))
        
        return jsonify({
            'success': True,
            'icon_path': icon_path
        })
        
    except Exception as e:
        print(f"❌ Error uploading icon for heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to upload icon'}), 500


@bp.route('/heraldry/<int:heraldry_id>/icon', methods=['DELETE'])
@require_ambassador
def delete_icon(heraldry_id, ambassador_did):
    """Clear/reset heraldry icon to default (ambassador only)"""
    try:
        db = get_db()
        
        # Verify ambassador owns this heraldry
        cursor = db.execute("""
            SELECT ambassador_did, icon_path FROM heraldry WHERE id = %s
        """, (heraldry_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        if row['ambassador_did'] != ambassador_did:
            return jsonify({'error': 'You are not the ambassador for this heraldry'}), 403
        
        old_icon_path = row['icon_path']
        default_icon = '/assets/heraldry/default.png'
        
        # Update database to default
        db.execute("""
            UPDATE heraldry SET icon_path = %s, updated_at = NOW() WHERE id = %s
        """, (default_icon, heraldry_id))
        
        # Log change
        db.execute("""
            INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
            VALUES (%s, %s, 'icon_clear', %s)
        """, (heraldry_id, ambassador_did, f'Cleared from {old_icon_path}'))
        
        # Optionally delete the old icon file if it's not the default
        if old_icon_path and old_icon_path != default_icon:
            try:
                old_filepath = os.path.join(current_app.root_path, 'site', old_icon_path.lstrip('/'))
                if os.path.exists(old_filepath):
                    os.remove(old_filepath)
            except Exception as e:
                print(f"Warning: Could not delete old icon file: {e}")
        
        return jsonify({
            'success': True,
            'icon_path': default_icon
        })
        
    except Exception as e:
        print(f"❌ Error clearing icon for heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to clear icon'}), 500


@bp.route('/heraldry/<int:heraldry_id>/transfer-ambassador', methods=['POST'])
@require_ambassador
def transfer_ambassador(heraldry_id, ambassador_did):
    """Transfer ambassadorship to another coterie member"""
    try:
        db = get_db()
        
        # Verify current ambassador
        cursor = db.execute("""
            SELECT ambassador_did FROM heraldry WHERE id = %s
        """, (heraldry_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        if row['ambassador_did'] != ambassador_did:
            return jsonify({'error': 'You are not the ambassador for this heraldry'}), 403
        
        data = request.get_json()
        new_ambassador_did = data.get('new_ambassador_did')
        
        if not new_ambassador_did:
            return jsonify({'error': 'New ambassador DID required'}), 400
        
        # Verify new ambassador exists
        cursor = db.execute("""
            SELECT handle, name FROM dreamers WHERE did = %s
        """, (new_ambassador_did,))
        new_ambassador = cursor.fetchone()
        
        if not new_ambassador:
            return jsonify({'error': 'New ambassador not found in dreamers'}), 404
        
        # Update ambassador
        db.execute("""
            UPDATE heraldry SET ambassador_did = %s, updated_at = NOW() WHERE id = %s
        """, (new_ambassador_did, heraldry_id))
        
        # Log change
        db.execute("""
            INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
            VALUES (%s, %s, 'ambassador_transfer', %s)
        """, (heraldry_id, ambassador_did, f"Transferred to {new_ambassador_did}"))
        
        return jsonify({
            'success': True,
            'new_ambassador_did': new_ambassador_did,
            'new_ambassador_handle': new_ambassador['handle'],
            'new_ambassador_name': new_ambassador['name']
        })
        
    except Exception as e:
        print(f"❌ Error transferring ambassador for heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to transfer ambassadorship'}), 500


@bp.route('/heraldry/<int:heraldry_id>/step-down', methods=['POST'])
@require_ambassador
def step_down(heraldry_id, ambassador_did):
    """Step down as ambassador (assigns most active coterie member)"""
    try:
        db = get_db()
        
        # Verify current ambassador
        cursor = db.execute("""
            SELECT ambassador_did FROM heraldry WHERE id = %s
        """, (heraldry_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Heraldry not found'}), 404
        
        if row['ambassador_did'] != ambassador_did:
            return jsonify({'error': 'You are not the ambassador for this heraldry'}), 403
        
        # Get domains for this heraldry
        cursor = db.execute("""
            SELECT domain, is_pattern FROM heraldry_domains WHERE heraldry_id = %s
        """, (heraldry_id,))
        domains = cursor.fetchall()
        
        if not domains:
            # No domains means no coterie - set ambassador to NULL
            db.execute("""
                UPDATE heraldry SET ambassador_did = NULL, updated_at = NOW() WHERE id = %s
            """, (heraldry_id,))
            
            db.execute("""
                INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
                VALUES (%s, %s, 'ambassador_step_down', 'No successor available')
            """, (heraldry_id, ambassador_did))
            
            return jsonify({'success': True, 'new_ambassador_did': None})
        
        # Find most active coterie member (excluding current ambassador)
        domain_conditions = []
        params = []
        
        for domain_row in domains:
            domain = domain_row['domain']
            is_pattern = domain_row['is_pattern']
            if is_pattern:
                domain_conditions.append("d.server LIKE %s")
                params.append(f"%{domain.replace('*.', '%.')}")
            else:
                domain_conditions.append("d.server LIKE %s")
                params.append(f"%{domain}%")
        
        where_clause = " OR ".join(domain_conditions)
        params.append(ambassador_did)
        
        cursor = db.execute(f"""
            SELECT d.did, d.handle, d.name,
                   COALESCE(d.canon_score, 0) + COALESCE(d.lore_score, 0) as activity_score
            FROM dreamers d
            WHERE ({where_clause}) AND d.did != %s
            ORDER BY activity_score DESC, d.updated_at DESC NULLS LAST
            LIMIT 1
        """, params)
        
        new_ambassador = cursor.fetchone()
        
        if new_ambassador:
            # Assign new ambassador
            db.execute("""
                UPDATE heraldry SET ambassador_did = %s, updated_at = NOW() WHERE id = %s
            """, (new_ambassador['did'], heraldry_id))
            
            db.execute("""
                INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
                VALUES (%s, %s, 'ambassador_step_down', %s)
            """, (heraldry_id, ambassador_did, f"Succeeded by {new_ambassador['did']}"))
            
            return jsonify({
                'success': True,
                'new_ambassador_did': new_ambassador['did'],
                'new_ambassador_handle': new_ambassador['handle'],
                'new_ambassador_name': new_ambassador['name']
            })
        else:
            # No coterie members available
            db.execute("""
                UPDATE heraldry SET ambassador_did = NULL, updated_at = NOW() WHERE id = %s
            """, (heraldry_id,))
            
            db.execute("""
                INSERT INTO heraldry_history (heraldry_id, changed_by_did, change_type, change_data)
                VALUES (%s, %s, 'ambassador_step_down', 'No successor available')
            """, (heraldry_id, ambassador_did))
            
            return jsonify({'success': True, 'new_ambassador_did': None})
        
    except Exception as e:
        print(f"❌ Error stepping down for heraldry {heraldry_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to step down'}), 500
