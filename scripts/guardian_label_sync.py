#!/usr/bin/env python3
"""
Guardian Label Sync Cron

Runs periodically to:
1. Retry any labels that failed to sync to the Reverie House labeler
2. Update aggregate labels (hide:community) when thresholds change
3. Clean up stale subscription records

Usage:
    python3 /srv/reverie.house/scripts/guardian_label_sync.py

Recommended: Run every 5 minutes via cron or systemd timer.
*/5 * * * * /usr/bin/python3 /srv/reverie.house/scripts/guardian_label_sync.py >> /srv/reverie.house/logs/guardian_label_sync.log 2>&1
"""

import sys
sys.path.insert(0, '/srv/reverie.house')

from datetime import datetime, timedelta

# Import after path setup
from core.database import DatabaseManager
from core.guardian_labels import get_label_manager


def retry_unsynced_labels():
    """Retry labels that failed to sync to the labeler."""
    print(f"[{datetime.now()}] Checking for unsynced labels...")
    
    label_manager = get_label_manager()
    result = label_manager.retry_unsynced_labels()
    
    if result['synced'] > 0 or result['failed'] > 0:
        print(f"  ✓ Synced: {result['synced']}, Failed: {result['failed']}")
    else:
        print(f"  No unsynced labels found")
    
    return result


def update_aggregate_labels():
    """
    Check and update aggregate labels for content that may have crossed thresholds.
    This handles cases where guardian count changes affect majority threshold.
    """
    print(f"[{datetime.now()}] Updating aggregate labels...")
    
    db = DatabaseManager()
    label_manager = get_label_manager()
    
    # Get current threshold
    current_threshold = label_manager.get_majority_threshold()
    print(f"  Current threshold: {current_threshold} guardians")
    
    # Find content where aggregate status may need updating
    # Check content that has hide labels but aggregate status doesn't match
    
    # Case 1: Content that should have aggregate label but doesn't
    should_have_aggregate = db.fetch_all("""
        SELECT gl.uri, COUNT(DISTINCT gl.guardian_did) as guardian_count
        FROM guardian_labels gl
        LEFT JOIN aggregate_labels al ON gl.uri = al.uri
        WHERE gl.label_type = 'hide' 
        AND gl.negated_at IS NULL
        AND (al.label_applied IS NULL OR al.label_applied = FALSE)
        GROUP BY gl.uri
        HAVING COUNT(DISTINCT gl.guardian_did) >= %s
    """, (current_threshold,))
    
    applied_count = 0
    for row in (should_have_aggregate or []):
        uri = row['uri']
        guardian_count = row['guardian_count']
        
        print(f"  Applying aggregate label to {uri[:50]}... ({guardian_count} guardians)")
        
        # Update aggregate_labels table
        db.execute("""
            INSERT INTO aggregate_labels (uri, guardian_count, threshold_met, threshold_met_at, label_applied, label_applied_at)
            VALUES (%s, %s, TRUE, CURRENT_TIMESTAMP, TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (uri) DO UPDATE SET
                guardian_count = EXCLUDED.guardian_count,
                threshold_met = TRUE,
                threshold_met_at = COALESCE(aggregate_labels.threshold_met_at, CURRENT_TIMESTAMP),
                label_applied = TRUE,
                label_applied_at = CURRENT_TIMESTAMP
        """, (uri, guardian_count))
        
        # Apply to lore.farm
        label_manager._apply_aggregate_label(uri)
        applied_count += 1
    
    # Case 2: Content that has aggregate label but shouldn't (fell below threshold)
    should_not_have_aggregate = db.fetch_all("""
        SELECT al.uri, COALESCE(gc.guardian_count, 0) as guardian_count
        FROM aggregate_labels al
        LEFT JOIN (
            SELECT uri, COUNT(DISTINCT guardian_did) as guardian_count
            FROM guardian_labels
            WHERE label_type = 'hide' AND negated_at IS NULL
            GROUP BY uri
        ) gc ON al.uri = gc.uri
        WHERE al.label_applied = TRUE
        AND COALESCE(gc.guardian_count, 0) < %s
    """, (current_threshold,))
    
    removed_count = 0
    for row in (should_not_have_aggregate or []):
        uri = row['uri']
        guardian_count = row['guardian_count']
        
        print(f"  Removing aggregate label from {uri[:50]}... ({guardian_count} guardians)")
        
        # Update aggregate_labels table
        db.execute("""
            UPDATE aggregate_labels
            SET guardian_count = %s, threshold_met = FALSE, label_applied = FALSE
            WHERE uri = %s
        """, (guardian_count, uri))
        
        # Remove from lore.farm
        label_manager._remove_aggregate_label(uri)
        removed_count += 1
    
    print(f"  Applied: {applied_count}, Removed: {removed_count}")
    
    return {'applied': applied_count, 'removed': removed_count}


def cleanup_stale_subscriptions():
    """
    Clean up subscription records for users no longer under any guardian.
    """
    print(f"[{datetime.now()}] Cleaning up stale subscriptions...")
    
    db = DatabaseManager()
    
    # Find subscriptions where user is no longer a ward/charge
    # Using correct column names from actual schema
    result = db.execute("""
        UPDATE labeler_subscriptions ls
        SET subscribed_to_labeler = FALSE, 
            last_sync_error = 'Orphaned - user no longer under guardian'
        WHERE subscribed_to_labeler = TRUE
        AND NOT EXISTS (
            SELECT 1 FROM stewardship s
            WHERE (ls.user_did = ANY(s.wards) OR ls.user_did = ANY(s.charges))
        )
        RETURNING user_did
    """)
    
    orphaned = result.fetchall() if result else []
    
    if orphaned:
        print(f"  Marked {len(orphaned)} orphaned subscriptions")
    else:
        print(f"  No stale subscriptions found")
    
    return len(orphaned)


def print_stats():
    """Print summary statistics."""
    print(f"\n[{datetime.now()}] === Guardian Label System Stats ===")
    
    db = DatabaseManager()
    
    # Total labels
    total_labels = db.fetch_one("SELECT COUNT(*) as count FROM guardian_labels WHERE negated_at IS NULL")
    print(f"  Active labels: {total_labels['count'] if total_labels else 0}")
    
    # Unsynced labels
    unsynced = db.fetch_one("SELECT COUNT(*) as count FROM guardian_labels WHERE synced_to_labeler = FALSE AND negated_at IS NULL")
    print(f"  Unsynced labels: {unsynced['count'] if unsynced else 0}")
    
    # Aggregate labels
    aggregate = db.fetch_one("SELECT COUNT(*) as count FROM aggregate_labels WHERE label_applied = TRUE")
    print(f"  Aggregate labels applied: {aggregate['count'] if aggregate else 0}")
    
    # Active subscriptions (using correct column name)
    subscriptions = db.fetch_one("SELECT COUNT(*) as count FROM labeler_subscriptions WHERE subscribed_to_labeler = TRUE")
    print(f"  Active subscriptions: {subscriptions['count'] if subscriptions else 0}")
    
    print("")


def main():
    """Run all sync tasks."""
    print(f"\n{'='*60}")
    print(f"Guardian Label Sync - {datetime.now()}")
    print(f"{'='*60}\n")
    
    try:
        # Retry failed syncs
        retry_unsynced_labels()
        
        # Update aggregate labels
        update_aggregate_labels()
        
        # Clean up stale subscriptions
        cleanup_stale_subscriptions()
        
        # Print stats
        print_stats()
        
        print(f"[{datetime.now()}] Sync completed successfully\n")
        
    except Exception as e:
        import traceback
        print(f"\n[{datetime.now()}] ERROR: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
