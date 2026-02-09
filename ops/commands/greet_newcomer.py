#!/usr/bin/env python3
"""
Quest Command: greet_newcomer

Automated greeting posted by the active Greeter of Reveries.
Greets newcomers who have just been named in the namegiver quest.
"""

import json
import random
import time
from datetime import datetime
from typing import List, Dict
from core.database import DatabaseManager
from core.workers import WorkerNetworkClient
from core.network import NetworkClient


# Greeting templates - these are the actual messages that will be posted
GREETING_TEMPLATES = [
    "Welcome to Reverie House, @{handle}!\n\nI'm here to help if you have any questions.",
    "Hello @{handle}, glad to meet you.\n\nFeel free to ask for anything if you need it.",
    "Welcome, @{handle}! Glad you found your way.\n\nLet me know if you have questions?",
    "Greetings @{handle}! Welcome to Reverie House.\n\nI'm here to help you settle in.",
    "Welcome to Reverie House @{handle}!\n\nLet me know if you have any questions?"
]


def _get_active_greeter(db: DatabaseManager) -> Dict:
    """
    Get the active greeter from the work table.
    
    Returns:
        Dict with 'did', 'passhash', or None if no active greeter
    """
    row = db.fetch_one("SELECT workers FROM work WHERE role = 'greeter'")
    
    if not row or not row['workers']:
        return None
    
    workers = json.loads(row['workers'])
    
    # Find a working or retiring greeter (both are active)
    for worker in workers:
        if worker.get('status') in ['working', 'retiring']:
            return {
                'did': worker['did'],
                'passhash': worker['passhash']
            }
    
    # If no active greeter, use any greeter
    if workers:
        return {
            'did': workers[0]['did'],
            'passhash': workers[0]['passhash']
        }
    
    return None


def _create_greeting_facet(text: str, handle: str, did: str) -> List[Dict]:
    """
    Create mention facet for the @handle in the greeting text.
    
    Args:
        text: The full greeting text
        handle: The handle being mentioned (e.g., "alice.reverie.house")
        did: The DID of the person being mentioned
        
    Returns:
        List with mention facet
    """
    mention_str = f"@{handle}"
    
    try:
        start_idx = text.index(mention_str)
        byte_start = len(text[:start_idx].encode('utf-8'))
        byte_end = len(text[:start_idx + len(mention_str)].encode('utf-8'))
        
        return [{
            "index": {
                "byteStart": byte_start,
                "byteEnd": byte_end
            },
            "features": [{
                "$type": "app.bsky.richtext.facet#mention",
                "did": did
            }]
        }]
    except ValueError:
        # Handle not found in text
        return []


