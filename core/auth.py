"""
🌜 REVERIE ESSENTIAL
"""
import json
import os
import time
import datetime
import requests
from typing import Optional, Tuple
from config import Config

class AuthManager:
    """Manages Bluesky authentication with token caching and multi-server fallback."""
    
    def __init__(self):
        self.session_cache = Config.SESSION_CACHE
        
    def get_token(self, force_refresh: bool = False) -> Optional[str]:
        """Get valid authentication token, refreshing if necessary."""
        pass
        
        if force_refresh:
            pass
        else:
            token, expires_at = self._get_cached_token_and_expiry()
            pass
            
            if token and expires_at:
                try:
                    from datetime import datetime, timezone
                    dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    expires_epoch = int(dt.timestamp())
                    now = int(time.time())
                    
                    if now < expires_epoch - 300:
                        pass
                        return token
                    else:
                        if Config.DEBUG:
                            print("🔑 Token expired or about to expire, will refresh.")
                except Exception as e:
                    if Config.DEBUG:
                        print(f"🔑 Could not parse expiration, will refresh: {e}")
            elif token and not expires_at:
                if Config.DEBUG:
                    print("🔑 No expiration info in cache, will refresh to ensure validity.")
            else:
                if Config.DEBUG:
                    print("🔑 No cached token, will refresh.")
        
        if Config.DEBUG:
            print("🔑 Attempting to refresh token...")
        if self.refresh_token():
            token, expires_at = self._get_cached_token_and_expiry()
            if token:
                if Config.DEBUG:
                    print("🔑 Refreshed token successfully")
                return token
            else:
                print("🔑 Failed to get token after refresh")
        else:
            print("🔑 Failed to refresh token")
        return None

    def _get_cached_token_and_expiry(self) -> tuple:
        """Return (token, expires_at) from cache, or (None, None) if missing."""
        import os, json
        if not os.path.exists(self.session_cache):
            return None, None
        try:
            with open(self.session_cache, 'r', encoding='utf-8') as f:
                data = json.load(f)
            token = data.get('accessJwt') or data.get('token')
            expires_at = data.get('accessJwtExpiresAt') or data.get('expiresAt') or data.get('expires_at')
            return token, expires_at
        except Exception as e:
            print(f"Error reading token cache: {e}")
            return None, None

    
    def refresh_token(self) -> bool:
        """Refresh authentication token from server."""
        print("🔄 AuthManager.refresh_token() called")
        
        # Try to get internal account credentials from database first
        handle, password = self._get_internal_credentials()
        
        if not handle or not password:
            # Fall back to Config (env vars / secrets files)
            valid, message = Config.validate_credentials()
            if not valid:
                print(f"❌ Authentication failed: {message}")
                return False
            handle = Config.BSKY_HANDLE
            password = Config.BSKY_APP_PASSWORD
        
        print("✅ Credentials obtained")
        
        pds_url = self._resolve_pds_for_handle(handle)
        if not pds_url:
            print(f"❌ Could not resolve PDS for handle: {handle}")
            return False
        
        print(f"🌐 Resolved PDS URL: {pds_url}")
        
        if self._authenticate_with_server(pds_url, handle, password):
            print("✅ Authentication with server successful")
            return True
        
        print("❌ Authentication failed on resolved PDS")
        return False
    
    def _get_internal_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """Get internal reverie.house account credentials from database."""
        try:
            from core.database import DatabaseManager
            from core.encryption import decrypt_password
            
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT d.handle, c.app_password_hash
                FROM user_credentials c
                JOIN dreamers d ON c.did = d.did
                WHERE d.handle = 'reverie.house'
                AND c.is_valid = true
            """)
            result = cursor.fetchone()
            
            if result and result['app_password_hash']:
                password = decrypt_password(result['app_password_hash'])
                if password:
                    return result['handle'], password
            return None, None
        except Exception as e:
            if Config.DEBUG:
                print(f"⚠️ Could not get internal credentials from DB: {e}")
            return None, None
    
    def handle_expired_token(self) -> Optional[str]:
        """Handle expired token by forcing a refresh and returning the new token."""
        if self.refresh_token():
            token, _ = self._get_cached_token_and_expiry()
            return token
        return None
    
    def _resolve_pds_for_handle(self, handle: str) -> Optional[str]:
        """Resolve the PDS URL for a given handle."""
        if Config.DEBUG:
            print(f"🔍 Resolving PDS for handle: {handle}")
        
        url = f"https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={handle}"
        try:
            response = requests.get(url, timeout=Config.REQUEST_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                did = data.get('did')
                if did:
                    if Config.DEBUG:
                        print(f"🔍 Resolved DID: {did}")
                    pds_url = self._get_pds_from_did(did)
                    if Config.DEBUG:
                        print(f"🔍 PDS from DID: {pds_url}")
                    return pds_url
        except Exception as e:
            if Config.DEBUG:
                print(f"🔍 Error resolving handle: {e}")
        
        if '.' in handle and not handle.endswith('.bsky.social'):
            domain = handle.split('@')[-1] if '@' in handle else handle.split('.')[-2] + '.' + handle.split('.')[-1]
            try:
                test_url = f"https://{domain}"
                response = requests.get(f"{test_url}/.well-known/atproto-did", timeout=5)
                if response.status_code == 200:
                    if Config.DEBUG:
                        print(f"🔍 Custom domain PDS: {test_url}")
                    return test_url
            except Exception as e:
                if Config.DEBUG:
                    print(f"🔍 Custom domain check failed: {e}")
        
        fallback = "https://bsky.social"
        print(f"🔍 Using fallback PDS: {fallback}")
        return fallback
    
    def _get_pds_from_did(self, did: str) -> Optional[str]:
        """Get PDS URL from DID document."""
        try:
            response = requests.get(f"https://plc.directory/{did}", timeout=Config.REQUEST_TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                services = data.get('service', [])
                for service in services:
                    if service.get('id') == '#atproto_pds':
                        pds_url = service.get('serviceEndpoint')
                        print(f"🔍 Found PDS in DID document: {pds_url}")
                        return pds_url
        except Exception as e:
            print(f"🔍 Error fetching DID document: {e}")
        
        return "https://bsky.social"
    
    def clear_cache(self) -> None:
        """Clear cached authentication token."""
        try:
            if os.path.exists(self.session_cache):
                os.remove(self.session_cache)
                print("🗑️ Authentication cache cleared")
        except Exception as e:
            print(f"⚠️ Warning: Could not clear auth cache: {e}")
    
    def validate_credentials(self) -> Tuple[bool, str]:
        """Validate that credentials are properly configured."""
        return Config.validate_credentials()
    
    def get_user_did(self) -> Optional[str]:
        """Get the current user's DID from cache."""
        if not os.path.exists(self.session_cache):
            return None
        try:
            with open(self.session_cache, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('did')
        except Exception:
            return None
    
    def get_user_handle(self) -> Optional[str]:
        """Get the current user's handle from cache."""
        if not os.path.exists(self.session_cache):
            return None
        try:
            with open(self.session_cache, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('handle')
        except Exception:
            return None
    
    def _get_cached_token(self) -> Optional[str]:
        """Load and validate cached token."""
        if Config.DEBUG:
            print("📂 Checking cached token...")
        
        if not os.path.exists(self.session_cache):
            if Config.DEBUG:
                print("📂 No session cache file found")
            return None
            
        try:
            with open(self.session_cache, 'r') as f:
                data = json.load(f)
                
            token = data.get("accessJwt")
            expires_epoch = data.get("expiresEpoch")
            expires_at_str = data.get("expiresAt")
            
            if Config.DEBUG:
                print(f"📂 Cache data loaded - token: {'Present' if token else 'Missing'}")
                print(f"📂 Expires epoch: {expires_epoch}")
                print(f"📂 Expires at: {expires_at_str}")
            
            if not expires_epoch and not expires_at_str:
                if Config.DEBUG:
                    print("📂 ⚠️ No expiration data - assuming token is valid")
                if token:
                    if Config.DEBUG:
                        print("📂 ✅ Using token without expiration check")
                    return token
                else:
                    if Config.DEBUG:
                        print("📂 ❌ No token found in cache")
                    return None
            
            if not expires_epoch and expires_at_str:
                expires_epoch = self._parse_iso8601_to_epoch(expires_at_str)
                if Config.DEBUG:
                    print(f"📂 Parsed expiration epoch: {expires_epoch}")
                
            if token and expires_epoch:
                current_time = int(time.time())
                buffer_time = current_time + 60
                
                if Config.DEBUG:
                    print(f"📂 Current time: {current_time}")
                    print(f"📂 Token expires: {expires_epoch}")
                    print(f"📂 Buffer time: {buffer_time}")
                
                if int(expires_epoch) > buffer_time:
                    if Config.DEBUG:
                        print("📂 ✅ Cached token is valid")
                    return token
                else:
                    if Config.DEBUG:
                        print("📂 ❌ Cached token has expired")
            else:
                if Config.DEBUG:
                    print("📂 ❌ Incomplete token data in cache")
                    
        except Exception as e:
            if Config.DEBUG:
                print(f"📂 ❌ Error reading cache: {e}")
            self.clear_cache()
            
        return None
    
    def _authenticate_with_server(self, server_url: str, handle: str = None, password: str = None) -> bool:
        """Authenticate with specific server and cache token."""
        print(f"🔐 Authenticating with server: {server_url}")
        
        # Use provided credentials or fall back to Config
        auth_handle = handle or Config.BSKY_HANDLE
        auth_password = password or Config.BSKY_APP_PASSWORD
        
        url = f"{server_url}/xrpc/com.atproto.server.createSession"
        
        payload = {
            "identifier": auth_handle,
            "password": auth_password
        }
        
        print(f"🔐 Using identifier: {auth_handle}")
        
        try:
            response = requests.post(
                url, 
                json=payload, 
                timeout=Config.REQUEST_TIMEOUT
            )
            
            print(f"🔐 Response status: {response.status_code}")
            
            if response.status_code == 429:
                print(f"⚠️ Rate limited on {server_url}")
                return False
            
            if response.status_code == 401:
                print(f"❌ Authentication failed: Invalid credentials for {auth_handle}")
                print("💡 Check credentials in database or .env file")
                return False
                
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    print(f"❌ Auth failed on {server_url}: {response.status_code} - {error_msg}")
                except:
                    print(f"❌ Auth failed on {server_url}: {response.status_code}")
                return False
                
            data = response.json()
            token = data.get("accessJwt")
            refresh_jwt = data.get("refreshJwt")
            expires_at = data.get("accessJwtExpiresAt") or data.get("expiresAt")
            did = data.get("did")
            handle = data.get("handle")
            
            print(f"🔐 Token received: {'Yes' if token else 'No'}")
            print(f"🔐 DID received: {did}")
            print(f"🔐 Handle received: {handle}")
            print(f"🔐 Expires at: {expires_at}")
            
            if token and did:
                if not expires_at:
                    print("🔐 ⚠️ No expiration provided by server - using default 24h")
                    expires_at = (datetime.datetime.now(datetime.timezone.utc) + 
                                datetime.timedelta(hours=24)).isoformat()
                
                self._save_token(token, expires_at, refresh_jwt, server_url, did, handle)
                print(f"✅ Authentication successful with {server_url}")
                return True
            else:
                print(f"❌ No access token or DID in response from {server_url}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error authenticating with {server_url}: {e}")
            
        return False
    
    def _save_token(self, token: str, expires_at: str, refresh_jwt: str = None, pds_url: str = None, did: str = None, handle: str = None) -> None:
        """Save token to cache with expiration data."""
        print("💾 Saving token to cache...")
        
        expires_epoch = self._parse_iso8601_to_epoch(expires_at) if expires_at else 0
        
        cache_data = {
            "accessJwt": token,
            "expiresAt": expires_at,
            "expiresEpoch": int(expires_epoch),
            "pdsUrl": pds_url,
            "did": did,
            "handle": handle
        }
        
        if refresh_jwt:
            cache_data["refreshJwt"] = refresh_jwt
        
        print(f"💾 Cache data prepared: expires_epoch={expires_epoch}")
        
        temp_file = self.session_cache + ".tmp"
        try:
            with open(temp_file, 'w') as f:
                json.dump(cache_data, f, indent=4)
            os.replace(temp_file, self.session_cache)
            print("💾 ✅ Token saved successfully")
        except Exception as e:
            print(f"💾 ❌ Atomic write failed: {e}")
            try:
                with open(self.session_cache, 'w') as f:
                    json.dump(cache_data, f, indent=4)
                print("💾 ✅ Token saved with fallback method")
            except Exception as e2:
                print(f"💾 ❌ Could not save auth token: {e2}")
    
    def _parse_iso8601_to_epoch(self, iso_string: str) -> Optional[int]:
        """Parse ISO8601 timestamp to epoch seconds."""
        if not iso_string:
            return None
            
        iso_string = iso_string.strip()
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S"
        ]
        
        for fmt in formats:
            try:
                dt = datetime.datetime.strptime(iso_string, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                else:
                    dt = dt.astimezone(datetime.timezone.utc)
                return int(dt.timestamp())
            except Exception:
                continue
                
        try:
            prefix = iso_string[:19]
            dt = datetime.datetime.strptime(prefix, "%Y-%m-%dT%H:%M:%S")
            dt = dt.replace(tzinfo=datetime.timezone.utc)
            return int(dt.timestamp())
        except Exception:
            return None
