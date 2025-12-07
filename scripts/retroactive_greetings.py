#!/usr/bin/env python3
"""
Retroactively capture existing greetings from Greeter of Reveries.

Scans isilme's feed for greeting posts to newly named dreamers and creates
reaction correlations in the database (greeting.reaction_to = name_event.id).

Run once to backfill historical greetings. Future greetings are automatically
linked by the greet_newcomer command.
"""

import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from core.database import DatabaseManager


# Greeting patterns to match isilme's messages
GREETING_PATTERNS = [
    "Welcome to Reverie House",
    "Hello @",
    "Welcome, @",
    "Greetings @",
    "glad to meet you",
    "Welcome to Reverie House @"
]


def is_greeting_message(text: str) -> bool:
    """Check if text matches greeting patterns."""
    text_lower = text.lower()
    return any(pattern.lower() in text_lower for pattern in GREETING_PATTERNS)


def iso_to_unix(iso_timestamp: str) -> int:
    """Convert ISO8601 timestamp to unix timestamp."""
    if not iso_timestamp:
        return int(time.time())
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return int(dt.timestamp())
    except (ValueError, AttributeError):
        return int(time.time())


def main():
    print("🔍 Retroactive Greeting Capture")
    print("=" * 70)
    print()
    
    db = DatabaseManager()
    
    # Get isilme's DID
    isilme = db.fetch_one("SELECT did, name, handle FROM dreamers WHERE name = 'isilme'")
    if not isilme:
        print("❌ Could not find isilme in database")
        return
    
    isilme_did = isilme['did']
    print(f"👋 Greeter: {isilme['name']} (@{isilme['handle']})")
    print(f"   DID: {isilme_did}")
    print()
    
    # Initialize AT Protocol client
    client = Client(base_url='https://public.api.bsky.app')
    
    # Get all isilme's posts (greetings are replies in her feed)
    print("🔍 Fetching isilme's posts to find greetings...")
    response = client.app.bsky.feed.get_author_feed({'actor': isilme_did, 'limit': 100})
    
    isilme_posts = response.feed
    print(f"📋 Found {len(isilme_posts)} posts from isilme")
    print()
    
    # Filter for greeting posts (posts that are replies with greeting text)
    greeting_keywords = ['welcome', 'hello', 'greetings', 'glad']
    greeting_posts = []
    
    for item in isilme_posts:
        post = item.post
        text = post.record.text.lower()
        
        # Check if it's a greeting (has welcome/hello/etc AND is a reply)
        is_greeting = any(keyword in text for keyword in greeting_keywords)
        is_reply = hasattr(post.record, 'reply') and post.record.reply
        
        if is_greeting and is_reply:
            greeting_posts.append(post)
    
    print(f"✨ Found {len(greeting_posts)} greeting posts")
    print()
    
    stats = {
        'total': len(greeting_posts),
        'processed': 0,
        'greetings_created': 0,
        'already_exists': 0,
        'no_name_event': 0,
        'errors': 0
    }
    
    # Process each greeting post
    for greeting_post in greeting_posts:
        stats['processed'] += 1
        
        greeting_uri = greeting_post.uri
        greeting_text = greeting_post.record.text
        greeting_created = greeting_post.record.created_at
        greeting_epoch = iso_to_unix(greeting_created)
        greeting_url = greeting_uri.replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
        
        # Get the URI of the post being replied to (the name post)
        name_post_uri = greeting_post.record.reply.parent.uri
        
        # Find the dreamer who spoke their name
        name_event = db.fetch_one("""
            SELECT e.id, e.did, d.name 
            FROM events e
            JOIN dreamers d ON e.did = d.did
            WHERE e.uri = %s AND e.type = 'name' AND e.key = 'name'
        """, (name_post_uri,))
        
        if not name_event:
            print(f"[{stats['processed']}/{stats['total']}] Skipping greeting - no name event found for URI")
            print(f"   Name URI: {name_post_uri}")
            stats['no_name_event'] += 1
            continue
        
        dreamer_name = name_event['name']
        dreamer_did = name_event['did']
        name_event_id = name_event['id']
        
        print(f"[{stats['processed']}/{stats['total']}] Processing greeting for {dreamer_name}...")
        print(f"   Greeting: {greeting_text[:60]}...")
        
        try:
            # Check if this greeting already exists in events
            existing = db.fetch_one("""
                SELECT id FROM events 
                WHERE did = %s AND uri = %s
            """, (isilme_did, greeting_uri))
            
            if existing:
                print(f"   ℹ️  Greeting already in database (id: {existing['id']})")
                stats['already_exists'] += 1
                
                # Update the greeting to point back to the name event
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE events 
                        SET reaction_to = %s
                        WHERE id = %s AND reaction_to IS NULL
                    """, (name_event_id, existing['id']))
                    conn.commit()
                print(f"   🔗 Greeting now points to name event (reaction_to)")
                continue
            
            # Create the "welcomed {name}" event for isilme
            event_text = f"welcomed {dreamer_name}"
            
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, reaction_to)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    isilme_did,
                    event_text,
                    'welcome',
                    'greeter',
                    greeting_uri,
                    greeting_url,
                    greeting_epoch,
                    int(time.time()),
                    name_event_id  # Greeting points back to name event
                ))
                
                greeting_event_id = cursor.fetchone()['id']
                conn.commit()
            
            stats['greetings_created'] += 1
            
            print(f"   💫 Created greeting event (id: {greeting_event_id})")
            print(f"   🔗 Points back to name event (reaction_to: {name_event_id})")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            stats['errors'] += 1
            import traceback
            traceback.print_exc()
            continue
    
    print()
    print("=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    print(f"Total greetings found:  {stats['total']}")
    print(f"Processed:              {stats['processed']}")
    print(f"No name event:          {stats['no_name_event']}")
    print(f"New greetings created:  {stats['greetings_created']}")
    print(f"Already existed:        {stats['already_exists']}")
    print(f"Errors:                 {stats['errors']}")
    print()
    
    if stats['greetings_created'] > 0:
        print(f"✅ Successfully created {stats['greetings_created']} greeting correlations!")
    elif stats['already_exists'] > 0:
        print(f"ℹ️  All {stats['already_exists']} greetings already in database")
    else:
        print("ℹ️  No greetings to process")


if __name__ == '__main__':
    main()
