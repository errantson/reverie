"""
User Invite Code Management Routes
Handles personal invite codes for Reverie House.

Slot allocation:
  - PDS residents (server = reverie.house): 3 invite slots
  - Dreamers who used a free pool invite code to create their account: 3 invite slots
  - Personally invited by another user (redeemed a personal code): 1 invite slot
  - General OAuth logins (no invite code used): 1 invite slot

Only core audience (PDS residents or those who claimed a free pool code)
get the full 3 slots. This prevents exponential spam from chained
personal invites AND limits general passers-by.

Codes are generated on-demand when the user "reveals" a slot — this
creates a real PDS invite code via the admin API and stores it in
both user_invites and invites tables.

Frontend: dashboard.js openInvitesPopup / showInvitesModal
"""

import time
import logging
import base64
import requests
from functools import wraps
from flask import Blueprint, jsonify, request
from core.database import DatabaseManager
from core.admin_auth import validate_user_token, get_client_ip
from core.rate_limiter import PersistentRateLimiter

logger = logging.getLogger(__name__)

user_invite_bp = Blueprint('user_invite', __name__)

_rate_limiter = PersistentRateLimiter()

def rate_limit(requests_per_minute=10):
    """Rate limiting decorator for user invite endpoints."""
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            allowed, retry_after = _rate_limiter.check_rate_limit(
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

# PDS admin API config — read from mounted secrets at import time
_pds_admin_password = None

def _get_pds_admin_password():
    """Lazy-load PDS admin password from secrets file."""
    global _pds_admin_password
    if _pds_admin_password is None:
        try:
            with open('/srv/secrets/pds.env', 'r') as f:
                for line in f:
                    if line.startswith('PDS_ADMIN_PASSWORD='):
                        _pds_admin_password = line.split('=', 1)[1].strip()
                        break
        except Exception as e:
            logger.error(f"Failed to read PDS admin password: {e}")
    return _pds_admin_password


def _get_pds_auth_header():
    """Get the Basic auth header for PDS admin API."""
    password = _get_pds_admin_password()
    if not password:
        raise RuntimeError("PDS admin password not available")
    return f"Basic {base64.b64encode(f'admin:{password}'.encode()).decode()}"


def _get_authenticated_did():
    """
    Extract and validate the user's DID from the Authorization header.
    Returns (did, error_response) — if did is None, return error_response.
    """
    auth_header = request.headers.get('Authorization', '')
    token = None

    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
    elif 'admin_token' in request.cookies:
        token = request.cookies.get('admin_token')

    if not token:
        return None, (jsonify({'error': 'Authentication required'}), 401)

    valid, did, handle = validate_user_token(token)
    if not valid or not did:
        return None, (jsonify({'error': 'Invalid or expired session'}), 401)

    return did, None


def _get_invite_slot_count(db, did):
    """
    Determine how many invite slots a dreamer gets.

    3 slots — PDS resident (server is reverie.house), OR
              used a free pool invite code to create a PDS account.
              These are the core audience.
    1 slot  — everyone else (general OAuth logins, personally invited, etc.)

    If a user already has codes generated in higher slots (from before
    the policy change), those slots are preserved.
    """
    # Check if they're a PDS resident (core audience by definition)
    cursor = db.execute(
        "SELECT 1 FROM dreamers WHERE did = %s AND server = 'https://reverie.house' LIMIT 1",
        (did,)
    )
    if cursor.fetchone() is not None:
        return 3

    # Check if they used a free pool invite code (core audience)
    cursor = db.execute(
        "SELECT 1 FROM invites WHERE used_by = %s AND is_personal = FALSE LIMIT 1",
        (did,)
    )
    if cursor.fetchone() is not None:
        return 3

    # Base allocation for non-core users
    base_slots = 1

    # Preserve existing slots that already have generated codes or redemptions
    cursor = db.execute(
        "SELECT MAX(slot) AS max_slot FROM user_invites WHERE owner_did = %s AND (code IS NOT NULL OR redeemed_by IS NOT NULL)",
        (did,)
    )
    row = cursor.fetchone()
    highest_active_slot = row['max_slot'] if row and row.get('max_slot') else 0

    return max(base_slots, highest_active_slot)


def _ensure_invite_slots(db, did):
    """
    Ensure the dreamer has their invite slots.
    Creates them if missing. Returns the max slot count for this user.
    """
    max_slots = _get_invite_slot_count(db, did)

    for slot in range(1, max_slots + 1):
        db.execute("""
            INSERT INTO user_invites (owner_did, slot)
            VALUES (%s, %s)
            ON CONFLICT (owner_did, slot) DO NOTHING
        """, (did, slot))

    return max_slots


def _create_pds_invite_code():
    """
    Create a single-use invite code on the PDS via admin API.
    Returns the code string or raises an exception.
    """
    response = requests.post(
        "http://localhost:3333/xrpc/com.atproto.server.createInviteCode",
        json={"useCount": 1},
        headers={
            "Content-Type": "application/json",
            "Authorization": _get_pds_auth_header()
        },
        timeout=10
    )

    if not response.ok:
        logger.error(f"PDS createInviteCode failed: {response.status_code} {response.text}")
        raise RuntimeError(f"PDS refused to create invite code: {response.status_code}")

    data = response.json()
    code = data.get('code')
    if not code:
        raise RuntimeError("PDS returned empty invite code")

    return code


def _disable_pds_invite_code(code):
    """
    Disable an orphaned PDS invite code.
    Called when a race condition creates a code that lost the atomic write.
    """
    try:
        requests.post(
            "http://localhost:3333/xrpc/com.atproto.admin.disableInviteCodes",
            json={"codes": [code]},
            headers={
                "Content-Type": "application/json",
                "Authorization": _get_pds_auth_header()
            },
            timeout=5
        )
        logger.warning(f"🗑️ Disabled orphaned PDS invite code: {code}")
    except Exception as e:
        logger.error(f"Failed to disable orphaned PDS code {code}: {e}")


@user_invite_bp.route('/api/user/invites/', methods=['GET'])
@rate_limit(requests_per_minute=20)
def list_user_invites():
    """
    Get the authenticated user's invite slots with status.
    Slot count varies: 3 for core audience (free pool code users), 1 for others.

    Response:
        {
            "invites": [
                {
                    "slot": 1,
                    "revealed": true,
                    "code": "reverie-house-xxxxx-xxxxx",
                    "redeemed": false,
                    "redeemed_by": null,
                    "redeemed_by_name": null
                },
                {
                    "slot": 2,
                    "revealed": false,
                    "code": null,
                    "redeemed": false,
                    "redeemed_by": null,
                    "redeemed_by_name": null
                },
                ...
            ],
            "redeemed_count": 1,
            "total": 3
        }
    """
    did, error = _get_authenticated_did()
    if error:
        return error

    try:
        db = DatabaseManager()

        # Ensure slots exist and get this user's allowed slot count
        max_slots = _ensure_invite_slots(db, did)

        cursor = db.execute("""
            SELECT ui.slot, ui.code, ui.generated_at, ui.redeemed_by, ui.redeemed_at,
                   d.name as redeemed_by_name, d.handle as redeemed_by_handle
            FROM user_invites ui
            LEFT JOIN dreamers d ON d.did = ui.redeemed_by
            WHERE ui.owner_did = %s AND ui.slot <= %s
            ORDER BY ui.slot
        """, (did, max_slots))

        rows = cursor.fetchall()
        invites = []
        redeemed_count = 0

        for row in rows:
            is_revealed = row['code'] is not None
            is_redeemed = row['redeemed_by'] is not None

            if is_redeemed:
                redeemed_count += 1

            invites.append({
                'slot': row['slot'],
                'revealed': is_revealed,
                'code': row['code'] if is_revealed else None,
                'redeemed': is_redeemed,
                'redeemed_by': row['redeemed_by'] if is_redeemed else None,
                'redeemed_by_name': row['redeemed_by_name'] or row['redeemed_by_handle'] if is_redeemed else None
            })

        return jsonify({
            'invites': invites,
            'redeemed_count': redeemed_count,
            'total': max_slots
        })

    except Exception as e:
        logger.error(f"Error listing user invites for {did}: {e}")
        return jsonify({'error': 'Failed to load invite codes'}), 500


@user_invite_bp.route('/api/user/invites/reveal/<int:slot>', methods=['POST'])
@rate_limit(requests_per_minute=3)
def reveal_invite_code(slot):
    """
    Reveal (generate) an invite code for a specific slot.

    If the slot already has a code, returns it.
    If the slot is empty, creates a PDS invite code and stores it.

    The code goes into BOTH tables:
    - user_invites: slot ownership/tracking (atomic WHERE code IS NULL)
    - invites: so create-account can validate it (with is_personal=true)

    Race condition protection: the UPDATE uses WHERE code IS NULL so only
    one concurrent request wins. Losers get the winner's code back. Any
    orphaned PDS codes from the losing request are disabled immediately.

    Response:
        {
            "code": "reverie-house-xxxxx-xxxxx",
            "slot": 1,
            "generated": true  (false if already existed)
        }
    """
    did, error = _get_authenticated_did()
    if error:
        return error

    if slot < 1 or slot > 3:
        return jsonify({'error': 'Invalid slot number'}), 400

    try:
        db = DatabaseManager()

        # Validate slot against this user's allowed count
        max_slots = _get_invite_slot_count(db, did)
        if slot > max_slots:
            return jsonify({'error': f'You have {max_slots} invite slot{"s" if max_slots > 1 else ""}'}), 403

        # Ensure slots exist
        _ensure_invite_slots(db, did)

        # Check current state of this slot
        cursor = db.execute("""
            SELECT code, redeemed_by FROM user_invites
            WHERE owner_did = %s AND slot = %s
        """, (did, slot))
        row = cursor.fetchone()

        if not row:
            return jsonify({'error': 'Invite slot not found'}), 404

        # If already has a code, just return it (fast path, no PDS call)
        if row['code']:
            return jsonify({
                'code': row['code'],
                'slot': slot,
                'generated': False
            })

        # Generate a new PDS invite code
        try:
            code = _create_pds_invite_code()
        except RuntimeError as e:
            logger.error(f"Failed to generate PDS invite code for {did} slot {slot}: {e}")
            return jsonify({'error': 'Failed to generate invite code. Please try again later.'}), 503

        now = int(time.time())

        # ATOMIC write: only succeeds if slot is still empty (code IS NULL)
        # This prevents race conditions where two concurrent reveals both
        # generate PDS codes — only one wins the atomic UPDATE.
        cursor = db.execute("""
            UPDATE user_invites
            SET code = %s, generated_at = %s
            WHERE owner_did = %s AND slot = %s AND code IS NULL
        """, (code, now, did, slot))

        if cursor.rowcount == 0:
            # Another request won the race — our PDS code is orphaned
            _disable_pds_invite_code(code)
            # Return the winner's code
            winner = db.execute(
                "SELECT code FROM user_invites WHERE owner_did = %s AND slot = %s",
                (did, slot)
            ).fetchone()
            if winner and winner['code']:
                return jsonify({
                    'code': winner['code'],
                    'slot': slot,
                    'generated': False
                })
            return jsonify({'error': 'Failed to generate invite code'}), 500

        # Atomic write succeeded — also store in invites table
        # (so create-account can validate it)
        db.execute("""
            INSERT INTO invites (code, is_personal, created_at)
            VALUES (%s, TRUE, %s)
            ON CONFLICT (code) DO NOTHING
        """, (code, now))

        logger.info(f"🎫 Generated invite code for {did} slot {slot}")
        print(f"🎫 Generated invite code for {did} slot {slot}")

        return jsonify({
            'code': code,
            'slot': slot,
            'generated': True
        })

    except Exception as e:
        logger.error(f"Error revealing invite code for {did} slot {slot}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to generate invite code'}), 500
