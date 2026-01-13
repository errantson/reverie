"""
Cogitarian Challenge System
Manages challenges to the Cogitarian role via the Keeper's Favor mechanism.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from core.database import DatabaseManager


class CogitarianChallengeManager:
    """Manages Cogitarian challenges and the Keeper's Favor resolution system."""
    
    # Greek letter rank progression
    GREEK_RANKS = [
        'Prime', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
        'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda',
        'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
        'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
    ]
    
    # Challenge duration in days
    CHALLENGE_DURATION_DAYS = 14
    
    def __init__(self):
        self.db = DatabaseManager()
    
    def get_next_rank(self, current_rank: str) -> str:
        """Get the next rank down in the hierarchy (for defeated Cogitarians)."""
        try:
            idx = self.GREEK_RANKS.index(current_rank)
            if idx < len(self.GREEK_RANKS) - 1:
                return self.GREEK_RANKS[idx + 1]
            return 'Omega'  # Already at bottom
        except ValueError:
            return 'Omega'  # Unknown rank
    
    def get_active_challenge(self) -> Optional[Dict]:
        """Get the currently active challenge, if any."""
        cursor = self.db.execute("""
            SELECT * FROM cogitarian_challenges
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    def get_challenge_by_id(self, challenge_id: str) -> Optional[Dict]:
        """Get a challenge by its ID."""
        cursor = self.db.execute("""
            SELECT * FROM cogitarian_challenges
            WHERE challenge_id = %s
        """, (challenge_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    
    def can_challenge(self, challenger_did: str) -> Tuple[bool, str]:
        """
        Check if a user can initiate a challenge.
        Returns (can_challenge, reason).
        """
        # Check for active challenge
        active = self.get_active_challenge()
        if active:
            return False, "A challenge is already in progress"
        
        # Check if challenger has app password stored
        cursor = self.db.execute("""
            SELECT * FROM user_credentials
            WHERE did = %s AND (valid = true OR is_valid = true)
        """, (challenger_did,))
        if not cursor.fetchone():
            return False, "You must store an app password before challenging"
        
        # Check for recent failed challenges (cooldown)
        cursor = self.db.execute("""
            SELECT * FROM cogitarian_challenges
            WHERE challenger_did = %s
            AND status IN ('resolved', 'disqualified')
            AND outcome != 'challenger_wins'
            AND resolved_at > NOW() - INTERVAL '30 days'
        """, (challenger_did,))
        if cursor.fetchone():
            return False, "You must wait 30 days after a failed challenge"
        
        return True, "OK"
    
    def create_challenge(
        self,
        challenger_did: str,
        challenger_handle: str,
        challenged_did: str,
        challenged_handle: str,
        challenged_rank: str,
        challenge_type: str = 'wish_to_be',
        evidence: str = None
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Create a new challenge.
        Returns (success, message, challenge_data).
        """
        can_do, reason = self.can_challenge(challenger_did)
        if not can_do:
            return False, reason, None
        
        # Generate challenge ID
        cursor = self.db.execute("""
            SELECT COUNT(*) as count FROM cogitarian_challenges
        """)
        count = cursor.fetchone()['count']
        challenge_id = f"challenge{count + 1:03d}"
        
        # Calculate expiration
        expires_at = datetime.utcnow() + timedelta(days=self.CHALLENGE_DURATION_DAYS)
        
        # Challenger gets the rank if they win
        challenger_rank = challenged_rank  # They take the current rank
        
        # Insert challenge
        self.db.execute("""
            INSERT INTO cogitarian_challenges (
                challenge_id, challenger_did, challenger_handle, challenger_rank,
                challenged_did, challenged_handle, challenged_rank,
                challenge_type, evidence, expires_at, favor, favor_set_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'challenger', 'system')
        """, (
            challenge_id, challenger_did, challenger_handle, challenger_rank,
            challenged_did, challenged_handle, challenged_rank,
            challenge_type, evidence, expires_at
        ))
        self.db.commit()
        
        challenge = self.get_challenge_by_id(challenge_id)
        return True, f"Challenge {challenge_id} created", challenge
    
    def set_favor(
        self,
        challenge_id: str,
        favor: str,
        set_by_did: str
    ) -> Tuple[bool, str]:
        """
        Set the Keeper's Favor for a challenge.
        Only the Keeper should call this.
        """
        if favor not in ('challenger', 'cogitarian'):
            return False, "Invalid favor value"
        
        challenge = self.get_challenge_by_id(challenge_id)
        if not challenge:
            return False, "Challenge not found"
        
        if challenge['status'] != 'active':
            return False, "Challenge is not active"
        
        self.db.execute("""
            UPDATE cogitarian_challenges
            SET favor = %s, favor_set_by = %s, favor_set_at = NOW()
            WHERE challenge_id = %s
        """, (favor, set_by_did, challenge_id))
        self.db.commit()
        
        return True, f"Favor set to {favor}"
    
    def record_response(self, challenge_id: str) -> Tuple[bool, str]:
        """
        Record that the Cogitarian has responded to the challenge.
        This automatically flips favor to the Cogitarian.
        """
        challenge = self.get_challenge_by_id(challenge_id)
        if not challenge:
            return False, "Challenge not found"
        
        if challenge['status'] != 'active':
            return False, "Challenge is not active"
        
        # Flip favor to cogitarian on response
        self.db.execute("""
            UPDATE cogitarian_challenges
            SET favor = 'cogitarian', favor_set_by = 'system', favor_set_at = NOW()
            WHERE challenge_id = %s AND favor = 'challenger'
        """, (challenge_id,))
        self.db.commit()
        
        return True, "Response recorded, favor flipped to Cogitarian"
    
    def resolve_challenge(
        self,
        challenge_id: str,
        resolver_did: str = None,
        notes: str = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Resolve a challenge based on current favor.
        Returns (success, message, outcome).
        """
        challenge = self.get_challenge_by_id(challenge_id)
        if not challenge:
            return False, "Challenge not found", None
        
        if challenge['status'] != 'active':
            return False, "Challenge is not active", None
        
        # Determine winner based on favor
        if challenge['favor'] == 'challenger':
            outcome = 'challenger_wins'
        else:
            outcome = 'challenged_wins'
        
        # Update challenge
        self.db.execute("""
            UPDATE cogitarian_challenges
            SET status = 'resolved',
                outcome = %s,
                outcome_notes = %s,
                resolved_at = NOW()
            WHERE challenge_id = %s
        """, (outcome, notes, challenge_id))
        self.db.commit()
        
        # Handle role transition if challenger wins
        if outcome == 'challenger_wins':
            self._transfer_cogitarian_role(
                new_cogitarian_did=challenge['challenger_did'],
                new_cogitarian_handle=challenge['challenger_handle'],
                new_rank=challenge['challenger_rank'],
                old_cogitarian_did=challenge['challenged_did'],
                demoted_rank=self.get_next_rank(challenge['challenged_rank'])
            )
        
        return True, f"Challenge resolved: {outcome}", outcome
    
    def disqualify_challenger(
        self,
        challenge_id: str,
        reason: str,
        disqualifier_did: str
    ) -> Tuple[bool, str]:
        """
        Disqualify the challenger (e.g., for violating rules, invalid password).
        """
        challenge = self.get_challenge_by_id(challenge_id)
        if not challenge:
            return False, "Challenge not found"
        
        if challenge['status'] != 'active':
            return False, "Challenge is not active"
        
        self.db.execute("""
            UPDATE cogitarian_challenges
            SET status = 'disqualified',
                outcome = 'disqualified',
                outcome_notes = %s,
                resolved_at = NOW()
            WHERE challenge_id = %s
        """, (f"Disqualified by {disqualifier_did}: {reason}", challenge_id))
        self.db.commit()
        
        return True, "Challenger disqualified"
    
    def check_expired_challenges(self) -> List[Dict]:
        """
        Check for and resolve any expired challenges.
        Called periodically by background worker.
        """
        cursor = self.db.execute("""
            SELECT * FROM cogitarian_challenges
            WHERE status = 'active'
            AND expires_at < NOW()
        """)
        expired = cursor.fetchall()
        
        resolved = []
        for challenge in expired:
            success, msg, outcome = self.resolve_challenge(
                challenge['challenge_id'],
                resolver_did='system',
                notes='Challenge period expired'
            )
            if success:
                resolved.append({
                    'challenge_id': challenge['challenge_id'],
                    'outcome': outcome
                })
        
        return resolved
    
    def _transfer_cogitarian_role(
        self,
        new_cogitarian_did: str,
        new_cogitarian_handle: str,
        new_rank: str,
        old_cogitarian_did: str,
        demoted_rank: str
    ):
        """
        Transfer the Cogitarian role from one user to another.
        Updates the work table and related records.
        """
        # Get current work row for cogitarian
        cursor = self.db.execute("""
            SELECT workers FROM work WHERE role = 'cogitarian'
        """)
        row = cursor.fetchone()
        
        if row:
            workers = row['workers']
            if isinstance(workers, str):
                workers = json.loads(workers)
            
            # Update workers array
            new_workers = []
            for worker in workers:
                if worker.get('did') == old_cogitarian_did:
                    # Mark old cogitarian as retired
                    worker['status'] = 'retired'
                    worker['retired_at'] = datetime.utcnow().isoformat()
                    worker['final_rank'] = demoted_rank
                new_workers.append(worker)
            
            # Add new cogitarian
            new_workers.append({
                'did': new_cogitarian_did,
                'handle': new_cogitarian_handle,
                'status': 'working',
                'rank': new_rank,
                'started_at': datetime.utcnow().isoformat()
            })
            
            # Update work table
            self.db.execute("""
                UPDATE work SET workers = %s WHERE role = 'cogitarian'
            """, (json.dumps(new_workers),))
            self.db.commit()
    
    def get_challenge_history(self, limit: int = 20) -> List[Dict]:
        """Get recent challenge history."""
        cursor = self.db.execute("""
            SELECT * FROM cogitarian_challenges
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def get_challenge_for_display(self, challenge_id: str = None) -> Optional[Dict]:
        """
        Get challenge data enriched with profile info for display.
        If no ID provided, gets active challenge.
        """
        if challenge_id:
            challenge = self.get_challenge_by_id(challenge_id)
        else:
            challenge = self.get_active_challenge()
        
        if not challenge:
            return None
        
        # Enrich with profile data from dreamers table
        cursor = self.db.execute("""
            SELECT did, handle, display_name, avatar
            FROM dreamers
            WHERE did IN (%s, %s)
        """, (challenge['challenger_did'], challenge['challenged_did']))
        
        profiles = {row['did']: dict(row) for row in cursor.fetchall()}
        
        challenger_profile = profiles.get(challenge['challenger_did'], {})
        challenged_profile = profiles.get(challenge['challenged_did'], {})
        
        return {
            **challenge,
            'challenger_name': challenger_profile.get('display_name'),
            'challenger_avatar': challenger_profile.get('avatar'),
            'cogitarian_name': challenged_profile.get('display_name'),
            'cogitarian_avatar': challenged_profile.get('avatar'),
            'cogitarian_handle': challenge['challenged_handle'],
            'current_rank': challenge['challenged_rank']
        }


# Singleton instance
_challenge_manager = None

def get_challenge_manager() -> CogitarianChallengeManager:
    """Get or create the singleton challenge manager."""
    global _challenge_manager
    if _challenge_manager is None:
        _challenge_manager = CogitarianChallengeManager()
    return _challenge_manager
