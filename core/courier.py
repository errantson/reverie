#!/usr/bin/env python3
"""
Courier Service - Clockwork post sender
Runs as a background service to deliver scheduled Bluesky posts
"""

import time
import json
import sys
import os
import requests
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager
from core.encryption import decrypt_password


def get_pending_posts():
    """Get all posts that are ready to be sent"""
    db = DatabaseManager()
    now = int(time.time())
    
    cursor = db.execute('''
        SELECT c.id, c.did, c.post_text_encrypted, c.post_images,
               c.is_lore, c.lore_type, c.canon_id,
               d.handle, uc.app_password_hash, uc.pds_url
        FROM courier c
        JOIN dreamers d ON c.did = d.did
        LEFT JOIN user_credentials uc ON c.did = uc.did AND uc.is_valid = TRUE
        WHERE c.status = 'pending'
          AND c.scheduled_for <= ?
          AND uc.app_password_hash IS NOT NULL
        ORDER BY c.scheduled_for ASC
        LIMIT 50
    ''', (now,))
    
    return cursor.fetchall()


def detect_facets_in_text(text: str) -> list:
    """Auto-detect links and @mentions in text and create facets"""
    import re
    facets = []
    
    # Detect URLs
    url_pattern = r'(?:https?://|www\.)[^\s]+|(?<![/@])(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s]*)?'
    for match in re.finditer(url_pattern, text):
        url_text = match.group(0)
        start = match.start()
        end = match.end()
        
        # Normalize URL
        if url_text.startswith('www.'):
            url = 'https://' + url_text
        elif not url_text.startswith(('http://', 'https://')):
            url = 'https://' + url_text
        else:
            url = url_text
        
        byte_start = len(text[:start].encode('utf-8'))
        byte_end = len(text[:end].encode('utf-8'))
        
        facets.append({
            "index": {"byteStart": byte_start, "byteEnd": byte_end},
            "features": [{"$type": "app.bsky.richtext.facet#link", "uri": url}]
        })
    
    # Detect @mentions
    mention_pattern = r'@([a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9])'
    for match in re.finditer(mention_pattern, text):
        handle = match.group(1)
        start = match.start()
        end = match.end()
        
        byte_start = len(text[:start].encode('utf-8'))
        byte_end = len(text[:end].encode('utf-8'))
        
        # Try to resolve DID
        try:
            resolve_response = requests.get(
                f'https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={handle}',
                timeout=5
            )
            if resolve_response.status_code == 200:
                did = resolve_response.json().get('did')
                if did:
                    facets.append({
                        "index": {"byteStart": byte_start, "byteEnd": byte_end},
                        "features": [{"$type": "app.bsky.richtext.facet#mention", "did": did}]
                    })
        except:
            pass  # Skip if resolution fails
    
    return facets


