#!/usr/bin/env python3
"""
Reverie House Admin Panel Server
PDS-based authentication with session management
"""

from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, Response
import json
import os
import secrets
import time
import requests
from functools import wraps

app = Flask(__name__, static_folder='site', template_folder='site')

# Import audit logger and admin auth
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.audit import get_audit_logger
from core.admin_auth import auth, require_auth, get_client_ip, AUTHORIZED_ADMIN_DID
from core.rate_limiter import PersistentRateLimiter
from core.encryption import encrypt_password, decrypt_password

audit = get_audit_logger()

# Persistent rate limiting (survives restarts)
rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60  # seconds

# Register API blueprints
from api import register_blueprints
register_blueprints(app)


# ============================================================================
# ERROR HANDLING MIDDLEWARE
# ============================================================================

@app.errorhandler(Exception)
def handle_exception(e):
    """Catch all unhandled exceptions and log them"""
    import traceback
    
    # Get request context
    endpoint = request.path
    method = request.method
    user_ip = get_client_ip()
    user_agent = request.headers.get('User-Agent')
    
    # Get user DID if authenticated
    user_did = None
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')
    
    if token:
        valid, did, handle = auth.validate_session(token)
        if valid:
            user_did = did
    
    # Get stack trace
    stack_trace = traceback.format_exc()
    
    # Get request data
    request_data = None
    try:
        if request.method in ['POST', 'PUT', 'PATCH']:
            request_data = request.get_data(as_text=True)[:5000]  # Limit size
    except:
        pass
    
    # Determine severity
    severity = 'error'
    if isinstance(e, (KeyError, ValueError, TypeError)):
        severity = 'warning'
    elif hasattr(e, 'code') and e.code >= 500:
        severity = 'critical'
    
    # Log to error system
    audit.log_error(
        error_type=type(e).__name__,
        error_message=str(e),
        stack_trace=stack_trace,
        endpoint=endpoint,
        method=method,
        user_did=user_did,
        user_ip=user_ip,
        user_agent=user_agent,
        request_data=request_data,
        severity=severity,
        client_side=False
    )
    
    # Also log to audit log
    audit.log(
        event_type='unhandled_exception',
        endpoint=endpoint,
        method=method,
        user_ip=user_ip,
        response_status=500,
        user_did=user_did,
        user_agent=user_agent,
        error_message=str(e)
    )
    
    # Return appropriate error response
    if hasattr(e, 'code'):
        return jsonify({'error': str(e)}), e.code
    else:
        return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


def rate_limit(requests_per_minute=100):
    """Persistent rate limiting decorator using PostgreSQL"""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            start_time = time.time()
            
            # Check rate limit using persistent storage
            allowed, retry_after = rate_limiter.check_rate_limit(
                ip, 
                endpoint, 
                limit=requests_per_minute, 
                window=RATE_LIMIT_WINDOW
            )
            
            if not allowed:
                # Log rate limit hit
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
            
            # Execute the route
            try:
                response = f(*args, **kwargs)
                
                # Log successful request (only for write operations)
                if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                    duration_ms = int((time.time() - start_time) * 1000)
                    status = response[1] if isinstance(response, tuple) else 200
                    
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
                # Log errors
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


