#!/usr/bin/env python3
"""
Retroactively capture existing mapper replies to origin declarations.

Scans mappy.reverie.house's feed for replies to origin posts and creates
reaction correlations in the database (mapper_reply.reaction_to = origin_event.id).

Run once to backfill historical mapper replies. Future mapper replies should be
automatically linked by the mapper command (if implemented).
"""

import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from atproto import Client
from core.database import DatabaseManager


def iso_to_unix(iso_timestamp: str) -> int:
    """Convert ISO timestamp to Unix epoch."""
    dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
    return int(dt.timestamp())


def main():
    print("🗺️  Retroactive Mapper Reply Capture")
    print("=" * 70)
    
    db = DatabaseManager()
    # Use public API - no authentication needed
    client = Client(base_url='https://public.api.bsky.app')
    
    # Get mapper's DID
    mapper = db.fetch_one("SELECT did, handle FROM dreamers WHERE handle = 'mappy.reverie.house'")
    if not mapper:
        print("❌ Mapper (mappy.reverie.house) not found in database")
        return
    
    mapper_did = mapper['did']
    print(f"Mapper: @{mapper['handle']} ({mapper_did})")
    print()
    
    # Get all origin events (users declaring their origin)
    origin_events = db.execute("""
        SELECT id, did, event, uri, url, epoch
        FROM events
        WHERE type = 'arrival' AND key = 'origin'
        ORDER BY epoch ASC
    """).fetchall()
    
    print(f"Found {len(origin_events)} origin declaration events")
    print()
    
    # Fetch mapper's full feed to search for replies
    print(f"Fetching mapper's feed...")
    mapper_posts = []
    cursor = None
    
    while True:
        params = {'actor': mapper_did, 'limit': 100}
        if cursor:
            params['cursor'] = cursor
        
        response = client.app.bsky.feed.get_author_feed(params)
        
        for item in response.feed:
            post = item.post
            # Only process posts that are replies
            if hasattr(post.record, 'reply') and post.record.reply:
                mapper_posts.append({
                    'uri': post.uri,
                    'text': post.record.text,
                    'created_at': post.record.created_at,
                    'reply_to': post.record.reply.parent.uri if post.record.reply.parent else None
                })
        
        if not hasattr(response, 'cursor') or not response.cursor:
            break
        cursor = response.cursor
        time.sleep(0.5)  # Rate limit
    
    print(f"Found {len(mapper_posts)} mapper posts (replies)")
    print()
    
    # Match mapper replies to origin events
    matches = []
    for origin_event in origin_events:
        origin_uri = origin_event['uri']
        origin_id = origin_event['id']
        origin_did = origin_event['did']
        
        # Find mapper's reply to this origin post
        mapper_reply = next((p for p in mapper_posts if p['reply_to'] == origin_uri), None)
        
        if mapper_reply:
            matches.append({
                'origin_id': origin_id,
                'origin_did': origin_did,
                'origin_uri': origin_uri,
                'mapper_uri': mapper_reply['uri'],
                'mapper_text': mapper_reply['text'],
                'mapper_created_at': mapper_reply['created_at']
            })
    
    print(f"Found {len(matches)} mapper replies to match")
    print()
    
    # Create events for mapper replies
    for match in matches:
        # Check if mapper event already exists
        existing = db.fetch_one("""
            SELECT id FROM events
            WHERE uri = %s
        """, (match['mapper_uri'],))
        
        if existing:
            print(f"⏭️  Mapper reply already in database: {match['mapper_uri']}")
            continue
        
        # Get the dreamer's name for event text
        dreamer = db.fetch_one("SELECT name FROM dreamers WHERE did = %s", (match['origin_did'],))
        dreamer_name = dreamer['name'] if dreamer else 'unknown'
        
        # Create event text based on mapper's response
        mapper_text = match['mapper_text'].lower()
        if 'dream' in mapper_text and 'nightmare' not in mapper_text:
            event_text = f"mapped {dreamer_name}'s dream coordinates"
        elif 'nightmare' in mapper_text:
            event_text = f"mapped {dreamer_name}'s nightmare coordinates"
        else:
            event_text = f"mapped {dreamer_name}'s coordinates"
        
        # Convert timestamp to epoch
        mapper_epoch = iso_to_unix(match['mapper_created_at'])
        
        # Create URL from URI
        mapper_url = match['mapper_uri'].replace('at://', 'https://bsky.app/profile/').replace('/app.bsky.feed.post/', '/post/')
        
        # Insert mapper event with reaction_to pointing to origin event
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO events (did, event, type, key, uri, url, epoch, created_at, reaction_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                mapper_did,
                event_text,
                'welcome',  # Using 'welcome' type as requested
                'mapper',
                match['mapper_uri'],
                mapper_url,
                mapper_epoch,
                mapper_epoch,
                match['origin_id']  # Link to origin event
            ))
            
            event_id = cursor.fetchone()['id']
            conn.commit()
        
        print(f"✅ Created mapper event (id: {event_id})")
        print(f"   Origin: {dreamer_name} declared their origin")
        print(f"   Mapper: {event_text}")
        print(f"   Points to origin event (reaction_to: {match['origin_id']})")
        print()
    
    print("=" * 70)
    print(f"✅ Retroactive mapper capture complete!")
    print(f"   Processed: {len(matches)} mapper replies")


if __name__ == '__main__':
    main()