def send_post(post):
    """Send a single scheduled post to Bluesky"""
    try:
        # Decrypt post text
        post_text = decrypt_password(post['post_text_encrypted'])
        
        # Decrypt app password (it's encrypted in the database)
        app_password = decrypt_password(post['app_password_hash'])
        
        # Determine PDS URL
        pds_url = post['pds_url'] if post.get('pds_url') else 'https://bsky.social'
        
        print(f"📤 [COURIER] Sending post {post['id']} for @{post['handle']}")
        print(f"   Text: {post_text[:50]}...")
        print(f"   PDS: {pds_url}")
        
        # Create Bluesky session
        session_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.server.createSession',
            json={
                'identifier': post['handle'],
                'password': app_password
            },
            timeout=10
        )
        
        if session_response.status_code != 200:
            raise Exception(f"Failed to create session: {session_response.status_code}")
        
        session_data = session_response.json()
        access_jwt = session_data.get('accessJwt')
        user_did = session_data.get('did')
        
        if not access_jwt:
            raise Exception("No access token in session response")
        
        # Detect facets in text
        facets = detect_facets_in_text(post_text)
        
        # Create post record
        record = {
            '$type': 'app.bsky.feed.post',
            'text': post_text,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        # Add facets if any were detected
        if facets:
            record['facets'] = facets
            print(f"   Facets: {len(facets)} detected")
        
        # Handle images if present
        if post['post_images']:
            try:
                images_data = json.loads(post['post_images'])
                if images_data and len(images_data) > 0:
                    print(f"   📷 Uploading {len(images_data)} image(s)...")
                    
                    uploaded_images = []
                    for idx, img_data in enumerate(images_data):
                        try:
                            # Image data should be base64 encoded in dataUrl format
                            data_url = img_data.get('dataUrl', '')
                            if not data_url.startswith('data:'):
                                print(f"   ⚠️  Image {idx+1}: Invalid data URL format, skipping")
                                continue
                            
                            # Extract mime type and base64 data
                            header, base64_data = data_url.split(',', 1)
                            mime_type = img_data.get('mimeType', 'image/jpeg')
                            
                            # Decode base64 to bytes
                            import base64
                            image_bytes = base64.b64decode(base64_data)
                            
                            # Upload to PDS
                            upload_response = requests.post(
                                f'{pds_url}/xrpc/com.atproto.repo.uploadBlob',
                                headers={
                                    'Authorization': f'Bearer {access_jwt}',
                                    'Content-Type': mime_type
                                },
                                data=image_bytes,
                                timeout=30
                            )
                            
                            if upload_response.status_code == 200:
                                blob_data = upload_response.json()
                                uploaded_images.append({
                                    'alt': img_data.get('alt', ''),
                                    'image': blob_data.get('blob')
                                })
                                print(f"   ✅ Image {idx+1} uploaded successfully")
                            else:
                                print(f"   ⚠️  Image {idx+1} upload failed: {upload_response.status_code}")
                        
                        except Exception as img_error:
                            print(f"   ⚠️  Image {idx+1} upload error: {img_error}")
                            # Continue with other images
                    
                    # Add images to post record if any were uploaded
                    if uploaded_images:
                        record['embed'] = {
                            '$type': 'app.bsky.embed.images',
                            'images': uploaded_images
                        }
                        print(f"   ✅ Added {len(uploaded_images)} image(s) to post")
                    else:
                        print(f"   ⚠️  No images could be uploaded, posting text only")
                        
            except Exception as e:
                print(f"   ⚠️  Error processing images: {e}, posting text only")
                # Continue without images rather than failing the whole post
        
        # Send post to PDS
        post_response = requests.post(
            f'{pds_url}/xrpc/com.atproto.repo.createRecord',
            headers={
                'Authorization': f'Bearer {access_jwt}',
                'Content-Type': 'application/json'
            },
            json={
                'repo': user_did,
                'collection': 'app.bsky.feed.post',
                'record': record
            },
            timeout=10
        )
        
        if post_response.status_code != 200:
            raise Exception(f"Failed to create post: {post_response.status_code} - {post_response.text}")
        
        result = post_response.json()
        post_uri = result.get('uri')
        post_cid = result.get('cid')
        
        print(f"✅ [COURIER] Post sent! URI: {post_uri}")
        
        # Mark as sent in database
        db = DatabaseManager()
        db.execute('''
            UPDATE courier
            SET status = 'sent',
                sent_at = ?,
                post_uri = ?,
                post_cid = ?
            WHERE id = ?
        ''', (int(time.time()), post_uri, post_cid, post['id']))
        
        # If this is lore, apply label via API
        if post['is_lore']:
            try:
                create_lore_entry(post, post_uri, post_cid, post_text)
            except Exception as e:
                print(f"⚠️ [COURIER] Failed to apply lore label: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ [COURIER] Failed to send post {post['id']}: {e}")
        import traceback
        traceback.print_exc()
        
        error_str = str(e)
        db = DatabaseManager()
        
        # Detect authentication failure (401)
        if 'Failed to create session: 401' in error_str:
            print(f"🔒 [COURIER] Authentication failed for {post['handle']} - invalidating credentials")
            
            # Mark post as auth_failed
            db.execute('''
                UPDATE courier
                SET status = 'auth_failed',
                    error_message = 'App password expired or invalid. Please reconnect.'
                WHERE id = ?
            ''', (post['id'],))
            
            # Invalidate user credentials
            db.execute('''
                UPDATE user_credentials
                SET is_valid = FALSE,
                    last_failure_at = ?
                WHERE did = ?
            ''', (int(time.time()), post['did']))
            
            print(f"🔒 [COURIER] Credentials invalidated for {post['handle']}")
        else:
            # Regular failure handling
            db.execute('''
                UPDATE courier
                SET status = 'failed',
                    error_message = ?
                WHERE id = ?
            ''', (error_str, post['id']))
        
        return False


def create_lore_entry(post, post_uri, post_cid, post_text):
    """Apply lore.farm label to a post via the lore.farm API"""
    import os
    
    # Try to get key from file first, then env var
    lorekey = None
    key_file = os.getenv('LOREFARM_KEY_FILE')
    if key_file and os.path.exists(key_file):
        try:
            with open(key_file, 'r') as f:
                lorekey = f.read().strip()
        except Exception as e:
            print(f"⚠️ [COURIER] Could not read LOREFARM_KEY_FILE: {e}")
    
    if not lorekey:
        lorekey = os.getenv('LOREFARM_KEY')
    
    if not lorekey:
        raise Exception("LOREFARM_KEY not configured")
    
    print(f"📤 [COURIER] Applying lore label to {post_uri}")
    
    # Make request to lore.farm API directly
    lorefarm_url = 'https://lore.farm/api/labels'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {lorekey}'
    }
    
    payload = {
        'post_uri': post_uri,
        'label_value': 'lore:reverie.house',
        'world_domain': 'reverie.house'
    }
    
    response = requests.post(lorefarm_url, json=payload, headers=headers, timeout=10)
    
    if response.status_code == 200:
        print(f"✅ [COURIER] Lore label applied successfully to post {post['id']}")
    else:
        error_text = response.text[:200]
        print(f"❌ [COURIER] Lore label failed: {response.status_code} - {error_text}")
        raise Exception(f"Lore label failed: {response.status_code}")


