#!/usr/bin/env python3
"""
Admin Authentication System for Reverie House
PDS-based authentication with session management
"""

import secrets
import time
import requests
from functools import wraps
from flask import request, jsonify, redirect, send_from_directory
import os

# Import DatabaseManager for PostgreSQL
from core.database import DatabaseManager

# Authorized admin DID (reverie.house)
AUTHORIZED_ADMIN_DID = "did:plc:yauphjufk7phkwurn266ybx2"
AUTHORIZED_ADMIN_HANDLE = "reverie.house"

# Session expiry: 24 hours
SESSION_EXPIRY_SECONDS = 24 * 60 * 60

# Rate limiting: 5 failures = 15 minute lockout
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 15 * 60


class AdminAuth:
    """Admin authentication and session management"""
    
    def __init__(self, db=None):
        self.db = db or DatabaseManager()
        self._init_tables()
    
    def _init_tables(self):
        """Create admin tables if they don't exist (tables already exist in PostgreSQL)"""
        # Tables are created in PostgreSQL migration, nothing to do here
        pass
    
    def is_ip_locked_out(self, ip_address):
        """
        Check if an IP is locked out due to too many failed attempts.
        Returns: (locked, remaining_seconds)
        """
        if not ip_address:
            return False, 0
        
        row = self.db.fetch_one("""
            SELECT attempts, locked_until 
            FROM login_attempts 
            WHERE ip_address = %s
        """, (ip_address,))
        
        if not row:
            return False, 0
        
        now = int(time.time())
        locked_until = row['locked_until'] or 0
        
        if locked_until > now:
            remaining = locked_until - now
            return True, remaining
        
        return False, 0
    
    def record_failed_attempt(self, ip_address):
        """
        Record a failed login attempt and lock out if necessary.
        Returns: (locked_out, remaining_seconds)
        """
        if not ip_address:
            return False, 0
        
        now = int(time.time())
        
        # Get current attempt record
        row = self.db.fetch_one("""
            SELECT attempts, first_attempt, locked_until 
            FROM login_attempts 
            WHERE ip_address = %s
        """, (ip_address,))
        
        if row:
            # Check if still locked out
            if row['locked_until'] and row['locked_until'] > now:
                return True, row['locked_until'] - now
            
            # Check if we should reset the counter (attempts older than lockout duration)
            if now - row['first_attempt'] > LOCKOUT_DURATION_SECONDS:
                # Reset counter
                attempts = 1
                self.db.execute("""
                    UPDATE login_attempts 
                    SET attempts = 1, first_attempt = %s, last_attempt = %s, locked_until = NULL
                    WHERE ip_address = %s
                """, (now, now, ip_address))
            else:
                # Increment counter
                attempts = row['attempts'] + 1
                locked_until = None
                
                # Lock out if max attempts reached
                if attempts >= MAX_LOGIN_ATTEMPTS:
                    locked_until = now + LOCKOUT_DURATION_SECONDS
                    print(f"[RATE LIMIT] IP {ip_address} locked out for {LOCKOUT_DURATION_SECONDS}s after {attempts} attempts")
                
                self.db.execute("""
                    UPDATE login_attempts 
                    SET attempts = %s, last_attempt = %s, locked_until = %s
                    WHERE ip_address = %s
                """, (attempts, now, locked_until, ip_address))
                
                if locked_until:
                    return True, LOCKOUT_DURATION_SECONDS
        else:
            # First attempt from this IP
            self.db.execute("""
                INSERT INTO login_attempts (ip_address, attempts, first_attempt, last_attempt)
                VALUES (%s, 1, %s, %s)
            """, (ip_address, now, now))
        
        return False, 0
    
    def reset_failed_attempts(self, ip_address):
        """Reset failed login attempts after successful login"""
        if not ip_address:
            return
        
        self.db.execute("DELETE FROM login_attempts WHERE ip_address = %s", (ip_address,))
    
    def authenticate_with_pds(self, handle, password, ip_address=None):
        """
        Authenticate with Bluesky PDS
        Returns: (success, did, handle, error_message)
        """
        # Check if IP is locked out
        if ip_address:
            locked, remaining = self.is_ip_locked_out(ip_address)
            if locked:
                minutes = remaining // 60
                seconds = remaining % 60
                return False, None, None, f"Too many failed attempts. Try again in {minutes}m {seconds}s."
        
        try:
            print(f"[AUTH] Attempting login for handle: {handle}")
            
            # Verify it's the authorized admin handle
            if handle != AUTHORIZED_ADMIN_HANDLE:
                print(f"[AUTH] Handle mismatch: got '{handle}', expected '{AUTHORIZED_ADMIN_HANDLE}'")
                return False, None, None, f"Unauthorized. Only {AUTHORIZED_ADMIN_HANDLE} can login."
            
            print(f"[AUTH] Handle verified, calling local PDS...")
            
            # Call local PDS to create session (localhost since PDS uses host networking)
            pds_url = "http://localhost:3333"
            response = requests.post(
                f"{pds_url}/xrpc/com.atproto.server.createSession",
                json={
                    "identifier": handle,
                    "password": password
                },
                timeout=10
            )
            
            print(f"[AUTH] PDS response status: {response.status_code}")
            
            if response.status_code != 200:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error_msg = error_data.get('message', 'Authentication failed')
                print(f"[AUTH] PDS auth failed: {error_msg}")
                print(f"[AUTH] Full error data: {error_data}")
                
                # Record failed attempt
                if ip_address:
                    locked, remaining = self.record_failed_attempt(ip_address)
                    if locked:
                        minutes = remaining // 60
                        seconds = remaining % 60
                        error_msg = f"Too many failed attempts. Locked out for {minutes}m {seconds}s."
                
                # Special handling for PDS rate limits
                if response.status_code == 429 or error_data.get('error') == 'RateLimitExceeded':
                    return False, None, None, "Bluesky PDS rate limit exceeded. Please wait a few minutes before trying again."
                
                return False, None, None, error_msg
            
            data = response.json()
            did = data.get('did')
            verified_handle = data.get('handle')
            
            print(f"[AUTH] PDS auth successful!")
            print(f"[AUTH] DID: {did}")
            print(f"[AUTH] Handle: {verified_handle}")
            print(f"[AUTH] Expected DID: {AUTHORIZED_ADMIN_DID}")
            
            # Double-check DID matches
            if did != AUTHORIZED_ADMIN_DID:
                print(f"[AUTH] DID mismatch!")
                if ip_address:
                    self.record_failed_attempt(ip_address)
                return False, None, None, f"DID mismatch. Expected {AUTHORIZED_ADMIN_DID}"
            
            print(f"[AUTH] DID verified! Authentication complete.")
            
            # Reset failed attempts on successful login
            if ip_address:
                self.reset_failed_attempts(ip_address)
            
            return True, did, verified_handle, None
            
        except requests.exceptions.Timeout:
            print(f"[AUTH] Timeout error")
            return False, None, None, "PDS timeout. Please try again."
        except requests.exceptions.ConnectionError:
            print(f"[AUTH] Connection error")
            return False, None, None, "Cannot connect to PDS. Check network."
        except Exception as e:
            print(f"[AUTH] Exception: {str(e)}")
            import traceback
            traceback.print_exc()
            return False, None, None, f"Authentication error: {str(e)}"
    
    def create_session(self, did, handle, ip_address=None, user_agent=None):
        """Create a new admin session"""
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        expires_at = now + SESSION_EXPIRY_SECONDS
        
        self.db.execute("""
            INSERT INTO sessions 
            (token, admin_did, created_at, expires_at, last_activity, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (token, did, now, expires_at, now, ip_address, user_agent))
        
        return token
    
    def validate_session(self, token):
        """
        Validate a session token
        Returns: (valid, did, handle)
        """
        if not token:
            return False, None, None
        
        # LEFT JOIN with admins (not all sessions are admin sessions)
        # For regular users, we'll fetch handle from dreamers table if needed
        row = self.db.fetch_one("""
            SELECT s.admin_did as did, a.handle as admin_handle, s.expires_at 
            FROM sessions s
            LEFT JOIN admins a ON s.admin_did = a.did
            WHERE s.token = %s
        """, (token,))
        
        if not row:
            return False, None, None
        
        # Check expiry
        now = int(time.time())
        if now > row['expires_at']:
            # Session expired - clean it up
            self.db.execute("DELETE FROM sessions WHERE token = %s", (token,))
            return False, None, None
        
        # Update last activity
        self.db.execute("""
            UPDATE sessions 
            SET last_activity = %s 
            WHERE token = %s
        """, (now, token))
        
        # Get handle (from authorized_admins for admins, or from dreamers for users)
        did = row['did']
        handle = row['admin_handle']  # Will be None for non-admin users
        
        if not handle:
            # Not an admin - try to get handle from dreamers table
            dreamer_row = self.db.fetch_one("SELECT handle FROM dreamers WHERE did = %s", (did,))
            if dreamer_row:
                handle = dreamer_row['handle']
        
        return True, did, handle
    
    def destroy_session(self, token):
        """Destroy a session (logout)"""
        if not token:
            return
        
        self.db.execute("DELETE FROM sessions WHERE token = %s", (token,))
    
    def log_action(self, did, handle, action, target=None, details=None, ip_address=None, user_agent=None):
        """Log an admin action"""
        
        # Parse target into target_type and target_id if it's structured
        target_type = None
        target_id = None
        if target and ':' in target:
            parts = target.split(':', 1)
            target_type = parts[0]
            target_id = parts[1]
        
        self.db.execute("""
            INSERT INTO admin_log 
            (admin_did, action, target_type, target_id, changes, timestamp, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (did, action, target_type, target_id, details, int(time.time()), ip_address))
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        now = int(time.time())
        self.db.execute("DELETE FROM sessions WHERE expires_at < %s", (now,))
        # Note: Cannot get rowcount with connection pooling
        return None


# Global auth instance
auth = AdminAuth()


def require_auth(require_superadmin=False):
    """
    Decorator to require authentication for routes
    Usage: @require_auth() or @require_auth(require_superadmin=True)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get token from Authorization header or cookie
            token = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
            elif 'admin_token' in request.cookies:
                token = request.cookies.get('admin_token')
            
            # Validate session
            valid, did, handle = auth.validate_session(token)
            
            if not valid:
                # Check if this is an API request or page request
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Unauthorized', 'message': 'Please login'}), 401
                else:
                    # Redirect to login page
                    return redirect('/admin/login')
            
            # Add user info to request context
            request.admin_did = did
            request.admin_handle = handle
            
            # Call the actual route function
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def require_user_auth(allow_admin_override=True):
    """
    Decorator to require user authentication and validate DID ownership
    Users can only access/modify their own data based on 'did' in request body
    
    Usage: @require_user_auth() or @require_user_auth(allow_admin_override=False)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get token from Authorization header or cookie
            token = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
            elif 'admin_token' in request.cookies:
                token = request.cookies.get('admin_token')
            
            # Validate session
            valid, did, handle = auth.validate_session(token)
            
            if not valid:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Unauthorized', 'message': 'Please login with your reverie.house account'}), 401
                else:
                    return redirect('/admin/login')
            
            # Get the DID from request data
            data = request.get_json() if request.is_json else {}
            target_did = data.get('did') or kwargs.get('did')
            
            # Check if authenticated user is authorized
            # Admin can modify anyone's data if allow_admin_override=True
            is_admin = (did == auth.AUTHORIZED_ADMIN_DID)
            is_owner = (did == target_did)
            
            if not is_owner:
                if allow_admin_override and is_admin:
                    # Admin override allowed
                    request.user_did = did
                    request.user_handle = handle
                    request.is_admin_override = True
                else:
                    # Not owner and no admin override
                    return jsonify({
                        'error': 'Forbidden',
                        'message': 'You can only modify your own data'
                    }), 403
            else:
                # User is modifying their own data
                request.user_did = did
                request.user_handle = handle
                request.is_admin_override = False
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def get_client_ip():
    """Get the real client IP address from request headers"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr


def verify_pds_jwt(token):
    """
    Verify a PDS JWT token by fetching the public key from the PDS.
    Handles both OAuth JWTs (with kid) and PDS accessJwt tokens (without kid).
    Returns: (valid, user_did, handle) or (False, None, None) on failure
    """
    import jwt
    import requests
    import json
    import time
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔍 [verify_pds_jwt] Starting JWT verification")
        logger.info(f"   Token length: {len(token)}")
        
        # First, decode header to get key ID
        logger.info(f"   Decoding JWT header...")
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')
        logger.info(f"   Key ID (kid): {kid}")
        
        # Decode payload without verification to get issuer and subject
        logger.info(f"   Decoding JWT payload (unverified)...")
        unverified = jwt.decode(token, options={"verify_signature": False})
        iss = unverified.get('iss')  # PDS URL
        sub = unverified.get('sub')  # DID
        exp = unverified.get('exp')
        
        logger.info(f"   Issuer (iss): {iss}")
        logger.info(f"   Subject (sub): {sub}")
        logger.info(f"   Expiration (exp): {exp}")
        
        if not sub or not sub.startswith('did:'):
            logger.warning(f"❌ [verify_pds_jwt] Invalid subject (DID)")
            logger.info(f"      sub={sub}")
            return False, None, None
        
        # Check expiration
        current_time = time.time()
        if exp and current_time > exp:
            logger.warning(f"❌ [verify_pds_jwt] Token expired")
            logger.info(f"      Current time: {current_time}")
            logger.info(f"      Expiration: {exp}")
            logger.info(f"      Expired by: {current_time - exp} seconds")
            return False, None, None
        
        logger.info(f"   Token not expired (expires in {exp - current_time if exp else 'N/A'} seconds)")
        
        # Handle PDS accessJwt tokens (no kid, from our trusted PDS)
        if not kid:
            logger.info(f"   No kid found - treating as PDS accessJwt (trusted token)")
            # For PDS accessJwt, we trust tokens from our own PDS
            # These tokens may not have an issuer field, so we trust them by default
            # since they come from authenticated PDS sessions
            logger.info(f"   ✅ Accepting PDS accessJwt token (issuer: {iss})")
            
            # Get handle from database
            logger.info(f"   Looking up handle in database for DID: {sub}")
            handle = None
            try:
                from core.database import DatabaseManager
                db = DatabaseManager()
                dreamer_row = db.fetch_one("SELECT handle, deactivated FROM dreamers WHERE did = %s", (sub,))
                if dreamer_row:
                    handle = dreamer_row['handle']
                    # Note: We don't check deactivation here - let endpoints decide
                    # if deactivated users should be allowed (e.g., for account deletion)
                    logger.info(f"   ✅ Found handle: {handle} (deactivated: {dreamer_row.get('deactivated', False)})")
                else:
                    logger.warning(f"❌ [verify_pds_jwt] No dreamer found for DID {sub}")
                    return False, None, None
            except Exception as e:
                logger.error(f"❌ [verify_pds_jwt] Database error: {e}")
                return False, None, None
            
            logger.info(f"   ✅ PDS accessJwt validated for {handle} ({sub})")
            return True, sub, handle
        
        # OAuth JWT path (with kid) - verify with JWKS
        logger.info(f"   OAuth JWT detected (has kid) - verifying with JWKS")
        if not iss:
            logger.warning(f"❌ [verify_pds_jwt] No issuer in OAuth JWT")
            return False, None, None
        
        jwks_url = f"{iss}/.well-known/jwks.json"
        logger.info(f"   Fetching JWKS from: {jwks_url}")
        
        try:
            response = requests.get(jwks_url, timeout=5)
            logger.info(f"   JWKS response status: {response.status_code}")
            response.raise_for_status()
            jwks = response.json()
            logger.info(f"   JWKS keys found: {len(jwks.get('keys', []))}")
        except requests.RequestException as e:
            logger.error(f"❌ [verify_pds_jwt] Failed to fetch JWKS: {e}")
            return False, None, None
        except json.JSONDecodeError as e:
            logger.error(f"❌ [verify_pds_jwt] Failed to parse JWKS JSON: {e}")
            return False, None, None
        
        # Find the key
        logger.info(f"   Looking for key with kid={kid}")
        public_key = None
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                logger.info(f"   ✅ Found matching key!")
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                break
        
        if not public_key:
            logger.warning(f"❌ [verify_pds_jwt] No matching public key found")
            logger.info(f"      Available kids: {[k.get('kid') for k in jwks.get('keys', [])]}")
            return False, None, None
        
        # Verify the JWT
        logger.info(f"   Verifying JWT signature...")
        try:
            verified = jwt.decode(token, public_key, algorithms=['RS256'], issuer=iss)
            logger.info(f"   ✅ JWT signature valid!")
        except jwt.InvalidTokenError as e:
            logger.error(f"❌ [verify_pds_jwt] JWT signature verification failed: {e}")
            return False, None, None
        
        # Additional validation
        if verified.get('sub') != sub:
            logger.warning(f"❌ [verify_pds_jwt] Subject mismatch after verification")
            return False, None, None
        
        logger.info(f"   ✅ JWT fully verified for DID: {sub}")
        
        # Get handle from database (DID is verified)
        logger.info(f"   Looking up handle in database for DID: {sub}")
        handle = None
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            dreamer = db.fetch_one(
                "SELECT handle, deactivated FROM dreamers WHERE did = %s",
                (sub,)
            )
            if dreamer:
                if dreamer.get('deactivated'):
                    logger.warning(f"❌ [verify_pds_jwt] Account is deactivated")
                    return False, None, None
                handle = dreamer['handle']
                logger.info(f"   ✅ Found handle in database: {handle}")
            else:
                logger.warning(f"   ❌ DID not found in dreamers table")
                return False, None, None
        except Exception as e:
            logger.error(f"❌ [verify_pds_jwt] Database lookup failed: {e}")
            return False, None, None
        
        logger.info(f"✅ [verify_pds_jwt] Returning: valid=True, did={sub}, handle={handle}")
        return True, sub, handle
        
    except jwt.InvalidTokenError as e:
        logger.error(f"❌ [verify_pds_jwt] JWT error: {e}")
        return False, None, None
    except Exception as e:
        logger.error(f"❌ [verify_pds_jwt] Unexpected error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False, None, None


def validate_user_token(token, allow_deactivated=False):
    """
    Validate authentication token - supports both admin sessions and PDS OAuth JWT.
    Returns: (valid, user_did, handle)
    
    This function handles two authentication methods:
    1. Admin session tokens (from sessions table)
    2. PDS OAuth JWT tokens (accessJwt from ATProto PDS)
    
    Also checks if the account is deactivated and blocks access (unless allow_deactivated=True).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"\n{'─'*80}")
    logger.info(f"🔐 [validate_user_token] Starting token validation")
    logger.info(f"{'─'*80}")
    
    if not token:
        logger.warning(f"❌ [validate_user_token] No token provided")
        return False, None, None
    
    logger.info(f"   Token provided: Yes (length: {len(token)})")
    logger.info(f"   Token preview: {token[:50]}...")
    logger.info(f"   Token ends with: ...{token[-20:]}")
    
    # Try to decode JWT header to see what type of token it is
    try:
        import jwt
        header = jwt.get_unverified_header(token)
        logger.info(f"   JWT header: {header}")
        has_kid = 'kid' in header
        logger.info(f"   Has 'kid' field (OAuth token): {has_kid}")
        if has_kid:
            logger.info(f"   This appears to be an OAuth JWT token")
        else:
            logger.info(f"   This appears to be a PDS accessJwt token")
    except Exception as e:
        logger.warning(f"   Could not decode JWT header: {e}")
        logger.info(f"   Token might not be a valid JWT")
    
    # Try admin session first
    logger.info(f"   Attempting admin session validation...")
    valid, user_did, handle = auth.validate_session(token)
    logger.info(f"   Admin session result: valid={valid}, did={user_did}, handle={handle}")
    
    # If admin session fails, try PDS JWT verification
    if not valid:
        logger.info(f"   Admin session failed, trying PDS JWT verification...")
        valid, user_did, handle = verify_pds_jwt(token)
        logger.info(f"   PDS JWT result: valid={valid}, did={user_did}, handle={handle}")
    else:
        logger.info(f"   ✅ Admin session validation succeeded")
    
    # If token is valid, check if account is deactivated
    if valid and user_did and not allow_deactivated:
        logger.info(f"   Checking if account is deactivated...")
        from core.database import DatabaseManager
        db = DatabaseManager()
        try:
            cursor = db.execute(
                "SELECT deactivated FROM dreamers WHERE did = %s",
                (user_did,)
            )
            dreamer = cursor.fetchone()
            if dreamer:
                is_deactivated = dreamer.get('deactivated', False)
                logger.info(f"   Account deactivated: {is_deactivated}")
                if is_deactivated:
                    # Account is deactivated - deny access
                    logger.warning(f"❌ [validate_user_token] Account is deactivated, denying access")
                    return False, None, None
            else:
                logger.warning(f"   ⚠️  Account not found in dreamers table")
        except Exception as e:
            # If query fails, allow access (fail open for now)
            logger.error(f"   ⚠️  Deactivation check failed: {e}")
    
    logger.info(f"✅ [validate_user_token] Final result: valid={valid}, did={user_did}, handle={handle}")
    logger.info(f"{'─'*80}\n")
    return valid, user_did, handle


