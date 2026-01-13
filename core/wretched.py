"""
Wretched Transformation System

Transforms a dreamer into a wretch as consequence of losing a Cogitarian Challenge:
1. Backs up profile data (Reverie House + Bluesky)
2. Assigns unique sequential avatar (wretch001, wretch002, etc.)
3. Changes displayName to "{name} the Wretch"
4. Changes bio to wretched message
5. Posts announcement with wretch art
6. Marks user as wretched in dreamers table

Soothing mechanism:
- Timer that halves each time wretch likes a valid soothing post
- Soothing posts are dreams (lore) @mentioning the wretch
- When timer expires or admin restores, wretch is soothed

Uses synchronous requests and atproto library - no async.
"""

import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any
import json

from core.database import DatabaseManager
from core.encryption import decrypt_password


WRETCHED_AVATARS_DIR = Path("/srv/reverie.house/site/assets/wretched")

# Initial soothe timer: 7 days (gets halved with each valid like)
INITIAL_SOOTHE_HOURS = 7 * 24  # 168 hours

WRETCHED_BIO = "wretchedness has consumed my dreams"

WRETCHED_POST_TEMPLATE = """⚠️ I HAVE BECOME WRETCHED ⚠️

The shadows have claimed me. My dreams have turned to ash.

Those who knew me may still soothe my spirit. Compose a dream and call my name.

https://reverie.house/wretched/{handle}

Until the darkness lifts, I am {name} the Wretch."""


def generate_wretched_color(did: str) -> str:
    """Generate a deterministic dark cold tone color from DID.
    
    Uses DID hash to pick:
    - Hue: 180-240 (cyan to blue range)
    - Saturation: 15-35% (muted)
    - Lightness: 10-20% (very dark)
    
    Returns HSL as hex color.
    """
    # Simple hash from DID string
    did_hash = 0
    for c in did:
        did_hash = ((did_hash << 5) - did_hash + ord(c)) & 0xFFFFFFFF
    
    hue = 180 + (did_hash % 61)  # 180-240
    sat = 15 + ((did_hash >> 8) % 21)  # 15-35%
    light = 10 + ((did_hash >> 16) % 11)  # 10-20%
    
    # Convert HSL to hex
    import colorsys
    r, g, b = colorsys.hls_to_rgb(hue/360, light/100, sat/100)
    return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"