def run_courier_service(interval=60):
    """Main service loop - check for pending posts every interval seconds"""
    print("📬 [COURIER] Service starting...")
    print(f"   Check interval: {interval} seconds")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            print(f"\n{'='*60}")
            print(f"📬 [COURIER] Check iteration #{iteration} - {datetime.now().isoformat()}")
            print(f"{'='*60}")
            
            # Get pending posts
            pending = get_pending_posts()
            
            if pending:
                print(f"📬 [COURIER] Found {len(pending)} posts ready to send")
                
                for idx, post in enumerate(pending, 1):
                    print(f"\n--- Post {idx}/{len(pending)} ---")
                    print(f"   ID: {post['id']}")
                    print(f"   User: @{post['handle']}")
                    print(f"   Scheduled: {post.get('scheduled_for')}")
                    print(f"   Is lore: {post.get('is_lore')}")
                    
                    send_post(post)
                    
                    # Small delay between posts to avoid rate limiting
                    if idx < len(pending):
                        print(f"⏱️  [COURIER] Waiting 2 seconds before next post...")
                        time.sleep(2)
            else:
                print(f"📬 [COURIER] No pending posts at this time")
            
            # Wait before next check
            print(f"\n⏱️  [COURIER] Sleeping for {interval} seconds until next check...")
            print(f"{'='*60}\n")
            time.sleep(interval)
            
        except KeyboardInterrupt:
            print("\n📬 [COURIER] Service stopped by user")
            break
        except Exception as e:
            print(f"❌ [COURIER] Service error: {e}")
            import traceback
            traceback.print_exc()
            print(f"⏱️  [COURIER] Waiting {interval} seconds before retry...")
            time.sleep(interval)


if __name__ == '__main__':
    # Check for interval argument
    import argparse
    parser = argparse.ArgumentParser(description='Courier service for scheduled Bluesky posts')
    parser.add_argument('--interval', type=int, default=60, help='Check interval in seconds')
    args = parser.parse_args()
    
    run_courier_service(interval=args.interval)
