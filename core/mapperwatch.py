#!/usr/bin/env python3
"""
Mapper Polling Service - Check origin quest replies every minute

Simple and reliable polling service that:
1. Polls the origin quest post for new replies every 60 seconds
2. Checks the events table for DIDs who already have key='origin'
3. For new users: calculates spectrum, posts reply as mapper, adds origin event
4. Uses the database as source of truth, not in-memory session tracking

This follows the same proven pattern as greeterwatch.
"""

import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Set, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client


class MapperMonitor:
    """Poll the origin quest for new replies every minute."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        
        self.stats = {
            'total_checks': 0,
            'replies_found': 0,
            'origins_declared': 0,
            'start_time': datetime.now()
        }
        
        # Track DIDs who already have origin declared - loaded from database
        self.declared_dids: Set[str] = set()
        self._load_declared_origins()
        
        # The origin quest URI - loaded from database
        self.origin_uri: Optional[str] = None
        self._load_origin_quest()
        
        # AT Protocol client for fetching threads (public API, no auth needed)
        self.client = Client(base_url='https://public.api.bsky.app')
        
        # Mapper client for posting replies - authenticated
        self.mapper_client = None
        self._authenticate_mapper()
    
    def _load_declared_origins(self):
        """Load DIDs who already have origin declared from events table."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            
            # Get all DIDs who have key='origin' in events table
            cursor = db.execute(
                "SELECT DISTINCT did FROM events WHERE key = 'origin'"
            )
            rows = cursor.fetchall()
            
            for row in rows:
                if row['did']:
                    self.declared_dids.add(row['did'])
            
            if self.verbose:
                print(f"📝 Loaded {len(self.declared_dids)} DIDs with origin already declared")
                
        except Exception as e:
            print(f"⚠️  Error loading declared origins: {e}")
    
    def _load_origin_quest(self):
        """Load the origin quest URI from database."""
        try:
            from core.database import DatabaseManager
            db = DatabaseManager()
            cursor = db.execute(
                "SELECT uri FROM quests WHERE title = 'origin' AND enabled = true"
            )
            result = cursor.fetchone()
            
            if result:
                self.origin_uri = result['uri']
                if self.verbose:
                    print(f"🗺️  MAPPERWATCH - Origin Quest Monitor")
                    print(f"=" * 70)
                    print(f"Quest URI: {self.origin_uri}")
                    print(f"Polling interval: 60 seconds")
                    print(f"Started: {self.stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"=" * 70)
            else:
                print(f"❌ Origin quest not found or disabled")
                
        except Exception as e:
            print(f"❌ Error loading origin quest: {e}")
            import traceback
            traceback.print_exc()
    
    def _authenticate_mapper(self):
        """Authenticate the mapper client for posting replies."""
        try:
            import json
            from core.database import DatabaseManager
            from core.encryption import decrypt_password
            
            db = DatabaseManager()
            
            # Get mapper from work table
            cursor = db.execute("SELECT workers FROM work WHERE role = 'mapper'")
            work_result = cursor.fetchone()
            
            if not work_result or not work_result['workers']:
                print("⚠️  No mapper assigned in work table")
                return
            
            workers = json.loads(work_result['workers'])
            if not workers:
                print("⚠️  Empty workers list for mapper")
                return
            
            mapper_did = workers[0].get('did')
            
            # Get mapper credentials
            cursor = db.execute("""
                SELECT d.handle, c.app_password_hash, c.pds_url
                FROM dreamers d
                JOIN user_credentials c ON d.did = c.did
                WHERE d.did = %s AND c.is_valid = true
            """, (mapper_did,))
            result = cursor.fetchone()
            
            if not result or not result['app_password_hash']:
                print(f"⚠️  No credentials found for mapper DID: {mapper_did}")
                return
            
            app_password = decrypt_password(result['app_password_hash'])
            if not app_password:
                print("⚠️  Failed to decrypt mapper password")
                return
            
            pds_url = result.get('pds_url') or 'https://reverie.house'
            
            # Login as mapper
            self.mapper_client = Client(base_url=pds_url)
            self.mapper_client.login(result['handle'], app_password)
            
            if self.verbose:
                print(f"🔐 Mapper authenticated as @{result['handle']} via {pds_url}")
                
        except FileNotFoundError:
            print("⚠️  Encryption key not found - mapper cannot authenticate")
        except Exception as e:
            print(f"⚠️  Could not authenticate mapper: {e}")
            import traceback
            traceback.print_exc()
    
    def _fetch_thread_replies(self):
        """Fetch all replies to the origin quest post."""
        if not self.origin_uri:
            return []
        
        try:
            response = self.client.app.bsky.feed.get_post_thread({
                'uri': self.origin_uri,
                'depth': 1000
            })
            
            thread = response.thread
            if not hasattr(thread, 'replies'):
                return []
            
            return thread.replies or []
            
        except Exception as e:
            print(f"⚠️  Error fetching thread: {e}")
            return []
    
    def _process_reply(self, reply):
        """Process a single reply to the origin quest."""
        try:
            post = reply.post
            author_did = post.author.did
            author_handle = post.author.handle
            post_uri = post.uri
            post_cid = post.cid
            post_text = post.record.text
            
            # Skip mapper's own posts (mapper replies to users, not itself)
            if self.mapper_client and author_did == self.mapper_client.me.did:
                return
            
            # Skip if this DID already has origin declared (database is source of truth)
            if author_did in self.declared_dids:
                if self.verbose:
                    print(f"   ⏭️  Skipping @{author_handle} - already has origin")
                return
            
            # Skip if this is a reply to a reply (not direct to origin quest)
            if hasattr(post.record, 'reply'):
                parent_uri = post.record.reply.parent.uri
                if parent_uri != self.origin_uri:
                    return
            
            print(f"\n🗺️  NEW ORIGIN REPLY!")
            print(f"   Author: @{author_handle} ({author_did})")
            print(f"   Text: {post_text[:60]}...")
            
            # Process the origin declaration
            success = self._declare_origin(author_did, author_handle, post_uri, post_cid)
            
            if success:
                # Add to our in-memory set so we don't process again this session
                self.declared_dids.add(author_did)
                self.stats['origins_declared'] += 1
                print(f"   ✅ Origin declared! Total: {self.stats['origins_declared']}")
            
        except Exception as e:
            print(f"⚠️  Error processing reply: {e}")
            import traceback
            traceback.print_exc()
    
    def _declare_origin(self, author_did: str, author_handle: str, 
                        reply_uri: str, reply_cid: str) -> bool:
        """
        Declare a dreamer's origin:
        1. Register if needed
        2. Get dreamer's name for event text
        3. Calculate spectrum
        4. Generate origin image via origincards service
        5. Upload image as blob to PDS
        6. Post reply as mapper with image embed
        7. Add origin event to database
        8. Like the post
        
        Returns True if successful.
        """
        try:
            from core.database import DatabaseManager
            from utils.registration import register_dreamer
            import requests
            import hashlib
            
            db = DatabaseManager()
            
            # 1. Register dreamer if needed
            cursor = db.execute("SELECT did FROM dreamers WHERE did = %s", (author_did,))
            if not cursor.fetchone():
                print(f"   📝 Registering new dreamer...")
                register_dreamer(author_did, author_handle)
            
            # 2. Get dreamer's name and avatar for event text and image
            cursor = db.execute("SELECT name, display_name, avatar FROM dreamers WHERE did = %s", (author_did,))
            dreamer_row = cursor.fetchone()
            dreamer_name = dreamer_row['name'] if dreamer_row else author_handle.split('.')[0]
            display_name = dreamer_row.get('display_name') or dreamer_name if dreamer_row else dreamer_name
            avatar_url = dreamer_row.get('avatar') if dreamer_row else None
            
            # 3. Calculate spectrum
            print(f"   🌟 Calculating spectrum...")
            spectrum_text, spectrum_values = self._calculate_spectrum(author_did, db)
            print(f"   📊 Spectrum: {spectrum_text}")
            
            # 6. Post reply as mapper
            if not self.mapper_client:
                print("   ❌ No mapper client - cannot post reply")
                return False
            
            origin_url = f"reverie.house/origin/{author_handle}"
            full_text = f"@{author_handle} origin located:\n\n{spectrum_text}\n\n{origin_url}"
            
            # Build facets for mention and link
            facets = []
            
            # Mention facet
            mention_end = len(f"@{author_handle}")
            facets.append({
                "index": {"byteStart": 0, "byteEnd": mention_end},
                "features": [{"$type": "app.bsky.richtext.facet#mention", "did": author_did}]
            })
            
            # Link facet
            link_start = full_text.find(origin_url)
            link_end = link_start + len(origin_url)
            facets.append({
                "index": {"byteStart": link_start, "byteEnd": link_end},
                "features": [{"$type": "app.bsky.richtext.facet#link", "uri": f"https://{origin_url}"}]
            })
            
            # Get CIDs for proper reply threading
            parent_cid = reply_cid
            root_uri = self.origin_uri
            root_cid = None
            
            try:
                resp = requests.get(
                    f"https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris={root_uri}",
                    timeout=10
                )
                if resp.status_code == 200:
                    posts = resp.json().get('posts', [])
                    if posts:
                        root_cid = posts[0].get('cid')
            except:
                pass
            
            # 4. Generate origin image via origincards service
            thumb_blob = None
            try:
                print(f"   🎨 Generating origin image...")
                gen_response = requests.post(
                    'http://localhost:3050/generate',
                    json={
                        'handle': author_handle,
                        'displayName': display_name,
                        'spectrum': spectrum_values,
                        'avatar': avatar_url
                    },
                    timeout=30
                )
                
                if gen_response.status_code == 200:
                    result = gen_response.json()
                    image_url = result.get('url')
                    print(f"   ✅ Image generated: {image_url}")
                    
                    # 5. Fetch image and upload as blob
                    if image_url:
                        img_response = requests.get(image_url, timeout=15)
                        if img_response.status_code == 200:
                            # Upload the image to get a blob reference
                            upload_result = self.mapper_client.com.atproto.repo.upload_blob(
                                img_response.content
                            )
                            thumb_blob = upload_result.blob
                            print(f"   📤 Uploaded image as blob")
                        else:
                            print(f"   ⚠️  Could not fetch image: {img_response.status_code}")
                else:
                    print(f"   ⚠️  Image generation failed: {gen_response.status_code}")
            except Exception as e:
                print(f"   ⚠️  Image generation error: {e}")
            
            # Build external embed for rich link preview
            external_data = {
                "uri": f"https://{origin_url}",
                "title": f"{author_handle} origin",
                "description": f"Spectrum coordinates: {spectrum_text}"
            }
            
            # Add thumb if we got it
            if thumb_blob:
                external_data["thumb"] = thumb_blob
            
            embed = {
                "$type": "app.bsky.embed.external",
                "external": external_data
            }
            
            # Build reply record
            reply_record = {
                "$type": "app.bsky.feed.post",
                "text": full_text,
                "facets": facets,
                "embed": embed,
                "createdAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "reply": {
                    "root": {"uri": root_uri, "cid": root_cid} if root_cid else {"uri": root_uri},
                    "parent": {"uri": reply_uri, "cid": parent_cid} if parent_cid else {"uri": reply_uri}
                }
            }
            
            # Post as mapper
            post_result = self.mapper_client.com.atproto.repo.create_record({
                "repo": self.mapper_client.me.did,
                "collection": "app.bsky.feed.post",
                "record": reply_record
            })
            
            if not post_result:
                print(f"   ❌ Failed to post reply")
                return False
            
            mapper_post_uri = post_result.uri
            print(f"   💬 Posted origin reply as mapper: {mapper_post_uri}")
            
            # Helper to convert AT URI to bsky.app URL
            def at_uri_to_bsky_url(uri):
                if not uri or not uri.startswith('at://'):
                    return None
                parts = uri.replace('at://', '').split('/')
                if len(parts) >= 3:
                    did = parts[0]
                    rkey = parts[-1]
                    return f'https://bsky.app/profile/{did}/post/{rkey}'
                return None
            
            # 7. Add origin event for the USER (their origin declaration)
            # Use color_source='octant' for the user's origin event (styled by their octant)
            epoch = int(time.time())
            user_post_url = at_uri_to_bsky_url(reply_uri)
            cursor = db.execute("""
                INSERT INTO events (did, key, event, type, uri, url, epoch, created_at, color_source, color_intensity)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (author_did, 'origin', 'knows their origin', 'spectrum', reply_uri, user_post_url, epoch, epoch, 'octant', 'highlight'))
            user_origin_event_id = cursor.fetchone()['id']
            print(f"   📝 Added user origin event (id={user_origin_event_id})")
            
            # 8. Add mapper event (mappy's work, linked to user's origin)
            # Use color_source='role' for mapper events (styled by mapper role)
            mapper_did = self.mapper_client.me.did
            mapper_post_url = at_uri_to_bsky_url(mapper_post_uri)
            db.execute("""
                INSERT INTO events (did, key, event, type, uri, url, epoch, created_at, reaction_to, color_source, color_intensity)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (mapper_did, 'mapper', f"mapped {dreamer_name}'s coordinates", 'spectrum', 
                  mapper_post_uri, mapper_post_url, epoch, epoch, user_origin_event_id, 'role', 'highlight'))
            print(f"   📝 Added mapper event (reaction_to={user_origin_event_id})")
            
            # 9. Like the user's post (as mapper)
            try:
                self.mapper_client.like(reply_uri, reply_cid)
                print(f"   ❤️  Liked the post")
            except Exception as e:
                print(f"   ⚠️  Could not like post: {e}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error declaring origin: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _calculate_spectrum(self, author_did: str, db) -> tuple:
        """
        Calculate spectrum values for a DID.
        Returns (formatted_text, values_dict)
        """
        import hashlib
        
        # Constants from spectrum.json algorithm
        keeper_did = "did:plc:yauphjufk7phkwurn266ybx2"
        primes = [2, 3, 5, 7, 11, 13]
        prime_mod_1 = 100000019
        prime_mod_2 = 99999989
        offset_prime = 7919
        variance_multiplier = 31
        
        # Get server for weighting
        cursor = db.execute("SELECT server FROM dreamers WHERE did = %s", (author_did,))
        dreamer_row = cursor.fetchone()
        server = dreamer_row['server'] if dreamer_row else None
        server_weight = 0.7 if server and 'reverie.house' in server else 1.0
        
        # Hash DIDs
        user_hash = hashlib.sha256(author_did.encode()).digest()
        keeper_hash = hashlib.sha256(keeper_did.encode()).digest()
        
        user_seed = int.from_bytes(user_hash[:8], 'big', signed=False)
        keeper_seed = int.from_bytes(keeper_hash[:8], 'big', signed=False)
        
        relative_seed = abs(user_seed - keeper_seed)
        
        # Calculate all 6 axes in EOLARS order
        spectrum_eolars = []
        
        if relative_seed == 0:
            spectrum_eolars = [0, 0, 0, 0, 0, 0]
        else:
            for axis in range(6):
                combined = relative_seed * primes[axis] + (axis * offset_prime)
                raw_value = (combined % prime_mod_1) / prime_mod_1
                
                variance_seed = (combined * variance_multiplier) % prime_mod_2
                variance = (variance_seed % prime_mod_1) / prime_mod_1
                
                if raw_value < 0.5:
                    adjusted = raw_value + (variance * 0.3)
                else:
                    adjusted = raw_value - (variance * 0.2)
                
                adjusted = max(0.0, min(1.0, adjusted))
                
                base_value = int(adjusted * 100)
                distance_from_center = base_value - 50
                weighted_distance = distance_from_center * server_weight
                final_value = 50 + weighted_distance
                final_value = max(0, min(100, int(final_value)))
                
                spectrum_eolars.append(final_value)
        
        # Reorder for display as OASRLE: [O, A, S, R, L, E]
        display_values = [
            spectrum_eolars[1],  # Oblivion
            spectrum_eolars[3],  # Authority
            spectrum_eolars[5],  # Skeptic
            spectrum_eolars[4],  # Receptive
            spectrum_eolars[2],  # Liberty
            spectrum_eolars[0]   # Entropy
        ]
        
        labels = ['O', 'A', 'S', 'R', 'L', 'E']
        spectrum_text = " ".join(f"{label}{v:02d}" for label, v in zip(labels, display_values))
        
        # Build full spectrum dict with proper keys for image generation
        values_dict = {
            'oblivion': spectrum_eolars[1],
            'authority': spectrum_eolars[3],
            'skeptic': spectrum_eolars[5],
            'receptive': spectrum_eolars[4],
            'liberty': spectrum_eolars[2],
            'entropy': spectrum_eolars[0]
        }
        
        # Calculate octant
        from utils.octant import calculate_octant_code
        octant = calculate_octant_code(values_dict)
        values_dict['octant'] = octant or 'equilibrium'
        
        return spectrum_text, values_dict
    
    def check_for_new_replies(self):
        """Check the origin post for new replies."""
        self.stats['total_checks'] += 1
        
        if self.verbose:
            now = datetime.now().strftime('%H:%M:%S')
            print(f"\n🔍 [{now}] Checking for origin replies... (check #{self.stats['total_checks']})")
        
        replies = self._fetch_thread_replies()
        
        if replies:
            new_count = sum(1 for r in replies if r.post.author.did not in self.declared_dids)
            self.stats['replies_found'] = len(replies)
            
            if self.verbose:
                print(f"   Found {len(replies)} total replies ({new_count} new)")
            
            for reply in replies:
                self._process_reply(reply)
        else:
            if self.verbose:
                print(f"   No replies found")
    
    def run(self):
        """Start the polling loop."""
        if not self.origin_uri:
            print("❌ Cannot start: origin quest not loaded")
            return
        
        if not self.mapper_client:
            print("⚠️  Warning: No mapper client - will only track, not post")
        
        print(f"\n🔁 Starting polling loop (60 second interval)...\n")
        
        while True:
            try:
                self.check_for_new_replies()
                time.sleep(60)
                
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print(f"⚠️  Error in polling loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(60)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Mapperwatch - Poll origin quest for new replies')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()
    
    monitor = MapperMonitor(verbose=args.verbose or True)
    
    try:
        monitor.run()
    except KeyboardInterrupt:
        print(f"\n\n🗺️  MAPPERWATCH STATS")
        print(f"=" * 70)
        elapsed = (datetime.now() - monitor.stats['start_time']).total_seconds()
        print(f"Runtime: {int(elapsed)} seconds")
        print(f"Total checks: {monitor.stats['total_checks']}")
        print(f"Replies found: {monitor.stats['replies_found']}")
        print(f"Origins declared: {monitor.stats['origins_declared']}")
        print(f"=" * 70)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
