#!/usr/bin/env python3
"""
Cleanup script for lore.farm labels on deleted posts
Checks if labeled posts still exist and removes labels for deleted ones
"""

import psycopg2
import requests
import time
from datetime import datetime

# Database connection for lore.farm
DB_CONFIG = {
    'host': 'localhost',
    'port': 6432,
    'database': 'lorefarm',
    'user': 'lorefarm',
    'password': 'L7oz1B1rF2q/nBoPGCjnnPOl8SpolPcXnS0N0iXFx3o='
}

def check_post_exists(uri):
    """Check if a post still exists on Bluesky using public API"""
    try:
        # Use getPostThread endpoint which is more reliable
        url = f"https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread"
        params = {
            'uri': uri,
            'depth': 0
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            return True  # Post exists
        elif response.status_code == 400:
            # Check if it's a "could not find post" error
            try:
                error_data = response.json()
                if 'NotFound' in str(error_data) or 'not found' in str(error_data).lower():
                    return False  # Post definitely deleted
            except:
                pass
        
        # For any other error, be conservative
        print(f"   ⚠️  Uncertain status for {uri}: {response.status_code}")
        return 'uncertain'
        
    except Exception as e:
        print(f"   ❌ Error checking {uri}: {e}")
        return 'uncertain'


def cleanup_deleted_labels(dry_run=False):
    """Remove labels for deleted posts"""
    print("🧹 Starting cleanup of deleted post labels...")
    print(f"   Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE'}")
    print()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    try:
        # Get all labeled URIs for reverie.house
        cur.execute("""
            SELECT DISTINCT uri, MAX(created_at) as latest
            FROM applied_labels 
            WHERE world_domain = 'reverie.house'
            GROUP BY uri
            ORDER BY latest DESC
        """)
        
        uris = [row[0] for row in cur.fetchall()]
        print(f"📊 Found {len(uris)} unique URIs to check")
        print()
        
        deleted_count = 0
        exists_count = 0
        uncertain_count = 0
        
        for idx, uri in enumerate(uris, 1):
            print(f"[{idx}/{len(uris)}] Checking: {uri[-30:]}")
            
            exists = check_post_exists(uri)
            
            if exists is False:
                # Post is deleted
                deleted_count += 1
                print(f"   🗑️  DELETED - Removing label")
                
                if not dry_run:
                    cur.execute("""
                        DELETE FROM applied_labels 
                        WHERE uri = %s AND world_domain = 'reverie.house'
                    """, (uri,))
                    conn.commit()
                    print(f"   ✅ Label removed")
                else:
                    print(f"   [DRY RUN] Would remove label")
                    
            elif exists is True:
                exists_count += 1
                print(f"   ✅ Post still exists")
            else:
                uncertain_count += 1
                print(f"   ⚠️  Status uncertain - keeping label")
            
            print()
            
            # Rate limiting
            time.sleep(0.5)
        
        print("=" * 60)
        print("✅ Cleanup complete!")
        print("=" * 60)
        print(f"   Total URIs checked: {len(uris)}")
        print(f"   Posts deleted:      {deleted_count}")
        print(f"   Posts still exist:  {exists_count}")
        print(f"   Uncertain/skipped:  {uncertain_count}")
        print()
        
        if dry_run:
            print("⚠️  This was a DRY RUN - no changes were made")
        else:
            print(f"✅ Removed labels for {deleted_count} deleted posts")
        
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    import sys
    dry_run = '--dry-run' in sys.argv or '-d' in sys.argv
    
    cleanup_deleted_labels(dry_run=dry_run)
