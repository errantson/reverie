from typing import Optional, Dict, List
import requests
import json
import os
from urllib.parse import quote
from config import Config
from .auth import AuthManager

class ReactionsManager:
    """Handles likes, reactions, and engagement operations."""
    
    def __init__(self, auth_manager: AuthManager):
        self.auth = auth_manager
        self._request_cache = {}
        self._liked_this_cycle = set()
    
    def get_post_likes(self, post_uri: str, cursor: Optional[str] = None, limit: int = 100) -> Optional[Dict]:
        """Get likes for a specific post."""
        token = self.auth.get_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        params = {
            "uri": post_uri,
            "limit": limit
        }
        
        if cursor:
            params["cursor"] = cursor
        
        endpoints = ["https://public.api.bsky.app", "https://bsky.social"]
        
        for server in endpoints:
            url = f"{server}/xrpc/app.bsky.feed.getLikes"
            try:
                response = requests.get(url, headers=headers, params=params, timeout=10)
                if response.status_code == 200:
                    return response.json()
            except requests.exceptions.RequestException:
                continue
        
        return None
    
    def get_post_reposts(self, post_uri: str, cursor: Optional[str] = None, limit: int = 100) -> Optional[Dict]:
        """Get reposts for a specific post."""
        token = self.auth.get_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        params = {
            "uri": post_uri,
            "limit": limit
        }
        
        if cursor:
            params["cursor"] = cursor
        
        endpoints = ["https://public.api.bsky.app", "https://bsky.social"]
        
        for server in endpoints:
            url = f"{server}/xrpc/app.bsky.feed.getRepostedBy"
            try:
                response = requests.get(url, headers=headers, params=params, timeout=10)
                if response.status_code == 200:
                    return response.json()
            except requests.exceptions.RequestException:
                continue
        
        return None
    
    def get_engagement_stats(self, post_uri: str) -> Dict:
        """Get engagement statistics for a post."""
        stats = {
            "likes_count": 0,
            "reposts_count": 0,
            "replies_count": 0
        }
        
        likes_data = self.get_post_likes(post_uri)
        if likes_data:
            stats["likes_count"] = len(likes_data.get("likes", []))
        
        reposts_data = self.get_post_reposts(post_uri)
        if reposts_data:
            stats["reposts_count"] = len(reposts_data.get("repostedBy", []))
        
        return stats
    
    def create_like(self, post_uri: str) -> bool:
        """Create a like for the specified post."""
        from config import Config
        
        if post_uri in self._liked_this_cycle:
            if Config.DEBUG:
                print(f"⏭️  Already liked in this cycle")
            return True
        
        status = {
            'auth': False,
            'identity': False, 
            'uri_valid': False,
            'cid_fetched': False,
            'record_created': False,
            'pds_resolved': False,
            'submitted': False,
            'user_handle': '',
            'user_did': '',
            'target_repo': '',
            'post_cid': '',
            'pds_url': '',
            'like_uri': ''
        }
        
        token = self.auth.get_token()
        if not token:
            print("❌ Like failed: No authentication token")
            return False
        status['auth'] = True
        
        try:
            user_did = self.auth.get_user_did()
            user_handle = self.auth.get_user_handle()
            
            if not user_did:
                print("❌ Like failed: No DID in auth cache")
                return False
                
            status['identity'] = True
            status['user_handle'] = user_handle
            status['user_did'] = user_did
            
        except Exception as e:
            print(f"❌ Like failed: Identity error")
            return False
        
        if not post_uri.startswith("at://"):
            print(f"❌ Like failed: Invalid URI format")
            return False
            
        try:
            uri_parts = post_uri[5:].split("/")
            if len(uri_parts) < 3:
                print(f"❌ Like failed: Invalid URI structure")
                return False
                
            target_repo = uri_parts[0]
            target_collection = "/".join(uri_parts[1:-1])
            target_rkey = uri_parts[-1]
            
            status['uri_valid'] = True
            status['target_repo'] = target_repo
            
        except Exception as e:
            print(f"❌ Like failed: URI parsing error")
            return False
        
        post_cid = self._get_post_cid(post_uri, token)
        if not post_cid:
            print("❌ Like failed: Could not fetch post CID")
            return False
        status['cid_fetched'] = True
        status['post_cid'] = post_cid
        
        like_record = {
            "$type": "app.bsky.feed.like",
            "subject": {
                "uri": post_uri,
                "cid": post_cid
            },
            "createdAt": self._get_current_timestamp()
        }
        
        status['record_created'] = True
        
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Like failed: Could not determine PDS")
            return False
        status['pds_resolved'] = True
        status['pds_url'] = pds_url
        
        create_url = f"{pds_url}/xrpc/com.atproto.repo.createRecord"
        
        payload = {
            "repo": user_did,
            "collection": "app.bsky.feed.like",
            "record": like_record
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                create_url,
                json=payload,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT
            )
            
            if response.status_code == 200:
                result = response.json()
                like_uri = result.get('uri', 'N/A')
                status['submitted'] = True
                status['like_uri'] = like_uri
                
                self._liked_this_cycle.add(post_uri)
                
                if Config.DEBUG:
                    print(f"✅ Like created: {like_uri}")
                else:
                    from utils.reactions_panel import reactions_panel
                    reactions_panel.quick_operation("like", f"@{user_handle}", True, f"URI: {like_uri}")
                
                return True
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    error_type = error_data.get('error', 'Unknown')
                    
                    if error_type == "ExpiredToken" or "expired" in error_msg.lower():
                        if Config.DEBUG:
                            print(f"🔄 Token expired, retrying...")
                        fresh_token = self.auth.handle_expired_token()
                        if fresh_token:
                            headers["Authorization"] = f"Bearer {fresh_token}"
                            retry_response = requests.post(
                                create_url,
                                json=payload,
                                headers=headers,
                                timeout=Config.REQUEST_TIMEOUT
                            )
                            if retry_response.status_code == 200:
                                result = retry_response.json()
                                like_uri = result.get('uri', 'N/A')
                                self._liked_this_cycle.add(post_uri)
                                if Config.DEBUG:
                                    print(f"✅ Retry success: {like_uri}")
                                return True
                            else:
                                if Config.DEBUG:
                                    print(f"❌ Retry failed: {retry_response.status_code}")
                        else:
                            if Config.DEBUG:
                                print(f"❌ Could not refresh token")
                        return False
                    
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        if Config.DEBUG:
                            print(f"💭 Already liked")
                        self._liked_this_cycle.add(post_uri)
                        return True
                    
                    if Config.DEBUG:
                        print(f"❌ Like failed: {error_msg}")
                except:
                    if Config.DEBUG:
                        print(f"❌ Like failed: {response.text}")
                return False
            else:
                if Config.DEBUG:
                    print(f"❌ Unexpected status: {response.status_code}")
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data.get('message', 'Unknown')}")
                    except:
                        pass
                return False
                
        except requests.exceptions.Timeout:
            if Config.DEBUG:
                print(f"❌ Timeout after {Config.REQUEST_TIMEOUT}s")
            return False
        except requests.exceptions.ConnectionError as e:
            if Config.DEBUG:
                print(f"❌ Connection error: {e}")
            return False
        except requests.exceptions.RequestException as e:
            if Config.DEBUG:
                print(f"❌ Network error: {e}")
            return False
        except Exception as e:
            if Config.DEBUG:
                print(f"❌ Unexpected exception: {e}")
            return False
    
    def create_follow(self, target_did: str) -> bool:
        """Create a follow for the specified user DID."""
        print("👥 === REACTIONS MANAGER FOLLOW START ===")
        print(f"📝 Target user DID: {target_did}")
        
        print(f"\n🔐 STEP 1: AUTHENTICATION")
        token = self.auth.get_token()
        if not token:
            print("❌ No authentication token available")
            return False
        print("✅ Authentication token obtained")
        
        print(f"\n🆔 STEP 2: USER IDENTITY")
        try:
            user_did = self.auth.get_user_did()
            user_handle = self.auth.get_user_handle()
            
            if not user_did:
                print("❌ No DID found in auth cache")
                return False
                
            if user_did == target_did:
                print("❌ Cannot follow yourself")
                return False
                
            print(f"✅ User identity: @{user_handle} (DID: {user_did})")
            
        except Exception as e:
            print(f"❌ Error getting user identity: {e}")
            return False
        
        print(f"\n📋 STEP 3: TARGET DID VALIDATION")
        if not target_did.startswith("did:"):
            print(f"❌ Invalid DID format: {target_did}")
            return False
            
        print(f"✅ Target DID validated: {target_did}")
        
        print(f"\n📝 STEP 4: FOLLOW RECORD CREATION")
        follow_record = {
            "$type": "app.bsky.graph.follow",
            "subject": target_did,
            "createdAt": self._get_current_timestamp()
        }
        
        print(f"✅ Follow record created:")
        print(f"   • Type: {follow_record['$type']}")
        print(f"   • Subject: {follow_record['subject']}")
        print(f"   • Created at: {follow_record['createdAt']}")
        
        print(f"\n🌐 STEP 5: PDS ENDPOINT RESOLUTION")
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Could not determine user's PDS")
            return False
        print(f"✅ PDS endpoint: {pds_url}")
        
        print(f"\n🚀 STEP 6: SUBMITTING FOLLOW RECORD")
        create_url = f"{pds_url}/xrpc/com.atproto.repo.createRecord"
        
        payload = {
            "repo": user_did,
            "collection": "app.bsky.graph.follow",
            "record": follow_record
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"📤 Request details:")
        print(f"   • URL: {create_url}")
        print(f"   • Repo: {payload['repo']}")
        print(f"   • Collection: {payload['collection']}")
        print(f"   • Authorization: Bearer {token[:20]}...")
        
        try:
            response = requests.post(
                create_url,
                json=payload,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT
            )
            
            print(f"📥 Response received:")
            print(f"   • Status code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                follow_uri = result.get('uri', 'N/A')
                
                if Config.DEBUG:
                    print(f"✅ === FOLLOW OPERATION SUCCESS ===")
                    print(f"   • Follow record created successfully")
                    print(f"   • Follow URI: {follow_uri}")
                    print(f"   • @{user_handle} now follows {target_did}")
                else:
                    from utils.reactions_panel import reactions_panel
                    reactions_panel.quick_operation("follow", target_did[:20] + "...", True, f"URI: {follow_uri}")
                
                return True
            elif response.status_code == 400:
                print(f"❌ === FOLLOW OPERATION FAILED ===")
                print(f"   • HTTP Status: 400 Bad Request")
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    error_type = error_data.get('error', 'Unknown')
                    print(f"   • Error message: {error_msg}")
                    print(f"   • Error type: {error_type}")
                    print(f"   • Full error data: {error_data}")
                    
                    if error_type == "ExpiredToken" or "expired" in error_msg.lower():
                        print(f"🔄 Token expired, attempting refresh and retry...")
                        fresh_token = self.auth.handle_expired_token()
                        if fresh_token:
                            print(f"✅ Got fresh token, retrying follow operation...")
                            headers["Authorization"] = f"Bearer {fresh_token}"
                            retry_response = requests.post(
                                create_url,
                                json=payload,
                                headers=headers,
                                timeout=Config.REQUEST_TIMEOUT
                            )
                            if retry_response.status_code == 200:
                                result = retry_response.json()
                                follow_uri = result.get('uri', 'N/A')
                                print(f"✅ === RETRY SUCCESS ===")
                                print(f"   • Follow record created successfully with fresh token")
                                print(f"   • Follow URI: {follow_uri}")
                                return True
                            else:
                                print(f"❌ Retry also failed: {retry_response.status_code}")
                                try:
                                    retry_error = retry_response.json()
                                    print(f"   • Retry error: {retry_error}")
                                except:
                                    print(f"   • Retry response: {retry_response.text}")
                        else:
                            print(f"❌ Could not get fresh token for retry")
                        return False
                    
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        print(f"💭 Already following user - treating as success")
                        return True
                except:
                    print(f"   • Response text: {response.text}")
                return False
            else:
                print(f"❌ === UNEXPECTED ERROR ===")
                print(f"   • HTTP Status: {response.status_code}")
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    print(f"   • Error message: {error_msg}")
                    print(f"   • Full error data: {error_data}")
                except:
                    print(f"   • Response text: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            print(f"💥 === TIMEOUT ERROR ===")
            print(f"   • Request timed out after {Config.REQUEST_TIMEOUT} seconds")
            return False
        except requests.exceptions.ConnectionError as e:
            print(f"💥 === CONNECTION ERROR ===")
            print(f"   • Could not connect to server: {e}")
            return False
        except requests.exceptions.RequestException as e:
            print(f"💥 === NETWORK ERROR ===")
            print(f"   • Network request failed: {e}")
            print(f"   • Exception type: {type(e).__name__}")
            return False
        except Exception as e:
            print(f"💥 === UNEXPECTED EXCEPTION ===")
            print(f"   • Exception: {e}")
            print(f"   • Exception type: {type(e).__name__}")
            return False
    
    def unfollow_user(self, target_did: str) -> bool:
        """Remove a follow for the specified user DID."""
        print(f"💔 === REACTIONS MANAGER UNFOLLOW START ===")
        print(f"📝 Target user DID: {target_did}")
        
        print(f"\n🔐 STEP 1: AUTHENTICATION")
        token = self.auth.get_token()
        if not token:
            print("❌ No authentication token available")
            return False
        print("✅ Authentication token obtained")
        
        print(f"\n🆔 STEP 2: USER IDENTITY")
        try:
            user_did = self.auth.get_user_did()
            user_handle = self.auth.get_user_handle()
            
            if not user_did:
                print("❌ No DID found in auth cache")
                return False
                
            if user_did == target_did:
                print("❌ Cannot unfollow yourself")
                return False
                
            print(f"✅ User identity: @{user_handle} (DID: {user_did})")
            
        except Exception as e:
            print(f"❌ Error getting user identity: {e}")
            return False
        
        print(f"\n🔍 STEP 3: FINDING FOLLOW RECORD")
        follow_rkey = self._find_follow_record(target_did)
        if not follow_rkey:
            print(f"❌ No follow record found for user {target_did}")
            print(f"💭 User may not be followed, treating as success")
            return True
        print(f"✅ Follow record found: {follow_rkey}")
        
        print(f"\n🌐 STEP 4: PDS ENDPOINT RESOLUTION")
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Could not determine user's PDS")
            return False
        print(f"✅ PDS endpoint: {pds_url}")
        
        print(f"\n🚀 STEP 5: DELETING FOLLOW RECORD")
        delete_url = f"{pds_url}/xrpc/com.atproto.repo.deleteRecord"
        
        payload = {
            "repo": user_did,
            "collection": "app.bsky.graph.follow",
            "rkey": follow_rkey
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"📤 Request details:")
        print(f"   • URL: {delete_url}")
        print(f"   • Repo: {payload['repo']}")
        print(f"   • Collection: {payload['collection']}")
        print(f"   • Record key: {payload['rkey']}")
        print(f"   • Authorization: Bearer {token[:20]}...")
        
        try:
            response = requests.post(
                delete_url,
                json=payload,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT
            )
            
            print(f"📥 Response received:")
            print(f"   • Status code: {response.status_code}")
            
            if response.status_code == 200:
                if Config.DEBUG:
                    print(f"✅ === UNFOLLOW OPERATION SUCCESS ===")
                    print(f"   • Follow record deleted successfully")
                    print(f"   • @{user_handle} unfollowed {target_did}")
                else:
                    from utils.reactions_panel import reactions_panel
                    reactions_panel.quick_operation("unfollow", target_did[:20] + "...", True, "Record deleted")
                
                return True
            elif response.status_code == 400:
                print(f"❌ === UNFOLLOW OPERATION FAILED ===")
                print(f"   • HTTP Status: 400 Bad Request")
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    error_type = error_data.get('error', 'Unknown')
                    print(f"   • Error message: {error_msg}")
                    print(f"   • Error type: {error_type}")
                    
                    if error_type == "ExpiredToken" or "expired" in error_msg.lower():
                        print(f"🔄 Token expired, attempting refresh and retry...")
                        fresh_token = self.auth.handle_expired_token()
                        if fresh_token:
                            print(f"✅ Got fresh token, retrying unfollow operation...")
                            headers["Authorization"] = f"Bearer {fresh_token}"
                            retry_response = requests.post(
                                delete_url,
                                json=payload,
                                headers=headers,
                                timeout=Config.REQUEST_TIMEOUT
                            )
                            if retry_response.status_code == 200:
                                print(f"✅ === RETRY SUCCESS ===")
                                print(f"   • Follow record deleted successfully with fresh token")
                                return True
                            else:
                                print(f"❌ Retry also failed: {retry_response.status_code}")
                                try:
                                    retry_error = retry_response.json()
                                    print(f"   • Retry error: {retry_error}")
                                except:
                                    print(f"   • Retry response: {retry_response.text}")
                        else:
                            print(f"❌ Could not get fresh token for retry")
                        return False
                    
                    if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                        print(f"💭 Follow record doesn't exist - treating as success")
                        return True
                except:
                    print(f"   • Response text: {response.text}")
                return False
            else:
                print(f"❌ === UNEXPECTED ERROR ===")
                print(f"   • HTTP Status: {response.status_code}")
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    print(f"   • Error message: {error_msg}")
                    print(f"   • Full error data: {error_data}")
                except:
                    print(f"   • Response text: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            print(f"💥 === TIMEOUT ERROR ===")
            print(f"   • Request timed out after {Config.REQUEST_TIMEOUT} seconds")
            return False
        except requests.exceptions.ConnectionError as e:
            print(f"💥 === CONNECTION ERROR ===")
            print(f"   • Could not connect to server: {e}")
            return False
        except requests.exceptions.RequestException as e:
            print(f"💥 === NETWORK ERROR ===")
            print(f"   • Network request failed: {e}")
            print(f"   • Exception type: {type(e).__name__}")
            return False
        except Exception as e:
            print(f"💥 === UNEXPECTED EXCEPTION ===")
            print(f"   • Exception: {e}")
            print(f"   • Exception type: {type(e).__name__}")
            return False
    
    def create_post(self, text: str, reply_to: Optional[str] = None, facets: Optional[List[Dict]] = None) -> Optional[Dict]:
        """
        Create a post (or reply if reply_to is specified).
        
        Args:
            text: The text content of the post
            reply_to: Optional AT URI of post to reply to (e.g., "at://did:plc:.../app.bsky.feed.post/...")
            facets: Optional list of facets for mentions, links, etc.
            
        Returns:
            Dict with 'uri' and 'cid' if successful, None if failed
        """
        print(f"📝 === CREATE POST START ===")
        print(f"Text: {text[:100]}{'...' if len(text) > 100 else ''}")
        if reply_to:
            print(f"Reply to: {reply_to}")
        if facets:
            print(f"Facets: {len(facets)} facet(s) provided")
        
        print(f"\n🔐 STEP 1: AUTHENTICATION")
        token = self.auth.get_token()
        if not token:
            print("❌ No authentication token available")
            return None
        print("✅ Authentication token obtained")
        
        print(f"\n🆔 STEP 2: USER IDENTITY")
        try:
            user_did = self.auth.get_user_did()
            user_handle = self.auth.get_user_handle()
            
            if not user_did:
                print("❌ No DID found in auth cache")
                return None
                
            print(f"✅ User identity: @{user_handle} (DID: {user_did})")
            
        except Exception as e:
            print(f"❌ Error getting user identity: {e}")
            return None
        
        print(f"\n📝 STEP 3: BUILDING POST RECORD")
        post_record = {
            "$type": "app.bsky.feed.post",
            "text": text,
            "createdAt": self._get_current_timestamp()
        }
        
        if facets:
            post_record["facets"] = facets
            print(f"✅ Added {len(facets)} facet(s) to post record")
        
        if reply_to:
            parent_cid = self._get_post_cid(reply_to, token)
            if not parent_cid:
                print(f"❌ Could not fetch parent post CID for reply")
                return None
            
            try:
                parent_parts = reply_to[5:].split("/")
                parent_repo = parent_parts[0]
            except Exception as e:
                print(f"❌ Error parsing parent URI: {e}")
                return None
            
            post_record["reply"] = {
                "root": {
                    "uri": reply_to,
                    "cid": parent_cid
                },
                "parent": {
                    "uri": reply_to,
                    "cid": parent_cid
                }
            }
            print(f"✅ Reply metadata added (parent CID: {parent_cid})")
        
        print(f"✅ Post record built")
        
        print(f"\n🌐 STEP 4: PDS ENDPOINT RESOLUTION")
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Could not determine user's PDS")
            return None
        print(f"✅ PDS endpoint: {pds_url}")
        
        print(f"\n🚀 STEP 5: SUBMITTING POST")
        create_url = f"{pds_url}/xrpc/com.atproto.repo.createRecord"
        
        payload = {
            "repo": user_did,
            "collection": "app.bsky.feed.post",
            "record": post_record
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print(f"📤 Request details:")
        print(f"   • URL: {create_url}")
        print(f"   • Repo: {payload['repo']}")
        print(f"   • Collection: {payload['collection']}")
        
        try:
            response = requests.post(
                create_url,
                json=payload,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT
            )
            
            print(f"📥 Response received:")
            print(f"   • Status code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                post_uri = result.get('uri')
                post_cid = result.get('cid')
                
                print(f"✅ === POST CREATED SUCCESSFULLY ===")
                print(f"   • URI: {post_uri}")
                print(f"   • CID: {post_cid}")
                
                return {
                    'uri': post_uri,
                    'cid': post_cid
                }
            elif response.status_code == 400:
                print(f"❌ === POST CREATION FAILED ===")
                print(f"   • HTTP Status: 400 Bad Request")
                try:
                    error_data = response.json()
                    error_msg = error_data.get('message', 'Unknown error')
                    error_type = error_data.get('error', 'Unknown')
                    print(f"   • Error message: {error_msg}")
                    print(f"   • Error type: {error_type}")
                    
                    if error_type == "ExpiredToken" or "expired" in error_msg.lower():
                        print(f"🔄 Token expired, attempting refresh and retry...")
                        fresh_token = self.auth.handle_expired_token()
                        if fresh_token:
                            print(f"✅ Got fresh token, retrying post...")
                            headers["Authorization"] = f"Bearer {fresh_token}"
                            retry_response = requests.post(
                                create_url,
                                json=payload,
                                headers=headers,
                                timeout=Config.REQUEST_TIMEOUT
                            )
                            if retry_response.status_code == 200:
                                result = retry_response.json()
                                post_uri = result.get('uri')
                                post_cid = result.get('cid')
                                print(f"✅ === RETRY SUCCESS ===")
                                print(f"   • URI: {post_uri}")
                                print(f"   • CID: {post_cid}")
                                return {
                                    'uri': post_uri,
                                    'cid': post_cid
                                }
                            else:
                                print(f"❌ Retry failed: {retry_response.status_code}")
                        else:
                            print(f"❌ Could not refresh token")
                except:
                    print(f"   • Response text: {response.text}")
                return None
            else:
                print(f"❌ === UNEXPECTED ERROR ===")
                print(f"   • HTTP Status: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   • Error: {error_data}")
                except:
                    print(f"   • Response text: {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"💥 === TIMEOUT ERROR ===")
            print(f"   • Request timed out after {Config.REQUEST_TIMEOUT} seconds")
            return None
        except requests.exceptions.ConnectionError as e:
            print(f"💥 === CONNECTION ERROR ===")
            print(f"   • Could not connect to server: {e}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"💥 === NETWORK ERROR ===")
            print(f"   • Network request failed: {e}")
            return None
        except Exception as e:
            print(f"💥 === UNEXPECTED EXCEPTION ===")
            print(f"   • Exception: {e}")
            print(f"   • Exception type: {type(e).__name__}")
            return None
    
    def _get_post_cid(self, post_uri: str, token: str) -> Optional[str]:
        """Fetch the CID for a specific post."""
        from config import Config
        
        try:
            uri_parts = post_uri[5:].split("/")
            repo = uri_parts[0]
            collection = "/".join(uri_parts[1:-1])
            rkey = uri_parts[-1]
            
        except Exception as e:
            if Config.DEBUG:
                print(f"❌ Error parsing URI for CID fetch: {e}")
            return None
        
        endpoints = [
            "https://reverie.house",  # Check local PDS first for fresh posts
            "https://public.api.bsky.app",
            "https://bsky.social"
        ]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        for endpoint in endpoints:
            try:
                url = f"{endpoint}/xrpc/com.atproto.repo.getRecord"
                params = {
                    "repo": repo,
                    "collection": collection,
                    "rkey": rkey
                }
                
                response = requests.get(url, headers=headers, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    cid = data.get('cid')
                    if cid:
                        return cid
                    
            except Exception as e:
                if Config.DEBUG:
                    print(f"⚠️ Error fetching CID from {endpoint}: {e}")
                continue
        
        if Config.DEBUG:
            print("❌ Could not fetch CID from any endpoint")
        return None
    
    def unlike_post(self, post_uri: str) -> bool:
        """Remove a like from a specific post."""
        print(f"💔 ReactionsManager: Attempting to unlike post {post_uri}")
        
        token = self.auth.get_token()
        if not token:
            print("❌ ReactionsManager: No authentication token available for unliking")
            return False
        
        like_rkey = self._find_like_record(post_uri)
        if not like_rkey:
            print(f"❌ ReactionsManager: No like record found for post")
            return False
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            user_did = self.auth.get_user_did()
            if not user_did:
                print("❌ No DID found in auth cache")
                return None
        except Exception as e:
            print(f"❌ Error getting user DID: {e}")
            return None
        
        data = {
            "repo": user_did,
            "collection": "app.bsky.feed.like",
            "rkey": like_rkey
        }
        
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Could not determine user's PDS for unlike")
            return False
        
        url = f"{pds_url}/xrpc/com.atproto.repo.deleteRecord"
        try:
            response = requests.post(url, headers=headers, json=data, timeout=Config.REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                print(f"💔 ✅ ReactionsManager: Successfully unliked post")
                return True
            else:
                print(f"❌ ReactionsManager: Failed to unlike - {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ ReactionsManager: Network error unliking: {e}")
            return False
    
    def _find_follow_record(self, target_did: str) -> Optional[str]:
        """Find the rkey of a follow record for a specific user DID."""
        print(f"🔍 Searching for follow record for DID: {target_did}")
        
        token = self.auth.get_token()
        if not token:
            print("❌ No authentication token available for follow search")
            return None
        
        try:
            user_did = self.auth.get_user_did()
            if not user_did:
                print("❌ No DID found in auth cache")
                return None
        except Exception as e:
            print(f"❌ Error getting user DID: {e}")
            return None
        
        pds_url = self._get_user_pds()
        if not pds_url:
            print("❌ Could not determine user's PDS for follow search")
            return None
        
        list_url = f"{pds_url}/xrpc/com.atproto.repo.listRecords"
        params = {
            "repo": user_did,
            "collection": "app.bsky.graph.follow"
        }
        
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        try:
            print(f"   • Querying: {list_url}")
            response = requests.get(list_url, headers=headers, params=params, timeout=Config.REQUEST_TIMEOUT)
            
            if response.status_code == 200:
                data = response.json()
                records = data.get('records', [])
                print(f"   • Found {len(records)} follow records")
                
                for record in records:
                    record_data = record.get('value', {})
                    subject = record_data.get('subject')
                    
                    if subject == target_did:
                        rkey = record.get('uri', '').split('/')[-1] if record.get('uri') else None
                        if rkey:
                            print(f"✅ Found follow record with rkey: {rkey}")
                            return rkey
                        else:
                            print(f"❌ Found follow record but could not extract rkey")
                            return None
                
                print(f"🔍 No follow record found for {target_did}")
                return None
            else:
                print(f"❌ Failed to list follow records: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   • Error: {error_data}")
                except:
                    print(f"   • Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error searching for follow record: {e}")
            return None
    
    def _find_like_record(self, post_uri: str) -> Optional[str]:
        """Find the rkey of a like record for a specific post."""
        print("🔍 ReactionsManager: Searching for existing like record...")
        print("💡 ReactionsManager: Like record search not implemented - would need to list user's likes")
        return None
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp in ISO 8601 format."""
        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        print(f"🕐 Generated timestamp: {timestamp}")
        return timestamp
    
    def _get_user_pds(self) -> Optional[str]:
        """Get the PDS URL for the authenticated user."""
        from config import Config
        
        try:
            session_cache = Config.SESSION_CACHE
            if os.path.exists(session_cache):
                with open(session_cache, 'r') as f:
                    data = json.load(f)
                    pds_url = data.get('pdsUrl')
                    if pds_url:
                        return pds_url
        except Exception:
            pass
        
        resolved_pds = self.auth._resolve_pds_for_handle(Config.BLUESKY_HANDLE)
        return resolved_pds
