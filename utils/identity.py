import requests
from typing import Optional, Dict, Tuple
from urllib.parse import quote
from config import Config

class IdentityManager:
    """Handles identity resolution including handle/DID conversion and profile fetching."""
    
    def __init__(self):
        from core.auth import AuthManager
        self.auth = AuthManager()
        self._request_cache = {}
    
    def resolve_handle(self, handle: str) -> Optional[str]:
        """Resolve handle to DID with server fallback."""
        handle_enc = quote(handle, safe='')
        
        endpoints = [
            "https://public.api.bsky.app",
            "https://bsky.social"
        ]
        
        for server in endpoints:
            url = f'{server}/xrpc/com.atproto.identity.resolveHandle?handle={handle_enc}'
            try:
                response = requests.get(url, timeout=Config.REQUEST_TIMEOUT)
                if response.status_code == 200:
                    data = response.json()
                    did = data.get('did')
                    if did:
                        return did
            except requests.exceptions.RequestException:
                continue
                
        print(f"Error: Could not resolve handle {handle} on any server")
        return None
    
    def get_handle_from_did(self, did: str) -> tuple[Optional[str], Optional[str]]:
        """Get handle and server from DID via PLC directory.
        
        For reverie.house users, checks local PDS first for authoritative handle.
        """
        try:
            from core.pds import PDSAdmin
            pds = PDSAdmin()
            pds_account = pds.get_account_by_did(did)
            if pds_account:
                return pds_account['handle'], 'https://reverie.house'
        except Exception as e:
            if Config.DEBUG:
                print(f"⚠️ PDS check failed for {did}: {e}")
        
        url = f'https://plc.directory/{did}'
        try:
            response = requests.get(url, timeout=Config.REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            
            also_known_as = data.get('alsoKnownAs', [])
            handle = also_known_as[0].removeprefix("at://") if also_known_as else None
            
            server = None
            services = data.get('service', [])
            for service in services:
                if service.get('id') == '#atproto_pds':
                    server = service.get('serviceEndpoint')
                    break
                    
            return handle, server
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching DID {did}: {e}")
            return None, None
    
    def get_profile(self, did: str, server: Optional[str] = None) -> Optional[Dict]:
        """
        Get full profile data for a DID.
        Uses app.bsky.actor.getProfile for complete profile with handle.
        Falls back to com.atproto.repo.getRecord if needed.
        """
        # Try app.bsky.actor.getProfile first (includes handle and full profile)
        try:
            url = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile'
            params = {'actor': did}
            response = requests.get(url, params=params, timeout=Config.REQUEST_TIMEOUT)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Public API profile fetch failed: {e}")
        
        # Fall back to repo.getRecord (profile record only, no handle)
        endpoints = []
        
        if server:
            endpoints.append(server)
        
        # Add public endpoints
        endpoints.extend([
            "https://public.api.bsky.app",
            "https://bsky.social"
        ])
        
        for endpoint in endpoints:
            url = f'{endpoint}/xrpc/com.atproto.repo.getRecord'
            params = {
                'repo': did,
                'collection': 'app.bsky.actor.profile',
                'rkey': 'self'
            }
            
            try:
                response = requests.get(url, params=params, timeout=Config.REQUEST_TIMEOUT)
                if response.status_code == 200:
                    data = response.json()
                    return data.get('value', {})
                elif response.status_code == 401:
                    # Try next endpoint
                    continue
                else:
                    print(f"Profile fetch failed from {endpoint}: {response.status_code}")
                    continue
            except requests.exceptions.RequestException as e:
                print(f"Network error fetching profile from {endpoint}: {e}")
                continue
                
        print(f"Failed to fetch profile for {did} from all endpoints")
        return None
    
    def get_pds_from_profile(self, profile_data: Dict) -> Optional[str]:
        """Extract PDS (Personal Data Server) URL from profile data."""
        # The service endpoint is typically in the DID document
        # For ATProto, check for the PDS service endpoint
        if not profile_data:
            return None
        
        # Try to get from known profile structure
        # ATProto profiles may have serviceEndpoint in various locations
        did_doc = profile_data.get('did_doc', {})
        services = did_doc.get('service', [])
        
        for service in services:
            if service.get('type') == 'AtprotoPersonalDataServer':
                return service.get('serviceEndpoint')
        
        # Fallback: check if there's a direct serviceEndpoint field
        if 'serviceEndpoint' in profile_data:
            return profile_data['serviceEndpoint']
        
        return None
    
    def resolve_identity_complete(self, identifier: str) -> Dict:
        """
        Complete identity resolution returning all available information.
        Works with either handle or DID as input.
        """
        result = {
            "input": identifier,
            "did": None,
            "handle": None,
            "server": None,
            "profile": None,
            "resolved": False
        }
        
        if identifier.startswith("did:"):
            result["did"] = identifier
            handle, server = self.get_handle_from_did(identifier)
            result["handle"] = handle
            result["server"] = server
        else:
            result["handle"] = identifier
            did = self.resolve_handle(identifier)
            result["did"] = did
            if did:
                _, server = self.get_handle_from_did(did)
                result["server"] = server
        
        if result["did"]:
            profile = self.get_profile(result["did"], result["server"])
            result["profile"] = profile
            result["resolved"] = True
            
            if not result["server"] and profile:
                result["server"] = self.get_pds_from_profile(profile)
        
        return result
    
    def batch_resolve_identities(self, identifiers: list) -> Dict[str, Dict]:
        """
        Resolve multiple identities in batch with caching.
        Returns dict mapping identifier to resolution result.
        """
        results = {}
        
        for identifier in identifiers:
            if identifier in self._request_cache:
                results[identifier] = self._request_cache[identifier]
                continue
            
            resolution = self.resolve_identity_complete(identifier)
            self._request_cache[identifier] = resolution
            results[identifier] = resolution
        
        return results
    
    def validate_identity(self, identifier: str) -> Tuple[bool, str]:
        """
        Validate that an identifier is properly formatted and resolvable.
        Returns (is_valid, error_message).
        """
        if not identifier or not isinstance(identifier, str):
            return False, "Identifier is empty or not a string"
        
        identifier = identifier.strip()
        
        if identifier.startswith("did:"):
            if not self._is_valid_did_format(identifier):
                return False, "Invalid DID format"
            
            handle, server = self.get_handle_from_did(identifier)
            if not handle and not server:
                return False, "DID could not be resolved"
            
            return True, "Valid DID"
        
        else:
            if not self._is_valid_handle_format(identifier):
                return False, "Invalid handle format"
            
            did = self.resolve_handle(identifier)
            if not did:
                return False, "Handle could not be resolved to DID"
            
            return True, "Valid handle"
    
    def _is_valid_did_format(self, did: str) -> bool:
        """Check if DID has valid format."""
        parts = did.split(":")
        return len(parts) >= 3 and parts[0] == "did" and all(part for part in parts)
    
    def _is_valid_handle_format(self, handle: str) -> bool:
        """Check if handle has valid format."""
        if len(handle) < 3 or len(handle) > 253:
            return False
        
        if "." not in handle:
            return False
        
        allowed_chars = set("abcdefghijklmnopqrstuvwxyz0123456789.-")
        return all(c.lower() in allowed_chars for c in handle)
