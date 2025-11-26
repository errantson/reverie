#!/usr/bin/env python3
"""
Worker Network Client

Handles authenticated network operations for volunteer workers (greeters, moderators, etc.)
who have securely stored app passwords in the work table.

This is separate from the main NetworkClient which uses the house account credentials.
Workers authenticate with their own credentials and post from their own accounts.
"""

import requests
import base64
from typing import Optional, Dict, List
from datetime import datetime, timezone
from .encryption import decrypt_password


class WorkerNetworkClient:
    """
    Network client for worker accounts with stored app passwords.
    
    Supports any worker role that needs to post from their own account:
    - Greeters posting welcome messages
    - Moderators posting moderation notices
    - Future worker roles
    """
    
    def __init__(self, worker_did: str, worker_handle: str, app_password_base64: str):
        """
        Initialize worker client with stored credentials.
        
        Args:
            worker_did: Worker's DID
            worker_handle: Worker's handle (e.g., 'alice.reverie.house')
            app_password_base64: Base64-encoded app password from work table
        """
        self.worker_did = worker_did
        self.worker_handle = worker_handle
        self.app_password_base64 = app_password_base64
        self.session_token = None
        self.pds_url = None
    
    @property
    def pds(self):
        """Alias for pds_url for backward compatibility"""
        return self.pds_url
        
    def authenticate(self) -> bool:
        """
        Authenticate worker and obtain session token.
        
        Returns:
            bool: True if authentication successful
        """
        try:
            # Decrypt app password (with fallback to base64 for migration)
            try:
                # Try decryption first (new encrypted passwords)
                app_password = decrypt_password(self.app_password_base64)
            except Exception:
                # Fallback to base64 decode (legacy passwords during migration)
                try:
                    app_password = base64.b64decode(self.app_password_base64).decode('utf-8')
                    print(f"⚠️ Using legacy base64 password for {self.worker_did} - should be re-encrypted")
                except Exception:
                    print(f"❌ Failed to decrypt or decode password for {self.worker_did}")
                    return False
            
            # Resolve actual PDS URL from DID document (don't trust handle)
            try:
                did_response = requests.get(
                    f"https://plc.directory/{self.worker_did}",
                    timeout=5
                )
                if did_response.status_code == 200:
                    did_doc = did_response.json()
                    services = did_doc.get('service', [])
                    for service in services:
                        if service.get('id') == '#atproto_pds':
                            self.pds_url = service.get('serviceEndpoint')
                            print(f"🔍 Resolved PDS from DID: {self.pds_url}")
                            break
            except Exception as e:
                print(f"⚠️ Failed to resolve PDS from DID: {e}")
            
            # Fallback: Determine PDS URL from handle (legacy behavior)
            if not self.pds_url:
                print(f"⚠️ Using fallback PDS detection from handle")
                if self.worker_handle.endswith('.reverie.house'):
                    self.pds_url = "https://reverie.house"
                elif self.worker_handle.endswith('.bsky.social'):
                    self.pds_url = "https://bsky.social"
                else:
                    # Custom domain - try to resolve
                    domain = '.'.join(self.worker_handle.split('.')[-2:])
                    self.pds_url = f"https://{domain}"
            
            print(f"🔐 Authenticating with PDS: {self.pds_url}")
            
            # Create session with worker's credentials
            response = requests.post(
                f"{self.pds_url}/xrpc/com.atproto.server.createSession",
                json={
                    "identifier": self.worker_handle,
                    "password": app_password
                },
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ Worker auth failed: {response.status_code}")
                return False
            
            session_data = response.json()
            self.session_token = session_data.get('accessJwt')
            verified_did = session_data.get('did')
            
            # Verify DID matches
            if verified_did != self.worker_did:
                print(f"❌ DID mismatch: expected {self.worker_did}, got {verified_did}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Worker authentication error: {e}")
            return False
    
    def create_post(self, text: str, reply_to: Optional[str] = None, 
                   facets: Optional[List[Dict]] = None, 
                   embed: Optional[Dict] = None) -> Optional[Dict]:
        """
        Create a post from the worker's account.
        
        Args:
            text: Post text content
            reply_to: Optional AT URI to reply to
            facets: Optional facets for mentions, links, etc.
            embed: Optional embed (external link card, images, etc.)
            
        Returns:
            Dict with 'uri' and 'cid' if successful, None if failed
        """
        if not self.session_token:
            print("❌ Not authenticated - call authenticate() first")
            return None
        
        try:
            # Build post record
            post_record = {
                '$type': 'app.bsky.feed.post',
                'text': text,
                'createdAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            }
            
            # Add facets if provided
            if facets:
                post_record['facets'] = facets
            
            # Add embed if provided
            if embed:
                post_record['embed'] = embed
            
            # Add reply structure if replying
            if reply_to:
                # Fetch parent post to get CID
                parent_uri_parts = reply_to.replace('at://', '').split('/')
                parent_did = parent_uri_parts[0]
                parent_rkey = parent_uri_parts[-1]
                
                parent_response = requests.get(
                    f"{self.pds_url}/xrpc/com.atproto.repo.getRecord",
                    params={
                        'repo': parent_did,
                        'collection': 'app.bsky.feed.post',
                        'rkey': parent_rkey
                    },
                    timeout=10
                )
                
                if parent_response.status_code != 200:
                    print(f"❌ Failed to fetch parent post: {parent_response.status_code}")
                    return None
                
                parent_cid = parent_response.json().get('cid')
                
                post_record['reply'] = {
                    'root': {
                        'uri': reply_to,
                        'cid': parent_cid
                    },
                    'parent': {
                        'uri': reply_to,
                        'cid': parent_cid
                    }
                }
            
            # Create the post
            response = requests.post(
                f"{self.pds_url}/xrpc/com.atproto.repo.createRecord",
                headers={
                    'Authorization': f'Bearer {self.session_token}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': self.worker_did,
                    'collection': 'app.bsky.feed.post',
                    'record': post_record
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Failed to create post: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error creating post: {e}")
            return None
    
    def upload_blob(self, file_path: str, mime_type: str = 'image/png') -> Optional[Dict]:
        """
        Upload a blob (image, etc.) to the PDS.
        
        Args:
            file_path: Path to the file to upload
            mime_type: MIME type of the file
            
        Returns:
            Dict with blob reference if successful, None if failed
        """
        if not self.session_token:
            print("❌ Not authenticated - call authenticate() first")
            return None
        
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            response = requests.post(
                f"{self.pds_url}/xrpc/com.atproto.repo.uploadBlob",
                headers={
                    'Authorization': f'Bearer {self.session_token}',
                    'Content-Type': mime_type
                },
                data=file_data,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json().get('blob')
            else:
                print(f"❌ Failed to upload blob: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error uploading blob: {e}")
            return None
    
    def create_like(self, post_uri: str) -> bool:
        """
        Create a like from the worker's account.
        
        Args:
            post_uri: AT URI of post to like
            
        Returns:
            bool: True if successful
        """
        if not self.session_token:
            print("❌ Not authenticated - call authenticate() first")
            return False
        
        try:
            # Parse post URI to get CID
            uri_parts = post_uri.replace('at://', '').split('/')
            post_did = uri_parts[0]
            post_rkey = uri_parts[-1]
            
            # Fetch post to get CID
            response = requests.get(
                f"{self.pds_url}/xrpc/com.atproto.repo.getRecord",
                params={
                    'repo': post_did,
                    'collection': 'app.bsky.feed.post',
                    'rkey': post_rkey
                },
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to fetch post for like: {response.status_code}")
                return False
            
            post_cid = response.json().get('cid')
            
            # Create like record
            like_record = {
                '$type': 'app.bsky.feed.like',
                'subject': {
                    'uri': post_uri,
                    'cid': post_cid
                },
                'createdAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            }
            
            # Create the like
            response = requests.post(
                f"{self.pds_url}/xrpc/com.atproto.repo.createRecord",
                headers={
                    'Authorization': f'Bearer {self.session_token}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': self.worker_did,
                    'collection': 'app.bsky.feed.like',
                    'record': like_record
                },
                timeout=10
            )
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"❌ Error creating like: {e}")
            return False
    
    def delete_post(self, post_uri: str) -> bool:
        """
        Delete a post from the worker's account.
        
        Args:
            post_uri: AT URI of post to delete (e.g., at://did:plc:xxx/app.bsky.feed.post/yyy)
            
        Returns:
            bool: True if successful
        """
        if not self.session_token:
            print("❌ Not authenticated - call authenticate() first")
            return False
        
        try:
            # Parse URI to get collection and rkey
            uri_parts = post_uri.replace('at://', '').split('/')
            repo_did = uri_parts[0]
            collection = '/'.join(uri_parts[1:-1])  # e.g., 'app.bsky.feed.post'
            rkey = uri_parts[-1]
            
            # Verify we're deleting from our own repo
            if repo_did != self.worker_did:
                print(f"❌ Cannot delete post from different repo: {repo_did} != {self.worker_did}")
                return False
            
            # Delete the record
            response = requests.post(
                f"{self.pds_url}/xrpc/com.atproto.repo.deleteRecord",
                headers={
                    'Authorization': f'Bearer {self.session_token}',
                    'Content-Type': 'application/json'
                },
                json={
                    'repo': self.worker_did,
                    'collection': collection,
                    'rkey': rkey
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return True
            else:
                print(f"❌ Failed to delete post: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting post: {e}")
            return False
    
    @staticmethod
    def from_work_table(db, role: str, status: str = 'working') -> Optional['WorkerNetworkClient']:
        """
        Create WorkerNetworkClient from work table data.
        
        Args:
            db: DatabaseManager instance
            role: Worker role (e.g., 'greeter', 'moderator')
            status: Worker status filter (default: 'working')
            
        Returns:
            WorkerNetworkClient instance if worker found, None otherwise
        """
        import json
        
        # Get workers for this role
        cursor = db.execute("SELECT workers FROM work WHERE role = %s", (role,))
        row = cursor.fetchone()
        
        if not row or not row['workers']:
            return None
        
        workers = json.loads(row['workers'])
        
        # Find worker with matching status
        for worker in workers:
            if worker.get('status') == status:
                # Get worker's handle
                cursor = db.execute("SELECT handle FROM dreamers WHERE did = %s", (worker['did'],))
                dreamer_row = cursor.fetchone()
                
                if not dreamer_row:
                    continue
                
                return WorkerNetworkClient(
                    worker_did=worker['did'],
                    worker_handle=dreamer_row['handle'],
                    app_password_base64=worker.get('passhash', '')
                )
        
        # If no working worker found, try any worker
        if workers:
            worker = workers[0]
            cursor = db.execute("SELECT handle FROM dreamers WHERE did = %s", (worker['did'],))
            dreamer_row = cursor.fetchone()
            
            if dreamer_row:
                return WorkerNetworkClient(
                    worker_did=worker['did'],
                    worker_handle=dreamer_row['handle'],
                    app_password_base64=worker.get('passhash', '')
                )
        
        return None
    
    @staticmethod
    def from_credentials(db, did: str, role: Optional[str] = None) -> Optional['WorkerNetworkClient']:
        """
        Create WorkerNetworkClient from user_credentials table (NEW unified system).
        
        This is the preferred method for Phase 2+ of the unified app password migration.
        It loads the shared credential from user_credentials and optionally verifies
        the role is active in user_roles.
        
        Args:
            db: DatabaseManager instance
            did: User's DID
            role: Optional role to verify is active (e.g., 'greeter', 'moderator')
            
        Returns:
            WorkerNetworkClient instance if credential found and valid, None otherwise
        """
        # Get shared credential
        cursor = db.execute(
            "SELECT app_password_hash, pds_url, is_valid FROM user_credentials WHERE did = %s",
            (did,)
        )
        cred = cursor.fetchone()
        
        if not cred:
            return None
        
        # Check if credential is marked as invalid
        if not cred['is_valid']:
            print(f"⚠️ Credential for {did} is marked invalid")
            return None
        
        # Get user handle
        cursor = db.execute("SELECT handle FROM dreamers WHERE did = %s", (did,))
        dreamer = cursor.fetchone()
        
        if not dreamer:
            print(f"⚠️ No dreamer record found for {did}")
            return None
        
        # Optional: Verify role is active
        if role:
            cursor = db.execute(
                "SELECT 1 FROM user_roles WHERE did = %s AND role = %s AND status = 'active'",
                (did, role)
            )
            if not cursor.fetchone():
                print(f"⚠️ Role '{role}' not active for {did}")
                return None
        
        return WorkerNetworkClient(
            worker_did=did,
            worker_handle=dreamer['handle'],
            app_password_base64=cred['app_password_hash']
        )
