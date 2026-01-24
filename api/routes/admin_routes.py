"""
Admin Routes Blueprint
Handles admin authentication, debug endpoints, and legacy challenge auth
"""

from flask import Blueprint, request, jsonify, send_from_directory, redirect, current_app
import secrets

# Create blueprint
bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Import shared dependencies
from core.admin_auth import auth, require_auth, get_client_ip, AUTHORIZED_ADMIN_DID
# from core.audit import get_audit_logger
from core.rate_limiter import PersistentRateLimiter

# audit = get_audit_logger()
audit = None
rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60


def rate_limit(requests_per_minute=100):
    """Rate limiting decorator (imported from app.py pattern)"""
    from functools import wraps
    import time
    
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            start_time = time.time()
            
            allowed, retry_after = rate_limiter.check_rate_limit(
                ip, 
                endpoint, 
                limit=requests_per_minute, 
                window=RATE_LIMIT_WINDOW
            )
            
            if not allowed:
                if audit:
                    audit.log(
                        event_type='rate_limit_exceeded',
                        endpoint=endpoint,
                        method=request.method,
                        user_ip=ip,
                        response_status=429,
                        user_agent=request.headers.get('User-Agent'),
                        extra_data={'limit': requests_per_minute, 'window': RATE_LIMIT_WINDOW, 'retry_after': retry_after}
                    )
                
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'limit': requests_per_minute,
                    'window': f'{RATE_LIMIT_WINDOW} seconds',
                    'retry_after': retry_after
                }), 429
            
            try:
                response = f(*args, **kwargs)
                
                if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                    duration_ms = int((time.time() - start_time) * 1000)
                    status = response[1] if isinstance(response, tuple) else 200
                    
                    if audit:
                        audit.log(
                            event_type='api_write',
                            endpoint=endpoint,
                            method=request.method,
                            user_ip=ip,
                            response_status=status,
                            user_agent=request.headers.get('User-Agent'),
                            request_body=request.get_data(as_text=True)[:1000] if request.method == 'POST' else None,
                            query_duration_ms=duration_ms
                        )
                
                return response
                
            except Exception as e:
                if audit:
                    audit.log(
                        event_type='api_error',
                        endpoint=endpoint,
                        method=request.method,
                        user_ip=ip,
                        response_status=500,
                        user_agent=request.headers.get('User-Agent'),
                        error_message=str(e)
                    )
                raise
                
        return wrapped
    return decorator


# ============================================================================
# ADMIN AUTHENTICATION ENDPOINTS
# ============================================================================

@bp.route('/login', methods=['POST'])
@rate_limit(60)
def admin_login():
    """Login endpoint - authenticates with Bluesky PDS"""
    try:
        client_ip = get_client_ip()
        
        data = request.get_json()
        handle = data.get('handle', '').strip()
        password = data.get('password', '')
        
        if not handle or not password:
            return jsonify({'error': 'Handle and password required'}), 400
        
        # Authenticate with PDS (includes rate limiting)
        success, did, verified_handle, error_msg = auth.authenticate_with_pds(handle, password, client_ip)
        
        if not success:
            if audit:
                audit.log(
                    event_type='admin_login_failed',
                    endpoint='/api/admin/login',
                    method='POST',
                    user_ip=client_ip,
                    response_status=401,
                    user_agent=request.headers.get('User-Agent'),
                    extra_data={'handle': handle, 'error': error_msg}
                )
            return jsonify({'error': error_msg}), 401
        
        # Check if user is the authorized admin
        if did != AUTHORIZED_ADMIN_DID:
            current_app.logger.warning(f"Unauthorized admin login attempt from DID: {did}")
            if audit:
                audit.log(
                    event_type='admin_login_unauthorized',
                    endpoint='/api/admin/login',
                    method='POST',
                    user_ip=client_ip,
                    response_status=403,
                    user_agent=request.headers.get('User-Agent'),
                    extra_data={'did': did, 'handle': verified_handle, 'error': 'Not authorized admin DID'}
                )
            return jsonify({'error': 'Unauthorized: Admin access restricted'}), 403
        
        # Create session
        token = auth.create_session(
            did=did,
            handle=verified_handle,
            ip_address=get_client_ip(),
            user_agent=request.headers.get('User-Agent')
        )
        
        # Log successful login
        auth.log_action(
            did=did,
            handle=verified_handle,
            action='login',
            ip_address=get_client_ip(),
            user_agent=request.headers.get('User-Agent')
        )
        
        if audit:
            audit.log(
                event_type='admin_login_success',
                endpoint='/api/admin/login',
                method='POST',
                user_ip=get_client_ip(),
                response_status=200,
                user_agent=request.headers.get('User-Agent'),
                extra_data={'did': did, 'handle': verified_handle}
            )
        
        return jsonify({
            'success': True,
            'token': token,
            'did': did,
            'handle': verified_handle,
            'role': 'superadmin'
        })
        
    except Exception as e:
        if audit:
            audit.log(
                event_type='admin_login_error',
                endpoint='/api/admin/login',
                method='POST',
                user_ip=get_client_ip(),
                response_status=500,
                user_agent=request.headers.get('User-Agent'),
                error_message=str(e)
            )
        return jsonify({'error': 'Login failed'}), 500