def greet_newcomer(replies: List[Dict], quest_config: Dict, verbose: bool = False) -> Dict:
    """
    Post an automated greeting to newcomers from the active Greeter.
    
    This command is triggered by the namegiver quest after a dreamer has been named.
    It retrieves the active greeter from the work table, authenticates with their
    app password, and posts a random greeting from the GREETING_TEMPLATES.
    
    Args:
        replies: List of reply objects (the name-speaking posts)
        quest_config: Quest configuration
        verbose: Whether to print detailed output
        
    Returns:
        {
            'success': bool,
            'errors': List[str]
        }
    """
    result = {'success': False, 'errors': []}
    
    db = DatabaseManager()
    
    # Try NEW unified credentials system first (Phase 2+)
    worker_client = None
    greeter_source = None
    
    # Check for active greeters in user_roles table
    active_greeter = db.fetch_one("""
        SELECT did FROM user_roles
        WHERE role = 'greeter' AND status = 'active'
        ORDER BY activated_at ASC
        LIMIT 1
    """)
    
    if active_greeter:
        # Try to load from new credentials system
        worker_client = WorkerNetworkClient.from_credentials(db, active_greeter['did'], 'greeter')
        if worker_client:
            greeter_source = 'unified_credentials'
            if verbose:
                print(f"   📊 Using NEW unified credentials system")
    
    # FALLBACK: Try old work.workers[] system (backward compatibility)
    if not worker_client:
        worker_client = WorkerNetworkClient.from_work_table(db, role='greeter', status='working')
        if worker_client:
            greeter_source = 'work_table'
            if verbose:
                print(f"   📊 Using OLD work.workers[] system (backward compatibility)")
    
    if not worker_client:
        error_msg = "No active greeter found"
        result['errors'].append(error_msg)
        if verbose:
            print(f"   ⚠️  {error_msg}")
        return result
    
    if verbose:
        print(f"   👋 Greeter: @{worker_client.worker_handle} (from {greeter_source})")
        print(f"   🔐 Authenticating greeter session...")
    
    # Authenticate as the greeter
    if not worker_client.authenticate():
        error_msg = "Failed to authenticate greeter"
        result['errors'].append(error_msg)
        if verbose:
            print(f"   ❌ {error_msg}")
        
        # If using new system, purge the invalid credential (set password hash to NULL)
        if greeter_source == 'unified_credentials':
            try:
                db.execute("""
                    UPDATE user_credentials
                    SET app_password_hash = NULL, password_hash = NULL
                    WHERE did = %s
                """, (worker_client.worker_did,))
                if verbose:
                    print(f"   ⚠️  Purged invalid credential from database")
            except Exception as e:
                if verbose:
                    print(f"   ⚠️  Failed to purge invalid credential: {e}")
        
        return result
    
    if verbose:
        print(f"   ✅ Greeter authenticated successfully")
        
    # Update last_verified if using new system
    if greeter_source == 'unified_credentials':
        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE user_credentials
                    SET last_verified = CURRENT_TIMESTAMP
                    WHERE did = %s
                """, (worker_client.worker_did,))
                
                cursor.execute("""
                    UPDATE user_roles
                    SET last_activity = CURRENT_TIMESTAMP
                    WHERE did = %s AND role = 'greeter'
                """, (worker_client.worker_did,))
        except Exception as e:
            if verbose:
                print(f"   ⚠️  Failed to update timestamps: {e}")
    
    # Get house NetworkClient for liking greeting posts
    house_network = NetworkClient()
    
    # Process each reply
    for reply in replies:
        try:
            author_did = reply['author']['did']
            author_handle = reply['author']['handle']
            reply_uri = reply['uri']
            
            # Check if this dreamer was just named (has 'spoke their name' canon entry)
            canon_row = db.fetch_one("""
                SELECT uri FROM events 
                WHERE did = %s AND type = 'name' AND key = 'name'
                ORDER BY created_at DESC
                LIMIT 1
            """, (author_did,))
            
            if not canon_row:
                if verbose:
                    print(f"   ℹ️  Skipping {author_handle} - no name canon found")
                continue
            
            # Check if the canon URI matches this reply (they just spoke their name)
            if canon_row['uri'] != reply_uri:
                if verbose:
                    print(f"   ℹ️  Skipping {author_handle} - not their name-speaking post")
                continue
            
            # Get the dreamer's Reverie House name to construct name.reverie.house handle
            dreamer_row = db.fetch_one("SELECT name FROM dreamers WHERE did = %s", (author_did,))
            
            if not dreamer_row or not dreamer_row['name']:
                if verbose:
                    print(f"   ⚠️  Skipping {author_handle} - no name in dreamers table")
                continue
            
            # Use name.reverie.house format for the greeting
            reverie_handle = f"{dreamer_row['name']}.reverie.house"
            
            # Select a random greeting template
            template = random.choice(GREETING_TEMPLATES)
            greeting_text = template.format(handle=reverie_handle)
            
            # Create mention facet with the Reverie House handle
            facets = _create_greeting_facet(greeting_text, reverie_handle, author_did)
            
            if verbose:
                print(f"   💬 Greeting {author_handle} as @{reverie_handle}: {greeting_text[:50]}...")
            
            # Post the greeting as the greeter
            post_result = worker_client.create_post(
                text=greeting_text,
                reply_to=reply_uri,
                facets=facets if facets else None
            )
            
            if post_result:
                greeting_uri = post_result.get('uri')
                if verbose:
                    print(f"   ✅ Posted greeting to @{author_handle}")
                    print(f"      URI: {greeting_uri}")
                
                # Create greeting event in database and link to name event
                if greeting_uri:
                    try:
                        greeting_url = greeting_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
                        greeting_epoch = int(time.time())
                        event_text = f"welcomed {dreamer_row['name']}"
                        
                        # Find the name event to link to
                        name_event = db.fetch_one("""
                            SELECT id FROM events 
                            WHERE did = %s AND type = 'name' AND key = 'name' AND uri = %s
                        """, (author_did, reply_uri))
                        
                        with db.get_connection() as conn:
                            cursor = conn.cursor()
                            
                            # Create the greeting event with reaction_to pointing back to name event
                            cursor.execute("""
                                INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, reaction_to, color_source, color_intensity, others)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ARRAY[%s])
                                RETURNING id
                            """, (
                                worker_client.worker_did,
                                event_text,
                                'welcome',
                                'greeter',
                                greeting_uri,
                                greeting_url,
                                greeting_epoch,
                                greeting_epoch,
                                name_event['id'] if name_event else None,
                                'role',       # color_source
                                'highlight',  # color_intensity
                                author_did  # others[] - the welcomed user's DID
                            ))
                            
                            greeting_event_id = cursor.fetchone()['id']
                            conn.commit()
                        
                        if verbose:
                            print(f"   📖 Created greeting event (id: {greeting_event_id})")
                            if name_event:
                                print(f"   🔗 Points to name event (reaction_to: {name_event['id']})")
                    
                    except Exception as e:
                        if verbose:
                            print(f"   ⚠️  Failed to create greeting event: {e}")
                
                # Like the greeting from the house account so greeter gets notified
                if greeting_uri:
                    if verbose:
                        print(f"   💜 Liking greeting from @reverie.house...")
                    
                    like_success = house_network.create_like(greeting_uri)
                    if like_success:
                        if verbose:
                            print(f"   ✅ House account liked the greeting")
                    else:
                        if verbose:
                            print(f"   ⚠️  Failed to like greeting from house account")
                
                result['success'] = True
            else:
                error_msg = f"Failed to post greeting for @{author_handle}"
                result['errors'].append(error_msg)
                if verbose:
                    print(f"   ❌ {error_msg}")
                
        except Exception as e:
            error_msg = f"Error greeting {author_handle}: {e}"
            result['errors'].append(error_msg)
            if verbose:
                import traceback
                print(f"   ❌ {error_msg}")
                traceback.print_exc()
    
    return result


def get_greeting_templates() -> List[str]:
    """
    Get all greeting templates (for display in work.html).
    
    Returns:
        List of greeting template strings
    """
    return GREETING_TEMPLATES.copy()
