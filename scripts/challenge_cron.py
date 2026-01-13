#!/usr/bin/env python3
"""
Challenge Cron - Hourly

Runs every hour to:
1. Check for expired challenges and resolve them
2. Verify challenge participants still have valid credentials
3. Disqualify/resolve if credentials become invalid

NOTE: General app password validation is handled by workerwatch (every 3 min).
This cron only handles challenge-specific logic.

Usage:
    python3 /srv/reverie.house/scripts/challenge_cron.py
"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from datetime import datetime
from core.database import DatabaseManager
from core.cogitarian_challenges import CogitarianChallengeManager


def check_challenge_expiration():
    """Check for expired challenges and resolve them based on current favor."""
    db = DatabaseManager()
    manager = CogitarianChallengeManager()
    
    # Find expired but still active challenges
    expired = db.fetch_all("""
        SELECT * FROM cogitarian_challenges
        WHERE status = 'active'
        AND expires_at < NOW()
    """)
    
    if not expired:
        print(f"[{datetime.now()}] No expired challenges")
        return
    
    for challenge in expired:
        challenge_id = challenge['challenge_id']
        print(f"[{datetime.now()}] Resolving expired challenge: {challenge_id}")
        
        success, msg, outcome = manager.resolve_challenge(
            challenge_id,
            resolver_did='system',
            notes='Challenge period expired'
        )
        
        if success:
            print(f"  ✓ Resolved: {outcome}")
        else:
            print(f"  ❌ Failed: {msg}")


def check_challenge_participant_credentials():
    """
    For any active challenge, verify both parties still have valid credentials.
    Uses the existing user_credentials.is_valid flag set by workerwatch.
    """
    db = DatabaseManager()
    manager = CogitarianChallengeManager()
    
    # Get active challenge
    active = db.fetch_one("""
        SELECT * FROM cogitarian_challenges WHERE status = 'active'
    """)
    
    if not active:
        print(f"[{datetime.now()}] No active challenge")
        return
    
    challenge_id = active['challenge_id']
    challenger_did = active['challenger_did']
    challenged_did = active['challenged_did']
    
    print(f"[{datetime.now()}] Checking credentials for: {challenge_id}")
    
    # Check credentials using existing user_credentials table
    def has_valid_password(did):
        row = db.fetch_one("""
            SELECT is_valid, app_password_hash FROM user_credentials WHERE did = %s
        """, (did,))
        if not row:
            return False
        return bool(row.get('is_valid')) and bool(row.get('app_password_hash'))
    
    challenger_valid = has_valid_password(challenger_did)
    cogitarian_valid = has_valid_password(challenged_did)
    
    print(f"  Challenger @{active['challenger_handle']}: {'✓' if challenger_valid else '❌'}")
    print(f"  Cogitarian @{active['challenged_handle']}: {'✓' if cogitarian_valid else '❌'}")
    
    # Handle invalidity
    if not challenger_valid and not cogitarian_valid:
        # Both invalid - disqualify challenger (benefit of doubt to incumbent)
        print(f"  ⚠️ Both invalid - disqualifying challenger")
        manager.disqualify_challenger(challenge_id, "Both credentials invalid", "system")
        
    elif not challenger_valid:
        print(f"  ❌ Challenger password invalid - disqualifying")
        manager.disqualify_challenger(challenge_id, "Challenger credential invalid", "system")
        
    elif not cogitarian_valid:
        # Cogitarian loses by default
        print(f"  ⚔️ Cogitarian password invalid - challenger wins")
        db.execute("""
            UPDATE cogitarian_challenges
            SET favor = 'challenger', favor_set_by = 'system'
            WHERE challenge_id = %s
        """, (challenge_id,))
        db.commit()
        manager.resolve_challenge(challenge_id, 'system', 'Cogitarian credential invalid')
    else:
        print(f"  ✓ Both credentials valid")


def main():
    print(f"\n{'='*60}")
    print(f"CHALLENGE CRON - {datetime.now()}")
    print(f"{'='*60}\n")
    
    try:
        check_challenge_expiration()
    except Exception as e:
        print(f"Error in expiration check: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    try:
        check_challenge_participant_credentials()
    except Exception as e:
        print(f"Error in credential check: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n{'='*60}\n")


if __name__ == '__main__':
    main()
