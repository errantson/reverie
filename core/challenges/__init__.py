"""
Cogitarian Challenge Subsystem

Thin wrapper around cogitarian_challenges.py for the challenge system.
Uses existing infrastructure:
- user_credentials table for app password storage
- workerwatch for credential validation (every 3 min)
- core/encryption for password encryption/decryption
- challenge_cron.py for hourly challenge-specific checks
"""

from core.cogitarian_challenges import (
    CogitarianChallengeManager,
    get_challenge_manager
)

__all__ = [
    'CogitarianChallengeManager',
    'get_challenge_manager'
]