@bp.route('/logout', methods=['POST'])
@require_auth()
def admin_logout():
    """Logout endpoint - destroys session"""
    try:
        # Get token
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if token:
            # Log logout
            auth.log_action(
                did=request.admin_did,
                handle=request.admin_handle,
                action='logout',
                ip_address=get_client_ip(),
                user_agent=request.headers.get('User-Agent')
            )
            
            # Destroy session
            auth.destroy_session(token)
        
        return jsonify({'success': True, 'message': 'Logged out successfully'})
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500


@bp.route('/verify', methods=['GET'])
def admin_verify():
    """Verify if current token is valid AND user is the authorized admin"""
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    
    valid, did, handle = auth.validate_session(token)
    
    if not valid:
        return jsonify({'valid': False})
    
    # Check if user is the authorized admin
    is_admin = (did == AUTHORIZED_ADMIN_DID)
    
    if is_admin:
        return jsonify({
            'valid': True,
            'did': did,
            'handle': handle,
            'role': 'superadmin'
        })
    
    # Valid session but not admin
    return jsonify({'valid': False, 'error': 'Unauthorized: Admin access required'})


# ============================================================================
# DEBUG ENDPOINTS
# ============================================================================

@bp.route('/debug/ratelimit', methods=['GET'])
def admin_debug_ratelimit():
    """Debug endpoint to check rate limit status (persistent)"""
    client_ip = get_client_ip()
    
    # Get stats from persistent rate limiter
    stats = rate_limiter.get_stats(ip=client_ip, hours=1)
    
    return jsonify({
        'client_ip': client_ip,
        'x_forwarded_for': request.headers.get('X-Forwarded-For'),
        'x_real_ip': request.headers.get('X-Real-IP'),
        'remote_addr': request.remote_addr,
        'window_seconds': RATE_LIMIT_WINDOW,
        'recent_activity': stats,
        'note': 'Rate limits now persist across server restarts'
    })


@bp.route('/debug/ratelimit/clear', methods=['POST'])
@require_auth()
def admin_clear_ratelimit():
    """Clear rate limit for the current IP or all IPs (persistent storage) - ADMIN ONLY"""
    try:
        data = request.get_json() or {}
        clear_all = data.get('all', False)
        
        if clear_all:
            # Clear all rate limits (admin override)
            rate_limiter.clear_all()
            return jsonify({
                'success': True,
                'message': 'All rate limits cleared from persistent storage'
            })
        else:
            # Clear rate limit for current IP
            client_ip = get_client_ip()
            rate_limiter.clear_ip(client_ip)
            return jsonify({
                'success': True,
                'message': f'Rate limit cleared for {client_ip}',
                'client_ip': client_ip
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


# ============================================================================
# LEGACY CHALLENGE-BASED AUTH (kept for compatibility)
# ============================================================================

# In-memory storage for challenges (use Redis in production)
pending_challenges = {}

@bp.route('/generate-challenge', methods=['POST'])
def generate_challenge():
    """Generate a cryptographic challenge for DID authentication"""
    try:
        data = request.get_json()
        did = data.get('did')
        
        if not did:
            return jsonify({'error': 'DID is required'}), 400
        
        # Generate a random challenge
        challenge = secrets.token_hex(32)
        
        # Store challenge temporarily (expires in 5 minutes)
        pending_challenges[did] = challenge
        
        return jsonify({
            'challenge': challenge,
            'message': f'Use zowell.exe to sign this challenge',
            'instructions': 'Download zowell.exe from reverie.house/zowell to complete authentication',
            'zowell_download': '/zowell'
        })
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500


@bp.route('/verify-challenge', methods=['POST'])
def verify_challenge_auth():
    """Verify the signed challenge for authentication"""
    try:
        data = request.get_json()
        did = data.get('did')
        signature = data.get('signature')
        
        if not did or not signature:
            return jsonify({'error': 'DID and signature are required'}), 400
        
        # Get the stored challenge
        challenge = pending_challenges.get(did)
        if not challenge:
            return jsonify({'error': 'No pending challenge found or challenge expired'}), 400
        
        # Verify the signature (temporarily disabled - requires secure_simple module)
        # from core.secure_simple import authenticate_dreamer
        # is_valid = authenticate_dreamer(did, challenge, signature)
        is_valid = False  # Disabled for now
        
        if is_valid:
            # Clean up the challenge
            del pending_challenges[did]
            return jsonify({
                'success': True, 
                'message': 'Authentication successful! Welcome to the deep archives.',
                'redirect': '/vault'
            })
        else:
            return jsonify({'error': 'Invalid signature. Ensure you used zowell.exe correctly.'}), 401
            
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500