class WretchedTransformer:
    """Transforms profiles to/from wretched state using synchronous APIs."""
    
    def __init__(self, db: DatabaseManager = None):
        self.db = db or DatabaseManager()
    
    # =========================================================================
    # AVATAR MANAGEMENT
    # =========================================================================
    
    def get_next_available_avatar(self) -> Optional[str]:
        """Get the next unassigned wretched avatar (sequential order)."""
        row = self.db.fetch_one("""
            SELECT filename FROM wretched_avatars
            WHERE assigned_to_did IS NULL
            ORDER BY filename ASC
            LIMIT 1
        """)
        return row['filename'] if row else None
    
    def assign_avatar(self, filename: str, did: str) -> bool:
        """Mark an avatar as assigned to a user."""
        self.db.execute("""
            UPDATE wretched_avatars
            SET assigned_to_did = %s, assigned_at = NOW(), times_used = times_used + 1
            WHERE filename = %s AND assigned_to_did IS NULL
        """, (did, filename))
        return True
    
    def release_avatar(self, did: str) -> bool:
        """Release avatar back to pool if reusable."""
        self.db.execute("""
            UPDATE wretched_avatars
            SET assigned_to_did = NULL, assigned_at = NULL
            WHERE assigned_to_did = %s AND reusable = TRUE
        """, (did,))
        return True
    
    def get_avatar_url(self, filename: str) -> str:
        """Get public URL for avatar."""
        return f"/assets/wretched/{filename}"
    
    def sync_avatars_from_disk(self):
        """Scan directory and add new avatars to DB."""
        if not WRETCHED_AVATARS_DIR.exists():
            return
        for path in sorted(WRETCHED_AVATARS_DIR.glob("wretch*.png")):
            filename = path.name
            existing = self.db.fetch_one(
                "SELECT id FROM wretched_avatars WHERE filename = %s",
                (filename,)
            )
            if not existing:
                self.db.execute("""
                    INSERT INTO wretched_avatars (filename, created_by)
                    VALUES (%s, 'system')
                """, (filename,))
    
    # =========================================================================
    # CREDENTIAL HELPERS
    # =========================================================================
    
    def get_credentials(self, did: str) -> tuple:
        """Get app password and PDS URL for a user. Returns (password, pds_url)."""
        row = self.db.fetch_one("""
            SELECT uc.app_password_hash, COALESCE(uc.pds_url, d.server, 'https://bsky.social') as pds
            FROM user_credentials uc
            JOIN dreamers d ON uc.did = d.did
            WHERE uc.did = %s AND uc.app_password_hash IS NOT NULL
        """, (did,))
        
        if not row or not row['app_password_hash']:
            return None, None
        
        try:
            password = decrypt_password(row['app_password_hash'])
            return password, row['pds']
        except Exception as e:
            print(f"Error decrypting password for {did}: {e}")
            return None, None
    
    # =========================================================================
    # PROFILE OPERATIONS
    # =========================================================================
    
    def get_rh_profile(self, did: str) -> Dict[str, Any]:
        """Get user's current Reverie House profile from DB."""
        row = self.db.fetch_one("""
            SELECT display_name, description, avatar, banner, color_hex
            FROM dreamers WHERE did = %s
        """, (did,))
        
        spectrum = self.db.fetch_one(
            "SELECT * FROM spectrum WHERE did = %s", (did,)
        )
        
        if row:
            return {
                'display_name': row.get('display_name'),
                'description': row.get('description'),
                'avatar': row.get('avatar'),
                'banner': row.get('banner'),
                'color': row.get('color_hex'),
                'spectrum': dict(spectrum) if spectrum else None
            }
        return {}
    
    def get_active_wretch(self, did: str) -> Optional[Dict]:
        """Get the current wretched state for a user, if any."""
        return self.db.fetch_one("""
            SELECT * FROM wretched_profiles
            WHERE did = %s AND status = 'wretched'
            ORDER BY wretched_at DESC
            LIMIT 1
        """, (did,))
    
    # =========================================================================
    # PREVIEW (no Bluesky API calls, just shows what would happen)
    # =========================================================================
    
    def preview(self, did: str) -> Dict[str, Any]:
        """Preview what wretching would look like - no API calls, just local data."""
        
        # Check if user exists
        dreamer = self.db.fetch_one(
            "SELECT handle, name, display_name, color_hex, description FROM dreamers WHERE did = %s", 
            (did,)
        )
        if not dreamer:
            return {"error": "User not found in Reverie House"}
        
        # Check for app password
        password, pds = self.get_credentials(did)
        has_app_password = bool(password)
        
        # Get local profile
        rh_profile = self.get_rh_profile(did)
        
        # Check existing wretched state
        existing_wretch = self.get_active_wretch(did)
        
        # Sync and get avatar
        self.sync_avatars_from_disk()
        avatar_filename = self.get_next_available_avatar()
        
        # Use database "name" field for wretch name
        original_name = dreamer.get('name') or dreamer['handle'].split('.')[0]
        
        return {
            "did": did,
            "handle": dreamer['handle'],
            "name": dreamer.get('name'),
            "display_name": dreamer.get('display_name'),
            "current_color": dreamer.get('color_hex'),
            "current_description": dreamer.get('description'),
            "has_app_password": has_app_password,
            "can_execute": has_app_password and not existing_wretch,
            "already_wretched": bool(existing_wretch),
            "current_rh": rh_profile,
            "would_become": {
                "name": f"{original_name} the Wretch",
                "displayName": f"{original_name} the Wretch",
                "description": WRETCHED_BIO,
                "color": generate_wretched_color(did),  # Deterministic dark cold tone from DID
                "avatar": avatar_filename,
                "avatar_url": self.get_avatar_url(avatar_filename) if avatar_filename else None
            },
            "changes": {
                "name": f"{original_name} → {original_name} the Wretch",
                "description": f"{dreamer.get('description', '(none)')} → {WRETCHED_BIO}",
                "color": f"{dreamer.get('color_hex') or '(inherit)'} → #666666",
                "avatar": f"(current) → {avatar_filename}"
            },
            "available_avatars": self.db.fetch_one(
                "SELECT COUNT(*) as count FROM wretched_avatars WHERE assigned_to_did IS NULL"
            )['count'],
            "soothe_hours": INITIAL_SOOTHE_HOURS
        }
    
    # =========================================================================
    # WRETCH EXECUTION
    # =========================================================================
    
    def wretch(self, did: str, reason: str = 'banished', challenge_id: str = None) -> Dict[str, Any]:
        """
        Execute full wretch transformation.
        Uses atproto library for Bluesky API calls.
        """
        from atproto import Client
        
        result = {"success": False, "did": did}
        
        # Get dreamer info
        dreamer = self.db.fetch_one(
            "SELECT handle, display_name FROM dreamers WHERE did = %s",
            (did,)
        )
        if not dreamer:
            result["error"] = "User not found"
            return result
        
        handle = dreamer['handle']
        original_name = dreamer.get('display_name') or handle.split('.')[0]
        
        # Check not already wretched
        if self.get_active_wretch(did):
            result["error"] = "User is already wretched"
            return result
        
        # Get credentials
        password, pds = self.get_credentials(did)
        if not password:
            result["error"] = "No app password stored for this user"
            return result
        
        # Get avatar
        self.sync_avatars_from_disk()
        avatar_filename = self.get_next_available_avatar()
        if not avatar_filename:
            result["error"] = "No available wretch avatars"
            return result
        
        try:
            # Login to Bluesky
            client = Client(base_url=pds)
            client.login(handle, password)
            
            # Get current profiles for backup
            rh_profile = self.get_rh_profile(did)
            
            # Get Bluesky profile
            try:
                bsky_profile_resp = client.app.bsky.actor.get_profile({'actor': did})
                bsky_profile = {
                    'displayName': bsky_profile_resp.display_name,
                    'description': bsky_profile_resp.description,
                    'avatar': bsky_profile_resp.avatar,
                    'banner': bsky_profile_resp.banner
                }
            except Exception as e:
                print(f"Warning: Could not get Bluesky profile: {e}")
                bsky_profile = {}
            
            # Store backup
            soothe_target = datetime.now(timezone.utc) + timedelta(hours=INITIAL_SOOTHE_HOURS)
            spectrum_json = json.dumps(rh_profile.get('spectrum')) if rh_profile.get('spectrum') else None
            
            self.db.execute("""
                INSERT INTO wretched_profiles (
                    did, handle,
                    rh_display_name, rh_bio, rh_avatar, rh_banner, rh_spectrum, rh_color,
                    bsky_display_name, bsky_description, bsky_avatar, bsky_banner,
                    wretched_avatar, wretched_reason, challenge_id, soothe_target_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                did, handle,
                rh_profile.get('display_name'), rh_profile.get('description'),
                rh_profile.get('avatar'), rh_profile.get('banner'),
                spectrum_json, rh_profile.get('color'),
                bsky_profile.get('displayName'), bsky_profile.get('description'),
                bsky_profile.get('avatar'), bsky_profile.get('banner'),
                avatar_filename, reason, challenge_id, soothe_target
            ))
            
            # Assign avatar
            self.assign_avatar(avatar_filename, did)
            
            # Upload wretch avatar to Bluesky
            avatar_path = WRETCHED_AVATARS_DIR / avatar_filename
            avatar_blob = None
            if avatar_path.exists():
                with open(avatar_path, 'rb') as f:
                    avatar_data = f.read()
                avatar_blob = client.upload_blob(avatar_data)
            
            # Update Bluesky profile
            new_display_name = f"{original_name} the Wretch"
            
            # Get existing profile record
            try:
                existing = client.com.atproto.repo.get_record({
                    'repo': did,
                    'collection': 'app.bsky.actor.profile',
                    'rkey': 'self'
                })
                existing_value = existing.value if existing else {}
            except Exception:
                existing_value = {}
            
            # Build new profile
            new_profile = {
                '$type': 'app.bsky.actor.profile',
                'displayName': new_display_name,
                'description': WRETCHED_BIO,
            }
            if avatar_blob:
                new_profile['avatar'] = avatar_blob.blob
            
            # Keep existing banner if present
            if hasattr(existing_value, 'banner') and existing_value.banner:
                new_profile['banner'] = existing_value.banner
            
            # Update profile
            client.com.atproto.repo.put_record({
                'repo': did,
                'collection': 'app.bsky.actor.profile',
                'rkey': 'self',
                'record': new_profile
            })
            
            # Mark wretched in dreamers table and update name/color/bio
            wretched_color = generate_wretched_color(did)
            self.db.execute("""
                UPDATE dreamers
                SET 
                    name = %s,
                    description = %s,
                    color_hex = %s,
                    is_wretched = TRUE,
                    wretched_at = NOW()
                WHERE did = %s
            """, (new_display_name, WRETCHED_BIO, wretched_color, did))
            
            # Post announcement
            announcement = WRETCHED_POST_TEMPLATE.format(
                handle=handle,
                name=original_name
            )
            client.send_post(text=announcement)
            
            result["success"] = True
            result["message"] = f"{handle} has been wretched"
            result["avatar"] = avatar_filename
            result["soothe_target"] = soothe_target.isoformat()
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            result["error"] = str(e)
        
        return result
    
    # =========================================================================
    # RESTORE
    # =========================================================================
    
    def restore(self, did: str, restored_by: str = 'admin') -> Dict[str, Any]:
        """Restore a user from wretched/soothed state."""
        result = {"success": False, "did": did}
        
        # Get any non-restored state
        wretch_state = self.db.fetch_one("""
            SELECT * FROM wretched_profiles
            WHERE did = %s AND status IN ('wretched', 'soothed')
            ORDER BY wretched_at DESC
            LIMIT 1
        """, (did,))
        
        if not wretch_state:
            result["error"] = "User has no active wretch state"
            return result
        
        # Update status to restored
        self.db.execute("""
            UPDATE wretched_profiles
            SET status = 'restored', soothed_at = COALESCE(soothed_at, NOW()), soothed_by = %s
            WHERE id = %s
        """, (restored_by, wretch_state['id']))
        
        # Clear wretched flag in dreamers
        self.db.execute("""
            UPDATE dreamers
            SET is_wretched = FALSE, wretched_at = NULL, wretched_profile_id = NULL
            WHERE did = %s
        """, (did,))
        
        # Release avatar
        self.release_avatar(did)
        
        result["success"] = True
        result["message"] = "User has been restored from wretched state"
        result["note"] = "User should manually restore their Bluesky profile if desired"
        
        return result
    
    # =========================================================================
    # AVATARS LISTING
    # =========================================================================
    
    def list_avatars(self) -> Dict[str, Any]:
        """Get all avatars with their status."""
        self.sync_avatars_from_disk()
        
        rows = self.db.fetch_all("""
            SELECT filename, assigned_to_did, assigned_at
            FROM wretched_avatars
            ORDER BY filename
        """)
        
        avatars = []
        available = 0
        for row in rows:
            is_assigned = bool(row.get('assigned_to_did'))
            if not is_assigned:
                available += 1
            avatars.append({
                'filename': row['filename'],
                'assigned': is_assigned,
                'assigned_to': row.get('assigned_to_did')
            })
        
        return {
            'avatars': avatars,
            'total': len(avatars),
            'available': available
        }


def get_transformer(db: DatabaseManager = None) -> WretchedTransformer:
    """Factory function to get a transformer instance."""
    return WretchedTransformer(db)
