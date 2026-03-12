"""
Guardian label management for reverie.house
Routes guardian hide/safe labels through lore.farm's labeler service.

Label types:
  hide:{guardian_handle} - Applied to barred content/users (content moderation)
  safe:{guardian_handle} - Applied to allowed content (advisory)

Uses lorekey authentication to call lore.farm's /api/v1/label/ endpoints.
"""

import os
import requests

# Module-level singleton
_label_manager = None

LOREFARM_APPLY_URL = 'https://lore.farm/api/v1/label/apply'
LOREFARM_NEGATE_URL = 'https://lore.farm/api/v1/label/negate'


def get_label_manager():
    """Get or create the singleton GuardianLabelManager."""
    global _label_manager
    if _label_manager is None:
        _label_manager = GuardianLabelManager()
    return _label_manager


class GuardianLabelManager:
    """Manages guardian labels via lore.farm's labeler API."""

    def __init__(self):
        self.lorekey = self._load_lorekey()
        self._headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.lorekey}'
        } if self.lorekey else None

    def _load_lorekey(self):
        """Load the lorekey for lore.farm API authentication."""
        # Try file first, then environment variable
        key_file = os.getenv('LOREFARM_KEY_FILE', '/srv/secrets/lorefarm.api.key')
        if os.path.exists(key_file):
            try:
                with open(key_file, 'r') as f:
                    key = f.read().strip()
                    if key:
                        return key
            except Exception as e:
                print(f"[GuardianLabels] Could not read key file: {e}")

        key = os.getenv('LOREFARM_KEY')
        if key:
            return key

        print("[GuardianLabels] WARNING: No lorekey configured. Guardian labels will not sync.")
        return None

    def _apply_label(self, uri, val):
        """Apply a label via lore.farm API. Returns result dict."""
        if not self._headers:
            return {'success': False, 'error': 'Lorekey not configured'}

        try:
            resp = requests.post(
                LOREFARM_APPLY_URL,
                json={'uri': uri, 'val': val},
                headers=self._headers,
                timeout=15
            )

            if resp.status_code == 200:
                data = resp.json()
                return {'success': True, 'label': data.get('label')}
            else:
                error = 'Unknown error'
                try:
                    error = resp.json().get('error', resp.text[:200])
                except Exception:
                    error = resp.text[:200]
                return {'success': False, 'error': error, 'status': resp.status_code}

        except requests.RequestException as e:
            return {'success': False, 'error': f'Network error: {e}'}

    def _negate_label(self, uri, val):
        """Negate a label via lore.farm API. Returns result dict."""
        if not self._headers:
            return {'success': False, 'error': 'Lorekey not configured'}

        try:
            resp = requests.post(
                LOREFARM_NEGATE_URL,
                json={'uri': uri, 'val': val},
                headers=self._headers,
                timeout=15
            )

            if resp.status_code == 200:
                data = resp.json()
                return {'success': True, 'negated': data.get('negated'), 'emitted': data.get('emitted')}
            else:
                error = 'Unknown error'
                try:
                    error = resp.json().get('error', resp.text[:200])
                except Exception:
                    error = resp.text[:200]
                return {'success': False, 'error': error, 'status': resp.status_code}

        except requests.RequestException as e:
            return {'success': False, 'error': f'Network error: {e}'}

    # ── Public API (matches interface expected by admin.py) ──

    def apply_hide_label(self, uri, guardian_did, guardian_handle, reason=None):
        """Apply a hide:{guardian_handle} label to content URI."""
        val = f'hide:{guardian_handle}'
        print(f"[GuardianLabels] Applying {val} to {uri[:60]}... (guardian={guardian_did})")
        result = self._apply_label(uri, val)
        if result.get('success'):
            print(f"[GuardianLabels] ✅ Applied {val}")
        else:
            print(f"[GuardianLabels] ⚠️ Failed: {result.get('error')}")
        return result

    def apply_hide_account_label(self, user_did, guardian_did, guardian_handle, reason=None):
        """Apply a hide:{guardian_handle} label to a user's DID (account-level)."""
        val = f'hide:{guardian_handle}'
        print(f"[GuardianLabels] Applying account label {val} to {user_did} (guardian={guardian_did})")
        result = self._apply_label(user_did, val)
        if result.get('success'):
            print(f"[GuardianLabels] ✅ Applied account label {val}")
        else:
            print(f"[GuardianLabels] ⚠️ Failed: {result.get('error')}")
        return result

    def remove_hide_label(self, uri, guardian_did, guardian_handle):
        """Negate a hide:{guardian_handle} label on content URI."""
        val = f'hide:{guardian_handle}'
        print(f"[GuardianLabels] Negating {val} on {uri[:60]}... (guardian={guardian_did})")
        result = self._negate_label(uri, val)
        if result.get('success'):
            print(f"[GuardianLabels] ✅ Negated {val}")
        else:
            print(f"[GuardianLabels] ⚠️ Failed: {result.get('error')}")
        return result

    def remove_hide_account_label(self, user_did, guardian_did, guardian_handle):
        """Negate a hide:{guardian_handle} label on a user's DID (account-level)."""
        val = f'hide:{guardian_handle}'
        print(f"[GuardianLabels] Negating account label {val} on {user_did} (guardian={guardian_did})")
        result = self._negate_label(user_did, val)
        if result.get('success'):
            print(f"[GuardianLabels] ✅ Negated account label {val}")
        else:
            print(f"[GuardianLabels] ⚠️ Failed: {result.get('error')}")
        return result

    def remove_safe_label(self, uri, guardian_did, guardian_handle):
        """Negate a safe:{guardian_handle} label on content URI."""
        val = f'safe:{guardian_handle}'
        print(f"[GuardianLabels] Negating {val} on {uri[:60]}... (guardian={guardian_did})")
        result = self._negate_label(uri, val)
        if result.get('success'):
            print(f"[GuardianLabels] ✅ Negated {val}")
        else:
            print(f"[GuardianLabels] ⚠️ Failed: {result.get('error')}")
        return result
