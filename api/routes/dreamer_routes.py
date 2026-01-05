"""
Dreamer Routes Blueprint
Handles dreamer data, profiles, spectrum, and related operations
"""

from flask import Blueprint, request, jsonify, current_app, Response, redirect
from collections import defaultdict
import re
import traceback

# Create blueprint
bp = Blueprint('dreamers', __name__, url_prefix='/api')

# Import shared dependencies
from core.admin_auth import auth, AUTHORIZED_ADMIN_DID, validate_user_token
from core.rate_limiter import PersistentRateLimiter
from functools import wraps
import time

rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60


def rate_limit(requests_per_minute=100):
    """Rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            from core.admin_auth import get_client_ip
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
# DREAMER DATA ENDPOINTS
# ============================================================================

@bp.route('/dreamers')
def get_dreamers():
    """Get all dreamers with spectrum, souvenirs, and kindred in dreamers.json format"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # OPTIMIZED: Get dreamers with spectrum data
        cursor = db.execute("""
            SELECT 
                d.did, d.handle, d.name, d.display_name, d.description,
                d.server, d.avatar, d.banner,
                d.followers_count, d.follows_count, d.posts_count,
                d.created_at, d.arrival, d.heading, d.color_hex, d.phanera,
                d.status, d.designation, d.alts,
                d.canon_score, d.lore_score, d.patron_score, d.contribution_score,
                s.oblivion, s.authority, s.skeptic, s.receptive, 
                s.liberty, s.entropy, s.octant,
                s.origin_oblivion, s.origin_authority, s.origin_skeptic,
                s.origin_receptive, s.origin_liberty, s.origin_entropy, s.origin_octant
            FROM dreamers d
            LEFT JOIN spectrum s ON d.did = s.did
            ORDER BY d.arrival DESC
        """)
        dreamers = cursor.fetchall()
        
        # OPTIMIZED: Get all souvenirs in one query
        cursor = db.execute("SELECT did, souvenir_key, earned_epoch FROM awards ORDER BY did")
        souvenirs_data = cursor.fetchall()
        
        # OPTIMIZED: Organize souvenirs by DID using defaultdict
        souvenirs_by_did = defaultdict(dict)
        for row in souvenirs_data:
            souvenirs_by_did[row['did']][row['souvenir_key']] = row['earned_epoch']
        
        # OPTIMIZED: Get kindred for all dreamers in one query (bidirectional)
        cursor = db.execute("""
            SELECT did_a as did, did_b as kindred_did, discovered_epoch
            FROM kindred
            UNION
            SELECT did_b as did, did_a as kindred_did, discovered_epoch
            FROM kindred
            ORDER BY did, discovered_epoch
        """)
        kindred_data = cursor.fetchall()
        
        # OPTIMIZED: Organize kindred by DID using defaultdict
        kindred_by_did = defaultdict(list)
        for row in kindred_data:
            kindred_by_did[row['did']].append(row['kindred_did'])
        
        # OPTIMIZED: Format dreamers data using list comprehension
        dreamers_list = [
            {
                'name': dreamer['name'],
                'handle': dreamer['handle'],
                'did': dreamer['did'],
                'server': dreamer['server'] or '',
                'souvenirs': souvenirs_by_did.get(dreamer['did'], {}),
                'kindred': kindred_by_did.get(dreamer['did'], []),
                'display_name': dreamer['display_name'] or dreamer['name'],
                'description': dreamer['description'] or '',
                'avatar': dreamer['avatar'] or '',
                'banner': dreamer['banner'] or '',
                'followers_count': dreamer['followers_count'] or 0,
                'follows_count': dreamer['follows_count'] or 0,
                'posts_count': dreamer['posts_count'] or 0,
                'patronage': dreamer['patron_score'] or 0,  # Legacy field name
                'patron_score': dreamer['patron_score'] or 0,  # New field name (used by profile.js/sidebar.js)
                'canon_score': dreamer['canon_score'] or 0,
                'lore_score': dreamer['lore_score'] or 0,
                'contribution_score': dreamer['contribution_score'] or 0,
                'created_at': dreamer['created_at'] or '',
                'arrival': dreamer['arrival'] or 0,
                'color_hex': dreamer['color_hex'],
                'phanera': dreamer['phanera'],
                'status': dreamer['status'],
                'designation': dreamer['designation'],
                'alt_names': dreamer['alts'] or '',
                'spectrum': {
                    'entropy': dreamer['entropy'] or 0,
                    'oblivion': dreamer['oblivion'] or 0,
                    'liberty': dreamer['liberty'] or 0,
                    'authority': dreamer['authority'] or 0,
                    'receptive': dreamer['receptive'] or 0,
                    'skeptic': dreamer['skeptic'] or 0,
                    'octant': dreamer['octant'],
                    'origin_entropy': dreamer['origin_entropy'] or 0,
                    'origin_oblivion': dreamer['origin_oblivion'] or 0,
                    'origin_liberty': dreamer['origin_liberty'] or 0,
                    'origin_authority': dreamer['origin_authority'] or 0,
                    'origin_receptive': dreamer['origin_receptive'] or 0,
                    'origin_skeptic': dreamer['origin_skeptic'] or 0,
                    'origin_octant': dreamer['origin_octant']
                },
                'heading': dreamer['heading']
            }
            for dreamer in dreamers
        ]
        
        return jsonify(dreamers_list)
        
    except Exception as e:
        print(f"Error in /api/dreamers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/dreamers/stats/newcomers-today')
def get_newcomers_today():
    """Get count of dreamers who joined today"""
    try:
        from core.database import DatabaseManager
        from datetime import datetime
        
        db = DatabaseManager()
        
        # Get start of today in epoch time (Unix timestamp)
        now = datetime.now()
        start_of_today = datetime(now.year, now.month, now.day)
        today_epoch = int(start_of_today.timestamp())
        
        # Count dreamers whose arrival is >= today's epoch
        cursor = db.execute("""
            SELECT COUNT(*) as count 
            FROM dreamers 
            WHERE arrival >= %s
        """, (today_epoch,))
        
        result = cursor.fetchone()
        count = result['count'] if result else 0
        
        return jsonify({
            'count': count,
            'date': now.strftime('%Y-%m-%d')
        })
        
    except Exception as e:
        print(f"Error in /api/dreamers/stats/newcomers-today: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/dreamers/recent')
def get_recent_dreamers():
    """Get the 3 most recently added dreamers (by database insertion order)"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get 3 most recent database additions using created_at (insertion order)
        cursor = db.execute("""
            SELECT 
                d.did, d.handle, d.name, d.display_name,
                d.server, d.avatar, d.created_at, d.color_hex
            FROM dreamers d
            ORDER BY d.created_at DESC NULLS LAST
            LIMIT 3
        """)
        dreamers = cursor.fetchall()
        
        # Format response
        recent_dreamers = [
            {
                'did': dreamer['did'],
                'handle': dreamer['handle'],
                'name': dreamer['name'],
                'display_name': dreamer['display_name'] or dreamer['name'],
                'server': dreamer['server'] or '',
                'avatar': dreamer['avatar'] or '',
                'created_at': dreamer['created_at'] or '',
                'color_hex': dreamer['color_hex'] or ''
            }
            for dreamer in dreamers
        ]
        
        return jsonify(recent_dreamers)
        
    except Exception as e:
        print(f"Error in /api/dreamers/recent: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/dreamers/active')
def get_active_dreamers():
    """Get the most active dreamers by lore:reverie.house label count from lore.farm PostgreSQL"""
    try:
        from core.database import DatabaseManager
        import subprocess
        
        # Query lore.farm PostgreSQL database directly for accurate counts
        # Get top 4 so we have 3 after filtering out errantson
        query = """
            SELECT 
                SUBSTRING(uri FROM 'at://([^/]+)') as did, 
                COUNT(*) as label_count 
            FROM applied_labels 
            WHERE val = 'lore:reverie.house' 
            GROUP BY did 
            ORDER BY label_count DESC 
            LIMIT 4
        """
        
        result = subprocess.run(
            ['/usr/bin/docker', 'exec', 'lorefarm_db', 'psql', '-U', 'lorefarm', '-d', 'lorefarm', '-t', '-A', '-F', '|', '-c', query],
            capture_output=True,
            text=True
        )
        
        print(f"Docker command return code: {result.returncode}")
        print(f"Docker command stdout: {result.stdout}")
        print(f"Docker command stderr: {result.stderr}")
        
        if result.returncode != 0:
            print(f"PostgreSQL query failed: {result.stderr}")
            return jsonify([])
        
        # Get dreamer details from reverie.db
        db = DatabaseManager()
        active_dreamers = []
        
        for line in result.stdout.strip().split('\n'):
            if not line or '|' not in line:
                continue
            parts = line.split('|')
            if len(parts) < 2:
                continue
            did = parts[0].strip()
            label_count = parts[1].strip()
            
            cursor = db.execute(
                "SELECT did, handle, name, display_name, server, avatar FROM dreamers WHERE did = %s",
                (did,)
            )
            dreamer = cursor.fetchone()
            
            # Skip errantson (they'll always have the most)
            if dreamer and dreamer['name'] != 'errantson':
                active_dreamers.append({
                    'did': dreamer['did'],
                    'handle': dreamer['handle'],
                    'name': dreamer['name'],
                    'display_name': dreamer['display_name'] or dreamer['name'],
                    'server': dreamer['server'] or '',
                    'avatar': dreamer['avatar'] or '',
                    'contribution_score': int(label_count)
                })
            
            # Stop once we have 3 (excluding errantson)
            if len(active_dreamers) >= 3:
                break
        
        return jsonify(active_dreamers)
        
    except Exception as e:
        print(f"Error in /api/dreamers/active: {e}")
        import traceback
        traceback.print_exc()
        return jsonify([])


@bp.route('/dreamers/<did>')
def get_dreamer_by_did(did):
    """Get a single dreamer by DID"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get dreamer info with spectrum
        cursor = db.execute("""
            SELECT 
                d.did, d.handle, d.name, d.display_name, d.description,
                d.server, d.avatar, d.banner,
                d.followers_count, d.follows_count, d.posts_count,
                d.created_at, d.arrival, d.heading, d.color_hex, d.phanera, d.alts,
                s.oblivion, s.authority, s.skeptic, s.receptive, s.liberty, s.entropy, s.octant,
                s.origin_oblivion, s.origin_authority, s.origin_skeptic,
                s.origin_receptive, s.origin_liberty, s.origin_entropy, s.origin_octant
            FROM dreamers d
            LEFT JOIN spectrum s ON d.did = s.did
            WHERE d.did = %s
        """, (did,))
        
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'Dreamer not found'}), 404
        
        # Build spectrum object if data exists
        spectrum = None
        if dreamer['entropy'] is not None:
            spectrum = {
                'oblivion': dreamer['oblivion'],
                'authority': dreamer['authority'],
                'skeptic': dreamer['skeptic'],
                'receptive': dreamer['receptive'],
                'liberty': dreamer['liberty'],
                'entropy': dreamer['entropy'],
                'octant': dreamer['octant'],
                'origin_oblivion': dreamer['origin_oblivion'],
                'origin_authority': dreamer['origin_authority'],
                'origin_skeptic': dreamer['origin_skeptic'],
                'origin_receptive': dreamer['origin_receptive'],
                'origin_liberty': dreamer['origin_liberty'],
                'origin_entropy': dreamer['origin_entropy'],
                'origin_octant': dreamer['origin_octant']
            }
        
        # Return dreamer data
        return jsonify({
            'did': dreamer['did'],
            'handle': dreamer['handle'],
            'name': dreamer['name'],
            'display_name': dreamer['display_name'],
            'description': dreamer['description'],
            'server': dreamer['server'],
            'avatar': dreamer['avatar'],
            'banner': dreamer['banner'],
            'followers_count': dreamer['followers_count'],
            'follows_count': dreamer['follows_count'],
            'posts_count': dreamer['posts_count'],
            'created_at': dreamer['created_at'],
            'arrival': dreamer['arrival'],
            'heading': dreamer['heading'],
            'color_hex': dreamer['color_hex'],
            'phanera': dreamer['phanera'],
            'alt_names': dreamer['alts'] or '',
            'spectrum': spectrum
        })
        
    except Exception as e:
        print(f"Error in /api/dreamers/<did>: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/dreamer/by-handle/<path:handle>')
def get_dreamer_by_handle(handle):
    """Get a single dreamer by handle (case-insensitive)"""
    try:
        from core.database import DatabaseManager
        
        # Clean handle
        handle = handle.strip().lstrip('@').lower()
        
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT 
                d.did, d.handle, d.name, d.display_name, d.description,
                d.server, d.avatar, d.banner
            FROM dreamers d
            WHERE LOWER(d.handle) = %s
        """, (handle,))
        
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'Dreamer not found'}), 404
        
        return jsonify({
            'did': dreamer['did'],
            'handle': dreamer['handle'],
            'name': dreamer['name'],
            'display_name': dreamer['display_name'],
            'description': dreamer['description'],
            'server': dreamer['server'],
            'avatar': dreamer['avatar'],
            'banner': dreamer['banner']
        })
        
    except Exception as e:
        print(f"Error in /api/dreamer/by-handle/<handle>: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/dreamer/did/<did>')
def get_dreamer_profile_by_did(did):
    """Get minimal dreamer profile by DID (for heraldry ambassador lookup)"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, handle, name, display_name, avatar
            FROM dreamers
            WHERE did = %s
        """, (did,))
        
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'Dreamer not found'}), 404
        
        return jsonify({
            'did': dreamer['did'],
            'handle': dreamer['handle'],
            'name': dreamer['name'] or dreamer['display_name'],
            'display_name': dreamer['display_name'],
            'avatar': dreamer['avatar']
        })
        
    except Exception as e:
        print(f"Error in /api/dreamer/did/<did>: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/formers/<identifier>')
def get_former_by_identifier(identifier):
    """Get an archived 'formers' record by DID or handle"""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager

        db = DatabaseManager()

        # Determine if identifier looks like a DID
        if identifier.startswith('did:'):
            cursor = db.execute(
                "SELECT did, handle, name, display_name, avatar_url, avatar_archived, banner_url, banner_archived, description, profile_data, departure_date FROM formers WHERE did = %s",
                (identifier,)
            )
        else:
            # lookup by handle (case-insensitive)
            cursor = db.execute(
                "SELECT did, handle, name, display_name, avatar_url, avatar_archived, banner_url, banner_archived, description, profile_data, departure_date FROM formers WHERE LOWER(handle) = LOWER(%s)",
                (identifier,)
            )

        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Former record not found'}), 404

        # Try to parse profile_data if present
        profile = row.get('profile_data')
        try:
            import json
            if profile and isinstance(profile, str):
                profile = json.loads(profile)
        except Exception:
            pass

        result = {
            'did': row.get('did'),
            'handle': row.get('handle'),
            'name': row.get('name'),
            'display_name': row.get('display_name'),
            'avatar_url': row.get('avatar_url'),
            'avatar_archived': row.get('avatar_archived'),
            'banner_url': row.get('banner_url'),
            'banner_archived': row.get('banner_archived'),
            'description': row.get('description'),
            'profile': profile,
            'departure_date': row.get('departure_date')
        }

        return jsonify(result)
    except Exception as e:
        print(f"Error in /api/formers/<identifier>: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/events')
def get_events_api():
    """Return events, optionally filtered by DID. Query params: did, limit, type"""
    try:
        did = request.args.get('did')
        limit = int(request.args.get('limit', '20'))
        event_type = request.args.get('type')

        # Use EventsManager to fetch events
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.events import EventsManager
        em = EventsManager()

        events = em.get_events(limit=limit, event_type=event_type, did=did)
        return jsonify(events)
    except Exception as e:
        print(f"Error in /api/events: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/dreamer/check')
def check_dreamer():
    """Check if a dreamer exists in the database"""
    try:
        did = request.args.get('did')
        if not did:
            return jsonify({'error': 'DID parameter required'}), 400
        
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Query database for dreamer
        cursor = db.execute("SELECT did, name, handle, avatar FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'exists': False}), 404
        
        return jsonify({
            'exists': True,
            'dreamer': {
                'did': dreamer['did'],
                'name': dreamer['name'],
                'handle': dreamer['handle'],
                'avatar': dreamer['avatar']
            }
        })
        
    except Exception as e:
        print(f"Error in /api/dreamer/check: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/dreamer/contribution')
def get_dreamer_contribution():
    """Calculate contribution score based on lore.farm tags with temporal/contextual weighting"""
    try:
        did = request.args.get('did')
        if not did:
            return jsonify({'error': 'DID parameter required'}), 400
        
        detailed = request.args.get('detailed', 'false').lower() == 'true'
        
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.contributions import ContributionCalculator
        
        calc = ContributionCalculator()
        
        # TODO: Fetch actual tags from lore.farm API
        # For now, using placeholder empty lists
        lore_tags = []  # Format: [(epoch, uri), ...]
        canon_tags = []  # Format: [(epoch, uri), ...]
        
        result = calc.calculate_contribution(did, lore_tags, canon_tags)
        
        if detailed:
            # Include timeline if requested
            timeline = calc.get_contribution_timeline(did, lore_tags, canon_tags)
            result['timeline'] = timeline
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/dreamer/contribution: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# SPECTRUM ENDPOINTS
# ============================================================================

@bp.route('/spectrum/reset/<did>', methods=['POST'])
@rate_limit(5)
def reset_spectrum_to_origin(did):
    """Reset a dreamer's spectrum to their algorithmic origin (REQUIRES USER AUTH)"""
    
    # Verify authentication and DID ownership
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')
    
    valid, user_did, handle = validate_user_token(token)
    
    if not valid:
        return jsonify({'error': 'Unauthorized', 'message': 'Please login'}), 401
    
    # Check if user owns this DID or is admin
    is_admin = (user_did == AUTHORIZED_ADMIN_DID)
    is_owner = (user_did == did)
    
    if not is_owner and not is_admin:
        return jsonify({'error': 'Forbidden', 'message': 'You can only reset your own spectrum'}), 403
    
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from utils.spectrum import SpectrumManager
        from core.database import DatabaseManager
        
        mgr = SpectrumManager()
        
        # Get dreamer info
        cursor = mgr.db.execute("SELECT server FROM dreamers WHERE did = %s", (did,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({
                'success': False,
                'error': 'Dreamer not found'
            }), 404
        
        # Reset to origin
        result = mgr.reset_to_origin(did, server=row['server'], reason='manual reset via API')
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/spectrum/reset: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================================
# DREAMER CUSTOMIZATION ENDPOINTS
# ============================================================================

@bp.route('/dreamers/color', methods=['POST'])
@rate_limit(20)
def update_dreamer_color():
    """
    Update a dreamer's personal color preference (REQUIRES USER AUTH).
    Expects: { "did": "did:plc:...", "color_hex": "#RRGGBB" }
    Returns: { "success": true }
    """
    
    # Verify authentication - support both admin sessions and OAuth JWT
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')
    
    valid, user_did, handle = validate_user_token(token)
    
    if not valid:
        return jsonify({'error': 'Unauthorized', 'message': 'Please login'}), 401
    
    try:
        data = request.get_json()
        did = data.get('did')
        color_hex = data.get('color_hex')
        
        if not did or not color_hex:
            return jsonify({'error': 'DID and color_hex required'}), 400
        
        # Check if user owns this DID or is admin
        is_admin = (user_did == AUTHORIZED_ADMIN_DID)
        is_owner = (user_did == did)
        
        if not is_owner and not is_admin:
            return jsonify({'error': 'Forbidden', 'message': 'You can only change your own color'}), 403
        
        # Validate hex color format
        if not re.match(r'^#[0-9A-Fa-f]{6}$', color_hex):
            return jsonify({'error': 'Invalid hex color format. Use #RRGGBB'}), 400
        
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Verify dreamer exists
        dreamer = db.fetch_one("SELECT did FROM dreamers WHERE did = %s", (did,))
        
        if not dreamer:
            return jsonify({'error': 'Dreamer not found'}), 404
        
        # Update color (auto-committed by DatabaseManager)
        db.execute("UPDATE dreamers SET color_hex = %s WHERE did = %s", (color_hex, did))
        
        return jsonify({
            'success': True,
            'color_hex': color_hex
        })
        
    except Exception as e:
        print(f"Error updating color: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/dreamers/phanera', methods=['POST'])
@rate_limit(20)
def update_dreamer_phanera():
    """
    Update a dreamer's selected phanera display (REQUIRES USER AUTH).
    Expects: { "did": "did:plc:...", "phanera": "dream/strange" }
    Returns: { "success": true }
    """
    
    # Verify authentication
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')
    
    valid, user_did, handle = validate_user_token(token)
    
    if not valid:
        return jsonify({'error': 'Unauthorized', 'message': 'Please login'}), 401
    
    try:
        data = request.get_json()
        did = data.get('did')
        phanera = data.get('phanera')
        
        if not did or not phanera:
            return jsonify({'error': 'DID and phanera required'}), 400
        
        # Check if user owns this DID or is admin
        is_admin = (user_did == AUTHORIZED_ADMIN_DID)
        is_owner = (user_did == did)
        
        if not is_owner and not is_admin:
            return jsonify({'error': 'Forbidden', 'message': 'You can only change your own phanera'}), 403
        
        import sys
        import os
        import json
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Verify dreamer exists
        cursor = db.execute("SELECT did, souvenirs FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'Dreamer not found'}), 404
        
        # Verify phanera is one of their unlocked souvenirs
        souvenirs = json.loads(dreamer['souvenirs']) if dreamer['souvenirs'] else {}
        if phanera not in souvenirs:
            return jsonify({'error': 'Souvenir not unlocked'}), 403
        
        # Update phanera
        db.execute("UPDATE dreamers SET phanera = %s WHERE did = %s", (phanera, did))
        # Auto-committed by DatabaseManager
        
        return jsonify({
            'success': True,
            'phanera': phanera
        })
        
    except Exception as e:
        print(f"Error updating phanera: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/spectrum/calculate', methods=['GET'])
def calculate_spectrum():
    """
    Calculate spectrum origin for ANY DID or handle on-the-fly.
    Does NOT require the dreamer to be in the database.
    Query params: handle=xxx.bsky.social OR did=did:plc:xxx
    Returns: Calculated spectrum data
    """
    try:
        handle = request.args.get('handle')
        did = request.args.get('did')
        
        if not handle and not did:
            return jsonify({'error': 'Either handle or did parameter required'}), 400
        
        import sys
        import os
        import requests
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        from utils.spectrum import SpectrumManager
        from utils.octant import calculate_octant_code
        
        db = DatabaseManager()
        
        # If given a handle, resolve it to DID via ATP API
        if handle and not did:
            # Clean the handle - remove @ prefix, whitespace, and invisible Unicode characters
            import re
            handle = handle.strip().lstrip('@')
            # Remove invisible Unicode characters (zero-width, directional marks, etc.)
            handle = re.sub(r'[\u200B-\u200D\u202A-\u202E\u2060-\u206F\uFEFF]', '', handle)
            handle = handle.strip()  # Strip again after removing invisible chars
            
            # Require full handles with domain - do NOT assume .bsky.social
            # This supports custom domains like bmann.ca, pfrazee.com, etc.
            if not '.' in handle:
                return jsonify({
                    'error': 'Invalid handle format. Please provide full handle with domain (e.g., user.bsky.social or custom.domain)'
                }), 400
            
            try:
                # Resolve handle to DID using ATP API
                resolve_url = f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}"
                response = requests.get(resolve_url, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    did = data.get('did')
                else:
                    return jsonify({'error': f'Failed to resolve handle: {handle}'}), 404
            except Exception as e:
                return jsonify({'error': f'Handle resolution failed: {str(e)}'}), 500
        
        if not did or not did.startswith('did:'):
            return jsonify({'error': 'Invalid DID format'}), 400
        
        # Always fetch fresh profile data from Bluesky ATP
        display_name = None
        avatar = None
        profile_handle = None
        
        try:
            profile_url = f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}"
            response = requests.get(profile_url, timeout=30)
            
            if response.status_code == 200:
                profile = response.json()
                profile_handle = profile.get('handle', 'unknown')
                display_name = profile.get('displayName', profile_handle)
                avatar = profile.get('avatar')
            else:
                profile_handle = handle or 'unknown'
                display_name = profile_handle
        except Exception as e:
            print(f"Warning: Failed to fetch profile from ATP: {e}")
            profile_handle = handle or 'unknown'
            display_name = profile_handle
        
        # Use the handle from profile, fallback to input handle
        handle = profile_handle or handle
        
        # Get server info from database (if they exist) for spectrum calculation
        server = None
        cursor = db.execute("""
            SELECT server
            FROM dreamers 
            WHERE did = %s
        """, (did,))
        dreamer_data = cursor.fetchone()
        
        if dreamer_data:
            server = dreamer_data['server']
        
        # If no server in DB, resolve PDS from DID document
        if not server and did:
            try:
                did_response = requests.get(f"https://plc.directory/{did}", timeout=5)
                if did_response.status_code == 200:
                    did_doc = did_response.json()
                    for service in did_doc.get('service', []):
                        if service.get('id') == '#atproto_pds':
                            server = service.get('serviceEndpoint')
                            print(f"🔍 Resolved PDS for {handle}: {server}")
                            break
            except Exception as e:
                print(f"⚠️ Failed to resolve PDS from DID: {e}")
        
        # Calculate spectrum using the algorithm
        spectrum_manager = SpectrumManager(db)
        spectrum_values = spectrum_manager.generate_spectrum(did, server or '')
        
        # Calculate octant
        octant = calculate_octant_code(spectrum_values)
        
        # Build response
        response = {
            'did': did,
            'handle': handle,
            'display_name': display_name or handle,
            'avatar': avatar,
            'server': server,
            'spectrum': {
                'entropy': spectrum_values['entropy'],
                'oblivion': spectrum_values['oblivion'],
                'liberty': spectrum_values['liberty'],
                'authority': spectrum_values['authority'],
                'receptive': spectrum_values['receptive'],
                'skeptic': spectrum_values['skeptic'],
                'octant': octant
            }
        }
        
        # Store dreamer data immediately for smooth UX
        # Image will be generated and uploaded by the frontend client
        # NOTE: Only create dreamers if AUTO_CREATE_DREAMERS is enabled
        # Otherwise, dreamers are only created when users actually log in
        from config import Config
        
        try:
            # 1. Store/update dreamer in database if not already present
            cursor = db.execute("SELECT did FROM dreamers WHERE did = %s", (did,))
            existing_dreamer = cursor.fetchone()
            
            if not existing_dreamer and Config.AUTO_CREATE_DREAMERS:
                print(f"📝 Storing new dreamer in database: {handle} ({did})")
                now = int(time.time())
                
                # Fetch account creation date from DID audit log
                arrival_timestamp = now  # fallback
                try:
                    audit_response = requests.get(f"https://plc.directory/{did}/log/audit", timeout=5)
                    if audit_response.status_code == 200:
                        audit_log = audit_response.json()
                        if audit_log and len(audit_log) > 0:
                            created_at_str = audit_log[0].get('createdAt')
                            if created_at_str:
                                from datetime import datetime
                                dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                                arrival_timestamp = int(dt.timestamp())
                                print(f"📅 Using account creation date as arrival: {created_at_str} ({arrival_timestamp})")
                except Exception as e:
                    print(f"⚠️ Failed to fetch DID creation date, using current time: {e}")
                
                # Store basic dreamer record with arrival timestamp
                db.execute("""
                    INSERT INTO dreamers (did, handle, name, display_name, avatar, server, arrival, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
                """, (
                    did,
                    handle,
                    handle.split('.')[0],  # Extract name from handle
                    display_name or handle,
                    avatar,
                    server or '',
                    arrival_timestamp,  # account creation from DID
                    now   # updated_at
                ))
                print(f"✅ Stored dreamer data for {handle}")
                
                # Create arrival event - "found our wild mindscape"
                db.execute("""
                    INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, color_source, color_intensity)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    did,
                    'found our wild mindscape',
                    'arrival',
                    'arrival',
                    f"{did}/app.bsky.actor.profile/self",
                    f"https://bsky.app/profile/{did}",
                    arrival_timestamp,  # account creation time as event epoch
                    now,                # created_at is when we recorded it
                    'user',
                    'highlight'
                ))
                print(f"✅ Created arrival event for {handle}")
                
                # Store spectrum data in spectrum table
                db.execute("""
                    INSERT INTO spectrum (did, oblivion, authority, skeptic, receptive, liberty, entropy, octant, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (did) DO UPDATE SET
                        oblivion = EXCLUDED.oblivion,
                        authority = EXCLUDED.authority,
                        skeptic = EXCLUDED.skeptic,
                        receptive = EXCLUDED.receptive,
                        liberty = EXCLUDED.liberty,
                        entropy = EXCLUDED.entropy,
                        octant = EXCLUDED.octant,
                        updated_at = EXCLUDED.updated_at
                """, (
                    did,
                    spectrum_values['oblivion'],
                    spectrum_values['authority'],
                    spectrum_values['skeptic'],
                    spectrum_values['receptive'],
                    spectrum_values['liberty'],
                    spectrum_values['entropy'],
                    octant,
                    int(time.time())
                ))
                print(f"✅ Stored spectrum data for {handle}")
            elif not existing_dreamer:
                # New dreamer but AUTO_CREATE_DREAMERS is disabled
                # Don't store anything - they need to actually log in first
                print(f"⏭️  Skipping dreamer creation for {handle} (AUTO_CREATE_DREAMERS=false)")
            else:
                # Update existing dreamer with latest profile data
                db.execute("""
                    UPDATE dreamers 
                    SET handle = %s, display_name = %s, avatar = %s
                    WHERE did = %s
                """, (
                    handle, display_name or handle, avatar, did
                ))
                
                # Update spectrum in spectrum table
                db.execute("""
                    INSERT INTO spectrum (did, oblivion, authority, skeptic, receptive, liberty, entropy, octant, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (did) DO UPDATE SET
                        oblivion = EXCLUDED.oblivion,
                        authority = EXCLUDED.authority,
                        skeptic = EXCLUDED.skeptic,
                        receptive = EXCLUDED.receptive,
                        liberty = EXCLUDED.liberty,
                        entropy = EXCLUDED.entropy,
                        octant = EXCLUDED.octant,
                        updated_at = EXCLUDED.updated_at
                """, (
                    did,
                    spectrum_values['oblivion'],
                    spectrum_values['authority'],
                    spectrum_values['skeptic'],
                    spectrum_values['receptive'],
                    spectrum_values['liberty'],
                    spectrum_values['entropy'],
                    octant,
                    int(time.time())
                ))
                print(f"✅ Updated existing dreamer and spectrum data for {handle}")
            
            # 2. Check if spectrum image already exists
            from werkzeug.utils import secure_filename
            
            safe_handle = handle.replace('/', '').replace('\\', '').replace('..', '')
            spectrum_dir = '/srv/site/spectrum'
            os.makedirs(spectrum_dir, exist_ok=True)
            image_path = f"{spectrum_dir}/{safe_handle}.png"
            
            # If image exists, include URL in response
            if os.path.exists(image_path):
                print(f"✅ Spectrum image already exists: {image_path}")
                response['spectrum_image_url'] = f"https://reverie.house/spectrum/{safe_handle}.png"
            else:
                print(f"⏳ Spectrum image will be generated by client: {safe_handle}.png")
            
        except Exception as e:
            # Don't fail the entire request if storage fails
            print(f"⚠️  Error during data storage: {e}")
            import traceback
            traceback.print_exc()
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error calculating spectrum: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/spectrum/save-image', methods=['POST'])
def save_spectrum_image():
    """
    Save spectrum origin image to /spectrum/{handle}.png
    Accepts multipart form data with image blob and handle
    Returns: URL to the saved image
    """
    try:
        import os
        from werkzeug.utils import secure_filename
        
        # Get image and handle from form data
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        if 'handle' not in request.form:
            return jsonify({'error': 'No handle provided'}), 400
        
        image_file = request.files['image']
        handle = request.form['handle'].strip().lstrip('@')
        
        # Sanitize handle for filename
        safe_handle = secure_filename(handle)
        if not safe_handle:
            return jsonify({'error': 'Invalid handle'}), 400
        
        # Ensure spectrum directory exists
        spectrum_dir = os.path.join('/srv/site/spectrum')
        os.makedirs(spectrum_dir, exist_ok=True)
        
        # Save image
        filename = f"{safe_handle}.png"
        filepath = os.path.join(spectrum_dir, filename)
        image_file.save(filepath)
        
        # Return URL to the image
        image_url = f"https://reverie.house/spectrum/{filename}"
        
        print(f"✅ Saved spectrum image: {filepath}")
        return jsonify({'url': image_url, 'imageUrl': image_url}), 200  # Return both for compatibility
        
    except Exception as e:
        print(f"Error saving spectrum image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/spectrum/origin/<handle>', methods=['GET'])
def spectrum_origin_redirect(handle):
    """
    Serves a page with OG meta tags for link preview, then redirects to /spectrum
    This creates rich previews on Bluesky while routing users to the main spectrum page
    
    If the spectrum image doesn't exist, auto-generates it using the frontend calculator
    """
    try:
        import os
        from werkzeug.utils import secure_filename
        
        # Clean and validate handle
        handle = handle.strip().lstrip('@').replace('.bsky.social', '')
        safe_handle = secure_filename(handle)
        
        if not safe_handle:
            return redirect('https://reverie.house/spectrum')
        
        # Check if image exists
        spectrum_dir = '/srv/site/spectrum'
        image_path = os.path.join(spectrum_dir, f"{safe_handle}.png")
        image_exists = os.path.exists(image_path)
        
        # Image URL for OG tags
        image_url = f"https://reverie.house/spectrum/{safe_handle}.png"
        
        # Fetch dreamer info for better meta tags
        try:
            import requests
            full_handle = handle if '.' in handle else f"{handle}.bsky.social"
            response = requests.get(
                f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={full_handle}",
                timeout=2
            )
            
            if response.status_code == 200:
                did = response.json().get('did')
                if did:
                    profile_response = requests.get(
                        f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}",
                        timeout=2
                    )
                    if profile_response.status_code == 200:
                        profile = profile_response.json()
                        display_name = profile.get('displayName', handle)
                    else:
                        display_name = handle
                else:
                    display_name = handle
            else:
                display_name = handle
        except:
            display_name = handle
        
        # If image doesn't exist, generate it synchronously using PIL
        if not image_exists:
            print(f"🎨 Generating spectrum image for {safe_handle}...")
            try:
                import subprocess
                
                full_handle = handle if '.' in handle else f"{handle}.bsky.social"
                
                # Call the PIL-based generator
                result = subprocess.run(
                    ['python3', '/srv/reverie.house/utils/generate_spectrum_image.py', full_handle, image_path],
                    timeout=30,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    print(f"✅ Image generated successfully for {safe_handle}")
                    print(result.stdout)
                    image_exists = True
                else:
                    print(f"⚠️  Image generation failed:")
                    print(result.stderr)
                    print(f"   Returning OG tags anyway - image may be missing in preview")
                
            except subprocess.TimeoutExpired:
                print(f"⚠️  Image generation timed out")
            except Exception as e:
                print(f"⚠️  Image generation error: {e}")
        
        # Return the OG preview HTML immediately (image may still be generating)
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{display_name}'s Spectrum Origin - Reverie House</title>
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://reverie.house/spectrum/origin/{safe_handle}">
    <meta property="og:title" content="{display_name}'s Spectrum Origin">
    <meta property="og:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">
    <meta property="og:image" content="{image_url}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="675">
    <meta property="og:site_name" content="Reverie House">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{display_name}'s Spectrum Origin">
    <meta name="twitter:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">
    <meta name="twitter:image" content="{image_url}">
    
    <!-- Immediate redirect -->
    <meta http-equiv="refresh" content="0;url=https://reverie.house/spectrum">
    <script>
        window.location.href = 'https://reverie.house/spectrum';
    </script>
</head>
<body>
    <p>Redirecting to <a href="https://reverie.house/spectrum">Reverie House Spectrum</a>...</p>
</body>
</html>'''
        
        return Response(html, mimetype='text/html')
        
    except Exception as e:
        print(f"Error in spectrum origin redirect: {e}")
        return redirect('https://reverie.house/spectrum')


@bp.route('/spectrum/generate-image/<handle>', methods=['GET'])
def generate_spectrum_image_page(handle):
    """
    Returns an HTML page that auto-generates a spectrum image using frontend JavaScript
    This is called internally by the origin endpoint to trigger image creation
    """
    try:
        from werkzeug.utils import secure_filename
        
        # Clean handle
        handle = handle.strip().lstrip('@')
        safe_handle = secure_filename(handle)
        full_handle = handle if '.' in handle else f"{handle}.bsky.social"
        
        # Return a minimal page that generates and saves the image
        html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Generating Spectrum Image</title>
</head>
<body>
    <script type="module">
        import {{ OCTANT_DESCRIPTIONS, AXIS_COLORS, configurePixelPerfectCanvas, loadImage, calculateAxisPercentage, drawSpectrumBar, formatCoordinates }} from '/js/utils/spectrum-utils.js';
        
        (async function() {{
            try {{
                console.log('🎨 Auto-generating spectrum image for {full_handle}...');
                
                // Fetch spectrum data
                const response = await fetch('/api/spectrum/calculate?handle=' + encodeURIComponent('{full_handle}'));
                if (!response.ok) {{
                    console.error('Failed to calculate spectrum');
                    return;
                }}
                
                const data = await response.json();
                const spectrum = data.spectrum;
                const octantName = spectrum?.octant || 'equilibrium';
                const displayName = data.display_name || '{full_handle}';
                const handle = data.handle || '{full_handle}';
                
                // Create canvas (1280x720 landscape)
                const canvas = document.createElement('canvas');
                canvas.width = 1280;
                canvas.height = 720;
                const ctx = canvas.getContext('2d');
                configurePixelPerfectCanvas(ctx);
                
                // Load and draw background
                const bgImage = await loadImage('/assets/originBG.png');
                ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
                
                // Octant colors
                const octantColors = {{
                    'adaptive': {{ base: 'rgb(100, 255, 200)', dark: 'rgb(45, 140, 100)' }},
                    'chaotic': {{ base: 'rgb(100, 200, 255)', dark: 'rgb(45, 110, 150)' }},
                    'intended': {{ base: 'rgb(255, 100, 150)', dark: 'rgb(160, 50, 90)' }},
                    'prepared': {{ base: 'rgb(255, 180, 100)', dark: 'rgb(150, 100, 50)' }},
                    'contented': {{ base: 'rgb(255, 150, 255)', dark: 'rgb(141, 87, 141)' }},
                    'assertive': {{ base: 'rgb(150, 150, 255)', dark: 'rgb(80, 80, 150)' }},
                    'ordered': {{ base: 'rgb(255, 255, 100)', dark: 'rgb(140, 140, 50)' }},
                    'guarded': {{ base: 'rgb(169, 85, 214)', dark: 'rgb(100, 50, 130)' }},
                    'equilibrium': {{ base: 'rgb(200, 200, 200)', dark: 'rgb(100, 100, 100)' }},
                    'confused': {{ base: 'rgb(180, 180, 200)', dark: 'rgb(90, 90, 110)' }},
                    'singling': {{ base: 'rgb(200, 180, 180)', dark: 'rgb(110, 90, 90)' }}
                }};
                
                const octantColor = octantColors[octantName] || octantColors['equilibrium'];
                const octantInfo = OCTANT_DESCRIPTIONS[octantName] || OCTANT_DESCRIPTIONS['equilibrium'];
                
                // Box dimensions
                const boxWidth = 880;
                const boxHeight = 630;
                const boxX = 20;
                const boxY = (canvas.height - boxHeight) / 2;
                
                // Background box with shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 25;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 10;
                ctx.fillStyle = 'rgba(26, 20, 16, 0.85)';
                ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
                
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Border
                ctx.strokeStyle = octantColor.base.replace(')', ', 0.6)').replace('rgb', 'rgba');
                ctx.lineWidth = 3;
                ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
                
                // Load avatar
                let avatarImage = null;
                if (data.avatar) {{
                    try {{
                        avatarImage = await loadImage('/api/avatar-proxy?url=' + encodeURIComponent(data.avatar));
                    }} catch (e) {{
                        console.warn('Could not load avatar');
                    }}
                }}
                
                const avatarSize = 121;
                const avatarX = boxX + 28;
                const avatarY = boxY + 18;
                
                if (avatarImage) {{
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
                    ctx.restore();
                    
                    ctx.strokeStyle = octantColor.base.replace(')', ', 0.8)').replace('rgb', 'rgba');
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx.stroke();
                }}
                
                // Text content
                const profileTextX = avatarX + avatarSize + 28;
                let textY = avatarY;
                
                ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
                ctx.font = 'bold 39px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(displayName, profileTextX, textY + 32);
                
                textY += 53;
                ctx.fillStyle = 'rgba(201, 184, 168, 0.75)';
                ctx.font = '31px system-ui, -apple-system, sans-serif';
                ctx.fillText('@' + handle, profileTextX, textY + 19);
                
                textY += 39;
                const coordinateText = formatCoordinates(spectrum);
                ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
                ctx.font = 'bold 26px "Courier New", monospace';
                ctx.fillText(coordinateText, profileTextX, textY + 16);
                
                // Octant name
                let profileY = avatarY + avatarSize + 44;
                ctx.fillStyle = octantColor.base;
                ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 8;
                ctx.fillText(octantName.toUpperCase(), boxX + 48, profileY);
                ctx.shadowBlur = 0;
                
                // Description
                profileY += 34;
                ctx.fillStyle = 'rgba(201, 184, 168, 0.85)';
                ctx.font = 'italic 26px Georgia, serif';
                ctx.fillText(octantInfo.desc, boxX + 48, profileY);
                
                // Spectrum bars
                profileY += 58;
                const barWidth = boxWidth - 96;
                const barHeight = 29;
                const barSpacing = 15;
                
                const axes = [
                    {{ label: 'entropy ⇄ oblivion', v1: spectrum.entropy, v2: spectrum.oblivion, c1: AXIS_COLORS.entropy, c2: AXIS_COLORS.oblivion }},
                    {{ label: 'liberty ⇄ authority', v1: spectrum.liberty, v2: spectrum.authority, c1: AXIS_COLORS.liberty, c2: AXIS_COLORS.authority }},
                    {{ label: 'receptive ⇄ skeptic', v1: spectrum.receptive, v2: spectrum.skeptic, c1: AXIS_COLORS.receptive, c2: AXIS_COLORS.skeptic }}
                ];
                
                axes.forEach((axis, i) => {{
                    const y = profileY + i * (barHeight + barSpacing + 23);
                    
                    ctx.font = '20px system-ui, -apple-system, sans-serif';
                    ctx.fillStyle = 'rgba(180, 165, 150, 0.85)';
                    ctx.textAlign = 'center';
                    ctx.fillText(axis.label, boxX + boxWidth / 2, y);
                    
                    const percentage = calculateAxisPercentage(axis.v1, axis.v2);
                    drawSpectrumBar(ctx, {{
                        x: boxX + 48,
                        y: y + 10,
                        width: barWidth,
                        height: barHeight,
                        color1: axis.c1,
                        color2: axis.c2,
                        percentage
                    }});
                }});
                
                // Convert to blob and save
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const formData = new FormData();
                formData.append('image', blob, '{safe_handle}.png');
                formData.append('handle', '{safe_handle}');
                
                const saveResponse = await fetch('/api/spectrum/save-image', {{
                    method: 'POST',
                    body: formData
                }});
                
                if (saveResponse.ok) {{
                    console.log('✅ Image generated and saved for {safe_handle}');
                    document.body.innerHTML = '<p style="color:green">✅ Image generated successfully</p>';
                }} else {{
                    console.error('Failed to save image');
                    document.body.innerHTML = '<p style="color:red">❌ Failed to save image</p>';
                }}
                
            }} catch (error) {{
                console.error('Generation failed:', error);
                document.body.innerHTML = '<p style="color:red">❌ Error: ' + error.message + '</p>';
            }}
        }})();
    </script>
    <p>Generating image for {full_handle}...</p>
</body>
</html>'''
        
        return Response(html, mimetype='text/html')
        
    except Exception as e:
        print(f"Error in generate image page: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/spectrum/generate-facets', methods=['POST'])
def generate_facets():
    """
    Generate AT Protocol facets for a post text.
    Used for creating proper @mention links in Bluesky posts.
    
    Request body: {"text": "Post text with @mentions"}
    Returns: {"facets": [...]}
    """
    try:
        from utils.facets import find_mentions_in_text
        
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'text field required in request body'}), 400
        
        text = data['text']
        
        # Generate facets for all mentions in the text
        facets = find_mentions_in_text(text)
        
        return jsonify({
            'facets': facets,
            'count': len(facets)
        })
        
    except Exception as e:
        print(f"Error generating facets: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