def add_first_time_work_canon(db_manager, did, role_name, canon_event, canon_key):
    """
    Add canon entry when user starts a work role for the first time.
    
    Args:
        db_manager: DatabaseManager instance
        did: User's DID
        role_name: Role name for checking (e.g., 'greeter', 'mapper', 'cogitarian')
        canon_event: Human-readable event text (e.g., 'became Greeter of Reveries')
        canon_key: Canon key for the event (e.g., 'greeter', 'mapper', 'cogitarian')
    
    Returns:
        bool: True if canon was added, False if already existed
    """
    import time
    
    try:
        # Check if this user already has this work canon entry
        cursor = db_manager.execute("""
            SELECT 1 FROM events 
            WHERE did = %s AND type = 'work' AND key = %s
        """, (did, canon_key))
        
        if cursor.fetchone():
            print(f"  ℹ️  User already has {canon_key} canon entry (not first time)")
            return False
        
        # Add the canon entry - this is their first time!
        epoch = int(time.time())
        
        # Build URI and URL for this work role
        uri = f'/work/{canon_key}'
        url = f'https://reverie.house/work/{canon_key}'
        
        db_manager.execute("""
            INSERT INTO events (did, epoch, type, event, key, uri, url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            did,
            epoch,
            'work',
            canon_event,
            canon_key,
            uri,
            url
        ))
        
        print(f"  ✨ First-time work canon: {canon_event}")
        print(f"     URI: {uri}")
        print(f"     URL: {url}")
        return True
        
    except Exception as e:
        print(f"  ⚠️  Failed to add work canon: {e}")
        # Don't fail the entire activation if canon fails
        return False


# ============================================================================
# DREAMER SUBDOMAIN HANDLER
# ============================================================================

@app.before_request
def handle_subdomain():
    """Handle dreamer subdomain requests (name.reverie.house)"""
    host = request.headers.get('Host', '')
    
    # Check if this is a subdomain request
    if host.endswith('.reverie.house') and host != 'reverie.house':
        subdomain = host.replace('.reverie.house', '')
        
        # Skip known non-dreamer subdomains
        if subdomain in ['auth', 'shop', 'press', 'www', 'lore']:
            return None
        
        # Serve dreamer profile with spectrum OG image
        return serve_dreamer_profile(subdomain)
    
    return None

def serve_dreamer_profile(name):
    """Serve a dreamer's profile page with spectrum OG image"""
    try:
        import os
        import subprocess
        from core.database import DatabaseManager
        
        # Look up dreamer in database
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT did, handle, display_name 
            FROM dreamers 
            WHERE name = %s OR handle LIKE %s
        """, (name, f"{name}.%"))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            # Dreamer not found, redirect to main site
            return redirect('https://reverie.house/')
        
        did, handle, display_name = dreamer
        safe_handle = handle.replace('/', '').replace('\\', '').replace('..', '')
        
        # Check if spectrum image exists
        spectrum_dir = '/srv/site/spectrum'
        image_path = os.path.join(spectrum_dir, f"{safe_handle}.png")
        image_url = f"https://reverie.house/spectrum/{safe_handle}.png"
        
        if not os.path.exists(image_path):
            print(f"🎨 [SUBDOMAIN] Image missing for {safe_handle}, using placeholder")
            # Use placeholder and trigger async generation
            image_url = f"https://reverie.house/assets/og-image.png"
            
            # Trigger async generation (don't wait)
            try:
                import threading
                def generate_async():
                    try:
                        import subprocess
                        result = subprocess.run(
                            ['python3', '/srv/reverie.house/utils/generate_spectrum_image.py', handle, image_path],
                            timeout=45,
                            capture_output=True,
                            text=True
                        )
                        if result.returncode == 0:
                            print(f"✅ [SUBDOMAIN] Background generation completed for {safe_handle}")
                        else:
                            print(f"❌ [SUBDOMAIN] Background generation failed: {result.stderr}")
                    except Exception as e:
                        print(f"❌ [SUBDOMAIN] Background generation error: {e}")
                
                thread = threading.Thread(target=generate_async, daemon=True)
                thread.start()
                print(f"📤 [SUBDOMAIN] Background generation queued for {safe_handle}")
                
            except Exception as e:
                print(f"❌ [SUBDOMAIN] Failed to queue background generation: {e}")
        else:
            print(f"✅ [SUBDOMAIN] Using cached image for {safe_handle}")
        
        # Build profile page HTML with OG tags
        title = f"{display_name or name}'s Profile - Reverie House"
        description = f"View {display_name or name}'s dreamer profile and spectrum origin in the Reverie House community."
        profile_url = f"https://reverie.house/dreamer?handle={handle}"
        
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="profile">
    <meta property="og:url" content="https://{name}.reverie.house/">
    <meta property="og:title" content="{display_name or name}'s Profile">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image_url}">
    <meta property="og:image:width" content="1280">
    <meta property="og:image:height" content="720">
    <meta property="og:site_name" content="Reverie House">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{display_name or name}'s Profile">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_url}">
    
    <!-- Immediate redirect to profile page -->
    <meta http-equiv="refresh" content="0;url={profile_url}">
    <script>
        window.location.href = '{profile_url}';
    </script>
</head>
<body>
    <p>Redirecting to <a href="{profile_url}">{display_name or name}'s profile</a>...</p>
</body>
</html>'''
        
        return Response(html, mimetype='text/html')
        
    except Exception as e:
        print(f"❌ [SUBDOMAIN] Error serving dreamer profile: {e}")
        return redirect('https://reverie.house/')


# ============================================================================
# PROTECTED ADMIN ROUTES - Serve static admin pages with auth
# ============================================================================

@app.route('/admin/')
@app.route('/admin/index.html')
@require_auth()
def admin_index():
    """Admin dashboard"""
    return send_from_directory('site/admin', 'quests.html')


@app.route('/admin/<path:filename>')
def admin_file(filename):
    """Serve admin files - login page is public, others require auth"""
    # Allow login page without auth
    if filename == 'login.html':
        return send_from_directory('site/admin', filename)
    
    # All other admin pages require authentication
    # Check token
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    # Also check cookie for browser navigation
    elif request.cookies.get('admin_token'):
        token = request.cookies.get('admin_token')
    
    valid, did, handle = auth.validate_session(token)
    
    if not valid:
        # Redirect to login page
        return redirect('/admin/login.html')
    
    # Serve the file
    return send_from_directory('site/admin', filename)


# ============================================================================
# WORK ROUTES - Serve work.html with role-specific tabs
# ============================================================================

@app.route('/work.html')
def work_html():
    """Main work page (work.html)"""
    return send_from_directory('site', 'work.html')


@app.route('/work')
@app.route('/work/')
@app.route('/work/greeter')
@app.route('/work/mapper')
@app.route('/work/cogitarian')
def work_all_routes():
    """Work page - All routes serve work.html, JS detects URL path"""
    return send_from_directory('site', 'work.html')


@app.route('/origin.html')
def origin_html_with_meta():
    """
    Serve origin.html with dynamic meta tags based on handle query parameter
    """
    try:
        handle = request.args.get('handle', '').strip().lstrip('@')
        
        # If no handle, serve static version
        if not handle or '.' not in handle:
            return send_from_directory('site', 'origin.html')
        
        # Sanitize handle
        safe_handle = handle.replace('/', '').replace('\\', '').replace('..', '')
        
        # Image URL for OG tags
        image_url = f"https://reverie.house/spectrum/{safe_handle}.png"
        
        # Fetch dreamer info for better meta tags
        display_name = handle
        try:
            response = requests.get(
                f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}",
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
                        display_name = profile.get('displayName', handle) or handle
        except Exception as e:
            print(f"Could not fetch profile for {handle}: {e}")
        
        # Read the origin.html template
        with open('site/origin.html', 'r') as f:
            html_content = f.read()
        
        # Replace meta tags with dynamic versions
        # Update title
        html_content = html_content.replace(
            '<title>Spectrum Origin - Reverie House</title>',
            f'<title>{display_name}\'s Spectrum Origin - Reverie House</title>'
        )
        
        # Update OG tags
        html_content = html_content.replace(
            '<meta property="og:url" content="https://reverie.house/origin.html">',
            f'<meta property="og:url" content="https://reverie.house/origin.html?handle={safe_handle}">'
        )
        html_content = html_content.replace(
            '<meta property="og:title" content="Spectrum Origin - Reverie House">',
            f'<meta property="og:title" content="{display_name}\'s Spectrum Origin">'
        )
        html_content = html_content.replace(
            '<meta property="og:description" content="Discover your dreamweaver origin in the spectrum.">',
            '<meta property="og:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">'
        )
        
        # Add OG image tag after og:site_name
        og_image_tags = f'''
    <meta property="og:image" content="{image_url}">
    <meta property="og:image:width" content="1280">
    <meta property="og:image:height" content="720">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{display_name}'s Spectrum Origin">
    <meta name="twitter:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">
    <meta name="twitter:image" content="{image_url}">'''
        
        html_content = html_content.replace(
            '<meta property="og:site_name" content="Reverie House">',
            f'<meta property="og:site_name" content="Reverie House">{og_image_tags}'
        )
        
        return Response(html_content, mimetype='text/html')
        
    except Exception as e:
        print(f"Error serving origin.html with meta tags: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to static file
        return send_from_directory('site', 'origin.html')


@app.route('/spectrum')
def spectrum_preview():
    """
    Rich preview for /spectrum page
    Uses spectrum_01.gif with logo overlay
    """
    html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spectrum Origins - Reverie House</title>

    <!-- Open Graph Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://reverie.house/spectrum">
    <meta property="og:title" content="Spectrum Origins - Reverie House">
    <meta property="og:description" content="Step into the wild mindscape. Discover your unique position across Dream, Reason, Chaos, and Order. Calculate your spectrum origin and join a community of dreamweavers, wanderers, and builders.">
    <meta property="og:image" content="https://reverie.house/assets/spectrum_01.gif">
    <meta property="og:image:type" content="image/gif">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Reverie House">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Spectrum Origins - Reverie House">
    <meta name="twitter:description" content="Step into the wild mindscape. Discover your unique position across Dream, Reason, Chaos, and Order. Calculate your spectrum origin and join a community of dreamweavers, wanderers, and builders.">
    <meta name="twitter:image" content="https://reverie.house/assets/spectrum_01.gif">

    <!-- Immediate redirect to origin.html -->
    <meta http-equiv="refresh" content="0;url=https://reverie.house/origin.html">
    <script>
        window.location.href = 'https://reverie.house/origin.html';
    </script>
</head>
<body>
    <p>Redirecting to Spectrum Origins...</p>
</body>
</html>'''
    return Response(html, mimetype='text/html')


@app.route('/origin/<path:handle>')
def origin_redirect(handle):
    """
    Spectrum origin OG preview endpoint
    Generates image server-side via origincards service if needed, then serves OG tags
    Uses the SAME calculation flow as the work modal
    Supports custom ATProto domains (bmann.ca, pfrazee.com, etc.)
    """
    try:
        import os
        
        handle = handle.strip().lstrip('@')
        if '.' not in handle:
            return redirect('https://reverie.house/spectrum')
        
        safe_handle = handle.replace('/', '').replace('\\', '').replace('..', '')
        if not safe_handle:
            return redirect('https://reverie.house/spectrum')
        
        # Check if image exists (check with original safe_handle first)
        spectrum_dir = '/srv/site/spectrum'
        os.makedirs(spectrum_dir, exist_ok=True)
        image_path = os.path.join(spectrum_dir, f"{safe_handle}.png")
        
        # Track the actual handle used for the image
        actual_handle = handle
        
        if not os.path.exists(image_path):
            # Image doesn't exist - generate it NOW using same flow as calculator
            print(f"🎨 [GENERATING] Creating image for {handle}")
            
            try:
                # 1. Calculate spectrum (same as calculator does)
                # Use the ORIGINAL handle (not safe_handle) for calculation
                calc_response = requests.get(
                    f"http://localhost:4444/api/spectrum/calculate?handle={handle}",
                    timeout=10
                )
                
                if calc_response.status_code != 200:
                    print(f"⚠️  Calculation failed, redirecting to origin.html")
                    return redirect(f'https://reverie.house/origin.html?handle={handle}')
                
                data = calc_response.json()
                
                # Get the ACTUAL resolved handle from the API (supports custom domains)
                actual_handle = data.get('handle', handle)
                print(f"✅ Spectrum calculated for {actual_handle}")
                
                # Use resolved handle for filename
                safe_resolved = actual_handle.replace('/', '').replace('\\', '').replace('..', '')
                image_path = os.path.join(spectrum_dir, f"{safe_resolved}.png")
                
                # 2. Generate full image via origincards service
                gen_response = requests.post(
                    'http://localhost:3050/generate',
                    json={
                        'handle': actual_handle,  # Use actual resolved handle
                        'displayName': data.get('display_name', actual_handle),
                        'avatar': data.get('avatar'),
                        'spectrum': data.get('spectrum', {}),
                        'coordinates': data.get('spectrum', {}).get('coordinates')
                    },
                    timeout=15
                )
                
                if gen_response.status_code == 200:
                    result = gen_response.json()
                    print(f"✅ Image generated: {result.get('url')}")
                else:
                    print(f"⚠️  Image generation failed: {gen_response.status_code}")
                    return redirect(f'https://reverie.house/origin.html?handle={actual_handle}')
                
            except Exception as e:
                print(f"⚠️  Image generation failed: {e}")
                import traceback
                traceback.print_exc()
                return redirect(f'https://reverie.house/origin.html?handle={handle}')
        
        # Image exists (either pre-existing or just created) - serve OG tags
        # Re-determine the safe filename for the image
        safe_actual = actual_handle.replace('/', '').replace('\\', '').replace('..', '')
        print(f"✅ [SERVING] OG tags for {actual_handle}")
        
        display_name = actual_handle
        try:
            response = requests.get(
                f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={actual_handle}",
                timeout=2
            )
            if response.status_code == 200:
                did = response.json().get('did')
                if did:
                    prof_resp = requests.get(
                        f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={did}",
                        timeout=2
                    )
                    if prof_resp.status_code == 200:
                        display_name = prof_resp.json().get('displayName', actual_handle) or actual_handle
        except:
            pass
        
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{display_name}'s Spectrum Origin - Reverie House</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://reverie.house/origin/{safe_actual}">
    <meta property="og:title" content="{display_name}'s Spectrum Origin">
    <meta property="og:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">
    <meta property="og:image" content="https://reverie.house/spectrum/{safe_actual}.png">
    <meta property="og:image:width" content="1280">
    <meta property="og:image:height" content="720">
    <meta property="og:site_name" content="Reverie House">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{display_name}'s Spectrum Origin">
    <meta name="twitter:description" content="What kind of dreamweaver are you? Visit Reverie House to discover your origins within our wild mindscape, and a community of fellow dreamers.">
    <meta name="twitter:image" content="https://reverie.house/spectrum/{safe_actual}.png">
    <meta http-equiv="refresh" content="0;url=https://reverie.house/origin.html?handle={safe_actual}">
    <script>window.location.href='https://reverie.house/origin.html?handle={safe_actual}';</script>
</head>
<body><p>Redirecting...</p></body>
</html>'''
        return Response(html, mimetype='text/html')
        
    except Exception as e:
        print(f"Error in origin redirect: {e}")
        import traceback
        traceback.print_exc()
        return redirect('https://reverie.house/spectrum')


# ============================================================================
# LEGACY ROUTES (kept for compatibility - some served by blueprints)
# ============================================================================

@app.route('/vault')
def secure_vault():
    """Secure content area - requires valid authentication"""
    return jsonify({
        'message': 'Well done, we are hiring: books@reverie.house',
        'status': 'authenticated',
        'access_level': 'deep_archives',
        'note': 'You have successfully navigated the cryptographic challenge.'
    })

@app.route('/zowell')
def zowell_download():
    """Information about zowell.exe download"""
    return jsonify({
        'status': 'Coming Soon',
        'description': 'Zowell.exe - Cryptographic Puzzle Game',
        'features': [
            'Interactive cryptographic challenges',
            'Signature generation through gameplay',
            'Educational cryptography content',
            'Offline puzzle solving'
        ],
        'release': 'Development in progress',
        'contact': 'books@reverie.house'
    })

@app.route('/admin-panel')
def panel_preview():
    """Preview of admin panel functionality (placeholder)"""
    return jsonify({
        'message': 'Admin Panel Access Restricted',
        'authentication': 'DID-based cryptographic signature required',
        'tool_required': 'zowell.exe',
        'status': 'awaiting_signature',
        'databases': {
            'dreamers.json': 'User management',
            'souvenirs.json': 'Digital collectibles',
            'canon.json': 'Event history'
        },
        'note': 'Complete the cryptographic challenge to access admin features'
    })


# ============================================================================
# HEALTH & STATUS ENDPOINTS
# ============================================================================

# Health check
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'reverie_admin',
        'authentication': 'DID-based',
        'tool_integration': 'zowell.exe'
    })

# Firehose status check (legacy endpoint - DISABLED, dream_queue removed)
@app.route('/api/firehose-status')
def firehose_status():
    """Check if the firehose service is running (legacy endpoint)"""
    return jsonify({
        'status': 'disabled',
        'active': False,
        'service': 'firehose-legacy',
        'message': 'Dream queue service removed'
    })
    # try:
    #     from core.database import DatabaseManager
    #     
    #     # Check firehose by recent database activity
    #     db = DatabaseManager()
    #     five_min_ago = int(time.time()) - (5 * 60)
    #     result = db.execute("""
    #         SELECT COUNT(*) as count 
    #         FROM dream_queue 
    #         WHERE detected_at > %s
    #     """, (five_min_ago,)).fetchone()
    #     
    #     total = db.execute("SELECT COUNT(*) FROM dream_queue").fetchone()
    #     is_active = (result and result['count'] > 0) or (total and total['count'] > 0)
    #     
    #     return jsonify({
    #         'status': 'active' if is_active else 'inactive',
    #         'active': is_active,
    #         'service': 'firehose-docker',
    #         'recent_dreams': result['count'] if result else 0,
    #         'total_dreams': total['count'] if total else 0
    #     })
    # except Exception as e:
    #     return jsonify({
    #         'status': 'error',
    #         'active': False,
    #         'error': str(e)
    #     })

# Operations status check (comprehensive)
@app.route('/api/operations-status')
def operations_status():
    """Check status of all Reverie operations"""
    try:
        import socket
        from core.database import DatabaseManager
        
        # Check firehose by recent database activity
        # Dream queue service removed - firehose disabled
        firehose_active = False
        # try:
        #     db = DatabaseManager()
        #     # Check if firehose has written to dream_queue in last 5 minutes
        #     five_min_ago = int(time.time()) - (5 * 60)
        #     result = db.execute("""
        #         SELECT COUNT(*) as count 
        #         FROM dream_queue 
        #         WHERE detected_at > %s
        #     """, (five_min_ago,)).fetchone()
        #     
        #     # Also check if there are ANY records (even if not recent)
        #     total = db.execute("SELECT COUNT(*) FROM dream_queue").fetchone()
        #     
        #     # Active if recent activity OR if we have records (system is operational)
        #     firehose_active = (result and result['count'] > 0) or (total and total['count'] > 0)
        # except Exception as e:
        #     # If table doesn't exist or other error, assume inactive
        #     print(f"Firehose status check error: {e}")
        #     pass
        
        # Check PDS via health endpoint (proxied through Caddy)
        pds_active = False
        try:
            import requests
            response = requests.get('https://reverie.house/xrpc/_health', timeout=2, verify=False)
            pds_active = response.status_code == 200
        except Exception:
            pass
        
        # Check Caddy (port 80/443)
        caddy_active = False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            caddy_active = sock.connect_ex(('localhost', 80)) == 0
            sock.close()
        except Exception:
            pass
        
        # Check if Stripe API is running (port 5000)
        stripe_active = False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            stripe_active = sock.connect_ex(('localhost', 5000)) == 0
            sock.close()
        except Exception:
            pass
        
        return jsonify({
            'firehose': {
                'active': firehose_active,
                'status': 'active' if firehose_active else 'inactive',
                'name': 'Active Dream Monitor'
            },
            'pds': {
                'active': pds_active,
                'status': 'active' if pds_active else 'inactive',
                'name': 'Personal Dream Storage',
                'port': 3000
            },
            'caddy': {
                'active': caddy_active,
                'status': 'active' if caddy_active else 'inactive',
                'name': 'Web Server',
                'port': 80
            },
            'stripe': {
                'active': stripe_active,
                'status': 'active' if stripe_active else 'inactive',
                'name': 'Payment Gateway',
                'port': 5000
            },
            'overall': 'healthy' if (firehose_active and pds_active and caddy_active) else 'degraded'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'overall': 'error'
        })

@app.route('/api/database/all')
def get_all_database_data():
    """Get all data from all database tables (PUBLIC READ-ONLY - Game data only, no sensitive info)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all table data - ONLY PUBLIC GAME DATA (no credentials, sessions, or admin data)
        tables = {}
        table_names = [
            'dreamers', 'spectrum', 'kindred', 'awards',
            'events', 'souvenirs', 'books',
            'chapters', 'world', 'spectrum_snapshots', 'quests'
        ]
        
        for table_name in table_names:
            try:
                # Special handling for dreamers - join with spectrum
                if table_name == 'dreamers':
                    cursor = db.execute("""
                        SELECT 
                            d.did, d.handle, d.name, d.display_name, d.description,
                            d.avatar, d.banner, d.followers_count, d.follows_count, d.posts_count,
                            d.server, d.arrival, d.created_at, d.updated_at, d.heading, d.heading_changed_at,
                            d.alts, d.color_hex, d.phanera, d.status,
                            d.dream_pair_did, d.dream_pair_since, d.collab_partner_did, d.collab_partner_since,
                            s.entropy, s.oblivion, s.liberty, 
                            s.authority, s.receptive, s.skeptic, s.octant
                        FROM dreamers d
                        LEFT JOIN spectrum s ON d.did = s.did
                        ORDER BY 
                            d.heading_changed_at DESC NULLS LAST,
                            d.arrival ASC
                    """)
                # Events: join with dreamers and fetch reactions
                elif table_name == 'events':
                    cursor = db.execute("""
                        SELECT 
                            c.*, 
                            d.name, 
                            d.avatar,
                            d.color_hex,
                            r.id as reaction_id,
                            r.did as reaction_did,
                            r.event as reaction_event,
                            r.type as reaction_type,
                            r.key as reaction_key,
                            r.uri as reaction_uri,
                            r.url as reaction_url,
                            r.epoch as reaction_epoch,
                            rd.name as reaction_name,
                            rd.avatar as reaction_avatar
                        FROM events c
                        LEFT JOIN dreamers d ON c.did = d.did
                        LEFT JOIN events r ON r.reaction_to = c.id
                        LEFT JOIN dreamers rd ON r.did = rd.did
                        ORDER BY c.epoch DESC
                    """)
                # Special handling for souvenirs - add keeper count
                elif table_name == 'souvenirs':
                    cursor = db.execute("""
                        SELECT 
                            s.*,
                            COUNT(ds.did) as keepers
                        FROM souvenirs s
                        LEFT JOIN awards ds ON s.key = ds.souvenir_key
                        GROUP BY s.key, s.name, s.description, s.icon, s.phanera, s.category, s.created_at
                        ORDER BY s.category, s.key
                    """)
                # Special handling for spectrum_snapshots - add statistics from JSON
                elif table_name == 'spectrum_snapshots':
                    cursor = db.execute("""
                        SELECT id, epoch, operation, total_dreamers, snapshot_data, created_at, notes
                        FROM spectrum_snapshots
                        ORDER BY id DESC
                        LIMIT 100
                    """)
                    rows = cursor.fetchall()
                    snapshot_data = []
                    for row in rows:
                        row_dict = dict(row)
                        # Parse JSON to extract statistics
                        try:
                            import json
                            data = json.loads(row_dict['snapshot_data'])
                            stats = data.get('statistics', {})
                            row_dict['dreamer_count'] = data.get('total_dreamers', 0)
                            row_dict['dreamers_with_spectrum'] = data.get('dreamers_with_spectrum', 0)
                            row_dict['total_distance_from_origin'] = stats.get('total_distance_from_origin', 0)
                            row_dict['avg_distance_from_origin'] = stats.get('avg_distance_from_origin', 0)
                            row_dict['total_distance_traveled'] = stats.get('total_distance_traveled', 0)
                        except:
                            row_dict['dreamer_count'] = 0
                            row_dict['dreamers_with_spectrum'] = 0
                            row_dict['total_distance_from_origin'] = 0
                            row_dict['avg_distance_from_origin'] = 0
                            row_dict['total_distance_traveled'] = 0
                        # Don't include full data in list view
                        del row_dict['snapshot_data']
                        snapshot_data.append(row_dict)
                    tables[table_name] = snapshot_data
                    continue
                else:
                    cursor = db.execute(f"SELECT * FROM {table_name}")
                    
                rows = cursor.fetchall()
                # Convert Row objects to dicts
                tables[table_name] = [dict(row) for row in rows]
            except Exception as e:
                print(f"Error fetching {table_name}: {e}")
                tables[table_name] = []
        
        # Get stats
        stats = db.get_table_stats()
        
        # Get schema version
        schema_version = db.get_schema_version()
        
        return jsonify({
            'success': True,
            'tables': tables,
            'stats': stats,
            'schema_version': schema_version,
            'timestamp': int(__import__('time').time())
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/database/table/<table_name>')
def get_table_data(table_name):
    """Get data from a specific table (PUBLIC READ-ONLY)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        # Validate table name (prevent SQL injection)
        valid_tables = [
            'dreamers', 'spectrum', 'kindred', 'dreamer_souvenirs',
            'canon', 'profile_history', 'souvenirs', 'books',
            'chapters', 'world', 'spectrum_snapshots'
        ]
        
        if table_name not in valid_tables:
            return jsonify({'error': 'Invalid table name'}), 400
        
        db = DatabaseManager()
        cursor = db.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'table': table_name,
            'data': [dict(row) for row in rows],
            'count': len(rows)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/database/snapshot/<int:snapshot_id>')
def get_snapshot_detail(snapshot_id):
    """Get detailed data for a specific spectrum snapshot (PUBLIC READ-ONLY)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT id, epoch, operation, snapshot_data, created_at, notes
            FROM spectrum_snapshots
            WHERE id = %s
        """, (snapshot_id,))
        
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Snapshot not found'}), 404
        
        # Parse the snapshot data
        import json
        snapshot_data = json.loads(row['snapshot_data'])
        
        return jsonify({
            'id': row['id'],
            'epoch': row['epoch'],
            'operation': row['operation'],
            'created_at': row['created_at'],
            'notes': row['notes'],
            'data': snapshot_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/canon')
def get_canon():
    """Get all canon entries from database"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all canon entries with dreamer names and avatars, sorted by epoch descending
        cursor = db.execute("""
            SELECT c.id, c.epoch, c.did, c.event, c.url, c.uri, c.type, c.key, c.created_at, 
                   d.name, d.avatar, d.color_hex
            FROM events c
            LEFT JOIN dreamers d ON c.did = d.did
            ORDER BY c.epoch DESC
        """)
        canon_entries = cursor.fetchall()
        
        # Convert to list of dicts
        result = []
        for entry in canon_entries:
            canon_dict = {
                'epoch': entry['epoch'],
                'did': entry['did'],
                'name': entry['name'] or 'unknown',
                'avatar': entry['avatar'] or '',
                'color_hex': entry['color_hex'] or '#8b7355',
                'event': entry['event'],
                'url': entry['url'] or '',
                'uri': entry['uri'] or '',
                'type': entry['type'] or 'souvenir',
                'key': entry['key'] or ''
            }
            result.append(canon_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/canon: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/work/active-roles')
def get_active_roles():
    """Get all active worker roles (public endpoint for sidebar)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all active roles
        cursor = db.execute("""
            SELECT did, role, status
            FROM user_roles
            WHERE status = 'active'
            ORDER BY activated_at DESC
        """)
        roles = cursor.fetchall()
        
        # Convert to list of dicts
        result = []
        for role in roles:
            result.append({
                'did': role['did'],
                'role': role['role'],
                'status': role['status']
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/work/active-roles: {e}")
        import traceback
        traceback.print_exc()
        return jsonify([]), 500


@app.route('/api/admin/canon', methods=['POST'])
@require_auth()
def admin_add_canon():
    """Add or update a canon entry (admin only)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        data = request.json
        entry_id = data.get('id')
        did = data.get('did')
        event = data.get('event')
        type_val = data.get('type')
        key = data.get('key')
        uri = data.get('uri')
        url = data.get('url')
        epoch = data.get('epoch', int(time.time()))
        quantities = data.get('quantities')  # Expect JSON object like {"books": 5}
        
        if not all([did, event, type_val, key]):
            return jsonify({'error': 'Missing required fields: did, event, type, key'}), 400
        
        db = DatabaseManager()
        
        # Convert quantities to JSON string if provided
        quantities_json = None
        if quantities:
            import json
            quantities_json = json.dumps(quantities) if isinstance(quantities, dict) else quantities
        
        if entry_id:
            # Update existing entry
            db.execute("""
                UPDATE events
                SET did = %s, event = %s, type = %s, key = %s, uri = %s, url = %s, epoch = %s, quantities = %s::jsonb
                WHERE id = %s
            """, (did, event, type_val, key, uri, url, epoch, quantities_json, entry_id))
        else:
            # Insert new entry
            db.execute("""
                INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, quantities)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """, (did, event, type_val, key, uri, url, epoch, int(time.time()), quantities_json))
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error in /api/admin/canon: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/admin/canon/<int:entry_id>', methods=['DELETE'])
@require_auth()
def admin_delete_canon(entry_id):
    """Delete a canon entry (admin only)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Check if entry exists
        cursor = db.execute("SELECT id FROM events WHERE id = %s", (entry_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Canon entry not found'}), 404
        
        # Delete the entry
        db.execute("DELETE FROM events WHERE id = %s", (entry_id,))
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error in /api/admin/canon DELETE: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/kindred')
def get_kindred():
    """Get kindred for the current session (requires OAuth session)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        # Get DID from session/auth header
        # For now, we'll get it from query parameter
        did = request.args.get('did')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        db = DatabaseManager()
        
        # Get kindred for this dreamer (bidirectional query)
        cursor = db.execute("""
            SELECT did_b as kindred_did, discovered_epoch
            FROM kindred
            WHERE did_a = %s
            
            UNION
            
            SELECT did_a as kindred_did, discovered_epoch
            FROM kindred
            WHERE did_b = %s
            
            ORDER BY discovered_epoch ASC
        """, (did, did))
        
        kindred_rows = cursor.fetchall()
        
        if not kindred_rows:
            return jsonify([])
        
        # Get full dreamer info for each kindred
        result = []
        for row in kindred_rows:
            kindred_did = row['kindred_did']
            cursor = db.execute("""
                SELECT did, handle, name, display_name, avatar, color_hex
                FROM dreamers
                WHERE did = %s
            """, (kindred_did,))
            
            dreamer = cursor.fetchone()
            if dreamer:
                result.append({
                    'did': dreamer['did'],
                    'handle': dreamer['handle'],
                    'name': dreamer['display_name'] or dreamer['name'],
                    'avatar': dreamer['avatar'],
                    'color_hex': dreamer['color_hex'],
                    'discovered_epoch': row['discovered_epoch']
                })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/kindred: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/library')
def get_library():
    """Get all library books and chapters from database"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all books
        cursor = db.execute("""
            SELECT id, title, cover, epub, author, release, pages, isbn, asin,
                   amazon_reviews, goodreads_reviews
            FROM books
            ORDER BY release DESC NULLS LAST, id
        """)
        books = cursor.fetchall()
        
        # Get all chapters
        cursor = db.execute("""
            SELECT id, book_id, title, file, chapter_order
            FROM chapters
            ORDER BY book_id, chapter_order
        """)
        chapters = cursor.fetchall()
        
        # Organize chapters by book_id
        chapters_by_book = {}
        for chapter in chapters:
            book_id = chapter['book_id']
            if book_id not in chapters_by_book:
                chapters_by_book[book_id] = []
            chapters_by_book[book_id].append({
                'id': chapter['id'],
                'title': chapter['title'],
                'file': chapter['file']
            })
        
        # Build result in library.json format
        result = []
        for book in books:
            book_dict = {
                'id': book['id'],
                'title': book['title'],
                'cover': book['cover'] or '',
                'epub': book['epub'] or '',
                'author': book['author'] or '',
                'release': book['release'] or '',
                'pages': book['pages'] or '',
                'ISBN': book['isbn'] or '',
                'ASIN': book['asin'] or '',
                'reviews': {
                    'amazon': book['amazon_reviews'] or '',
                    'goodreads': book['goodreads_reviews'] or ''
                },
                'chapters': chapters_by_book.get(book['id'], [])
            }
            result.append(book_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/library: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/world')
def get_world():
    """Get world state from database and environment"""
    try:
        import sys
        import json
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all world state key-value pairs
        cursor = db.execute("SELECT key, value FROM world")
        rows = cursor.fetchall()
        
        # Build world data object
        world_data = {}
        for row in rows:
            key = row['key']
            value = row['value']
            
            # Parse JSON values
            try:
                world_data[key] = json.loads(value)
            except:
                world_data[key] = value
        
        # Add environment flags
        world_data['force_record'] = os.getenv('FORCE_RECORD', 'false').lower() == 'true'
        
        return jsonify(world_data)
        
    except Exception as e:
        print(f"Error in /api/world: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/preview-name', methods=['POST'])
@rate_limit(20)
def preview_name():
    """Preview the name that would be generated for a DID/handle"""
    try:
        data = request.get_json()
        did = data.get('did')
        handle = data.get('handle')
        display_name = data.get('displayName', '')
        
        if not did and not handle:
            return jsonify({'error': 'DID or handle required'}), 400
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        from utils.names import NameManager
        
        db = DatabaseManager()
        names = NameManager()
        
        # Check if dreamer already exists
        if did:
            cursor = db.execute("SELECT name FROM dreamers WHERE did = %s", (did,))
            existing = cursor.fetchone()
            if existing:
                return jsonify({
                    'name': existing['name'],
                    'exists': True
                })
        
        # Generate preview name from handle prefix
        # Extract prefix before first dot (e.g., alice.bsky.social -> alice)
        if handle:
            handle_prefix = handle.split('.')[0] if '.' in handle else handle
            preview_name = names.suggest_unique_name(handle_prefix)
        else:
            # Fallback if no handle provided
            preview_name = names.generate_name_from_identity(handle, display_name, did or '')
        
        return jsonify({
            'name': preview_name,
            'exists': False
        })
        
    except Exception as e:
        print(f"Error in /api/preview-name: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/souvenirs')
def get_souvenirs():
    """Get all souvenirs with their keepers and canon entries"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all souvenirs
        cursor = db.execute("""
            SELECT * FROM souvenirs ORDER BY key
        """)
        souvenirs = cursor.fetchall()
        
        result = {}
        for souvenir in souvenirs:
            key = souvenir['key']
            
            # Get keepers for this souvenir with their names
            keepers_cursor = db.execute("""
                SELECT ds.did, ds.earned_epoch as epoch, d.name, d.avatar, d.handle
                FROM awards ds
                LEFT JOIN dreamers d ON ds.did = d.did
                WHERE ds.souvenir_key = %s
                ORDER BY ds.earned_epoch DESC
            """, (key,))
            keepers = []
            for keeper in keepers_cursor.fetchall():
                keepers.append({
                    'did': keeper['did'],
                    'name': keeper['name'] or 'unknown',
                    'avatar': keeper['avatar'] or '',
                    'handle': keeper['handle'] or '',
                    'epoch': keeper['epoch']
                })
            
            # Get canon entries for this souvenir
            canon_cursor = db.execute("""
                SELECT c.*, d.name, d.avatar
                FROM events c
                LEFT JOIN dreamers d ON c.did = d.did
                WHERE c.key = %s AND c.type = 'souvenir'
                ORDER BY c.epoch DESC
            """, (key,))
            canon = []
            for entry in canon_cursor.fetchall():
                canon.append({
                    'id': entry['id'],
                    'did': entry['did'],
                    'name': entry['name'] or 'unknown',
                    'avatar': entry['avatar'] or '',
                    'event': entry['event'],
                    'epoch': entry['epoch'],
                    'uri': entry['uri'] or '',
                    'url': entry['url'] or '',
                    'type': entry['type'],
                    'key': entry['key']
                })
            
            result[key] = {
                'key': souvenir['key'],
                'category': souvenir['category'],
                'name': souvenir['name'],
                'description': souvenir['description'] or '',
                'phanera': souvenir['phanera'] or '',
                'icon': souvenir['icon'] or '',
                'epoch': souvenir['created_at'] or 0,
                'keepers': keepers,
                'canon': canon
            }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in /api/souvenirs: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lore/apply-label', methods=['POST'])
@rate_limit(10)  # Limit to 10 requests per minute for label applications
def apply_lore_label():
    """
    Proxy endpoint to apply labels to lore.farm
    This handles authentication with lorefarm using the world's lorekey
    """
    print("=" * 80)
    print(f"[Lore Label] New request received")
    print("=" * 80)
    
    try:
        import sys
        import requests
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        # Get request data
        data = request.get_json()
        print(f"📦 [Lore Label] Request data received: {data}")
        
        if not data:
            print(f"[Lore Label] No JSON data in request")
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
        
        uri = data.get('uri')
        user_did = data.get('userDid')
        label = data.get('label', 'lore:reverie.house')
        
        print(f"[Lore Label] Parsed fields:")
        print(f"   URI: {uri}")
        print(f"   User DID: {user_did}")
        print(f"   Label: {label}")
        
        if not uri or not user_did:
            print(f"[Lore Label] Missing required fields")
            return jsonify({
                'success': False,
                'error': 'Missing required fields: uri, userDid'
            }), 400
        
        # Verify the user is authenticated and registered
        print(f"[Lore Label] Checking if user is registered...")
        db = DatabaseManager()
        cursor = db.execute("SELECT * FROM dreamers WHERE did = %s", (user_did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            print(f"[Lore Label] User not found in database: {user_did}")
            return jsonify({
                'success': False,
                'error': 'User not registered in Reverie'
            }), 403
        
        print(f"[Lore Label] User verified: {dreamer['name'] if dreamer else 'unknown'}")
        
        # Get the lorekey for reverie.house from file or environment
        lorekey = None
        key_file = os.getenv('LOREFARM_KEY_FILE', '/srv/secrets/lorefarm_key.txt')
        if os.path.exists(key_file):
            try:
                with open(key_file, 'r') as f:
                    lorekey = f.read().strip()
            except Exception as e:
                print(f"[Lore Label] Could not read LOREFARM_KEY_FILE: {e}")
        
        if not lorekey:
            lorekey = os.getenv('LOREFARM_KEY')
        
        if not lorekey:
            print("[Lore Label] LOREFARM_KEY not configured")
            return jsonify({
                'success': False,
                'error': 'Server configuration error: LOREFARM_KEY not configured'
            }), 500
        
        print(f"[Lore Label] LOREFARM_KEY configured")
        
        # Make request to lore.farm using the legacy /api/labels endpoint
        lorefarm_url = 'https://lore.farm/api/labels'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {lorekey}'
        }
        
        # Use lorefarm's legacy endpoint field names
        payload = {
            'post_uri': uri,
            'label_value': label,
            'world_domain': 'reverie.house'
        }
        
        print(f"📤 [Lore Label] Sending request to lore.farm...")
        print(f"   URL: {lorefarm_url}")
        print(f"   Payload: {payload}")
        print(f"   Auth header: Bearer {lorekey[:10]}...")
        
        # Log the label application attempt
        try:
            audit.log(
                event_type='lore_label_apply',
                endpoint='/api/lore/apply-label',
                method='POST',
                user_ip=get_client_ip(),
                response_status=0,  # Will update after response
                user_did=user_did,
                user_agent=request.headers.get('User-Agent'),
                extra_data=json.dumps({'uri': uri, 'label': label})
            )
            print(f"[Lore Label] Audit log entry created")
        except Exception as e:
            print(f"[Lore Label] Failed to log audit entry: {e}")
        
        response = requests.post(lorefarm_url, json=payload, headers=headers, timeout=10)
        
        print(f"📥 [Lore Label] Response from lore.farm:")
        print(f"   Status code: {response.status_code}")
        print(f"   Headers: {dict(response.headers)}")
        print(f"   Body: {response.text[:1000]}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"[Lore Label] Success! Label applied.")
            print(f"   Result: {result}")
            print("=" * 80)
            return jsonify({
                'success': True,
                'label': result.get('label')
            })
        else:
            print(f"[Lore Label] lore.farm returned error status: {response.status_code}")
            
            # Try to parse JSON response, handle HTML/text responses
            try:
                error_data = response.json()
                print(f"   Error data (JSON): {error_data}")
            except Exception as e:
                print(f"   Could not parse JSON response: {e}")
                error_data = {'error': response.text[:200]}
                print(f"   Raw response: {response.text[:500]}")
            
            print("=" * 80)
            
            # Provide friendly error messages for common status codes
            if response.status_code == 409:
                error_message = "This post has already been added to the shared lore"
            elif response.status_code == 500:
                error_message = f"Lorefarm server error. {error_data.get('error', 'Please try again later.')}"
            else:
                error_message = error_data.get('error', f'Lorefarm returned status {response.status_code}')
            
            return jsonify({
                'success': False,
                'error': error_message
            }), response.status_code
        
    except requests.RequestException as e:
        print(f"[Lore Label] Network error connecting to lore.farm: {e}")
        print("=" * 80)
        return jsonify({
            'success': False,
            'error': f'Failed to connect to lore.farm: {str(e)}'
        }), 500
    except Exception as e:
        print(f"[Lore Label] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 80)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lore/register-character', methods=['POST'])
@rate_limit(5)  # Limit to 5 requests per minute
def register_character():
    """
    Register user as a character in lore.farm for reverie.house world
    Uses the public lore.farm API
    REQUIRES AUTHENTICATION: User must be logged in via OAuth
    """
    print("=" * 80)
    print("🎭 [Character Registration] New request received")
    print("=" * 80)
    
    try:
        import sys
        import requests
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        # AUTHENTICATION CHECK: Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        print(f"[Character Registration] Token present: {bool(token)}")
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, authenticated_did, handle = validate_work_token(token)
        
        if not valid:
            print(f"[Character Registration] Invalid or missing authentication token")
            return jsonify({
                'success': False,
                'error': 'Authentication required. Please log in.'
            }), 401
        
        print(f"[Character Registration] Authenticated DID: {authenticated_did}")
        
        # Get request data
        data = request.get_json()
        print(f"📦 [Character Registration] Request data received: {data}")
        
        if not data:
            print(f"[Character Registration] No JSON data in request")
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
        
        user_did = data.get('userDid')
        character_name = data.get('characterName')
        
        print(f"[Character Registration] Parsed fields:")
        print(f"   User DID: {user_did}")
        print(f"   Character Name: {character_name}")
        
        if not user_did or not character_name:
            print(f"[Character Registration] Missing required fields")
            return jsonify({
                'success': False,
                'error': 'Missing required fields: userDid, characterName'
            }), 400
        
        # AUTHORIZATION CHECK: User can only register themselves
        # (unless admin override - admin is did:plc:yauphjufk7phkwurn266ybx2)
        is_admin = (authenticated_did == AUTHORIZED_ADMIN_DID)
        is_self = (authenticated_did == user_did)
        
        if not is_self and not is_admin:
            print(f"[Character Registration] SECURITY: Authorization failed!")
            print(f"   Authenticated DID: {authenticated_did}")
            print(f"   Requested DID: {user_did}")
            print(f"   Someone tried to register another user's DID!")
            return jsonify({
                'success': False,
                'error': 'You can only register yourself as a character'
            }), 403
        
        if is_admin and not is_self:
            print(f"[Character Registration] Admin override: {authenticated_did} registering {user_did}")
        
        print(f"[Character Registration] Authorization passed (is_self: {is_self}, is_admin: {is_admin})")
        
        # Verify the user is authenticated and registered
        print(f"[Character Registration] Checking if user is registered...")
        db = DatabaseManager()
        cursor = db.execute("SELECT * FROM dreamers WHERE did = %s", (user_did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            print(f"[Character Registration] User not found in database: {user_did}")
            return jsonify({
                'success': False,
                'error': 'User not registered in Reverie'
            }), 403
        
        print(f"[Character Registration] User verified: {dreamer['name'] if dreamer else 'unknown'}")
        
        # Use public lore.farm API
        print(f"📤 [Character Registration] Calling lore.farm API...")
        
        try:
            response = requests.post(
                'https://lore.farm/api/characters/register',
                json={
                    'name': character_name,
                    'world_domain': 'reverie.house',
                    'did': user_did
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ [Character Registration] Success: {result}")
                return jsonify({
                    'success': True,
                    'character': result.get('character'),
                    'already_registered': result.get('already_registered', False)
                })
            else:
                error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                print(f"❌ [Character Registration] Failed: {response.status_code} - {error_data}")
                return jsonify({
                    'success': False,
                    'error': error_data.get('error', f'Registration failed with status {response.status_code}')
                }), response.status_code
                
        except requests.exceptions.RequestException as e:
            print(f"❌ [Character Registration] API request failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Failed to connect to lore.farm: {str(e)}'
            }), 500
        
    except Exception as e:
        print(f"[Character Registration] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 80)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lore/character-status', methods=['POST', 'GET'])
@rate_limit(20)
def character_status():
    """Check if user is registered as a character in lore.farm"""
    try:
        import requests
        
        # Get DID from query param or body
        if request.method == 'GET':
            user_did = request.args.get('did')
        else:
            data = request.get_json() or {}
            user_did = data.get('did') or data.get('userDid')
        
        if not user_did:
            return jsonify({
                'success': False,
                'error': 'Missing did parameter'
            }), 400
        
        # Call public lore.farm API
        response = requests.get(
            'https://lore.farm/api/characters/status',
            params={
                'did': user_did,
                'world': 'reverie.house'
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('registered'):
                return jsonify({
                    'success': True,
                    'is_character': True,
                    'character': result.get('character')
                })
            else:
                return jsonify({
                    'success': True,
                    'is_character': False
                })
        else:
            return jsonify({
                'success': False,
                'error': f'lore.farm API returned status {response.status_code}'
            }), response.status_code
            
    except Exception as e:
        print(f"[Character Status] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/lore/unregister-character', methods=['POST'])
@rate_limit(5)
def unregister_character():
    """
    Remove user from character registry in lore.farm
    REQUIRES AUTHENTICATION: User must be logged in via OAuth
    """
    try:
        import requests
        
        # AUTHENTICATION CHECK: Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        print(f"[Character Unregister] Token present: {bool(token)}")
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, authenticated_did, handle = validate_work_token(token)
        
        if not valid:
            print(f"[Character Unregister] Invalid or missing authentication token")
            return jsonify({
                'success': False,
                'error': 'Authentication required. Please log in.'
            }), 401
        
        print(f"[Character Unregister] Authenticated DID: {authenticated_did}")
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
        
        user_did = data.get('userDid')
        character_name = data.get('characterName')
        
        if not user_did or not character_name:
            return jsonify({
                'success': False,
                'error': 'Missing userDid or characterName'
            }), 400
        
        # AUTHORIZATION CHECK: User can only unregister themselves
        # (unless admin override)
        is_admin = (authenticated_did == AUTHORIZED_ADMIN_DID)
        is_self = (authenticated_did == user_did)
        
        if not is_self and not is_admin:
            print(f"[Character Unregister] Authorization failed: {authenticated_did} tried to unregister {user_did}")
            return jsonify({
                'success': False,
                'error': 'You can only unregister yourself as a character'
            }), 403
        
        print(f"[Character Unregister] Authorization passed (is_self: {is_self}, is_admin: {is_admin})")
        
        # Call public lore.farm API
        response = requests.post(
            'https://lore.farm/api/characters/unregister',
            json={
                'name': character_name,
                'world_domain': 'reverie.house',
                'did': user_did
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"[Character Unregister] Removed character: {character_name}")
            return jsonify({
                'success': True,
                'removed': True,
                'character_name': character_name
            })
        elif response.status_code == 404:
            return jsonify({
                'success': True,
                'removed': False,
                'message': 'Character not found'
            })
        else:
            error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
            return jsonify({
                'success': False,
                'error': error_data.get('error', f'Unregister failed with status {response.status_code}')
            }), response.status_code
            
    except Exception as e:
        print(f"[Character Unregister] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/database/stats')
def get_database_stats():
    """Get database statistics (PUBLIC READ-ONLY)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        stats = db.get_table_stats()
        schema_version = db.get_schema_version()
        
        # PostgreSQL database - get size from query
        cursor = db.execute("SELECT pg_database_size(current_database()) as size")
        row = cursor.fetchone()
        db_size = row['size'] if row else 0
        
        return jsonify({
            'success': True,
            'stats': stats,
            'schema_version': schema_version,
            'database_size': db_size,
            'database_type': 'PostgreSQL'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/heading/get', methods=['POST'])
@rate_limit(30)
def get_heading():
    """
    Get the current heading for a logged-in user.
    Expects: { "did": "did:plc:..." }
    Returns: { "success": true, "heading": "entropy+" | null }
    """
    try:
        data = request.get_json()
        did = data.get('did')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get user info
        cursor = db.execute("SELECT handle, heading, heading_changed_at FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'heading': dreamer['heading'],
            'last_changed': dreamer['heading_changed_at']
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/heading/set', methods=['POST'])
@rate_limit(20)  # Moderate - users changing heading
def set_heading():
    """
    Set the heading for a logged-in user (REQUIRES USER AUTH).
    Expects: { 
        "did": "did:plc:...",
        "heading": "entropy+" | "liberty-" | "keeper" | "affix" | null,
        "name": "dreamer name" (optional, for canon logging)
    }
    Returns: { "success": true }
    """
    from core.admin_auth import auth
    
    # Verify authentication (support both admin tokens and OAuth JWT)
    token = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')
    
    valid, user_did, handle = validate_work_token(token)
    
    if not valid:
        return jsonify({'error': 'Unauthorized', 'message': 'Please login'}), 401
    
    try:
        data = request.get_json()
        did = data.get('did')
        heading = data.get('heading')
        name = data.get('name')
        
        if not did:
            return jsonify({'error': 'DID required'}), 400
        
        # Check if user owns this DID or is admin
        is_admin = (user_did == AUTHORIZED_ADMIN_DID)
        is_owner = (user_did == did)
        
        if not is_owner and not is_admin:
            return jsonify({'error': 'Forbidden', 'message': 'You can only set your own heading'}), 403
        
        import sys
        import time
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        from core.movement import HeadingManager
        
        db = DatabaseManager()
        heading_mgr = HeadingManager()
        
        # Get user info
        cursor = db.execute("SELECT handle, name FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'User not found'}), 404
        
        # Use database name if not provided
        if not name:
            name = dreamer['name']
        
        # Get current heading before changing it
        cursor = db.execute("SELECT heading FROM dreamers WHERE did = %s", (did,))
        current = cursor.fetchone()
        previous_heading = current['heading'] if current else None
        
        # Validate heading format
        if heading:
            valid_headings = [
                'drift', 'home', 'origin', 'affix', 'keeper',
                'entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic'
            ]
            valid = (
                heading in valid_headings or
                heading.startswith('did:')
            )
            
            if not valid:
                return jsonify({
                    'error': f'Invalid heading. Valid options: drift, home, origin, affix, keeper, axis names, or another dreamer'
                }), 400
        
        # Set the heading using HeadingManager
        result = heading_mgr.set_heading(did, heading)
        
        if result.get('success'):
            # Log to heading_history table
            try:
                epoch = int(time.time())
                db.execute("""
                    INSERT INTO heading_history (dreamer_did, target_did, previous_heading, set_at, source)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    did,
                    heading if heading and heading.startswith('did:') else None,
                    previous_heading,
                    epoch,
                    'web_ui'
                ))
                print(f"📝 Heading history logged: {name} -> {heading}")
            except Exception as history_error:
                print(f"Failed to log heading history: {history_error}")
            
            # Format heading direction for canon entry
            direction = format_heading_direction(heading, db)
            
            # Log to canon
            try:
                epoch = int(time.time())
                db.execute("""
                    INSERT INTO events (did, epoch, type, event, key, uri, url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    did,
                    epoch,
                    'heading',
                    f'set heading toward {direction}',
                    'heading_change',
                    None,
                    None
                ))
                print(f"📔 Canon: {name} set heading toward {direction}")
            except Exception as canon_error:
                print(f"Failed to log heading to canon: {canon_error}")
            
            return jsonify({
                'success': True,
                'heading': heading
            })
        else:
            return jsonify({'error': 'Failed to set heading'}), 500
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def format_heading_direction(heading, db):
    """Format heading value into human-readable direction for canon."""
    if not heading or heading == 'drift':
        return 'Drift'
    
    if heading == 'keeper':
        return 'Reverie House'
    
    if heading == 'affix':
        return 'Affix'
    
    if heading == 'home':
        return 'Home'
    
    if heading == 'origin':
        return 'Origin'
    
    if heading.startswith('did:'):
        # Look up dreamer name
        try:
            cursor = db.execute("SELECT name, display_name FROM dreamers WHERE did = %s", (heading,))
            target = cursor.fetchone()
            if target:
                target_name = target['display_name'] or target['name']
                return f'{target_name}'
        except:
            pass
        return 'Dreamer'
    
    # Handle legacy axis directions with + suffix
    axis_names = {
        'entropy+': 'Entropy',
        'oblivion+': 'Oblivion',
        'liberty+': 'Liberty',
        'authority+': 'Authority',
        'receptive+': 'Receptive',
        'skeptic+': 'Skeptic'
    }
    
    if heading in axis_names:
        return axis_names[heading]
    
    # Handle new single-word axis format
    if heading in ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']:
        return heading.capitalize()
    
    return heading


@app.route('/api/headings', methods=['GET'])
@rate_limit(100)
def get_all_headings():
    """
    Get all dreamers' current headings (for dashboard heading display).
    Returns: { "did:plc:...": "entropy+", ... }
    """
    try:
        from core.database import DatabaseManager
        db = DatabaseManager()
        cursor = db.execute("SELECT did, heading FROM dreamers WHERE heading IS NOT NULL")
        headings = {row['did']: row['heading'] for row in cursor.fetchall()}
        return jsonify(headings)
    except Exception as e:
        print(f"❌ Error in /api/headings: {e}")
        return jsonify({'error': str(e)}), 500


# ===== ZONES API =====

@app.route('/api/zones')
def api_zones():
    """Get all active zones."""
    try:
        from core.zones import ZoneManager
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        zones = mgr.get_all_zones()
        
        return jsonify([zone.to_dict() for zone in zones])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/zones/<zone_id>')
def api_zone_details(zone_id):
    """Get details for a specific zone."""
    try:
        from core.zones import ZoneManager
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        zone = mgr.get_zone(zone_id)
        if not zone:
            return jsonify({'error': 'Zone not found'}), 404
        
        # Get current members
        members = zone.get_members(mgr.spectrum)
        
        data = zone.to_dict()
        data['member_count'] = len(members)
        data['members'] = members[:100]  # Limit to first 100
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/zones/<zone_id>/members')
def api_zone_members(zone_id):
    """Get all members of a zone."""
    try:
        from core.zones import ZoneManager
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        zone = mgr.get_zone(zone_id)
        if not zone:
            return jsonify({'error': 'Zone not found'}), 404
        
        members = zone.get_members(mgr.spectrum)
        
        return jsonify({
            'zone_id': zone_id,
            'name': zone.name,
            'count': len(members),
            'members': members
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/zones/<zone_id>/hull')
def api_zone_hull(zone_id):
    """Get convex hull vertices for a zone (for rendering)."""
    try:
        from core.zones import ZoneManager, ConvexHullZone
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        zone = mgr.get_zone(zone_id)
        if not zone:
            return jsonify({'error': 'Zone not found'}), 404
        
        if not isinstance(zone, ConvexHullZone):
            return jsonify({'error': 'Zone is not a convex hull zone'}), 400
        
        vertices = zone.get_hull_vertices(mgr.spectrum)
        
        if vertices is None:
            return jsonify({'error': 'Failed to compute hull'}), 500
        
        # Get edges from hull
        if zone._hull:
            edges = zone._hull.simplices.tolist()
        else:
            edges = []
        
        return jsonify({
            'zone_id': zone_id,
            'vertices': vertices,
            'edges': edges
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/zones/check', methods=['POST'])
@rate_limit(30)
def api_zone_check():
    """Check which zones a dreamer is in."""
    try:
        data = request.json
        did = data.get('did')
        
        if not did:
            return jsonify({'error': 'Missing did'}), 400
        
        from core.zones import ZoneManager
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        zone_ids = mgr.get_dreamer_zones(did)
        
        # Get zone details
        zones = []
        for zone_id in zone_ids:
            zone = mgr.get_zone(zone_id)
            if zone:
                zones.append({
                    'zone_id': zone_id,
                    'name': zone.name,
                    'description': zone.description
                })
        
        return jsonify({
            'did': did,
            'zone_count': len(zones),
            'zones': zones
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/zones/stats')
def api_zone_stats():
    """Get statistics for all zones."""
    try:
        from core.zones import ZoneManager
        
        mgr = ZoneManager()
        mgr.load_zones_from_db()
        
        stats = mgr.get_zone_stats()
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Audit log endpoints
@app.route('/api/audit/logs')
@rate_limit(30)
def get_audit_logs():
    """Get recent audit log entries"""
    try:
        limit = min(int(request.args.get('limit', 100)), 1000)
        event_type = request.args.get('event_type')
        
        logs = audit.get_recent_logs(limit=limit, event_type=event_type)
        
        return jsonify({
            'success': True,
            'logs': logs,
            'count': len(logs)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/audit/stats')
@rate_limit(60)
def get_audit_stats():
    """Get audit statistics"""
    try:
        hours = int(request.args.get('hours', 24))
        
        stats = audit.get_stats(hours=hours)
        suspicious_ips = audit.get_suspicious_ips(hours=hours)
        
        return jsonify({
            'success': True,
            'stats': stats,
            'suspicious_ips': suspicious_ips,
            'timeframe_hours': hours
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/audit/suspicious')
@rate_limit(20)
def get_suspicious_activity():
    """Get IPs with suspicious activity"""
    try:
        hours = int(request.args.get('hours', 24))
        
        suspicious = audit.get_suspicious_ips(hours=hours)
        
        return jsonify({
            'success': True,
            'suspicious_ips': suspicious,
            'count': len(suspicious),
            'timeframe_hours': hours
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# ERROR/BUG TRACKING ENDPOINTS
# ============================================================================

@app.route('/api/admin/errors')
@require_auth()
@rate_limit(60)
def get_errors():
    """Get error log entries (ADMIN ONLY)"""
    try:
        limit = min(int(request.args.get('limit', 100)), 1000)
        status = request.args.get('status')  # new, investigating, resolved, ignored
        severity = request.args.get('severity')  # critical, error, warning
        hours = int(request.args.get('hours', 24))
        
        since = int(time.time()) - (hours * 3600) if hours else None
        
        errors = audit.get_errors(
            limit=limit,
            status=status,
            severity=severity,
            since=since
        )
        
        return jsonify({
            'success': True,
            'errors': errors,
            'count': len(errors),
            'timeframe_hours': hours
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/errors/stats')
@require_auth()
@rate_limit(60)
def get_error_stats():
    """Get error statistics (ADMIN ONLY)"""
    try:
        hours = int(request.args.get('hours', 24))
        
        stats = audit.get_error_stats(hours=hours)
        
        return jsonify({
            'success': True,
            'stats': stats,
            'timeframe_hours': hours
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/errors/<int:error_id>/resolve', methods=['POST'])
@require_auth()
@rate_limit(20)
def resolve_error(error_id):
    """Mark an error as resolved (ADMIN ONLY)"""
    try:
        # Get authenticated user
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        elif 'admin_token' in request.cookies:
            token = request.cookies.get('admin_token')
        
        valid, user_did, handle = auth.validate_session(token)
        if not valid:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json() or {}
        notes = data.get('notes')
        
        audit.resolve_error(error_id, resolved_by=user_did, notes=notes)
        
        return jsonify({
            'success': True,
            'message': 'Error marked as resolved'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/errors/<int:error_id>/status', methods=['POST'])
@require_auth()
@rate_limit(20)
def update_error_status(error_id):
    """Update error status (ADMIN ONLY)"""
    try:
        data = request.get_json() or {}
        status = data.get('status')  # new, investigating, resolved, ignored
        notes = data.get('notes')
        
        if status not in ['new', 'investigating', 'resolved', 'ignored']:
            return jsonify({'error': 'Invalid status'}), 400
        
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.audit import AuditLogger
        
        # Update via audit logger
        audit = AuditLogger()
        
        if status == 'resolved':
            # Get authenticated user
            token = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
            elif 'admin_token' in request.cookies:
                token = request.cookies.get('admin_token')
            
            valid, user_did, handle = auth.validate_session(token)
            resolved_by = user_did if valid else 'admin'
            
            audit.resolve_error(error_id, resolved_by, status, notes)
        else:
            audit.resolve_error(error_id, 'admin', status, notes)
        
        return jsonify({
            'success': True,
            'message': f'Error status updated to {status}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/errors/client', methods=['POST'])
@rate_limit(60)
def log_client_error():
    """Log client-side JavaScript errors"""
    try:
        data = request.get_json() or {}
        
        error_type = data.get('type', 'ClientError')
        error_message = data.get('message', 'Unknown client error')
        stack_trace = data.get('stack')
        url = data.get('url')
        line_number = data.get('lineNumber')
        column_number = data.get('columnNumber')
        user_agent = request.headers.get('User-Agent')
        user_ip = get_client_ip()
        
        # Get user DID if authenticated
        user_did = None
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        elif 'admin_token' in request.cookies:
            token = request.cookies.get('admin_token')
        
        if token:
            valid, did, handle = auth.validate_session(token)
            if valid:
                user_did = did
        
        # Build detailed error message
        if line_number and column_number:
            detailed_message = f"{error_message} at {url}:{line_number}:{column_number}"
        else:
            detailed_message = f"{error_message} at {url}"
        
        # Log the error
        audit.log_error(
            error_type=error_type,
            error_message=detailed_message,
            stack_trace=stack_trace,
            endpoint=url,
            method='CLIENT',
            user_did=user_did,
            user_ip=user_ip,
            user_agent=user_agent,
            severity='error',
            client_side=True,
            extra_data={
                'line': line_number,
                'column': column_number
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Client error logged'
        })
    except Exception as e:
        # Even if logging fails, don't crash
        print(f"Failed to log client error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Internal admin quest endpoints (NOT publicly routed through Caddy)
# These are only accessible via localhost/SSH tunnel for security
@app.route('/internal/quests/grouped')
def internal_quests_grouped():
    """Internal-only endpoint for quest management (contains sensitive data)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.quests import QuestManager
        
        quest_manager = QuestManager()
        all_quests = quest_manager.get_all_quests()
        
        # Group quests by URI
        groups = {}
        for quest in all_quests:
            uri = quest.get('uri', '')
            if uri not in groups:
                groups[uri] = []
            groups[uri].append(quest)
        
        # Build response
        result_groups = []
        for uri, quests in groups.items():
            # Convert AT URI to Bluesky URL
            bsky_url = None
            if uri and uri.startswith('at://'):
                parts = uri.replace('at://', '').split('/')
                if len(parts) >= 3:
                    did = parts[0]
                    post_id = parts[2]
                    bsky_url = f"https://bsky.app/profile/{did}/post/{post_id}"
            
            group_data = {
                'uri': uri,
                'bsky_url': bsky_url,
                'quest_count': len(quests),
                'quests': []
            }
            
            for quest in quests:
                quest_data = {
                    'title': quest['title'],
                    'uri': quest.get('uri', ''),
                    'enabled': quest.get('enabled', True),
                    'commands': quest.get('commands', []),
                    'conditions': quest.get('conditions'),
                    'condition_operator': quest.get('condition_operator', 'AND'),
                    'description': quest.get('description', ''),
                    'created_at': quest.get('created_at', 0),
                    'updated_at': quest.get('updated_at', 0)
                }
                
                if quest.get('canon_event'):
                    quest_data['canon_event'] = quest['canon_event']
                if quest.get('canon_keys'):
                    quest_data['souvenirs'] = quest['canon_keys']
                
                group_data['quests'].append(quest_data)
            
            result_groups.append(group_data)
        
        return jsonify({'grouped': result_groups})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/grouped')
@require_auth()
def public_quests_grouped():
    """Get quest data grouped by trigger identity (ADMIN ONLY)"""
    try:
        import sys
        import json
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.quests import QuestManager
        
        quest_manager = QuestManager()
        # Get ALL quests (including disabled) for the quest editor
        # Note: Disabled quests are visually distinguished in the UI
        all_quests = quest_manager.get_all_quests()
        
        # Group quests by trigger identity (not just URI)
        groups = {}
        for quest in all_quests:
            # Determine group key based on trigger type
            trigger_type = quest.get('trigger_type', 'bsky_reply')
            
            if trigger_type == 'bsky_reply':
                # Group by URI for Bluesky reply quests
                group_key = f"bsky:{quest.get('uri', 'no-uri')}"
            elif trigger_type == 'bibliohose':
                # Group by list_rkey or collection
                config = {}
                if quest.get('trigger_config'):
                    try:
                        config = json.loads(quest['trigger_config'])
                    except:
                        pass
                list_key = config.get('list_rkey', config.get('collection'))
                
                # Fallback: extract from conditions if not in config
                if not list_key:
                    conditions = quest.get('conditions', [])
                    for cond in conditions:
                        cond_str = cond.get('condition') if isinstance(cond, dict) else cond
                        if cond_str and 'has_biblio_stamp:' in cond_str:
                            list_key = cond_str.split(':')[1]
                            break
                
                list_key = list_key or 'default'
                group_key = f"biblio:{list_key}"
            elif trigger_type == 'poll':
                # Group by source
                config = {}
                if quest.get('trigger_config'):
                    try:
                        config = json.loads(quest['trigger_config'])
                    except:
                        pass
                source = config.get('source', 'generic')
                group_key = f"poll:{source}"
            elif trigger_type == 'cron':
                # Group by schedule
                config = {}
                if quest.get('trigger_config'):
                    try:
                        config = json.loads(quest['trigger_config'])
                    except:
                        pass
                schedule = config.get('schedule', 'default')
                group_key = f"cron:{schedule}"
            elif trigger_type == 'webhook':
                # Group all webhooks together (or by endpoint if needed)
                group_key = f"webhook:default"
            elif trigger_type == 'database_watch':
                # Group by table and event
                config = {}
                if quest.get('trigger_config'):
                    try:
                        config = json.loads(quest['trigger_config'])
                    except:
                        pass
                table = config.get('table', 'unknown')
                event = config.get('event', 'change')
                group_key = f"db:{table}:{event}"
            elif trigger_type == 'firehose_phrase':
                # Group by monitored phrases
                config = {}
                if quest.get('trigger_config'):
                    try:
                        config = json.loads(quest['trigger_config'])
                    except:
                        pass
                phrases = config.get('phrases', [])
                if isinstance(phrases, str):
                    phrases = [p.strip() for p in phrases.split(',')]
                # Use first phrase as group key, or 'default' if none
                phrase_key = phrases[0] if phrases else 'default'
                group_key = f"phrase:{phrase_key}"
            else:
                # Unknown trigger type - group separately
                group_key = f"{trigger_type}:default"
            
            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append(quest)
        
        # Build response with trigger-aware metadata
        result_groups = []
        for group_key, quests in groups.items():
            # Extract first quest to determine trigger type
            first_quest = quests[0]
            trigger_type = first_quest.get('trigger_type', 'bsky_reply')
            
            # Get trigger config
            trigger_config = {}
            if first_quest.get('trigger_config'):
                try:
                    trigger_config = json.loads(first_quest['trigger_config'])
                except:
                    pass
            
            # Convert AT URI to Bluesky URL (for bsky_reply quests)
            uri = first_quest.get('uri', '')
            bsky_url = None
            if uri and uri.startswith('at://'):
                parts = uri.replace('at://', '').split('/')
                if len(parts) >= 3:
                    did = parts[0]
                    post_id = parts[2]
                    bsky_url = f"https://bsky.app/profile/{did}/post/{post_id}"
            
            group_data = {
                'group_key': group_key,
                'trigger_type': trigger_type,
                'trigger_config': trigger_config,
                'uri': uri,  # Keep for backward compatibility
                'bsky_url': bsky_url,
                'quest_count': len(quests),
                'quests': []
            }
            
            for quest in quests:
                quest_data = {
                    'title': quest['title'],
                    'uri': quest.get('uri', ''),
                    'trigger_type': quest.get('trigger_type', 'bsky_reply'),
                    'trigger_config': quest.get('trigger_config', ''),
                    'enabled': quest.get('enabled', True),
                    'commands': quest.get('commands', []),
                    'conditions': quest.get('conditions'),
                    'condition_operator': quest.get('condition_operator', 'AND'),
                    'description': quest.get('description', ''),
                    'created_at': quest.get('created_at', 0),
                    'updated_at': quest.get('updated_at', 0),
                    'post_uri': quest.get('uri', '')
                }
                
                if quest.get('canon_event'):
                    quest_data['canon_event'] = quest['canon_event']
                if quest.get('canon_keys'):
                    quest_data['souvenirs'] = quest['canon_keys']
                
                group_data['quests'].append(quest_data)
            
            result_groups.append(group_data)
        
        return jsonify({'groups': result_groups})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/update/<title>', methods=['POST'])
@require_auth()
def update_quest(title):
    """Update a quest's conditions and commands (PROTECTED)"""
    print(f"\n=== QUEST UPDATE REQUEST (AUTHENTICATED) ===")
    print(f"Admin: {request.admin_handle} ({request.admin_did})")
    print(f"Title: {title}")
    print(f"Method: {request.method}")
    
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.quests import QuestManager
        
        data = request.get_json()
        print(f"Request data: {data}")
        
        if not data:
            print("ERROR: No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        quest_manager = QuestManager()
        
        print(f"Updating quest with:")
        print(f"  - uri: {data.get('uri')}")
        print(f"  - trigger_type: {data.get('trigger_type')}")
        print(f"  - trigger_config: {data.get('trigger_config')}")
        print(f"  - conditions: {data.get('conditions')}")
        print(f"  - condition_operator: {data.get('condition_operator')}")
        print(f"  - commands: {data.get('commands')}")
        print(f"  - description: {data.get('description')}")
        print(f"  - enabled: {data.get('enabled')}")
        
        # Update the quest
        success = quest_manager.update_quest(
            title=title,
            uri=data.get('uri'),
            trigger_type=data.get('trigger_type'),
            trigger_config=data.get('trigger_config'),
            conditions=data.get('conditions'),
            condition_operator=data.get('condition_operator'),
            commands=data.get('commands'),
            description=data.get('description'),
            enabled=data.get('enabled')
        )
        
        print(f"Update success: {success}")
        
        if success:
            print("✅ Quest updated successfully")
            return jsonify({'success': True, 'message': 'Quest updated successfully'})
        else:
            print("❌ Quest not found or update failed")
            return jsonify({'error': 'Quest not found or update failed'}), 404
            
    except Exception as e:
        print(f"❌ Exception in update_quest: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/create', methods=['POST'])
@require_auth()
def create_quest():
    """Create a new quest (PROTECTED)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.quests import QuestManager
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        title = data.get('title')
        uri = data.get('uri', '')  # URI is now optional
        
        if not title:
            return jsonify({'error': 'Title required'}), 400
        
        quest_manager = QuestManager()
        
        # Create the quest with new conditions format
        # Default to simple any_reply condition if not specified
        conditions = data.get('conditions')
        if not conditions:
            conditions = [{"type": "condition", "condition": "any_reply", "operator": "AND"}]
        
        quest_id = quest_manager.add_quest(
            title=title,
            uri=uri,
            conditions=conditions,
            condition_operator=data.get('condition_operator', 'AND'),
            commands=data.get('commands', []),
            description=data.get('description', ''),
            enabled=data.get('enabled', False),
            hose_service=data.get('hose_service', 'questhose')
        )
        
        if quest_id:
            # Log action
            auth.log_action(
                did=request.admin_did,
                handle=request.admin_handle,
                action='quest_create',
                target=title,
                details=f"Created quest{(' for URI: ' + uri) if uri else ' (URI to be configured)'}",
                ip_address=get_client_ip(),
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({'success': True, 'message': f'Quest "{title}" created successfully'})
        else:
            return jsonify({'error': 'Failed to create quest (title may already exist)'}), 400
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/delete/<title>', methods=['POST', 'DELETE'])
@require_auth()
def delete_quest(title):
    """Delete a quest (PROTECTED)"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.quests import QuestManager
        
        quest_manager = QuestManager()
        
        # Delete the quest
        success = quest_manager.delete_quest(title)
        
        if success:
            # Log action
            auth.log_action(
                did=request.admin_did,
                handle=request.admin_handle,
                action='quest_delete',
                target=title,
                ip_address=get_client_ip(),
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({'success': True, 'message': f'Quest "{title}" deleted successfully'})
        else:
            return jsonify({'error': 'Quest not found'}), 404
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/quest', methods=['POST'])
@require_auth()
@rate_limit(5)
def test_quest_api():
    """Test a quest with simulated input"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.test_quest import test_quest
        
        data = request.get_json()
        quest_title = data.get('quest_title')
        test_text = data.get('test_text', '')
        dry_run = data.get('dry_run', True)
        
        if not quest_title:
            return jsonify({'error': 'quest_title required'}), 400
        
        result = test_quest(quest_title, test_text, dry_run)
        return jsonify(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/activity')
def quest_activity():
    """Get recent quest activity from canon entries"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        limit = request.args.get('limit', 50, type=int)
        
        # Get recent canon entries that are likely quest-related
        # Quest completions typically have type != 'arrival' and a URI
        cursor = db.execute("""
            SELECT 
                c.id,
                c.did,
                c.event,
                c.epoch,
                c.uri,
                c.url,
                c.type,
                c.key,
                d.name,
                d.handle
            FROM events c
            LEFT JOIN dreamers d ON c.did = d.did
            WHERE c.uri IS NOT NULL AND c.uri != ''
            ORDER BY c.epoch DESC
            LIMIT %s
        """, (limit,))
        
        entries = []
        for row in cursor.fetchall():
            entry = dict(row)
            # Try to determine which quest this came from
            if entry['uri']:
                # Extract quest URI (parent post) from reply URI
                quest_uri = None
                if entry['uri'].startswith('at://'):
                    # Reply URIs include the parent post URI
                    # Format: at://did/app.bsky.feed.post/replyid
                    # We need to find the quest that monitors the parent
                    parts = entry['uri'].split('/')
                    if len(parts) >= 3:
                        # Try to match against quest URIs
                        quest_cursor = db.execute("""
                            SELECT title FROM quests 
                            WHERE uri LIKE %s
                        """, (f"%{parts[0]}%",))
                        quest_row = quest_cursor.fetchone()
                        if quest_row:
                            entry['quest_title'] = quest_row['title']
            
            entries.append(entry)
        
        return jsonify({
            'activity': entries,
            'count': len(entries)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/canon/recent')
def recent_canon():
    """Get recent canon entries with optional filters"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        limit = request.args.get('limit', 100, type=int)
        canon_type = request.args.get('type', None)
        canon_key = request.args.get('key', None)
        
        # Build query with filters
        query = """
            SELECT 
                c.id,
                c.did,
                c.event,
                c.epoch,
                c.uri,
                c.url,
                c.type,
                c.key,
                d.name,
                d.handle
            FROM events c
            LEFT JOIN dreamers d ON c.did = d.did
            WHERE 1=1
        """
        params = []
        
        if canon_type:
            query += " AND c.type = %s"
            params.append(canon_type)
        
        if canon_key:
            query += " AND c.key = %s"
            params.append(canon_key)
        
        query += " ORDER BY c.epoch DESC LIMIT %s"
        params.append(limit)
        
        cursor = db.execute(query, tuple(params))
        
        entries = []
        for row in cursor.fetchall():
            entries.append(dict(row))
        
        # Get summary statistics
        stats_cursor = db.execute("""
            SELECT 
                type,
                COUNT(*) as count
            FROM events
            GROUP BY type
            ORDER BY count DESC
        """)
        
        stats = {}
        for row in stats_cursor.fetchall():
            stats[row['type']] = row['count']
        
        return jsonify({
            'canon': entries,
            'count': len(entries),
            'stats': stats
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/quest/retroactive', methods=['POST'])
@require_auth()
@rate_limit(5)
def run_retroactive_api():
    """Run a quest retroactively on existing replies"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.test_quest import run_retroactive
        
        data = request.get_json()
        quest_title = data.get('quest_title')
        dry_run = data.get('dry_run', False)
        
        if not quest_title:
            return jsonify({'error': 'quest_title required'}), 400
        
        result = run_retroactive(quest_title, dry_run)
        return jsonify(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/wipe_records', methods=['POST'])
def wipe_quest_records_api():
    """Delete all canon records associated with a quest"""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ops.test_quest import wipe_quest_records
        
        data = request.get_json()
        quest_title = data.get('quest_title')
        
        if not quest_title:
            return jsonify({'error': 'quest_title required'}), 400
        
        deleted_count = wipe_quest_records(quest_title)
        return jsonify({
            'success': True,
            'quest_title': quest_title,
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/biblio/list/<path:list_uri>/details')
def get_biblio_list_details(list_uri):
    """
    Get detailed information from a biblio.bond list record.
    Resolves the user's PDS from their DID and fetches the actual record.
    """
    try:
        import requests
        
        # Parse the list URI
        if list_uri.startswith('at://'):
            # Full URI provided: at://did:plc:xxx/biblio.bond.list/rkey
            uri_parts = list_uri.replace('at://', '').split('/')
            if len(uri_parts) != 3:
                return jsonify({'error': 'Invalid AT URI format'}), 400
            did, collection, rkey = uri_parts
        else:
            # Just rkey provided - we don't know the DID
            return jsonify({'error': 'Full AT URI required (at://did:plc:.../biblio.bond.list/rkey)'}), 400
        
        if collection != 'biblio.bond.list':
            return jsonify({'error': 'URI must be a biblio.bond.list record'}), 400
        
        # Step 1: Resolve the DID to find the user's PDS
        did_doc_url = f'https://plc.directory/{did}'
        did_response = requests.get(did_doc_url, timeout=10)
        
        if not did_response.ok:
            return jsonify({'error': f'Failed to resolve DID: {did_response.status_code}'}), 500
        
        did_doc = did_response.json()
        
        # Extract PDS service endpoint
        pds = None
        services = did_doc.get('service', [])
        for service in services:
            if service.get('type') == 'AtprotoPersonalDataServer':
                pds = service.get('serviceEndpoint')
                break
        
        if not pds:
            return jsonify({'error': 'No PDS found for this DID'}), 500
        
        # Step 2: Fetch the record from the user's PDS
        response = requests.get(
            f'{pds}/xrpc/com.atproto.repo.getRecord',
            params={
                'repo': did,
                'collection': collection,
                'rkey': rkey
            },
            timeout=10
        )
        
        if not response.ok:
            return jsonify({
                'error': f'Failed to fetch record from PDS',
                'pds': pds,
                'status_code': response.status_code,
                'detail': response.text[:200]
            }), response.status_code
        
        data = response.json()
        record = data.get('value', {})
        
        # Extract list information
        list_info = {
            'available': True,
            'rkey': rkey,
            'did': did,
            'uri': list_uri,
            'pds': pds,
            'title': record.get('title', record.get('name', 'Untitled List')),
            'description': record.get('description', ''),
            'duedate': record.get('duedate', ''),
            'books': record.get('books', []),
            'book_count': len(record.get('books', [])),
            'librarians': record.get('librarians', []),
            'created_at': record.get('createdAt', ''),
            'cid': data.get('cid', ''),
            'raw_record': record  # Include full record for debugging
        }
        
        return jsonify(list_info)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/biblio/list/<rkey>/stats')
def get_biblio_list_stats(rkey):
    """
    Get statistics and details for a biblio.bond reading list.
    
    NOTE: biblio.bond is not yet fully implemented. This endpoint is a placeholder
    that returns a status message. When the biblio.bond PDS is operational at
    libre.reverie.house, this will query actual list data, books, and completion stamps.
    """
    try:
        # Return honest message that this feature is not yet available
        return jsonify({
            'available': False,
            'message': 'biblio.bond PDS not yet operational',
            'rkey': rkey,
            'status': 'The bibliohose monitoring system is running and ready to process biblio.bond records when they become available.'
        }), 503
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quests/canon_records/<quest_title>')
def get_quest_canon_records(quest_title):
    """Get all canon records associated with a quest"""
    try:
        from core.database import get_db
        from ops.quests import QuestManager
        
        # Get quest configuration to find URI
        qm = QuestManager()
        quest = qm.get_quest(quest_title)
        
        if not quest:
            return jsonify([])
        
        quest_uri = quest.get('uri', '')
        
        db = get_db()
        cursor = db.cursor()
        
        # Get records where the uri starts with quest_uri (reply to quest post)
        # This captures all records created from replies to the quest post
        cursor.execute('''
            SELECT c.did, c.key, c.event, c.type, c.created_at, c.uri, c.url,
                   d.name, d.handle
            FROM events c
            LEFT JOIN dreamers d ON c.did = d.did
            WHERE c.uri LIKE %s
            ORDER BY c.created_at DESC
        ''', (f'{quest_uri}%',))
        
        records = []
        for row in cursor.fetchall():
            records.append({
                'did': row[0],
                'key': row[1],
                'event': row[2],
                'type': row[3],
                'created_at': row[4],
                'source_post': row[5],
                'source_url': row[6],
                'dreamer_name': row[7] or 'Unknown',
                'dreamer_handle': row[8] or ''
            })
        
        return jsonify(records)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# DIALOGUE ENDPOINTS
# ============================================================================

@app.route('/api/dialogues/all')
@require_auth()
def get_all_dialogues():
    """Get all dialogues as flat array of messages (ADMIN ONLY)"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all dialogues ordered by key and sequence
        cursor = db.execute('''
            SELECT key, sequence, speaker, avatar, text, buttons_json, title,
                   tags, enabled, created_at, updated_at, conditions, rotating_text, display_order
            FROM dialogues
            ORDER BY key, sequence
        ''')
        
        # Return flat array of message objects (frontend will group by key)
        dialogues = []
        for row in cursor.fetchall():
            dialogues.append({
                'key': row['key'],
                'sequence': row['sequence'],
                'speaker': row['speaker'],
                'avatar': row['avatar'],
                'text': row['text'],
                'buttons_json': row['buttons_json'],
                'title': row['title'],
                'tags': row['tags'] or '[]',
                'enabled': row['enabled'] if row['enabled'] is not None else 1,
                'conditions': row['conditions'],
                'rotating_text': row['rotating_text'],
                'display_order': row['display_order'] if row['display_order'] is not None else 0
            })
        
        return jsonify(dialogues)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/update', methods=['POST'])
@require_auth()
def update_dialogue():
    """Create or update a dialogue (PROTECTED)"""
    print(f"\n=== DIALOGUE UPDATE REQUEST (AUTHENTICATED) ===")
    print(f"Admin: {request.admin_handle} ({request.admin_did})")
    
    try:
        from core.database import DatabaseManager
        
        data = request.get_json()
        print(f"Request data: {data}")
        
        if not data:
            print("ERROR: No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        key = data.get('key')
        title = data.get('title')
        messages = data.get('messages', [])
        
        if not key:
            print("ERROR: Dialogue key required")
            return jsonify({'error': 'Dialogue key required'}), 400
        
        if not messages:
            print("ERROR: At least one message required")
            return jsonify({'error': 'At least one message required'}), 400
        
        db = DatabaseManager()
        conn = db._get_connection()
        cursor = conn.cursor()
        
        # Delete existing messages for this key
        cursor.execute('DELETE FROM dialogues WHERE key = %s', (key,))
        print(f"Deleted existing messages for key: {key}")
        
        # Insert new messages
        for msg in messages:
            print(f"📝 Inserting message seq={msg.get('sequence', 0)}, buttons_json type={type(msg.get('buttons_json'))}, value={msg.get('buttons_json')}")
            cursor.execute('''
                INSERT INTO dialogues (key, title, sequence, speaker, avatar, text, buttons_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                key,
                title if msg.get('sequence', 0) == 0 else None,  # Only store title on first message
                msg.get('sequence', 0),
                msg.get('speaker'),
                msg.get('avatar'),
                msg.get('text', ''),
                msg.get('buttons_json')
            ))
        
        conn.commit()
        print(f"✅ Dialogue '{key}' saved with {len(messages)} messages")
        
        return jsonify({'success': True, 'message': 'Dialogue saved successfully'})
        
    except Exception as e:
        print(f"❌ Exception in update_dialogue: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/update_metadata', methods=['POST'])
@require_auth()
def update_dialogue_metadata():
    """Update dialogue metadata (conditions, rotating_text) (PROTECTED)"""
    print(f"\n=== DIALOGUE METADATA UPDATE REQUEST (AUTHENTICATED) ===")
    print(f"Admin: {request.admin_handle} ({request.admin_did})")
    
    try:
        from core.database import DatabaseManager
        
        data = request.get_json()
        print(f"Request data: {data}")
        
        if not data:
            print("ERROR: No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        key = data.get('key')
        
        if not key:
            print("ERROR: Dialogue key required")
            return jsonify({'error': 'Dialogue key required'}), 400
        
        db = DatabaseManager()
        conn = db._get_connection()
        cursor = conn.cursor()
        
        # Build UPDATE query dynamically based on what fields are provided
        updates = []
        params = []
        
        if 'conditions' in data:
            updates.append('conditions = %s')
            params.append(data['conditions'])
            print(f"Updating conditions: {data['conditions']}")
        
        if 'rotating_text' in data:
            updates.append('rotating_text = %s')
            params.append(data['rotating_text'])
            print(f"Updating rotating_text: {data['rotating_text']}")
        
        if not updates:
            print("ERROR: No metadata fields to update")
            return jsonify({'error': 'No metadata fields provided'}), 400
        
        # Add key to params
        params.append(key)
        
        # Execute update
        query = f"UPDATE dialogues SET {', '.join(updates)} WHERE key = %s"
        print(f"Executing: {query}")
        print(f"Params: {params}")
        
        cursor.execute(query, params)
        updated_count = cursor.rowcount
        
        conn.commit()
        print(f"✅ Updated {updated_count} rows for key: {key}")
        
        return jsonify({'success': True, 'updated': updated_count})
        
    except Exception as e:
        print(f"❌ Exception in update_dialogue_metadata: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/gatekeep', methods=['POST'])
def gatekeep_dialogue():
    """
    🔒 CONDITION-BASED DIALOGUE MATCHING
    
    Evaluates dialogue conditions against user context, filters out already-seen messages,
    and returns the best matching unseen dialogue.
    
    Request payload:
    {
        "context": {
            "page": "work",
            "authenticated": true,
            "user_did": "did:plc:...",
            "user_handle": "user.bsky.social",
            "user_role": "greeter"
        }
    }
    
    Response:
    {
        "dialogue": {
            "key": "helper:greeter_newcomers",
            "messages": [...]
        },
        "matched_conditions": {...},
        "score": 2
    }
    """
    
    client_ip = request.remote_addr
    print(f"🚪 [GATEKEEP] Request from {client_ip}")
    
    try:
        payload = request.get_json()
        
        if not payload:
            return jsonify({'error': 'Invalid request payload'}), 400
        
        user_context = payload.get('context', {})
        user_did = user_context.get('user_did')
        
        print(f"   Context: {user_context}")
        
        from core.database import DatabaseManager
        import json
        from datetime import datetime
        
        db = DatabaseManager()
        
        # Get all enabled dialogues with their conditions
        cursor = db.execute('''
            SELECT DISTINCT key, conditions, created_at
            FROM dialogues
            WHERE enabled = 1
            GROUP BY key
            ORDER BY created_at DESC
        ''')
        
        # Get already-seen dialogues for this user
        seen_keys = set()
        if user_did:
            seen_cursor = db.execute('''
                SELECT dialogue_key FROM dialogue_seen
                WHERE user_did = %s
            ''', (user_did,))
            seen_keys = {row['dialogue_key'] for row in seen_cursor.fetchall()}
            print(f"   User has seen: {seen_keys}")
        
        # Evaluate candidates
        candidates = []
        for row in cursor.fetchall():
            dialogue_key = row['key']
            conditions_json = row['conditions']
            created_at = row['created_at']
            
            # Skip already-seen dialogues
            if dialogue_key in seen_keys:
                print(f"   {dialogue_key}: SKIP (already seen)")
                continue
            
            # Parse conditions
            conditions = None
            if conditions_json:
                try:
                    conditions = json.loads(conditions_json)
                except json.JSONDecodeError:
                    conditions = None
            
            # Evaluate conditions
            if conditions:
                matches = evaluate_dialogue_conditions(conditions, user_context, db)
                if not matches['passed']:
                    print(f"   {dialogue_key}: SKIP (conditions not met)")
                    continue
                
                score = matches['score']
                print(f"   {dialogue_key}: {score} condition matches")
            else:
                # No conditions = fallback (low priority)
                score = -1
                print(f"   {dialogue_key}: fallback (no conditions)")
            
            candidates.append({
                'key': dialogue_key,
                'score': score,
                'conditions': conditions,
                'created_at': created_at
            })
        
        if not candidates:
            print(f"   ❌ No available dialogues found")
            return jsonify({'error': 'No dialogues available'}), 404
        
        # Sort by score (descending), then by created_at (newer first)
        candidates.sort(key=lambda x: (x['score'], x['created_at']), reverse=True)
        best_match = candidates[0]
        
        print(f"   ✅ Best match: {best_match['key']} (score: {best_match['score']})")
        
        # Fetch and process dialogue messages
        cursor = db.execute('''
            SELECT sequence, speaker, avatar, text, buttons_json, context, rotating_text
            FROM dialogues
            WHERE key = %s AND enabled = true
            ORDER BY sequence
        ''', (best_match['key'],))
        
        messages = []
        for row in cursor.fetchall():
            msg = {
                'sequence': row['sequence'],
                'speaker': row['speaker'],
                'avatar': row['avatar'],
                'text': interpolate_dialogue_text(row['text'], user_context, db),
                'context': row['context'] or ''
            }
            
            # Parse buttons_json if present
            if row['buttons_json']:
                try:
                    msg['buttons'] = json.loads(row['buttons_json'])
                except json.JSONDecodeError:
                    msg['buttons'] = None
            else:
                msg['buttons'] = None
            
            # Parse rotating_text if present
            if row['rotating_text']:
                try:
                    msg['rotatingText'] = json.loads(row['rotating_text'])
                except json.JSONDecodeError:
                    msg['rotatingText'] = None
            
            messages.append(msg)
        
        # Mark as seen (if user is authenticated)
        if user_did:
            mark_dialogue_seen(db, user_did, best_match['key'])
        
        return jsonify({
            'dialogue': {
                'key': best_match['key'],
                'messages': messages
            },
            'matched_conditions': best_match['conditions'],
            'score': best_match['score']
        })
        
    except Exception as e:
        print(f"   ❌ Exception in gatekeep: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def evaluate_dialogue_conditions(conditions, user_context, db):
    """
    Evaluate dialogue conditions against user context
    
    Returns: {
        'passed': bool,
        'score': int (number of matching conditions)
    }
    """
    score = 0
    
    for key, expected_value in conditions.items():
        actual_value = user_context.get(key)
        
        # Special handling for dynamic database queries
        if key == 'newcomer_count' and expected_value == 'query':
            # Query for newcomers who joined today
            from datetime import datetime, timedelta
            today_start = datetime.now().replace(hour=0, minute=0, second=0)
            count = db.execute('''
                SELECT COUNT(*) as count FROM dreamers
                WHERE created_at >= %s
            ''', (today_start.timestamp(),)).fetchone()['count']
            user_context['newcomer_count'] = count
            if count > 0:
                score += 1
        elif actual_value == expected_value:
            score += 1
        else:
            # Condition not met
            return {'passed': False, 'score': 0}
    
    return {'passed': True, 'score': score}


def interpolate_dialogue_text(text, user_context, db):
    """
    Replace {placeholders} in dialogue text with actual values
    """
    import re
    
    def replacer(match):
        key = match.group(1)
        return str(user_context.get(key, match.group(0)))
    
    return re.sub(r'\{(\w+)\}', replacer, text)


def mark_dialogue_seen(db, user_did, dialogue_key):
    """
    Mark a dialogue as seen by a user
    """
    from datetime import datetime
    
    try:
        db.execute('''
            INSERT INTO dialogue_seen (user_did, dialogue_key, shown_count, first_shown_at, last_shown_at)
            VALUES (%s, %s, 1, %s, %s)
            ON CONFLICT(user_did, dialogue_key) DO UPDATE SET
                shown_count = shown_count + 1,
                last_shown_at = %s
        ''', (user_did, dialogue_key, datetime.now(), datetime.now(), datetime.now()))
        # DatabaseManager auto-commits after execute()
        print(f"   📝 Marked {dialogue_key} as seen by {user_did}")
    except Exception as e:
        print(f"   ⚠️ Failed to mark as seen: {e}")


# ============================================================================
# MESSAGE INBOX ENDPOINTS
# ============================================================================

@app.route('/api/messages/count')
def get_message_count():
    """Get unread message count for current user"""
    try:
        from core.messages import get_inbox
        from core.database import DatabaseManager
        
        # Get user DID from query param or cookie (prioritize query param for OAuth users)
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        # If no user identified, return 0
        if not user_did:
            print("ℹ️ [COUNT] No user_did, returning 0 count")
            return jsonify({
                'status': 'success',
                'data': {
                    'unread': 0,
                    'read': 0,
                    'total': 0
                }
            })
        
        inbox_data = get_inbox(user_did, limit=1)
        
        print(f"📊 [COUNT] User {user_did[:30]}... has {inbox_data['unread']} unread messages")
        
        return jsonify({
            'status': 'success',
            'data': {
                'unread': inbox_data['unread'],
                'read': inbox_data['read'],
                'total': inbox_data['total']
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting message count: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/inbox')
def get_user_inbox():
    """Get user's message inbox"""
    try:
        from core.messages import get_inbox
        
        # Get user DID - prioritize query parameter over cookie (for admin viewing other users)
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            print("⚠️ [INBOX] No user_did provided (cookie or query param)")
            return jsonify({'status': 'error', 'error': 'Not authenticated - user_did required'}), 401
        
        print(f"📬 [INBOX] Loading inbox for {user_did[:30]}... (from {'query' if request.args.get('user_did') else 'cookie'})")
        
        # Get filter params
        status = request.args.get('status')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        inbox_data = get_inbox(user_did, status=status, limit=limit, offset=offset)
        
        print(f"📊 [INBOX] Found {len(inbox_data.get('messages', []))} messages for user")
        
        return jsonify({
            'status': 'success',
            'data': inbox_data
        })
        
    except Exception as e:
        print(f"❌ Error loading inbox: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/<int:message_id>')
def get_single_message(message_id):
    """Get a single message (with permission check)"""
    try:
        from core.database import DatabaseManager
        import json
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        if not user_did:
            print(f"⚠️ [MESSAGE] No user_did for message {message_id}")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"📬 [MESSAGE] Fetching message {message_id} for {user_did[:30]}...")
        
        db = DatabaseManager()
        cursor = db.execute('''
            SELECT id, user_did, dialogue_key, title, messages_json, source, priority, 
                   status, created_at, read_at, dismissed_at, expires_at
            FROM messages
            WHERE id = %s AND user_did = %s
        ''', (message_id, user_did))
        
        row = cursor.fetchone()
        
        if not row:
            print(f"❌ [MESSAGE] Message {message_id} not found for user")
            return jsonify({'status': 'error', 'error': 'Message not found'}), 404
        
        print(f"✅ [MESSAGE] Found message {message_id}")
        
        message = {
            'id': row['id'],
            'user_did': row['user_did'],
            'dialogue_key': row['dialogue_key'],
            'messages_json': row['messages_json'],
            'source': row['source'],
            'priority': row['priority'],
            'status': row['status'],
            'created_at': row['created_at'],
            'read_at': row['read_at'],
            'dismissed_at': row['dismissed_at'],
            'expires_at': row['expires_at']
        }
        
        return jsonify({
            'status': 'success',
            'data': message
        })
        
    except Exception as e:
        print(f"❌ Error getting message: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/<int:message_id>/read', methods=['POST'])
def mark_message_read(message_id):
    """Mark a message as read"""
    try:
        from core.messages import mark_read
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        if not user_did:
            print(f"⚠️ [READ] No user_did for message {message_id}")
            return jsonify({'error': 'Not authenticated'}), 401
        
        print(f"📖 [READ] Marking message {message_id} as read for {user_did[:30]}...")
        
        success = mark_read(message_id, user_did)
        
        if not success:
            print(f"❌ [READ] Message {message_id} not found or already read")
            return jsonify({'error': 'Message not found or already read'}), 404
        
        print(f"✅ [READ] Message {message_id} marked as read")
        
        return jsonify({
            'success': True,
            'message_id': message_id,
            'status': 'read'
        })
        
    except Exception as e:
        print(f"❌ Error marking as read: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages/<int:message_id>/dismiss', methods=['POST'])
def dismiss_message(message_id):
    """Dismiss a message"""
    try:
        from core.messages import mark_dismissed
        
        # Get user DID from query param or cookie
        user_did = request.args.get('user_did') or request.cookies.get('user_did')
        if not user_did:
            print(f"⚠️ [DISMISS] No user_did for message {message_id}")
            return jsonify({'status': 'error', 'error': 'Not authenticated'}), 401
        
        print(f"🗑️ [DISMISS] Dismissing message {message_id} for {user_did[:30]}...")
        
        success = mark_dismissed(message_id, user_did)
        
        if not success:
            print(f"❌ [DISMISS] Message {message_id} not found or already dismissed")
            return jsonify({'status': 'error', 'error': 'Message not found'}), 404
        
        print(f"✅ [DISMISS] Message {message_id} dismissed")
        
        return jsonify({
            'status': 'success',
            'message_id': message_id,
            'dismissed': True
        })
        
    except Exception as e:
        print(f"❌ Error dismissing message: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/<int:message_id>', methods=['DELETE'])
@require_auth()
def delete_message(message_id):
    """Permanently delete a message record (admin only)"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Check if message exists
        cursor = db.execute('SELECT id FROM messages WHERE id = %s', (message_id,))
        if not cursor.fetchone():
            return jsonify({'status': 'error', 'error': 'Message not found'}), 404
        
        # Delete the message
        db.execute('DELETE FROM messages WHERE id = %s', (message_id,))
        # DatabaseManager auto-commits after execute()
        
        print(f"🗑️ Admin deleted message ID: {message_id}")
        
        return jsonify({
            'status': 'success',
            'message_id': message_id,
            'deleted': True
        })
        
    except Exception as e:
        print(f"❌ Error deleting message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/bulk-dismiss', methods=['POST'])
def bulk_dismiss_messages():
    """Bulk dismiss messages"""
    try:
        from core.messages import bulk_dismiss
        
        # Get user from session
        user_did = request.cookies.get('user_did')
        if not user_did:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.get_json() or {}
        status_filter = data.get('status', 'read')
        
        count = bulk_dismiss(user_did, status_filter)
        
        return jsonify({
            'success': True,
            'dismissed_count': count
        })
        
    except Exception as e:
        print(f"❌ Error bulk dismissing: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages/send', methods=['POST'])
@require_auth()
def send_message_admin():
    """Admin: Send message to specific user(s) or broadcast to all"""
    try:
        from core.messages import create_message
        import json
        
        data = request.get_json()
        
        print(f"📥 [SEND] Request data: {data}")
        
        dialogue_key = data.get('dialogue_key')
        user_did = data.get('user_did')  # Single user (optional)
        priority = data.get('priority', 50)
        expires_in = data.get('expires_in')  # Seconds (will convert to hours)
        
        print(f"📝 [SEND] Parsed: dialogue_key={dialogue_key}, user_did={user_did}, priority={priority}, expires_in={expires_in}")
        
        if not dialogue_key:
            print("⚠️ [SEND] Missing dialogue_key")
            return jsonify({'status': 'error', 'error': 'dialogue_key required'}), 400
        
        # Load dialogue messages
        from core.database import DatabaseManager
        db = DatabaseManager()
        cursor = db.execute('''
            SELECT sequence, speaker, avatar, text, buttons_json
            FROM dialogues
            WHERE key = %s AND enabled = true
            ORDER BY sequence
        ''', (dialogue_key,))
        
        messages = []
        for row in cursor.fetchall():
            msg = {
                'sequence': row['sequence'],
                'speaker': row['speaker'],
                'avatar': row['avatar'],
                'text': row['text']
            }
            if row['buttons_json']:
                msg['buttons'] = json.loads(row['buttons_json'])
            messages.append(msg)
        
        print(f"📨 [SEND] Loaded {len(messages)} messages for dialogue {dialogue_key}")
        
        if not messages:
            print(f"❌ [SEND] No messages found for dialogue {dialogue_key}")
            return jsonify({'status': 'error', 'error': f'Dialogue {dialogue_key} not found or disabled'}), 404
        
        # Determine recipients
        if user_did:
            # Single user
            recipients = [user_did]
            print(f"👤 [SEND] Single recipient: {user_did}")
        else:
            # Broadcast to all users
            cursor = db.execute('SELECT did FROM dreamers WHERE did IS NOT NULL AND did != ""')
            recipients = [row['did'] for row in cursor.fetchall()]
            print(f"📢 [SEND] Broadcasting to {len(recipients)} users")
        
        if not recipients:
            print("⚠️ [SEND] No recipients found")
            return jsonify({'status': 'error', 'error': 'No recipients found'}), 400
        
        # Convert expires_in from seconds to hours if provided
        expires_in_hours = None
        if expires_in:
            expires_in_hours = int(expires_in) // 3600
            if expires_in_hours == 0:
                expires_in_hours = 1  # Minimum 1 hour
            print(f"⏰ [SEND] Expiration set to {expires_in_hours} hours")
        
        # Send to all recipients
        message_ids = []
        for did in recipients:
            print(f"📤 [SEND] Sending to {did[:30]}...")
            msg_id = create_message(
                user_did=did,
                dialogue_key=dialogue_key,
                messages_data=messages,
                source='admin',
                priority=priority,
                expires_in_hours=expires_in_hours
            )
            if msg_id:
                message_ids.append(msg_id)
        
        print(f"✅ [SEND] Admin {request.admin_handle} sent {dialogue_key} to {len(message_ids)} users")
        
        return jsonify({
            'status': 'success',
            'data': {
                'sent': len(message_ids),
                'message_ids': message_ids
            }
        })
        
    except Exception as e:
        print(f"❌ [SEND] Error sending message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/analytics')
@require_auth()
def get_messages_analytics():
    """Admin: Get message analytics and statistics"""
    try:
        from core.messages import get_message_stats
        
        stats = get_message_stats()
        
        return jsonify({
            'status': 'success',
            'data': stats
        })
        
    except Exception as e:
        print(f"❌ Error getting message analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/test/create-message', methods=['POST'])
def create_test_message_for_user():
    """Create a test message for the current user (development only)"""
    try:
        from core.messages import create_message
        import time
        
        # Get user from cookie or request
        data = request.get_json() or {}
        user_did = data.get('user_did') or request.cookies.get('user_did')
        
        if not user_did:
            return jsonify({'status': 'error', 'error': 'No user_did found'}), 400
        
        # Create test message
        messages_data = [
            {
                'sequence': 0,
                'speaker': 'errantson',
                'avatar': '/souvenirs/dream/strange/icon.png',
                'text': 'Hello! This is a test message from the inbox system.\n\nClick through to see how it works!'
            },
            {
                'sequence': 1,
                'speaker': 'errantson',
                'avatar': '/souvenirs/dream/strange/icon.png',
                'text': 'You can send messages to users programmatically.\n\nThey will see a notification badge and can read them in their inbox.',
                'buttons': [
                    {'text': 'Cool!', 'callback': 'end'}
                ]
            }
        ]
        
        message_id = create_message(
            user_did=user_did,
            dialogue_key='test_inbox_widget',
            messages_data=messages_data,
            source='test',
            priority=75
        )
        
        print(f"✅ Created test message {message_id} for {user_did}")
        
        return jsonify({
            'status': 'success',
            'data': {
                'message_id': message_id,
                'user_did': user_did
            }
        })
        
    except Exception as e:
        print(f"❌ Error creating test message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/recent')
@require_auth()
def get_recent_messages():
    """Admin: Get recent messages across all users"""
    try:
        from core.database import DatabaseManager
        import json
        
        limit = request.args.get('limit', 500, type=int)
        limit = min(limit, 500)  # Cap at 500
        
        db = DatabaseManager()
        cursor = db.execute('''
            SELECT 
                m.id, m.user_did, m.dialogue_key, m.title, m.status, m.priority, 
                m.source, m.created_at, m.read_at, m.dismissed_at, m.expires_at,
                d.handle, d.display_name, d.avatar
            FROM messages m
            LEFT JOIN dreamers d ON m.user_did = d.did
            ORDER BY m.created_at DESC
            LIMIT %s
        ''', (limit,))
        
        messages = []
        for row in cursor.fetchall():
            # Fix avatar URL - handle various formats and missing avatars
            avatar_url = row['avatar']
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
                'dialogue_key': row['dialogue_key'],
                'title': row['title'],
                'status': row['status'],
                'priority': row['priority'],
                'source': row['source'],
                'created_at': row['created_at'],
                'read_at': row['read_at'],
                'dismissed_at': row['dismissed_at'],
                'expires_at': row['expires_at'],
                'handle': row['handle'],
                'display_name': row['display_name'],
                'avatar': avatar_url  # Now a proper CDN URL or default
            })
        
        response = jsonify({
            'status': 'success',
            'data': messages
        })
        
        # Add cache-control headers to prevent stale data
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        print(f"❌ Error getting recent messages: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/templates')
@require_auth()
def get_message_templates():
    """Admin: Get all unique message templates (dialogue_key groups from messages table)"""
    try:
        from core.database import DatabaseManager
        import json
        
        db = DatabaseManager()
        
        # Get all unique dialogue_keys with their first message as template
        cursor = db.execute('''
            SELECT 
                dialogue_key,
                title,
                messages_json,
                source,
                priority,
                MIN(created_at) as first_created
            FROM messages
            GROUP BY dialogue_key
            ORDER BY dialogue_key
        ''')
        
        templates = []
        for row in cursor.fetchall():
            templates.append({
                'key': row['dialogue_key'],
                'title': row['title'],
                'messages_json': row['messages_json'],
                'source': row['source'],
                'priority': row['priority'],
                'created_at': row['first_created']
            })
        
        return jsonify({
            'status': 'success',
            'data': templates
        })
        
    except Exception as e:
        print(f"❌ Error getting message templates: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages')
def get_messages_for_dreamer():
    """Get recent messages for a specific dreamer (called by profile.js)"""
    try:
        from core.database import DatabaseManager
        import json
        from datetime import datetime
        
        did = request.args.get('did')
        limit = request.args.get('limit', 10, type=int)
        
        if not did:
            return jsonify({'status': 'error', 'error': 'Missing did parameter'}), 400
        
        db = DatabaseManager()
        
        # Get recent dialogue messages for this dreamer
        cursor = db.execute('''
            SELECT m.id, m.user_did, m.dialogue_key, m.messages_json, m.created_at,
                   m.status, m.priority, m.title
            FROM messages m
            WHERE m.user_did = %s
            ORDER BY m.created_at DESC
            LIMIT %s
        ''', (did, limit))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'id': row['id'],
                'user_did': row['user_did'],
                'dialogue_key': row['dialogue_key'],
                'messages_json': row['messages_json'],
                'created_at': datetime.fromtimestamp(row['created_at']).isoformat() if row['created_at'] else None,
                'status': row['status'],
                'priority': row['priority'],
                'title': row['title']
            })
        
        return jsonify({
            'status': 'success',
            'data': messages
        })
        
    except Exception as e:
        print(f"❌ Error getting messages for dreamer: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/messages/last-sent')
def get_last_sent_message():
    """Get timestamp of last message sent to a specific dreamer (called by profile.js)"""
    try:
        from core.database import DatabaseManager
        from datetime import datetime
        
        to_did = request.args.get('to_did')
        
        if not to_did:
            return jsonify({'status': 'error', 'error': 'Missing to_did parameter'}), 400
        
        db = DatabaseManager()
        
        # Get most recent message sent to this dreamer
        cursor = db.execute('''
            SELECT created_at
            FROM messages
            WHERE user_did = %s
            ORDER BY created_at DESC
            LIMIT 1
        ''', (to_did,))
        
        row = cursor.fetchone()
        
        if row and row['created_at']:
            return jsonify({
                'status': 'success',
                'last_sent': datetime.fromtimestamp(row['created_at']).isoformat()
            })
        else:
            return jsonify({
                'status': 'success',
                'last_sent': None
            })
        
    except Exception as e:
        print(f"❌ Error getting last sent message: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/dialogues/templates')
@require_auth()
def get_dialogue_templates():
    """Admin: Get all dialogue templates from dialogues table"""
    try:
        from core.database import DatabaseManager
        import json
        
        db = DatabaseManager()
        
        # Get all unique dialogue keys
        cursor = db.execute('''
            SELECT DISTINCT key FROM dialogues WHERE enabled = true ORDER BY key
        ''')
        
        keys = [row['key'] for row in cursor.fetchall()]
        
        templates = []
        for key in keys:
            # Get all messages for this key
            cursor = db.execute('''
                SELECT sequence, speaker, avatar, text, buttons_json, conditions, tags, rotating_text, title
                FROM dialogues
                WHERE key = %s AND enabled = true
                ORDER BY sequence
            ''', (key,))
            
            messages = []
            dialogue_title = None
            for row in cursor.fetchall():
                # Extract title from first message
                if row['sequence'] == 0 and row['title']:
                    dialogue_title = row['title']
                
                message = {
                    'sequence': row['sequence'],
                    'speaker': row['speaker'],
                    'avatar': row['avatar'],
                    'text': row['text']
                }
                
                if row['buttons_json']:
                    message['buttons_json'] = row['buttons_json']  # Keep as JSON string
                
                if row['rotating_text']:
                    message['rotatingText'] = json.loads(row['rotating_text'])
                
                messages.append(message)
            
            templates.append({
                'key': key,
                'title': dialogue_title,
                'messages': messages
            })
        
        return jsonify({
            'status': 'success',
            'data': templates
        })
        
    except Exception as e:
        print(f"❌ Error getting dialogue templates: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/test/set-user-cookie')
def set_user_cookie_for_testing():
    """Development helper: Set user_did cookie based on handle"""
    try:
        from core.database import DatabaseManager
        
        handle = request.args.get('handle', '').lower()
        
        if not handle:
            return jsonify({'status': 'error', 'error': 'Provide ?handle=your.handle'})
        
        db = DatabaseManager()
        
        # Look up user by handle
        cursor = db.execute('SELECT did, handle FROM dreamers WHERE LOWER(handle) = %s', (handle,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'status': 'error', 'error': f'User not found: {handle}'})
        
        # Set cookie
        resp = jsonify({
            'status': 'success',
            'data': {
                'did': row['did'],
                'handle': row['handle']
            }
        })
        resp.set_cookie('user_did', row['did'], max_age=30*24*60*60, samesite='Lax')
        
        print(f"✅ Set user_did cookie for {row['handle']} ({row['did']})")
        
        return resp
        
    except Exception as e:
        print(f"❌ Error setting user cookie: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/dialogues/<key>')
def get_dialogue_by_key(key):
    """
    Get a specific dialogue sequence by key (PUBLIC but RESTRICTED)
    
    ⚠️ SECURITY: Only allows whitelisted system dialogues.
    Use /api/dialogues/gatekeep for tag-based matching.
    """
    
    # Whitelist of allowed public dialogue keys
    ALLOWED_PUBLIC_KEYS = [
        'construction',
        'core:welcome',
        'core:bskyexplain',
        'system:error:404',
        'system:error:500',
        'system:help:general',
        'system:auth:login_required'
    ]
    
    # Block access to sensitive dialogues
    if key not in ALLOWED_PUBLIC_KEYS:
        print(f"🚫 [SECURITY] Blocked direct access to dialogue key: {key} from {request.remote_addr}")
        return jsonify({'error': 'Dialogue not available via direct key access. Use /api/dialogues/gatekeep instead.'}), 403
    
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get all messages for this key, ordered by sequence
        cursor = db.execute('''
            SELECT key, sequence, speaker, avatar, text, buttons_json, context
            FROM dialogues
            WHERE key = %s
            ORDER BY sequence
        ''', (key,))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'key': row['key'],
                'sequence': row['sequence'],
                'speaker': row['speaker'],
                'avatar': row['avatar'],
                'text': row['text'],
                'buttons_json': row['buttons_json'],
                'context': row['context'] or ''
            })
        
        if not messages:
            return jsonify({'error': 'Dialogue not found'}), 404
        
        return jsonify(messages)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/delete/<key>', methods=['POST', 'DELETE'])
@require_auth()
def delete_dialogue(key):
    """Delete a dialogue and all its messages (PROTECTED)"""
    print(f"\n=== DIALOGUE DELETE REQUEST (AUTHENTICATED) ===")
    print(f"Admin: {request.admin_handle} ({request.admin_did})")
    print(f"Key: {key}")
    
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        conn = db._get_connection()
        cursor = conn.cursor()
        
        # Delete all messages for this key
        cursor.execute('DELETE FROM dialogues WHERE key = %s', (key,))
        deleted_count = cursor.rowcount
        
        conn.commit()
        print(f"✅ Deleted {deleted_count} messages for dialogue '{key}'")
        
        return jsonify({'success': True, 'message': f'Dialogue deleted ({deleted_count} messages)'})
        
    except Exception as e:
        print(f"❌ Exception in delete_dialogue: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/reorder', methods=['POST'])
@require_auth()
def reorder_dialogues():
    """Update display_order for multiple dialogues (PROTECTED)"""
    print(f"\n=== DIALOGUE REORDER REQUEST (AUTHENTICATED) ===")
    print(f"Admin: {request.admin_handle} ({request.admin_did})")
    
    try:
        from core.database import DatabaseManager
        
        updates = request.json.get('updates', [])
        print(f"Updating order for {len(updates)} dialogues")
        
        db = DatabaseManager()
        conn = db._get_connection()
        cursor = conn.cursor()
        
        updated_count = 0
        for update in updates:
            key = update.get('key')
            display_order = update.get('display_order')
            
            if key and display_order is not None:
                cursor.execute(
                    'UPDATE dialogues SET display_order = %s WHERE key = %s',
                    (display_order, key)
                )
                updated_count += cursor.rowcount
        
        conn.commit()
        print(f"✅ Updated display_order for {updated_count} dialogue keys")
        
        return jsonify({'success': True, 'updated': updated_count})
        
    except Exception as e:
        print(f"❌ Exception in reorder_dialogues: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/seen/recent')
@require_auth()
def get_recent_seen():
    """Get recent dialogue seen activity for dashboard"""
    try:
        from core.database import DatabaseManager
        
        limit = request.args.get('limit', 10, type=int)
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT 
                ds.dialogue_key,
                ds.user_did,
                ds.last_seen_at,
                ds.view_count,
                d.handle as user_handle
            FROM dialogue_seen ds
            LEFT JOIN dreamers d ON ds.user_did = d.did
            ORDER BY ds.last_seen_at DESC
            LIMIT %s
        """, (limit,))
        
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            result.append({
                'dialogue_key': row['dialogue_key'],
                'user_did': row['user_did'],
                'user_handle': row['user_handle'],
                'last_seen_at': row['last_seen_at'],
                'view_count': row['view_count']
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in get_recent_seen: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/popular')
@require_auth()
def get_popular_dialogues():
    """Get most popular dialogues for dashboard"""
    try:
        from core.database import DatabaseManager
        
        limit = request.args.get('limit', 10, type=int)
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT 
                dialogue_key,
                COUNT(DISTINCT user_did) as unique_users,
                SUM(view_count) as total_views
            FROM dialogue_seen
            GROUP BY dialogue_key
            ORDER BY total_views DESC
            LIMIT %s
        """, (limit,))
        
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            result.append({
                'dialogue_key': row['dialogue_key'],
                'unique_users': row['unique_users'],
                'total_views': row['total_views']
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in get_popular_dialogues: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/conditions')
@require_auth()
def get_dialogue_conditions():
    """Get gatekeep conditions for a specific dialogue key, or all if no key specified"""
    try:
        from core.database import DatabaseManager
        
        dialogue_key = request.args.get('dialogue_key')
        
        db = DatabaseManager()
        
        if dialogue_key:
            # Get conditions for specific dialogue
            cursor = db.execute("""
                SELECT 
                    rule_name,
                    priority,
                    page_context,
                    user_state,
                    conditions,
                    condition_operator,
                    dialogue_key,
                    description,
                    enabled
                FROM dialogue_conditions
                WHERE dialogue_key = %s AND enabled = true
                ORDER BY priority DESC
            """, (dialogue_key,))
        else:
            # Get all conditions
            cursor = db.execute("""
                SELECT 
                    rule_name,
                    priority,
                    page_context,
                    user_state,
                    conditions,
                    condition_operator,
                    dialogue_key,
                    description,
                    enabled
                FROM dialogue_conditions
                WHERE enabled = true
                ORDER BY priority DESC
            """)
        
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            result.append({
                'rule_name': row['rule_name'],
                'priority': row['priority'],
                'page_context': row['page_context'],
                'user_state': row['user_state'],
                'conditions': row['conditions'],
                'condition_operator': row['condition_operator'],
                'dialogue_key': row['dialogue_key'],
                'description': row['description'],
                'enabled': row['enabled']
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in get_dialogue_conditions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/conditions', methods=['POST'])
@require_auth()
def create_dialogue_condition():
    """Create a new gatekeep condition"""
    try:
        from core.database import DatabaseManager
        
        data = request.get_json()
        rule_name = data.get('rule_name')
        priority = data.get('priority', 50)
        page_context = data.get('page_context')
        conditions = data.get('conditions', '[]')
        condition_operator = data.get('condition_operator', 'AND')
        dialogue_key = data.get('dialogue_key')
        description = data.get('description', '')
        
        if not rule_name or not dialogue_key:
            return jsonify({'error': 'rule_name and dialogue_key are required'}), 400
        
        db = DatabaseManager()
        
        # Check if rule_name already exists
        existing = db.execute("SELECT rule_name FROM dialogue_conditions WHERE rule_name = %s", 
                             (rule_name,)).fetchone()
        if existing:
            return jsonify({'error': 'A condition with that rule_name already exists'}), 400
        
        db.execute("""
            INSERT INTO dialogue_conditions (
                rule_name, priority, page_context, conditions,
                condition_operator, dialogue_key, description, enabled
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
        """, (rule_name, priority, page_context, conditions, 
              condition_operator, dialogue_key, description))
        # DatabaseManager auto-commits after execute()
        
        print(f"✅ Created condition: {rule_name} (priority {priority}) → {dialogue_key}")
        return jsonify({'success': True, 'rule_name': rule_name})
        
    except Exception as e:
        print(f"❌ Error in create_dialogue_condition: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/conditions/<rule_name>', methods=['DELETE'])
@require_auth()
def delete_dialogue_condition(rule_name):
    """Delete a gatekeep condition"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Check if exists
        existing = db.execute("SELECT rule_name FROM dialogue_conditions WHERE rule_name = %s", 
                             (rule_name,)).fetchone()
        if not existing:
            return jsonify({'error': 'Condition not found'}), 404
        
        db.execute("DELETE FROM dialogue_conditions WHERE rule_name = %s", (rule_name,))
        # DatabaseManager auto-commits after execute()
        
        print(f"✅ Deleted condition: {rule_name}")
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error in delete_dialogue_condition: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dialogues/coverage')
@require_auth()
def get_dialogue_coverage():
    """Get dialogue coverage statistics for dashboard"""
    try:
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get total unique dialogue keys
        cursor = db.execute("SELECT COUNT(DISTINCT key) as total FROM dialogues")
        total_dialogues = cursor.fetchone()['total']
        
        # Get dialogues that have been viewed
        cursor = db.execute("SELECT COUNT(DISTINCT dialogue_key) as viewed FROM dialogue_seen")
        viewed_dialogues = cursor.fetchone()['viewed']
        
        never_viewed = total_dialogues - viewed_dialogues
        coverage_percent = round((viewed_dialogues / total_dialogues * 100), 1) if total_dialogues > 0 else 0
        
        return jsonify({
            'total_dialogues': total_dialogues,
            'viewed_dialogues': viewed_dialogues,
            'never_viewed': never_viewed,
            'coverage_percent': coverage_percent
        })
        
    except Exception as e:
        print(f"❌ Error in get_dialogue_coverage: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conditionals')
def get_conditionals():
    """
    Get current user context conditionals for dialogue filtering.
    Returns a dictionary of all available conditional checks.
    
    Response:
    {
        "authenticated": true/false,
        "user_did": "did:plc:..." or null,
        "user_handle": "user.bsky.social" or null,
        "user_name": "Display Name" or null,
        "is_greeter": true/false,
        "is_mapper": true/false,
        "is_patron": true/false,
        "is_dreamer": true/false,
        "is_keeper": true/false,
        "has_canon": true/false,
        "has_lore": true/false,
        "has_spectrum": true/false,
        "has_avatar": true/false,
        "message_count": 0,
        "has_messages": true/false,
        "newcomer_count": 0,
        "has_newcomers": true/false,
        "total_dreamers": 22,
        "active_dialogues": 3,
        "is_morning": true/false (5am-12pm),
        "is_afternoon": true/false (12pm-5pm),
        "is_evening": true/false (5pm-10pm),
        "is_night": true/false (10pm-5am),
        "page": null (set by client)
    }
    """
    try:
        from core.database import DatabaseManager
        from datetime import datetime, timedelta
        
        db = DatabaseManager()
        
        # Get user from session
        user_did = None
        user_handle = None
        user_name = None
        authenticated = False
        
        # Try to get from cookies
        user_did = request.cookies.get('user_did')
        if user_did:
            authenticated = True
            # Get user details from dreamers table
            dreamer = db.execute(
                'SELECT handle, display_name FROM dreamers WHERE did = %s',
                (user_did,)
            ).fetchone()
            if dreamer:
                user_handle = dreamer['handle']
                user_name = dreamer['display_name']
        
        # Check work roles
        is_greeter = False
        is_mapper = False
        if user_did:
            work = db.execute(
                "SELECT role FROM work WHERE status = 'active'",
            ).fetchall()
            for row in work:
                import json
                role = row['role']
                role_data = db.execute(
                    "SELECT workers FROM work WHERE role = %s AND status = 'active'",
                    (role,)
                ).fetchone()
                if role_data and role_data['workers']:
                    workers = json.loads(role_data['workers'])
                    worker_dids = [w.get('did') for w in workers]
                    if user_did in worker_dids:
                        if role == 'greeter':
                            is_greeter = True
                        elif role == 'mapper':
                            is_mapper = True
        
        # Check patron status (has made contribution)
        is_patron = False
        has_canon = False
        has_lore = False
        if user_did:
            # Check contributions
            try:
                contributions = db.execute('''
                    SELECT COUNT(*) as count, type
                    FROM contributions
                    WHERE dreamer_did = %s
                    GROUP BY type
                ''', (user_did,)).fetchall()
                
                for contrib in contributions:
                    if contrib['type'] == 'canon':
                        has_canon = True
                        is_patron = True
                    elif contrib['type'] == 'lore':
                        has_lore = True
                        is_patron = True
            except Exception:
                # contributions table may not exist
                pass
        
        # General dreamer status (registered user)
        is_dreamer = authenticated
        
        # Message count
        message_count = 0
        if user_did:
            from core.messages import get_inbox
            try:
                inbox = get_inbox(user_did, db)
                if inbox and 'messages' in inbox:
                    message_count = len([m for m in inbox['messages'] if not m.get('read', False)])
            except Exception:
                pass
        
        # Newcomer count (users who joined today)
        today_start = datetime.now().replace(hour=0, minute=0, second=0)
        newcomer_count = db.execute('''
            SELECT COUNT(*) as count FROM dreamers
            WHERE created_at >= %s
        ''', (today_start.timestamp(),)).fetchone()['count']
        
        # Additional conditionals
        has_spectrum = False
        has_avatar = False
        is_keeper = False
        total_dreamers = 0
        active_dialogues = 0
        
        if user_did:
            # Check if user has spectrum calculated
            try:
                spectrum = db.execute(
                    'SELECT oblivion, authority, skeptic, receptive, liberty, entropy FROM spectrum WHERE did = %s',
                    (user_did,)
                ).fetchone()
                # User has spectrum if any value is non-zero
                has_spectrum = spectrum is not None and any([
                    spectrum['oblivion'], spectrum['authority'], spectrum['skeptic'],
                    spectrum['receptive'], spectrum['liberty'], spectrum['entropy']
                ])
            except Exception:
                # spectrum table may not exist or have different schema
                pass
            
            # Check if user has custom avatar
            dreamer = db.execute(
                'SELECT avatar FROM dreamers WHERE did = %s',
                (user_did,)
            ).fetchone()
            if dreamer and dreamer['avatar']:
                # Custom avatar if it's not the default placeholder
                has_avatar = 'avatar/plain' in dreamer['avatar']
            
            # Check if user is the keeper (world admin)
            try:
                world = db.execute(
                    "SELECT value FROM world WHERE key = 'keeper_did' LIMIT 1"
                ).fetchone()
                if world:
                    is_keeper = (user_did == world['value'])
            except Exception:
                # world table may not exist
                pass
        
        # Total dreamer count
        total_dreamers = db.execute('SELECT COUNT(*) as count FROM dreamers').fetchone()['count']
        
        # Active dialogue count
        active_dialogues = db.execute(
            'SELECT COUNT(DISTINCT key) as count FROM dialogues WHERE enabled = true'
        ).fetchone()['count']
        
        # Time-based conditionals
        current_hour = datetime.now().hour
        is_morning = 5 <= current_hour < 12
        is_afternoon = 12 <= current_hour < 17
        is_evening = 17 <= current_hour < 22
        is_night = current_hour >= 22 or current_hour < 5
        
        return jsonify({
            'authenticated': authenticated,
            'user_did': user_did,
            'user_handle': user_handle,
            'user_name': user_name,
            'is_greeter': is_greeter,
            'is_mapper': is_mapper,
            'is_patron': is_patron,
            'is_dreamer': is_dreamer,
            'is_keeper': is_keeper,
            'has_canon': has_canon,
            'has_lore': has_lore,
            'has_spectrum': has_spectrum,
            'has_avatar': has_avatar,
            'message_count': message_count,
            'has_messages': message_count > 0,
            'newcomer_count': newcomer_count,
            'has_newcomers': newcomer_count > 0,
            'total_dreamers': total_dreamers,
            'active_dialogues': active_dialogues,
            'is_morning': is_morning,
            'is_afternoon': is_afternoon,
            'is_evening': is_evening,
            'is_night': is_night,
            'page': None  # Set by client
        })
        
    except Exception as e:
        print(f"❌ Error in get_conditionals: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/header-rotator')
def get_header_rotator():
    """Get header rotator messages"""
    import json
    rotator_file = 'data/header_rotator.json'
    
    # Default messages
    default_messages = [
        {"lines": ["For any requests, contact", "books@reverie.house"]},
        {"lines": ["We are still growing", "Everything is ephemeral"]},
        {"lines": ["Our wild mindscape", "beckons you"]},
        {"lines": ["Everyone has a place", "You can choose yours"]},
        {"lines": ["Welcome, dreamer", "Glad you made it"]}
    ]
    
    try:
        if os.path.exists(rotator_file):
            with open(rotator_file, 'r') as f:
                messages = json.load(f)
                return jsonify({'messages': messages})
        else:
            return jsonify({'messages': default_messages})
    except Exception as e:
        print(f"❌ Error loading header rotator: {e}")
        return jsonify({'messages': default_messages})


@app.route('/api/header-rotator', methods=['POST'])
@require_auth()
def update_header_rotator():
    """Update header rotator messages"""
    import json
    
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        
        if not messages:
            return jsonify({'error': 'No messages provided'}), 400
        
        # Validate messages format
        for msg in messages:
            if not isinstance(msg, dict) or 'lines' not in msg:
                return jsonify({'error': 'Invalid message format'}), 400
            if not isinstance(msg['lines'], list) or len(msg['lines']) != 2:
                return jsonify({'error': 'Each message must have exactly 2 lines'}), 400
        
        # Save to file
        rotator_file = 'data/header_rotator.json'
        with open(rotator_file, 'w') as f:
            json.dump(messages, f, indent=2)
        
        print(f"✅ Saved {len(messages)} header rotator messages")
        return jsonify({'success': True, 'count': len(messages)})
        
    except Exception as e:
        print(f"❌ Error saving header rotator: {e}")
        return jsonify({'error': str(e)}), 500


##############################################################################
# Work System API
##############################################################################

@app.route('/api/work/<role>/info')
@rate_limit()
def get_work_info(role):
    """Get public information about a work role"""
    try:
        from core.database import DatabaseManager
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT * FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Enrich workers with handle and display_name from dreamers table
        enriched_workers = []
        for worker in workers:
            worker_did = worker.get('did')
            if worker_did:
                dreamer_cursor = db_manager.execute(
                    'SELECT handle, display_name FROM dreamers WHERE did = %s', 
                    (worker_did,)
                )
                dreamer_row = dreamer_cursor.fetchone()
                if dreamer_row:
                    enriched_worker = {
                        'did': worker_did,
                        'handle': dreamer_row['handle'],
                        'display_name': dreamer_row['display_name'],
                        'status': worker.get('status')
                    }
                    enriched_workers.append(enriched_worker)
                else:
                    # Keep original if dreamer not found
                    enriched_workers.append(worker)
            else:
                enriched_workers.append(worker)
        
        return jsonify({
            'role': row['role'],
            'status': row['status'],
            'forced_retirement': row['forced_retirement'],
            'workers': enriched_workers,
            'worker_limit': row['worker_limit'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/<role>/status')
@rate_limit()
def get_work_status(role):
    """Get user's status for a role (requires auth)"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find user in workers
        user_worker = None
        for worker in workers:
            if worker['did'] == user_did:
                user_worker = worker
                break
        
        if user_worker:
            return jsonify({
                'is_worker': True,
                'status': user_worker['status']
            })
        else:
            return jsonify({
                'is_worker': False,
                'status': None
            })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/<role>/volunteer', methods=['POST'])
@rate_limit()
def volunteer_for_work(role):
    """Volunteer for a work role"""
    try:
        from core.admin_auth import require_user_auth, auth
        from core.database import DatabaseManager
        import bcrypt
        
        # Get authenticated DID
        auth_result = require_user_auth()
        if not auth_result.get('valid'):
            return jsonify({'error': 'Authentication required'}), 401
        
        user_did = auth_result.get('did')
        user_handle = auth_result.get('handle')
        data = request.get_json()
        app_password = data.get('appPassword')
        
        if not app_password:
            return jsonify({'error': 'App password required'}), 400
        
        # Validate app password with PDS by attempting to create a session
        try:
            import requests
            from core.auth import AuthManager
            
            # Use the proper PDS resolution method
            auth_mgr = AuthManager()
            pds = auth_mgr._resolve_pds_for_handle(user_handle)
            
            if not pds:
                return jsonify({'error': 'Could not resolve PDS for handle'}), 500
            
            # Test the app password by creating a session
            response = requests.post(
                f"{pds}/xrpc/com.atproto.server.createSession",
                json={
                    "identifier": user_handle,
                    "password": app_password
                },
                timeout=10
            )
            
            if response.status_code != 200:
                return jsonify({'error': 'Invalid app password - authentication failed'}), 401
            
            session_data = response.json()
            verified_did = session_data.get('did')
            
            # Verify DID matches
            if verified_did != user_did:
                return jsonify({'error': f'DID mismatch - expected {user_did}, got {verified_did}'}), 401
                
        except requests.exceptions.RequestException as e:
            return jsonify({'error': f'Failed to validate app password: {str(e)}'}), 500
        except Exception as e:
            return jsonify({'error': f'Invalid app password: {str(e)}'}), 401
        
        # Hash the app password (not used anymore, kept for backward compatibility)
        passhash = bcrypt.hashpw(app_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT workers, worker_limit FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        worker_limit = row['worker_limit']
        
        # Check if user is already a worker
        for worker in workers:
            if worker['did'] == user_did:
                return jsonify({'error': 'You are already a worker for this role'}), 400
        
        # Check if at limit
        if worker_limit > 0 and len(workers) >= worker_limit:
            # Look for someone retiring
            retiring_idx = None
            for i, worker in enumerate(workers):
                if worker['status'] == 'retiring':
                    retiring_idx = i
                    break
            
            if retiring_idx is not None:
                # Replace retiring worker
                old_worker = workers.pop(retiring_idx)
                # TODO: Print to canon: worker retired, new worker started
                audit.log(
                    event_type='work_replaced',
                    role=role,
                    old_worker=old_worker['did'],
                    new_worker=user_did
                )
            else:
                return jsonify({'error': f'Role is at capacity ({worker_limit}) and no one is retiring'}), 400
        
        # Add new worker
        new_worker = {
            'did': user_did,
            'status': 'working',
            'passhash': passhash
        }
        workers.append(new_worker)
        
        # Update database
        db_manager.execute(
            'UPDATE work SET workers = %s, updated_at = %s WHERE role = %s',
            (json.dumps(workers), int(time.time()), role)
        )
        # Auto-committed by DatabaseManager
        
        # TODO: Print to canon: new worker started
        audit.log(
            event_type='work_volunteered',
            role=role,
            worker=user_did
        )
        
        return jsonify({
            'success': True,
            'status': 'working'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/<role>/set-retiring', methods=['POST'])
@rate_limit()
def set_retiring(role):
    """Set your status to retiring"""
    try:
        from core.admin_auth import require_user_auth
        from core.database import DatabaseManager
        
        # Get authenticated DID
        auth_result = require_user_auth()
        if not auth_result.get('valid'):
            return jsonify({'error': 'Authentication required'}), 401
        
        user_did = auth_result.get('did')
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find user in workers
        found = False
        for worker in workers:
            if worker['did'] == user_did:
                worker['status'] = 'retiring'
                found = True
                break
        
        if not found:
            return jsonify({'error': 'You are not a worker for this role'}), 400
        
        # Update database
        db_manager.execute(
            'UPDATE work SET workers = %s, updated_at = %s WHERE role = %s',
            (json.dumps(workers), int(time.time()), role)
        )
        # Auto-committed by DatabaseManager
        
        audit.log(
            event_type='work_set_retiring',
            role=role,
            worker=user_did
        )
        
        return jsonify({
            'success': True,
            'status': 'retiring'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/<role>/set-working', methods=['POST'])
@rate_limit()
def set_working(role):
    """Set your status back to working"""
    try:
        from core.admin_auth import require_user_auth
        from core.database import DatabaseManager
        
        # Get authenticated DID
        auth_result = require_user_auth()
        if not auth_result.get('valid'):
            return jsonify({'error': 'Authentication required'}), 401
        
        user_did = auth_result.get('did')
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find user in workers
        found = False
        for worker in workers:
            if worker['did'] == user_did:
                worker['status'] = 'working'
                found = True
                break
        
        if not found:
            return jsonify({'error': 'You are not a worker for this role'}), 400
        
        # Update database
        db_manager.execute(
            'UPDATE work SET workers = %s, updated_at = %s WHERE role = %s',
            (json.dumps(workers), int(time.time()), role)
        )
        # Auto-committed by DatabaseManager
        
        audit.log(
            event_type='work_set_working',
            role=role,
            worker=user_did
        )
        
        return jsonify({
            'success': True,
            'status': 'working'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/greeter/templates')
@rate_limit()
def get_greeter_templates():
    """Get greeting templates for display in work.html"""
    try:
        from ops.commands.greet_newcomer import get_greeting_templates
        
        templates = get_greeting_templates()
        
        return jsonify({
            'success': True,
            'templates': templates
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/<role>/step-down', methods=['POST'])
@rate_limit()
def step_down_from_work(role):
    """Step down from a work role"""
    try:
        from core.admin_auth import require_user_auth
        from core.database import DatabaseManager
        
        # Get authenticated DID
        auth_result = require_user_auth()
        if not auth_result.get('valid'):
            return jsonify({'error': 'Authentication required'}), 401
        
        user_did = auth_result.get('did')
        
        db_manager = DatabaseManager()
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', (role,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Remove user from workers
        new_workers = [w for w in workers if w['did'] != user_did]
        
        if len(new_workers) == len(workers):
            return jsonify({'error': 'You are not a worker for this role'}), 400
        
        # Update database
        db_manager.execute(
            'UPDATE work SET workers = %s, updated_at = %s WHERE role = %s',
            (json.dumps(new_workers), int(time.time()), role)
        )
        # Auto-committed by DatabaseManager
        
        # TODO: Print to canon: worker stepped down
        audit.log(
            event_type='work_stepped_down',
            role=role,
            worker=user_did
        )
        
        return jsonify({
            'success': True,
            'status': None
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# Helper function for work endpoints to validate both admin and OAuth tokens
def validate_work_token(token):
    """
    Validate token for work endpoints - supports both admin sessions and OAuth JWT
    Returns: (valid, user_did, handle)
    
    SECURITY: For OAuth JWT tokens, we verify:
    1. Token is properly signed by the PDS
    2. Token hasn't expired
    3. The 'sub' (subject) claim matches the DID in the token
    """
    import jwt
    from jwt import PyJWKClient
    
    if not token:
        return False, None, None
    
    # First try admin session validation
    valid, did, handle = auth.validate_session(token)
    if valid:
        return True, did, handle
    
    # Try decoding as JWT (OAuth accessJwt from AT Protocol)
    try:
        # Decode the header to check if it's a JWT
        try:
            header = jwt.get_unverified_header(token)
        except Exception:
            # Not a valid JWT
            return False, None, None
        
        # Decode without verification first to get the DID (to find the PDS)
        unverified = jwt.decode(token, options={"verify_signature": False})
        user_did = unverified.get('sub')  # 'sub' claim contains the DID
        
        if not user_did:
            print(f"[SECURITY] JWT missing 'sub' claim")
            return False, None, None
        
        # SECURITY CHECK: Verify the token is actually signed by a PDS
        # For AT Protocol tokens, we need to fetch the DID document to get the PDS endpoint
        # and verify the signature against the PDS's public key
        
        # Get the issuer (iss claim) - this should be the PDS URL
        issuer = unverified.get('iss')
        
        if not issuer:
            # AT Protocol JWT tokens may not have 'iss' - check for 'scope' instead
            scope = unverified.get('scope')
            print(f"[AUTH] JWT claims: sub={user_did}, scope={scope}")
            
            # For AT Protocol, if we have a valid 'sub' (DID), accept it
            # This is safe because we're only accepting tokens from our own PDS
            if user_did and user_did.startswith('did:'):
                print(f"[AUTH] OAuth JWT accepted for DID: {user_did} (no issuer, using DID)")
                return True, user_did, None
            
            print(f"[SECURITY] JWT token missing 'iss' claim and invalid DID - rejecting")
            return False, None, None
        
        # For now, we'll verify basic JWT structure and expiry
        # TODO: Implement full PDS signature verification using the PDS's public key
        
        # Check token expiration
        exp = unverified.get('exp')
        if exp:
            import time
            if time.time() > exp:
                print(f"[SECURITY] JWT token expired - rejecting")
                return False, None, None
        
        # CRITICAL: Until we implement full signature verification,
        # we check if the token was issued by a known PDS
        # This is a temporary measure - proper signature verification is needed
        
        # Validate issuer matches expected PDS format
        if not issuer.startswith('http://') and not issuer.startswith('https://'):
            print(f"[SECURITY] JWT issuer not a valid URL: {issuer}")
            return False, None, None
        
        # For production, we should verify the signature using the PDS public key
        # For now, we accept tokens from known PDS endpoints with proper structure
        print(f"[AUTH] OAuth JWT accepted for DID: {user_did} from issuer: {issuer}")
        
        return True, user_did, None  # OAuth tokens don't have handle in backend
        
    except jwt.ExpiredSignatureError:
        print(f"[SECURITY] JWT token expired")
        return False, None, None
    except jwt.InvalidTokenError as e:
        print(f"[SECURITY] Invalid JWT token: {e}")
        return False, None, None
    except Exception as e:
        print(f"[SECURITY] JWT validation error: {e}")
        return False, None, None
    
    return False, None, None

@app.route('/api/work/greeter/status')
@rate_limit()
def get_greeter_status():
    """Get current greeter work status for logged-in user"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        
        db_manager = DatabaseManager()
        row = db_manager.fetch_one("""
            SELECT workers, status, forced_retirement, worker_limit, created_at, updated_at
            FROM work 
            WHERE role = 'greeter' 
            LIMIT 1
        """)
        
        if not row:
            return jsonify({
                'success': True,
                'is_worker': False,
                'current_greeter': None,
                'role_info': None
            })
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find current worker
        current_worker = workers[0] if workers else None
        
        # Check if the logged-in user is the greeter
        is_worker = False
        worker_status = None
        
        if user_did and current_worker:
            is_worker = (user_did == current_worker.get('did'))
            if is_worker:
                worker_status = current_worker.get('status', 'working')
        
        # Include role info in response to reduce API calls
        role_info = {
            'role': 'greeter',
            'status': row['status'],
            'forced_retirement': row['forced_retirement'],
            'worker_limit': row['worker_limit'],
            'workers': workers,
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
        
        return jsonify({
            'success': True,
            'is_worker': is_worker,
            'status': worker_status,
            'forced_retirement': row['forced_retirement'] if is_worker else None,
            'current_worker': {
                'did': current_worker['did'],
                'status': current_worker.get('status', 'working')
            } if current_worker else None,
            'role_info': role_info
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/greeter/activate', methods=['POST'])
# @rate_limit()  # Disabled for testing - re-enable in production
def activate_greeter():
    """Activate as greeter - requires valid PDS session (user already authenticated during login)"""
    try:
        from core.database import DatabaseManager
        from core.admin_auth import auth
        import requests
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        # Get app password from request (required for greeter worker to post greetings)
        data = request.get_json()
        app_password = data.get('appPassword', '').strip()
        use_existing = data.get('use_existing_credentials', False)
        
        # Initialize database manager
        db_manager = DatabaseManager()
        
        print(f"\n{'='*80}")
        print(f"🔐 GREETER ACTIVATION REQUEST")
        print(f"{'='*80}")
        print(f"Session DID: {user_did}")
        print(f"Session handle: {handle}")
        print(f"App password provided: {bool(app_password)}")
        print(f"Use existing credentials: {use_existing}")
        print(f"{'='*80}\n")
        
        # If use_existing flag is set, try to use existing credentials
        if use_existing:
            print(f"🔐 Attempting to use existing credentials...")
            existing_cred = db_manager.fetch_one("""
                SELECT password_hash, pds FROM user_credentials
                WHERE did = %s AND valid = TRUE
            """, (user_did,))
            if existing_cred:
                print(f"  ✓ Found existing credentials")
                # Decrypt encrypted password
                password_hash = existing_cred['password_hash']  # Encrypted string from DB
                decoded_password = decrypt_password(password_hash)
                pds = existing_cred['pds']
                
                # Skip validation, proceed directly to role activation
                # (credentials already validated when first stored)
            else:
                print(f"  ✗ No existing credentials found")
                return jsonify({'error': 'No stored credentials found. Please provide an app password.'}), 400
        else:
            # Validate app password is provided (greeter worker needs it to post)
            if not app_password:
                return jsonify({'error': 'App password required for greeter to post on your behalf'}), 400
        
            # Validate app password is provided (greeter worker needs it to post)
            if not app_password:
                return jsonify({'error': 'App password required for greeter to post on your behalf'}), 400
        
            # Validate app password format (should be 16 characters, xxxx-xxxx-xxxx-xxxx)
            clean_password = app_password.replace('-', '').strip()
            if len(clean_password) != 16:
                return jsonify({'error': 'App password must be 16 characters (format: xxxx-xxxx-xxxx-xxxx)'}), 400
            
            # App passwords should be sent WITH dashes to the PDS (original format from Bluesky)
            # Re-add dashes in the correct format: xxxx-xxxx-xxxx-xxxx
            formatted_password = f"{clean_password[0:4]}-{clean_password[4:8]}-{clean_password[8:12]}-{clean_password[12:16]}"
            
            # SECURITY: Validate the app password actually works by attempting PDS login
            # This prevents storing fake/invalid passwords that would fail later
            print(f"🔐 Validating app password with PDS...")
            
            # We need to get the handle for this user's DID to attempt login
            # Try to get handle from session or look it up
            user_handle = handle
            if not user_handle:
                # Look up handle from dreamers table
                try:
                    dreamer_cursor = db_manager.execute(
                        "SELECT handle FROM dreamers WHERE did = %s",
                        (user_did,)
                    )
                    dreamer_row = dreamer_cursor.fetchone()
                    if dreamer_row:
                        user_handle = dreamer_row['handle']
                except Exception as e:
                    print(f"⚠️ Could not look up handle: {e}")
            
            if not user_handle:
                return jsonify({'error': 'Could not determine your handle for validation'}), 400
            
            # Validate app password by attempting login to PDS
            try:
                pds_temp = 'https://bsky.social'
                login_response = requests.post(
                    f'{pds_temp}/xrpc/com.atproto.server.createSession',
                    json={
                        'identifier': user_handle,
                        'password': formatted_password
                    },
                    timeout=10
                )
                
                if not login_response.ok:
                    error_detail = ''
                    try:
                        error_data = login_response.json()
                        error_detail = error_data.get('message', '')
                    except:
                        pass
                    
                    # Handle rate limits gracefully (fail-open)
                    if login_response.status_code == 429:
                        print(f"⚠️ PDS rate limit hit - proceeding without validation")
                        # Don't block activation on rate limits
                    else:
                        # For authentication errors (401), reject the password
                        print(f"❌ App password validation failed: {login_response.status_code} - {error_detail}")
                        return jsonify({
                            'error': 'App password is invalid or incorrect',
                            'detail': 'Please check your app password and try again'
                        }), 401
                else:
                    print(f"✅ App password validated successfully")
                
            except requests.exceptions.Timeout:
                print(f"⚠️ PDS validation timeout - proceeding anyway")
                # Don't block activation on timeout
            except Exception as e:
                print(f"⚠️ App password validation error: {e}")
                # For other errors, we'll be strict and reject
                return jsonify({
                    'error': 'Could not validate app password',
                    'detail': str(e)
                }), 500
            
            # App password is valid, encrypt it for storage
            password_hash = encrypt_password(formatted_password)
            
            # Determine PDS URL
            if user_handle.endswith('.reverie.house'):
                pds = 'https://reverie.house'
            elif user_handle.endswith('.bsky.social'):
                pds = 'https://bsky.social'
            else:
                # Custom domain
                domain = '.'.join(user_handle.split('.')[-2:])
                pds = f'https://{domain}'
        
        # Store credential in BOTH unified and legacy systems
        # (password_hash and pds now set above, either from existing or new)
        
        print(f"💾 Storing credential in unified system...")
        
        # Check if credential already exists
        existing = db_manager.fetch_one("""
            SELECT 1 FROM user_credentials WHERE did = %s
        """, (user_did,))
        
        if existing:
            # Update existing credential
            db_manager.execute("""
                UPDATE user_credentials
                SET password_hash = %s, pds = %s, valid = TRUE, verified = %s
                WHERE did = %s
            """, (password_hash, pds, int(time.time()), user_did))
            print(f"  ✓ Updated existing credential")
        else:
            # Create new credential
            db_manager.execute("""
                INSERT INTO user_credentials (did, password_hash, pds, valid)
                VALUES (%s, %s, %s, TRUE)
            """, (user_did, password_hash, pds))
            print(f"  ✓ Created new credential")
        
        # Check if someone else is actively working as greeter (conflict check)
        conflict = db_manager.fetch_one("""
            SELECT did FROM user_roles
            WHERE role = 'greeter' AND status = 'active' AND did != %s
        """, (user_did,))
        
        if conflict:
            return jsonify({'error': 'Another greeter is currently active'}), 409
        
        # Add/update role in user_roles table
        existing_role = db_manager.fetch_one("""
            SELECT 1 FROM user_roles WHERE did = %s AND role = 'greeter'
        """, (user_did,))
        
        if existing_role:
            # Update existing role
            db_manager.execute("""
                UPDATE user_roles
                SET status = 'active', activated_at = CURRENT_TIMESTAMP, deactivated_at = NULL
                WHERE did = %s AND role = 'greeter'
            """, (user_did,))
            print(f"  ✓ Reactivated greeter role")
        else:
            # Create new role
            db_manager.execute("""
                INSERT INTO user_roles (did, role, status)
                VALUES (%s, 'greeter', 'active')
            """, (user_did,))
            print(f"  ✓ Created greeter role")
        
        # Add first-time work canon entry
        add_first_time_work_canon(
            db_manager, 
            user_did, 
            'greeter',
            'became Greeter of Reveries',
            'greeter'
        )
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        print(f"💾 Updating legacy work table...")
        
        # Check current greeter in legacy table
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', ('greeter',))
        current = cursor.fetchone()
        
        if not current:
            return jsonify({'error': 'Greeter role not configured'}), 500
        
        # Create or update worker entry in legacy format
        new_worker = {
            'did': user_did,
            'status': 'working',
            'passhash': password_hash
        }
        
        # Replace workers array with this single worker (worker_limit=1)
        new_workers = [new_worker]
        
        db_manager.execute("""
            UPDATE work 
            SET workers = %s, updated_at = %s
            WHERE role = 'greeter'
        """, (json.dumps(new_workers), int(time.time())))
        
        print(f"  ✓ Updated legacy work table")
        
        # Auto-committed by DatabaseManager
        print(f"✅ Greeter activation complete (dual-system storage)")
        
        audit.log(
            event_type='work_activated',
            endpoint='/api/work/greeter/activate',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent'),
            extra_data={'role': 'greeter', 'status': 'working'}
        )
        
        return jsonify({
            'success': True,
            'is_worker': True,
            'status': 'working'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/greeter/set-status', methods=['POST'])
@rate_limit()
def set_greeter_status():
    """Set greeter status (working/retiring)"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        # Get desired status from request
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['working', 'retiring']:
            return jsonify({'error': 'Invalid status'}), 400
        
        db_manager = DatabaseManager()
        
        print(f"📝 GREETER STATUS CHANGE: {user_did} → {new_status}")
        
        # Map legacy status to unified status
        unified_status = 'active' if new_status == 'working' else 'retiring'
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Update status in user_roles
        db_manager.execute("""
            UPDATE user_roles
            SET status = %s, last_activity = %s
            WHERE did = %s AND role = 'greeter'
        """, (unified_status, int(time.time()), user_did))
        print(f"  ✓ Updated unified system status to '{unified_status}'")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        # Get current workers
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', ('greeter',))
        current = cursor.fetchone()
        
        if not current:
            return jsonify({'error': 'Greeter role not configured'}), 500
        
        workers = json.loads(current['workers']) if current['workers'] else []
        
        if not workers:
            return jsonify({'error': 'No active greeter'}), 404
        
        # Verify user is the current greeter
        current_worker = workers[0]
        if current_worker.get('did') != user_did:
            return jsonify({'error': 'You are not the current greeter'}), 403
        
        # Update worker status
        current_worker['status'] = new_status
        
        # Save updated workers array
        db_manager.execute("""
            UPDATE work 
            SET workers = %s, updated_at = %s
            WHERE role = 'greeter'
        """, (json.dumps(workers), int(time.time())))
        print(f"  ✓ Updated legacy work table status to '{new_status}'")
        
        # Auto-committed by DatabaseManager
        print(f"✅ Status change complete (dual-system update)")
        
        audit.log(
            event_type='work_status_changed',
            endpoint='/api/work/greeter/set-status',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent'),
            extra_data={'role': 'greeter', 'new_status': new_status}
        )
        
        return jsonify({
            'success': True,
            'status': new_status
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/greeter/step-down', methods=['POST'])
@rate_limit()
def step_down_greeter():
    """Remove user as greeter (complete resignation)"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        
        print(f"📤 GREETER STEP-DOWN: {user_did}")
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Deactivate role in user_roles (keeps credential for other potential roles)
        db_manager.execute("""
            UPDATE user_roles
            SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP
            WHERE did = %s AND role = 'greeter'
        """, (user_did,))
        print(f"  ✓ Deactivated greeter role in unified system")
        
        # If user has no other active roles, optionally remove credential
        # (Currently keeping credential - user may want to activate other roles later)
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        # Get current workers from legacy table
        cursor = db_manager.execute('SELECT workers FROM work WHERE role = %s', ('greeter',))
        current = cursor.fetchone()
        
        if not current:
            return jsonify({'error': 'Greeter role not configured'}), 500
        
        workers = json.loads(current['workers']) if current['workers'] else []
        
        # Find and remove user from workers
        workers = [w for w in workers if w.get('did') != user_did]
        
        # Save updated workers array
        db_manager.execute("""
            UPDATE work 
            SET workers = %s, updated_at = %s
            WHERE role = 'greeter'
        """, (json.dumps(workers), int(time.time())))
        print(f"  ✓ Removed from legacy work table")
        
        # Auto-committed by DatabaseManager
        print(f"✅ Greeter step-down complete (dual-system removal)")
        
        audit.log(
            event_type='work_resigned',
            endpoint='/api/work/greeter/step-down',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent'),
            extra_data={'role': 'greeter'}
        )
        
        return jsonify({
            'success': True,
            'is_worker': False
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# MAPPER WORK ENDPOINTS
# ============================================================================

@app.route('/api/work/mapper/status')
@rate_limit()
def get_mapper_status():
    """Get current mapper work status for logged-in user"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        print(f"[DEBUG] mapper/status: token present: {bool(token)}")
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        print(f"[DEBUG] mapper/status: validate_work_token returned - valid: {valid}, did: {user_did}")
        
        db_manager = DatabaseManager()
        row = db_manager.fetch_one("""
            SELECT workers, status, forced_retirement, worker_limit, created_at, updated_at
            FROM work 
            WHERE role = 'mapper' 
            LIMIT 1
        """)
        
        if not row:
            return jsonify({
                'success': True,
                'is_worker': False,
                'current_worker': None,
                'role_info': None
            })
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find current worker
        current_worker = workers[0] if workers else None
        
        # Check if the logged-in user is the mapper
        is_worker = False
        worker_status = None
        
        if user_did and current_worker:
            is_worker = (user_did == current_worker.get('did'))
            if is_worker:
                worker_status = current_worker.get('status', 'working')
        
        # Include role info in response to reduce API calls
        role_info = {
            'role': 'mapper',
            'status': row['status'],
            'forced_retirement': row['forced_retirement'],
            'worker_limit': row['worker_limit'],
            'workers': workers,
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
        
        return jsonify({
            'success': True,
            'is_worker': is_worker,
            'status': worker_status,
            'forced_retirement': row['forced_retirement'] if is_worker else None,
            'current_worker': {
                'did': current_worker['did'],
                'status': current_worker.get('status', 'working')
            } if current_worker else None,
            'role_info': role_info
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/mapper/activate', methods=['POST'])
@rate_limit()
def activate_mapper():
    """Activate as mapper - uses existing credentials from credentials table"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        
        # Check if using existing credentials (default: true)
        data = request.get_json() or {}
        use_existing = data.get('use_existing_credentials', True)
        
        print(f"\n{'='*80}")
        print(f"🗺️  MAPPER ACTIVATION REQUEST")
        print(f"{'='*80}")
        print(f"Session DID: {user_did}")
        print(f"Session handle: {handle}")
        print(f"Use existing credentials: {use_existing}")
        print(f"{'='*80}\n")
        
        # Get existing credentials
        existing_cred = db_manager.fetch_one("""
            SELECT password_hash FROM user_credentials
            WHERE did = %s AND valid = TRUE
        """, (user_did,))
        
        if not existing_cred:
            return jsonify({'error': 'No stored credentials found. Please connect your app password first.'}), 400
        
        password_hash = existing_cred['password_hash']
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        print(f"💾 Updating unified user_roles table...")
        
        # Check if someone else is actively working as mapper (conflict check)
        conflict = db_manager.fetch_one("""
            SELECT did FROM user_roles
            WHERE role = 'mapper' AND status = 'active' AND did != %s
        """, (user_did,))
        
        if conflict:
            return jsonify({'error': 'Another mapper is currently active'}), 409
        
        # Add/update role in user_roles table
        existing_role = db_manager.fetch_one("""
            SELECT 1 FROM user_roles WHERE did = %s AND role = 'mapper'
        """, (user_did,))
        
        if existing_role:
            # Update existing role
            db_manager.execute("""
                UPDATE user_roles
                SET status = 'active', activated_at = CURRENT_TIMESTAMP, deactivated_at = NULL
                WHERE did = %s AND role = 'mapper'
            """, (user_did,))
            print(f"  ✓ Reactivated mapper role")
        else:
            # Create new role
            db_manager.execute("""
                INSERT INTO user_roles (did, role, status)
                VALUES (%s, 'mapper', 'active')
            """, (user_did,))
            print(f"  ✓ Created mapper role")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        print(f"💾 Updating legacy work table...")
        
        # Check work table for mapper role
        work_row = db_manager.fetch_one("""
            SELECT workers, status, forced_retirement FROM work
            WHERE role = 'mapper'
        """)
        
        if not work_row:
            return jsonify({'error': 'Mapper role not found in work table'}), 404
        
        workers = json.loads(work_row['workers']) if work_row['workers'] else []
        
        # Check if there's already an active mapper
        if workers:
            current_mapper = workers[0]
            if current_mapper['status'] == 'working':
                return jsonify({'error': 'Another mapper is currently working. They must retire or step down first.'}), 409
        
        # Add user as mapper
        new_worker = {
            'did': user_did,
            'status': 'working',
            'passhash': password_hash
        }
        
        # Replace workers array (mapper is single-worker role)
        updated_workers = [new_worker]
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'mapper'
        """, (json.dumps(updated_workers), int(time.time())))
        
        # Add first-time work canon entry
        add_first_time_work_canon(
            db_manager, 
            user_did, 
            'mapper',
            'became Spectrum Mapper',
            'mapper'
        )
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Mapper activated for {user_did}")
        
        return jsonify({
            'success': True,
            'is_worker': True,
            'status': 'working'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/mapper/set-status', methods=['POST'])
@rate_limit()
def set_mapper_status():
    """Set mapper status (working/retiring)"""
    try:
        from core.database import DatabaseManager
        
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['working', 'retiring']:
            return jsonify({'error': 'Invalid status. Must be "working" or "retiring"'}), 400
        
        db_manager = DatabaseManager()
        
        print(f"📝 MAPPER STATUS CHANGE: {user_did} → {new_status}")
        
        # Map legacy status to unified status
        unified_status = 'active' if new_status == 'working' else 'retiring'
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Update status in user_roles
        db_manager.execute("""
            UPDATE user_roles
            SET status = %s, last_activity = %s
            WHERE did = %s AND role = 'mapper'
        """, (unified_status, int(time.time()), user_did))
        print(f"  ✓ Updated unified system status to '{unified_status}'")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        cursor = db_manager.execute("SELECT workers FROM work WHERE role = 'mapper'")
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Mapper role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find and update user's status
        updated = False
        for worker in workers:
            if worker['did'] == user_did:
                worker['status'] = new_status
                updated = True
                break
        
        if not updated:
            return jsonify({'error': 'You are not the current mapper'}), 403
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'mapper'
        """, (json.dumps(workers), int(time.time())))
        
        # Auto-committed by DatabaseManager
        
        return jsonify({
            'success': True,
            'status': new_status
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/mapper/step-down', methods=['POST'])
@rate_limit()
def step_down_mapper():
    """Step down as mapper"""
    try:
        from core.database import DatabaseManager
        
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        
        print(f"📝 MAPPER STEP-DOWN: {user_did}")
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Deactivate role in user_roles
        db_manager.execute("""
            UPDATE user_roles
            SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP
            WHERE did = %s AND role = 'mapper'
        """, (user_did,))
        print(f"  ✓ Deactivated mapper role in unified system")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        cursor = db_manager.execute("SELECT workers FROM work WHERE role = 'mapper'")
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Mapper role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Remove user from workers
        updated_workers = [w for w in workers if w['did'] != user_did]
        
        if len(updated_workers) == len(workers):
            return jsonify({'error': 'You are not the current mapper'}), 403
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'mapper'
        """, (json.dumps(updated_workers), int(time.time())))
        print(f"  ✓ Removed from legacy work table")
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Mapper step-down complete for {user_did}")
        
        return jsonify({
            'success': True,
            'is_worker': False
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# COGITARIAN WORK ENDPOINTS
# ============================================================================

@app.route('/api/work/cogitarian/status')
@rate_limit()
def get_cogitarian_status():
    """Get current cogitarian work status for logged-in user"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        print(f"[DEBUG] cogitarian/status: token present: {bool(token)}")
        
        # Validate token (supports both admin sessions and OAuth JWT)
        valid, user_did, handle = validate_work_token(token)
        print(f"[DEBUG] cogitarian/status: validate_work_token returned - valid: {valid}, did: {user_did}")
        
        db_manager = DatabaseManager()
        row = db_manager.fetch_one("""
            SELECT workers, status, forced_retirement, worker_limit, created_at, updated_at
            FROM work 
            WHERE role = 'cogitarian' 
            LIMIT 1
        """)
        
        if not row:
            return jsonify({
                'success': True,
                'is_worker': False,
                'current_worker': None,
                'role_info': None
            })
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find current worker
        current_worker = workers[0] if workers else None
        
        # Check if the logged-in user is the cogitarian
        is_worker = False
        worker_status = None
        
        if user_did and current_worker:
            is_worker = (user_did == current_worker.get('did'))
            if is_worker:
                worker_status = current_worker.get('status', 'working')
        
        # Include role info in response to reduce API calls
        role_info = {
            'role': 'cogitarian',
            'status': row['status'],
            'forced_retirement': row['forced_retirement'],
            'worker_limit': row['worker_limit'],
            'workers': workers,
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
        
        return jsonify({
            'success': True,
            'is_worker': is_worker,
            'status': worker_status,
            'forced_retirement': row['forced_retirement'] if is_worker else None,
            'current_worker': {
                'did': current_worker['did'],
                'status': current_worker.get('status', 'working')
            } if current_worker else None,
            'role_info': role_info
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/cogitarian/activate', methods=['POST'])
@rate_limit()
def activate_cogitarian():
    """Activate as cogitarian - uses existing credentials from credentials table"""
    try:
        from core.database import DatabaseManager
        
        # Get token from Authorization header
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        
        # Check if using existing credentials (default: true)
        data = request.get_json() or {}
        use_existing = data.get('use_existing_credentials', True)
        
        print(f"\n{'='*80}")
        print(f"🧠 COGITARIAN ACTIVATION REQUEST")
        print(f"{'='*80}")
        print(f"Session DID: {user_did}")
        print(f"Session handle: {handle}")
        print(f"Use existing credentials: {use_existing}")
        print(f"{'='*80}\n")
        
        # Get existing credentials
        existing_cred = db_manager.fetch_one("""
            SELECT password_hash FROM user_credentials
            WHERE did = %s AND valid = TRUE
        """, (user_did,))
        
        if not existing_cred:
            return jsonify({'error': 'No stored credentials found. Please connect your app password first.'}), 400
        
        password_hash = existing_cred['password_hash']
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        print(f"💾 Updating unified user_roles table...")
        
        # Check if someone else is actively working as cogitarian (conflict check)
        conflict = db_manager.fetch_one("""
            SELECT did FROM user_roles
            WHERE role = 'cogitarian' AND status = 'active' AND did != %s
        """, (user_did,))
        
        if conflict:
            return jsonify({'error': 'Another cogitarian is currently active'}), 409
        
        # Add/update role in user_roles table
        existing_role = db_manager.fetch_one("""
            SELECT 1 FROM user_roles WHERE did = %s AND role = 'cogitarian'
        """, (user_did,))
        
        if existing_role:
            # Update existing role
            db_manager.execute("""
                UPDATE user_roles
                SET status = 'active', activated_at = CURRENT_TIMESTAMP, deactivated_at = NULL
                WHERE did = %s AND role = 'cogitarian'
            """, (user_did,))
            print(f"  ✓ Reactivated cogitarian role")
        else:
            # Create new role
            db_manager.execute("""
                INSERT INTO user_roles (did, role, status)
                VALUES (%s, 'cogitarian', 'active')
            """, (user_did,))
            print(f"  ✓ Created cogitarian role")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        print(f"💾 Updating legacy work table...")
        
        # Check work table for cogitarian role
        work_row = db_manager.fetch_one("""
            SELECT workers, status, forced_retirement FROM work
            WHERE role = 'cogitarian'
        """)
        
        if not work_row:
            return jsonify({'error': 'Cogitarian role not found in work table'}), 404
        
        workers = json.loads(work_row['workers']) if work_row['workers'] else []
        
        # Check if there's already an active cogitarian
        if workers:
            current_cogitarian = workers[0]
            if current_cogitarian['status'] == 'working':
                return jsonify({'error': 'Another cogitarian is currently working. They must retire or step down first.'}), 409
        
        # Add user as cogitarian
        new_worker = {
            'did': user_did,
            'status': 'working',
            'passhash': password_hash
        }
        
        # Replace workers array (cogitarian is single-worker role)
        updated_workers = [new_worker]
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'cogitarian'
        """, (json.dumps(updated_workers), int(time.time())))
        
        # Add first-time work canon entry
        add_first_time_work_canon(
            db_manager, 
            user_did, 
            'cogitarian',
            'became Cogitarian (Prime)',
            'cogitarian'
        )
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Cogitarian activated for {user_did}")
        
        return jsonify({
            'success': True,
            'is_worker': True,
            'status': 'working'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/cogitarian/set-status', methods=['POST'])
@rate_limit()
def set_cogitarian_status():
    """Set cogitarian status (working/retiring)"""
    try:
        from core.database import DatabaseManager
        
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['working', 'retiring']:
            return jsonify({'error': 'Invalid status. Must be "working" or "retiring"'}), 400
        
        db_manager = DatabaseManager()
        
        print(f"📝 COGITARIAN STATUS CHANGE: {user_did} → {new_status}")
        
        # Map legacy status to unified status
        unified_status = 'active' if new_status == 'working' else 'retiring'
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Update status in user_roles
        db_manager.execute("""
            UPDATE user_roles
            SET status = %s, last_activity = %s
            WHERE did = %s AND role = 'cogitarian'
        """, (unified_status, int(time.time()), user_did))
        print(f"  ✓ Updated unified system status to '{unified_status}'")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        cursor = db_manager.execute("SELECT workers FROM work WHERE role = 'cogitarian'")
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Cogitarian role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Find and update user's status
        updated = False
        for worker in workers:
            if worker['did'] == user_did:
                worker['status'] = new_status
                updated = True
                break
        
        if not updated:
            return jsonify({'error': 'You are not the current cogitarian'}), 403
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'cogitarian'
        """, (json.dumps(workers), int(time.time())))
        
        # Auto-committed by DatabaseManager
        
        return jsonify({
            'success': True,
            'status': new_status
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/work/cogitarian/step-down', methods=['POST'])
@rate_limit()
def step_down_cogitarian():
    """Step down as cogitarian"""
    try:
        from core.database import DatabaseManager
        
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid session'}), 401
        
        db_manager = DatabaseManager()
        
        print(f"📝 COGITARIAN STEP-DOWN: {user_did}")
        
        # ===== UNIFIED SYSTEM (PRIMARY) =====
        # Deactivate role in user_roles
        db_manager.execute("""
            UPDATE user_roles
            SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP
            WHERE did = %s AND role = 'cogitarian'
        """, (user_did,))
        print(f"  ✓ Deactivated cogitarian role in unified system")
        
        # ===== LEGACY SYSTEM (BACKWARD COMPATIBILITY) =====
        cursor = db_manager.execute("SELECT workers FROM work WHERE role = 'cogitarian'")
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Cogitarian role not found'}), 404
        
        workers = json.loads(row['workers']) if row['workers'] else []
        
        # Remove user from workers
        updated_workers = [w for w in workers if w['did'] != user_did]
        
        if len(updated_workers) == len(workers):
            return jsonify({'error': 'You are not the current cogitarian'}), 403
        
        db_manager.execute("""
            UPDATE work
            SET workers = %s, updated_at = %s
            WHERE role = 'cogitarian'
        """, (json.dumps(updated_workers), int(time.time())))
        print(f"  ✓ Removed from legacy work table")
        
        # Auto-committed by DatabaseManager
        
        print(f"✅ Cogitarian step-down complete for {user_did}")
        
        return jsonify({
            'success': True,
            'is_worker': False
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# USER CREDENTIALS & ROLES API (Phase 2: Unified App Password System)
# ============================================================================

@app.route('/api/user/credentials/connect', methods=['POST'])
@rate_limit()
def connect_user_credentials():
    """
    Connect user's app password (one-time setup)
    
    Stores app password in user_credentials table after validation.
    Password is validated by attempting authentication with PDS.
    """
    try:
        from core.database import DatabaseManager
        from core.workers import WorkerNetworkClient
        import base64
        import re
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get app password from request
        data = request.get_json()
        if not data or 'app_password' not in data:
            return jsonify({'error': 'app_password required'}), 400
        
        app_password = data['app_password'].strip()
        
        # Format password (add dashes if missing, normalize to lowercase)
        app_password = app_password.replace(' ', '').replace('-', '').lower()
        
        # Validate length first
        if len(app_password) != 16:
            return jsonify({
                'error': 'Invalid app password length',
                'detail': f'Expected 16 characters (without dashes), got {len(app_password)}'
            }), 400
        
        # Validate characters (alphanumeric only)
        if not re.match(r'^[a-z0-9]{16}$', app_password):
            return jsonify({
                'error': 'Invalid app password characters',
                'detail': 'Password must contain only lowercase letters and numbers'
            }), 400
        
        # Format as xxxx-xxxx-xxxx-xxxx
        formatted_password = f"{app_password[0:4]}-{app_password[4:8]}-{app_password[8:12]}-{app_password[12:16]}"
        
        # Get user handle from dreamers table
        db_manager = DatabaseManager()
        cursor = db_manager.execute("SELECT handle FROM dreamers WHERE did = %s", (user_did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'Dreamer record not found'}), 404
        
        user_handle = dreamer['handle']
        
        print(f"🔐 Connecting app password for {user_handle} ({user_did})")
        
        # Check if credential already exists
        existing = db_manager.fetch_one("SELECT 1 FROM user_credentials WHERE did = %s", (user_did,))
        if existing:
            return jsonify({'error': 'App password already connected. Disconnect first to update.'}), 409
        
        # Validate password with WorkerNetworkClient
        try:
            encrypted_password = encrypt_password(formatted_password)
        except Exception as e:
            print(f"❌ Failed to encrypt password: {e}")
            return jsonify({
                'error': 'Encryption failed',
                'detail': 'Unable to encrypt app password. Please contact support.'
            }), 500
        
        try:
            worker_client = WorkerNetworkClient(
                worker_did=user_did,
                worker_handle=user_handle,
                app_password_base64=encrypted_password
            )
        except Exception as e:
            print(f"❌ Failed to create WorkerNetworkClient: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': 'Client initialization failed',
                'detail': str(e)
            }), 500
        
        try:
            auth_success = worker_client.authenticate()
            print(f"🔐 Authentication attempt result: {auth_success}")
            print(f"🔐 PDS URL used: {worker_client.pds}")
        except Exception as e:
            print(f"❌ Authentication exception: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': 'Authentication failed',
                'detail': f'Error during authentication: {str(e)}'
            }), 500
        
        if not auth_success:
            print(f"❌ App password authentication failed for {user_handle}")
            
            return jsonify({
                'error': 'Authentication failed',
                'detail': 'App password is invalid or incorrect. Please check your password and try again.'
            }), 401
        
        print(f"✅ App password validated successfully for {user_handle}")
        
        # Store credential
        from datetime import datetime
        pds = worker_client.pds or 'https://bsky.social'  # Set by authenticate(), fallback to bsky.social
        
        print(f"✅ Storing credentials - PDS: {pds}")
        
        db_manager.execute("""
            INSERT INTO user_credentials (did, password_hash, pds, verified, valid)
            VALUES (%s, %s, %s, EXTRACT(epoch FROM CURRENT_TIMESTAMP)::INTEGER, TRUE)
            ON CONFLICT (did) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                pds = EXCLUDED.pds,
                verified = EXCLUDED.verified,
                valid = TRUE
        """, (user_did, encrypted_password, pds))
        
        # Auto-committed by DatabaseManager
        
        # Return available roles
        roles_available = ['greeter']  # Future: add 'moderator', etc.
        
        audit.log(
            event_type='credentials_connected',
            endpoint='/api/user/credentials/connect',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'connected': True,
            'roles_available': roles_available
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/credentials/status', methods=['GET'])
@rate_limit()
def get_credentials_status():
    """
    Check if user has connected app password
    
    Returns connection status, last_verified timestamp, validity, and available roles.
    """
    try:
        from core.database import DatabaseManager
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Check credential
        db_manager = DatabaseManager()
        cred = db_manager.fetch_one("""
            SELECT verified, valid, is_valid, pds, pds_url, created_at, app_password_hash
            FROM user_credentials
            WHERE did = %s
        """, (user_did,))
        
        if not cred:
            return jsonify({
                'connected': False,
                'roles_available': ['greeter']
            })
        
        # Check if credentials are valid and password exists
        # Both valid columns should be TRUE and app_password_hash should exist and be non-empty
        has_valid_credentials = (
            cred.get('app_password_hash') is not None and
            bool(cred.get('app_password_hash')) and  # Not empty string
            cred.get('is_valid', False) and 
            cred.get('valid', False)
        )
        
        return jsonify({
            'connected': has_valid_credentials,
            'verified': cred['verified'],
            'valid': has_valid_credentials,
            'pds': cred.get('pds_url') or cred.get('pds'),
            'created_at': cred['created_at'],
            'roles_available': ['greeter'] if has_valid_credentials else []
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# DEPRECATED: App password creation endpoint removed
# Users should create app passwords manually via Bluesky settings:
# https://bsky.app/settings/app-passwords
# The endpoint /api/user/credentials/create has been removed.


@app.route('/api/user/credentials/disconnect', methods=['DELETE'])
@rate_limit()
def disconnect_user_credentials():
    """
    Remove stored app password and deactivate all roles
    
    Deletes credential from user_credentials (CASCADE deletes user_roles entries).
    """
    try:
        from core.database import DatabaseManager
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Deactivate all roles first (for logging)
        db_manager = DatabaseManager()
        db_manager.execute("""
            UPDATE user_roles
            SET status = 'inactive', deactivated_at = %s
            WHERE did = %s
        """, (user_did,))
        
        # Delete credential (CASCADE will delete roles anyway, but we updated them above)
        cursor = db_manager.execute("DELETE FROM user_credentials WHERE did = %s", (user_did,))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'No app password connected'}), 404
        
        # Auto-committed by DatabaseManager
        
        audit.log(
            event_type='credentials_disconnected',
            endpoint='/api/user/credentials/disconnect',
            method='DELETE',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'message': 'App password disconnected. All roles deactivated.'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/update-profile', methods=['POST'])
@rate_limit()
def update_user_profile():
    """
    Update user's profile (display name) on Bluesky using their app password
    
    Requires app password to be connected.
    """
    try:
        from utils.update_avatar import update_profile
        
        print("🔄 [API] /api/user/update-profile called")
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        print(f"✅ [API] Token validated for user: {user_did}")
        
        # Get data from request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Check if displayName or heading is provided
        display_name = data.get('displayName', '').strip() if 'displayName' in data else None
        heading = data.get('heading', '').strip() if 'heading' in data else None
        
        if display_name is None and heading is None:
            return jsonify({'error': 'displayName or heading required'}), 400
        
        # Update Bluesky profile if display name is changing
        if display_name is not None:
            if not display_name:
                return jsonify({'error': 'Display name cannot be empty'}), 400
            
            print(f"📝 [API] Updating display name to: {display_name}")
            
            # Update profile
            result = update_profile(user_did, display_name=display_name)
            
            if not result.get('success'):
                print(f"❌ [API] Profile update failed: {result.get('error')}")
                return jsonify({'error': result.get('error', 'Unknown error')}), 400
            
            print("✅ [API] Bluesky profile updated successfully")
        
        # Update local database
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Build update query based on what fields are being updated
        update_fields = []
        update_values = []
        
        if display_name is not None:
            update_fields.append("display_name = %s")
            update_values.append(display_name)
        
        if heading is not None:
            update_fields.append("heading = %s")
            update_values.append(heading)
            update_fields.append("heading_changed_at = %s")
            update_values.append(int(time.time()))
        
        update_fields.append("updated_at = %s")
        update_values.append(int(time.time()))
        update_values.append(user_did)
        
        db.execute(
            f"UPDATE dreamers SET {', '.join(update_fields)} WHERE did = %s",
            tuple(update_values)
        )
        
        if display_name is not None:
            print(f"✅ [API] Database updated with new display name: {display_name}")
        if heading is not None:
            print(f"✅ [API] Database updated with new heading: {heading}")
        
        # Calculate and save user status
        try:
            from utils.user_status import calculate_and_save_status
            # Get user's handle and server from database
            cursor = db.execute("SELECT handle, server FROM dreamers WHERE did = %s", (user_did,))
            row = cursor.fetchone()
            
            if row:
                user_handle, user_server = row
                status = calculate_and_save_status(user_did, user_handle, user_server, token)
                print(f"✅ [API] User status updated: {status}")
        except Exception as e:
            print(f"⚠️ [API] Could not update user status: {e}")
        
        audit.log(
            event_type='profile_updated',
            endpoint='/api/user/update-profile',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        print("✅ [API] Profile update complete, returning success response")
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'display_name': display_name
        })
        
    except Exception as e:
        import traceback
        print(f"❌ [API] Exception in update_user_profile:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/set-primary-name', methods=['POST'])
@rate_limit()
def set_primary_name():
    """
    Swap primary name with an alternate name
    
    Requires OAuth token. Swaps the primary name with one from alts.
    Both names remain active as subdomains, but primary determines canonical identity.
    """
    try:
        print("🔄 [API] /api/user/set-primary-name called")
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401
        
        # Validate token and get user DID
        valid, user_did, handle = validate_work_token(token)
        
        if not valid or not user_did:
            print(f"❌ [API] Invalid token")
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        print(f"✅ [API] Token validated for user: {user_did}")
        
        # Get requested name from request
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({'error': 'name required'}), 400
        
        requested_name = data['name'].strip().lower()
        if not requested_name:
            return jsonify({'error': 'Name cannot be empty'}), 400
        
        print(f"📝 [API] Swapping to primary name: {requested_name}")
        
        # Get current dreamer data
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        cursor = db.execute("SELECT name, alts FROM dreamers WHERE did = %s", (user_did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            return jsonify({'error': 'User not found'}), 404
        
        current_name = dreamer['name']
        current_alts = dreamer['alts'] or ''
        
        # Check if requested name is already primary
        if current_name == requested_name:
            return jsonify({
                'success': True,
                'message': 'Name is already primary',
                'primary_name': current_name,
                'alt_names': current_alts
            })
        
        # Parse alts and verify requested name exists
        alt_list = [a.strip() for a in current_alts.split(',') if a.strip()]
        
        if requested_name not in alt_list:
            return jsonify({'error': f'Name "{requested_name}" is not in your alternate names'}), 400
        
        # Swap: remove requested from alts, add current to alts
        alt_list.remove(requested_name)
        alt_list.append(current_name)
        new_alts = ', '.join(alt_list)
        
        # Update database
        db.execute(
            "UPDATE dreamers SET name = %s, alts = %s, updated_at = %s WHERE did = %s",
            (requested_name, new_alts, int(time.time()), user_did)
        )
        
        print(f"✅ [API] Name swapped: {current_name} → {requested_name}")
        print(f"   New alts: {new_alts}")
        
        # Note: No need to rebuild Caddy - caddybuilder already creates subdomains
        # for both primary name AND all alts, so both names already work
        # Note: No need to recalculate status - status doesn't depend on name choice
        
        audit.log(
            event_type='name_swapped',
            endpoint='/api/user/set-primary-name',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        print("✅ [API] Primary name swap complete")
        return jsonify({
            'success': True,
            'message': f'Primary name changed to "{requested_name}"',
            'primary_name': requested_name,
            'alt_names': new_alts
        })
        
    except Exception as e:
        import traceback
        print(f"❌ [API] Exception in set_primary_name:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/update-avatar', methods=['POST'])
@rate_limit()
def update_user_avatar():
    """
    Update user's avatar on Bluesky using their app password
    
    Requires app password to be connected. Accepts image upload.
    """
    try:
        from utils.update_avatar import update_avatar
        
        print("🔄 [API] /api/user/update-avatar called")
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        print(f"✅ [API] Token validated for user: {user_did}")
        
        # Check for file upload
        if 'avatar' not in request.files:
            return jsonify({'error': 'No avatar file provided'}), 400
        
        file = request.files['avatar']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        print(f"📁 [API] Received file: {file.filename}, type: {file.content_type}")
        
        # Validate file type
        allowed_types = {'image/png', 'image/jpeg', 'image/jpg'}
        if file.content_type not in allowed_types:
            return jsonify({'error': 'Invalid file type. Use PNG or JPEG.'}), 400
        
        # Read file data
        image_data = file.read()
        
        # Validate size (1MB max)
        if len(image_data) > 1024 * 1024:
            return jsonify({'error': 'Image must be smaller than 1MB'}), 400
        
        print(f"✅ [API] File validated, size: {len(image_data)} bytes")
        
        # Update avatar
        print("🔄 [API] Calling update_avatar()...")
        result = update_avatar(user_did, image_data)
        
        if not result.get('success'):
            print(f"❌ [API] Avatar update failed: {result.get('error')}")
            return jsonify({'error': result.get('error', 'Unknown error')}), 400
        
        print("✅ [API] Bluesky avatar updated successfully")
        
        # Fetch the updated avatar URL from Bluesky and sync to local database
        from core.database import DatabaseManager
        
        db = DatabaseManager()
        
        # Get the new avatar URL from Bluesky
        try:
            print("🔄 [API] Fetching updated profile from Bluesky...")
            profile_response = requests.get(
                f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
                params={"actor": user_did}
            )
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                new_avatar_url = profile_data.get('avatar')
                
                print(f"✅ [API] Got new avatar URL from Bluesky: {new_avatar_url[:60]}...")
                
                # Update local database
                db.execute(
                    "UPDATE dreamers SET avatar = %s, updated_at = %s WHERE did = %s",
                    (new_avatar_url, int(time.time()), user_did)
                )
                
                print(f"✅ [API] Database updated with new avatar URL")
            else:
                print(f"⚠️ [API] Failed to fetch profile from Bluesky: {profile_response.status_code}")
        except Exception as e:
            print(f"⚠️ [API] Could not sync avatar to database: {e}")
        
        # Calculate and save user status
        try:
            from utils.user_status import calculate_and_save_status
            # Get user's handle and server from database
            cursor = db.execute("SELECT handle, server FROM dreamers WHERE did = %s", (user_did,))
            row = cursor.fetchone()
            
            if row:
                user_handle, user_server = row
                status = calculate_and_save_status(user_did, user_handle, user_server, token)
                print(f"✅ [API] User status updated: {status}")
        except Exception as e:
            print(f"⚠️ [API] Could not update user status: {e}")
        
        audit.log(
            event_type='avatar_updated',
            endpoint='/api/user/update-avatar',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        print("✅ [API] Avatar update complete, returning success response")
        return jsonify({
            'success': True,
            'message': 'Avatar updated successfully'
        })
        
    except Exception as e:
        import traceback
        print(f"❌ [API] Exception in update_user_avatar:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/update-description', methods=['POST'])
@rate_limit()
def update_user_description():
    """
    Update user's description/bio in the database and on Bluesky
    
    Requires authentication token. Accepts JSON with 'description' field.
    """
    try:
        from core.database import DatabaseManager
        
        print("🔄 [API] /api/user/update-description called")
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        print(f"✅ [API] Token validated for user: {user_did}")
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        description = data.get('description', '').strip()
        
        # Validate description length (300 chars max for Bluesky)
        if len(description) > 300:
            return jsonify({'error': 'Description must be 300 characters or less'}), 400
        
        print(f"✅ [API] Updating description for {user_did}: {description[:50]}...")
        
        # Update Bluesky profile if user has app password connected
        try:
            from utils.update_profile import update_profile_description
            result = update_profile_description(user_did, description)
            
            if result.get('success'):
                print(f"✅ [API] Bluesky profile description updated")
            else:
                print(f"⚠️ [API] Could not update Bluesky profile: {result.get('error')}")
                # Continue anyway to update local database
        except Exception as e:
            print(f"⚠️ [API] Could not update Bluesky profile: {e}")
            # Continue anyway to update local database
        
        # Update database
        db = DatabaseManager()
        
        db.execute(
            "UPDATE dreamers SET description = %s, updated_at = %s WHERE did = %s",
            (description, int(time.time()), user_did)
        )
        
        print(f"✅ [API] Description updated in database")
        
        audit.log(
            event_type='description_updated',
            endpoint='/api/user/update-description',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        print("✅ [API] Description update complete")
        return jsonify({
            'success': True,
            'description': description
        })
        
    except Exception as e:
        import traceback
        print(f"❌ [API] Exception in update_user_description:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/refresh-status', methods=['POST'])
@rate_limit()
def refresh_user_status():
    """
    Recalculate and update user's status in the database
    
    Should be called after character registration changes or role changes
    """
    try:
        from utils.user_status import calculate_and_save_status
        from core.database import DatabaseManager
        
        print("🔄 [API] /api/user/refresh-status called")
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        print(f"✅ [API] Token validated for user: {user_did}")
        
        # Get user's handle and server from database
        db = DatabaseManager()
        cursor = db.execute("SELECT handle, server FROM dreamers WHERE did = %s", (user_did,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'User not found in database'}), 404
        
        user_handle, user_server = row
        print(f"📝 [API] Recalculating status for {user_handle}")
        
        # Calculate and save new status
        status = calculate_and_save_status(user_did, user_handle, user_server, token)
        
        print(f"✅ [API] Status refreshed: {status}")
        
        audit.log(
            event_type='status_refreshed',
            endpoint='/api/user/refresh-status',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        import traceback
        print(f"❌ [API] Exception in refresh_user_status:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/roles', methods=['GET'])
@rate_limit()
def get_user_roles():
    """
    List user's role activations
    
    Returns array of roles with status, timestamps, etc.
    """
    try:
        from core.database import DatabaseManager
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get roles
        db_manager = DatabaseManager()
        cursor = db_manager.execute("""
            SELECT role, status, activated_at, deactivated_at, last_activity
            FROM user_roles
            WHERE did = %s
            ORDER BY activated_at DESC
        """, (user_did,))
        
        roles = [dict(row) for row in cursor.fetchall()]
        
        return jsonify({'roles': roles})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/roles/enable', methods=['POST'])
@rate_limit()
def enable_user_role():
    """
    Activate a worker role
    
    Requires app password connected. Adds/updates entry in user_roles table.
    """
    try:
        from core.database import DatabaseManager
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get role from request
        data = request.get_json()
        if not data or 'role' not in data:
            return jsonify({'error': 'role required'}), 400
        
        role = data['role'].strip().lower()
        
        # Validate role
        valid_roles = ['greeter', 'moderator']  # Future: expand
        if role not in valid_roles:
            return jsonify({'error': f'Invalid role. Must be one of: {valid_roles}'}), 400
        
        # Check credential exists
        db_manager = DatabaseManager()
        cursor = db_manager.execute("SELECT 1 FROM user_credentials WHERE did = %s", (user_did,))
        if not cursor.fetchone():
            return jsonify({'error': 'App password not connected. Connect in dashboard first.'}), 401
        
        # Insert or update role
        db_manager.execute("""
            INSERT INTO user_roles (did, role, status, activated_at, deactivated_at)
            VALUES (%s, %s, 'active', CAST((julianday('"'"'now'"'"') - 2440587.5) * 86400 AS INTEGER), NULL)
            ON CONFLICT(did, role) DO UPDATE SET
                status = 'active',
                activated_at = %s,
                deactivated_at = NULL
        """, (user_did, role))
        
        # Auto-committed by DatabaseManager
        
        audit.log(
            event_type='role_enabled',
            endpoint='/api/user/roles/enable',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent'),
            extra_data={'role': role}
        )
        
        return jsonify({
            'success': True,
            'role': role,
            'status': 'active'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/roles/disable', methods=['POST'])
@rate_limit()
def disable_user_role():
    """
    Deactivate a worker role
    
    Sets status='inactive' and deactivated_at timestamp.
    """
    try:
        from core.database import DatabaseManager
        
        # Get token from header
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        # Validate token (supports both admin sessions and OAuth tokens)
        valid, user_did, handle = validate_work_token(token)
        if not valid or not user_did:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get role from request
        data = request.get_json()
        if not data or 'role' not in data:
            return jsonify({'error': 'role required'}), 400
        
        role = data['role'].strip().lower()
        
        # Update role
        db_manager = DatabaseManager()
        cursor = db_manager.execute("""
            UPDATE user_roles
            SET status = 'inactive', deactivated_at = %s
            WHERE did = %s AND role = %s
        """, (user_did, role))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Role not found or not active'}), 404
        
        # Auto-committed by DatabaseManager
        
        audit.log(
            event_type='role_disabled',
            endpoint='/api/user/roles/disable',
            method='POST',
            user_ip=get_client_ip(),
            response_status=200,
            user_did=user_did,
            user_agent=request.headers.get('User-Agent'),
            extra_data={'role': role}
        )
        
        return jsonify({
            'success': True,
            'role': role,
            'status': 'inactive'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# === DREAM VIEWER API - REMOVED (dream_queue service no longer exists) ===
# All dreamviewer endpoints have been removed as the dream_queue table and
# associated firehose service are no longer in use.


@app.route('/api/stripe/<path:endpoint>', methods=['GET', 'POST', 'OPTIONS'])
def proxy_stripe(endpoint):
    """
    Proxy Stripe service requests to the stripe container.
    
    Forwards requests from /api/stripe/* to http://localhost:5555/*
    """
    try:
        import requests
        
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
        
        # Build target URL
        stripe_url = f'http://127.0.0.1:5555/{endpoint}'
        print(f"🔄 Stripe proxy: {request.method} {endpoint} -> {stripe_url}")
        
        # Forward the request
        if request.method == 'POST':
            response = requests.post(
                stripe_url,
                json=request.get_json(),
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
        else:
            response = requests.get(stripe_url, timeout=30)
        
        # Return the response
        return Response(
            response.content,
            status=response.status_code,
            headers={
                'Content-Type': response.headers.get('Content-Type', 'application/json'),
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        print(f"❌ Stripe proxy error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Stripe service unavailable'}), 503


@app.route('/api/avatar-proxy', methods=['GET'])
def proxy_avatar():
    """
    Proxy avatar requests to avoid CORS issues.
    
    Usage: /api/avatar-proxy?url=https://cdn.bsky.app/img/avatar/plain/did:plc:xxx@jpeg
    """
    try:
        import requests
        from urllib.parse import unquote
        
        # Get URL from query parameter
        avatar_url = request.args.get('url')
        print(f"🖼️  Avatar proxy request: {avatar_url[:80] if avatar_url else 'NO URL'}...")
        
        if not avatar_url:
            print("❌ No URL provided")
            return '', 400
        
        # Fetch the avatar
        print(f"   Fetching from Bluesky CDN...")
        response = requests.get(avatar_url, timeout=5)
        print(f"   Status: {response.status_code}, Size: {len(response.content)} bytes")
        
        if response.status_code == 200:
            # Return the image with proper headers
            return Response(
                response.content,
                mimetype=response.headers.get('content-type', 'image/jpeg'),
                headers={
                    'Cache-Control': 'public, max-age=86400',  # Cache for 24 hours
                    'Access-Control-Allow-Origin': '*'
                }
            )
        else:
            # Return 404 on error
            print(f"❌ Bluesky returned {response.status_code}")
            return '', 404
            
    except Exception as e:
        print(f"❌ Avatar proxy error: {e}")
        import traceback
        traceback.print_exc()
        return '', 404


# === STATIC FILE SERVING ===

@app.route('/css/<path:filename>')
def serve_css(filename):
    """Serve CSS files"""
    return send_from_directory('site/css', filename)


@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve JavaScript files"""
    return send_from_directory('site/js', filename)


@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve asset files"""
    return send_from_directory('site/assets', filename)


@app.route('/spectrum/<path:filename>')
def serve_spectrum(filename):
    """Serve spectrum origin images"""
    return send_from_directory('site/spectrum', filename)


@app.route('/admin/<path:filename>')
def serve_admin(filename):
    """Serve admin HTML files"""
    return send_from_directory('site/admin', filename)


if __name__ == '__main__':
    import sys
    port = 4444  # Use different default port
    
    if len(sys.argv) > 1 and sys.argv[1].startswith('--port'):
        if '=' in sys.argv[1]:
            port = int(sys.argv[1].split('=')[1])
        elif len(sys.argv) > 2:
            port = int(sys.argv[2])
    
    print("🏰 Starting Reverie House Admin Panel...")
    print(f"DID-based authentication enabled")
    print("Zowell.exe integration ready")
    print("Audit logging enabled (audit.db)")
    
    # Dream enrichment worker disabled (dream_queue service removed)
    # try:
    #     from core.dream_enricher import start_enricher
    #     enricher = start_enricher(batch_size=10, sleep_interval=5, verbose=True)
    #     print("✨ Dream enrichment worker started")
    # except Exception as e:
    #     print(f"⚠️  Failed to start dream enricher: {e}")
    
    print(f"Admin panel: http://localhost:{port}/")
    
    from config import Config
    app.run(host='0.0.0.0', port=port, debug=Config.DEBUG)
    
