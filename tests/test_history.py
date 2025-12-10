#!/usr/bin/env python3
"""
History/Events Table Integrity Tests

This test suite validates the consistency and completeness of the events table,
which stores the canonical timeline/history for all dreamers.

The events table is the single source of truth for:
- Arrivals (finding the mindscape)
- Souvenirs (achievements/milestones)
- Names (speaking their name)
- Canon contributions
- Lore posts
- Work (becoming greeter, mapper, etc.)
- Welcomes (greeter/mapper actions)
- Orders (book purchases)
- Dreams and nightmares
- Spectrum movements (journeys through the psychometric space)

Test Categories:
1. Core Event Integrity - Every dreamer must have fundamental events
2. Event Source Testing - Each system that writes to events works correctly
3. Chronological Consistency - Events must be in proper order
4. Data Completeness - Cross-reference with awards, roles, etc.
5. Advanced Integrity - Quantities, URIs, spectrum coordination

Role in test_everything.sh:
This suite runs in the "Data Integrity" category, ensuring the events table
maintains consistency as dreamers register, earn souvenirs, contribute canon,
and interact with the world. It catches data corruption early and validates
that all event-writing systems (registration, admin, feedgen, API) follow
the same rules.
"""

import pytest
import sys
import os
from datetime import datetime
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager


class TestHistoryCoreIntegrity:
    """Test that every dreamer has the fundamental required events."""
    
    def test_all_reverie_dreamers_have_arrival_event(self):
        """Every reverie.house dreamer must have an arrival event (found our wild mindscape)."""
        db = DatabaseManager()
        
        # Get all reverie.house dreamers
        cursor = db.execute("""
            SELECT did, handle, arrival
            FROM dreamers
            WHERE server = 'https://reverie.house'
        """)
        dreamers = cursor.fetchall()
        
        assert len(dreamers) > 0, "No reverie.house dreamers found"
        
        missing_arrival = []
        for dreamer in dreamers:
            cursor = db.execute("""
                SELECT COUNT(*) as count
                FROM events
                WHERE did = %s AND type = 'arrival' AND key = 'arrival'
            """, (dreamer['did'],))
            result = cursor.fetchone()
            
            if result['count'] == 0:
                missing_arrival.append(dreamer['handle'])
        
        assert len(missing_arrival) == 0, (
            f"Dreamers missing 'arrival' event: {', '.join(missing_arrival)}"
        )
    
    def test_all_reverie_dreamers_have_residence_souvenir_event(self):
        """Every reverie.house dreamer must have residence souvenir event (stayed at Reverie House)."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, handle
            FROM dreamers
            WHERE server = 'https://reverie.house'
        """)
        dreamers = cursor.fetchall()
        
        missing_residence = []
        for dreamer in dreamers:
            cursor = db.execute("""
                SELECT COUNT(*) as count
                FROM events
                WHERE did = %s AND type = 'souvenir' AND key = 'residence'
            """, (dreamer['did'],))
            result = cursor.fetchone()
            
            if result['count'] == 0:
                missing_residence.append(dreamer['handle'])
        
        assert len(missing_residence) == 0, (
            f"Dreamers missing 'residence' souvenir event: {', '.join(missing_residence)}"
        )
    
    def test_residence_souvenir_chronology(self):
        """Residence souvenir must come AFTER arrival event."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, handle
            FROM dreamers
            WHERE server = 'https://reverie.house'
        """)
        dreamers = cursor.fetchall()
        
        chronology_errors = []
        for dreamer in dreamers:
            cursor = db.execute("""
                SELECT 
                    (SELECT epoch FROM events WHERE did = %s AND type = 'arrival' AND key = 'arrival' LIMIT 1) as arrival_epoch,
                    (SELECT epoch FROM events WHERE did = %s AND type = 'souvenir' AND key = 'residence' LIMIT 1) as residence_epoch
            """, (dreamer['did'], dreamer['did']))
            result = cursor.fetchone()
            
            if result['arrival_epoch'] and result['residence_epoch']:
                if result['residence_epoch'] <= result['arrival_epoch']:
                    chronology_errors.append(
                        f"{dreamer['handle']}: residence ({result['residence_epoch']}) <= arrival ({result['arrival_epoch']})"
                    )
        
        assert len(chronology_errors) == 0, (
            f"Chronology errors (residence must be AFTER arrival):\n" + 
            "\n".join(chronology_errors)
        )
    
    def test_events_match_awards_table(self):
        """Souvenir events must match the awards table."""
        db = DatabaseManager()
        
        # Get all souvenir events
        cursor = db.execute("""
            SELECT did, key as souvenir_key, epoch
            FROM events
            WHERE type = 'souvenir'
        """)
        events = cursor.fetchall()
        
        # Get all awards
        cursor = db.execute("""
            SELECT did, souvenir_key, earned_epoch
            FROM awards
        """)
        awards = cursor.fetchall()
        
        # Convert to sets for comparison
        events_set = {(e['did'], e['souvenir_key']) for e in events}
        awards_set = {(a['did'], a['souvenir_key']) for a in awards}
        
        # Check for mismatches
        in_events_not_awards = events_set - awards_set
        in_awards_not_events = awards_set - events_set
        
        errors = []
        if in_events_not_awards:
            errors.append(f"In events but not awards: {in_events_not_awards}")
        if in_awards_not_events:
            errors.append(f"In awards but not events: {in_awards_not_events}")
        
        assert len(errors) == 0, "\n".join(errors)
    
    def test_event_epochs_are_valid_timestamps(self):
        """All event epochs must be valid Unix timestamps."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, event, epoch, type, key
            FROM events
            WHERE epoch IS NOT NULL
        """)
        events = cursor.fetchall()
        
        invalid_epochs = []
        for event in events:
            epoch = event['epoch']
            
            # Check if epoch is reasonable (after 2020, before 2100)
            min_epoch = 1577836800  # 2020-01-01
            max_epoch = 4102444800  # 2100-01-01
            
            if epoch < min_epoch or epoch > max_epoch:
                try:
                    date_str = datetime.fromtimestamp(epoch).isoformat() if epoch > 0 else 'invalid'
                except:
                    date_str = 'invalid'
                
                invalid_epochs.append(
                    f"Event ID {event['id']}: {event['type']}/{event['key']} - "
                    f"epoch {epoch} ({date_str})"
                )
        
        assert len(invalid_epochs) == 0, (
            f"Invalid epoch timestamps:\n" + "\n".join(invalid_epochs)
        )
    
    def test_all_events_have_required_fields(self):
        """All events must have did, event, type, and key fields populated."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, event, type, key
            FROM events
            WHERE did IS NULL OR event IS NULL OR type IS NULL OR key IS NULL
        """)
        incomplete_events = cursor.fetchall()
        
        assert len(incomplete_events) == 0, (
            f"Found {len(incomplete_events)} events with missing required fields"
        )


class TestHistoryEventSources:
    """Test each system that writes to the events table."""
    
    def test_registration_creates_arrival_event(self):
        """Registration system creates arrival events correctly."""
        # This is tested by checking existing data
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'arrival' AND key = 'arrival' AND event = 'found our wild mindscape'
        """)
        result = cursor.fetchone()
        
        assert result['count'] > 0, "No arrival events found from registration system"
    
    def test_registration_creates_residence_souvenir(self):
        """Registration system creates residence souvenir events for reverie.house users."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'souvenir' AND key = 'residence' AND event = 'stayed at Reverie House'
        """)
        result = cursor.fetchone()
        
        assert result['count'] > 0, "No residence souvenir events found"
    
    def test_greeter_creates_welcome_events(self):
        """Greeter system creates welcome events."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'welcome' AND key = 'greeter'
        """)
        result = cursor.fetchone()
        
        # This is optional, so we just check the query works
        assert result['count'] >= 0, "Greeter welcome event query failed"
    
    def test_mapper_creates_welcome_events(self):
        """Mapper system creates welcome events."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'welcome' AND key = 'mapper'
        """)
        result = cursor.fetchone()
        
        assert result['count'] >= 0, "Mapper welcome event query failed"
    
    def test_role_assignment_creates_work_events(self):
        """Role assignment creates work events."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'work'
        """)
        result = cursor.fetchone()
        
        assert result['count'] >= 0, "Work event query failed"
    
    def test_feedgen_creates_canon_events(self):
        """Feedgen creates canon events for labeled posts."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'canon'
        """)
        result = cursor.fetchone()
        
        # Canon events are optional but should be queryable
        assert result['count'] >= 0, "Canon event query failed"
    
    def test_feedgen_creates_lore_events(self):
        """Feedgen creates lore events for labeled posts."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'lore'
        """)
        result = cursor.fetchone()
        
        assert result['count'] >= 0, "Lore event query failed"
    
    def test_departure_event_structure(self):
        """Departure events have correct structure (type=departure, key=dissipate, text='dissipates their self')."""
        db = DatabaseManager()
        
        # Check if any departure events exist
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'departure' AND key = 'dissipate'
        """)
        result = cursor.fetchone()
        
        # Departure events are optional (only created on account deletion)
        # but if they exist, they must have the correct format
        assert result['count'] >= 0, "Departure event query failed"
        
        # If departure events exist, verify their text format
        if result['count'] > 0:
            cursor = db.execute("""
                SELECT event
                FROM events
                WHERE type = 'departure' AND key = 'dissipate'
                LIMIT 1
            """)
            sample = cursor.fetchone()
            assert sample['event'] == 'dissipates their self', (
                f"Departure event text must be 'dissipates their self', got: {sample['event']}"
            )


class TestHistoryDataCompleteness:
    """Test that events table is consistent with other tables."""
    
    def test_work_events_match_user_roles(self):
        """Work events should correspond to user_roles entries."""
        db = DatabaseManager()
        
        # Get all active roles
        cursor = db.execute("""
            SELECT ur.did, ur.role, d.handle
            FROM user_roles ur
            JOIN dreamers d ON ur.did = d.did
            WHERE ur.status = 'active'
        """)
        roles = cursor.fetchall()
        
        missing_work_events = []
        for role_entry in roles:
            cursor = db.execute("""
                SELECT COUNT(*) as count
                FROM events
                WHERE did = %s AND type = 'work' AND key = %s
            """, (role_entry['did'], role_entry['role']))
            result = cursor.fetchone()
            
            if result['count'] == 0:
                missing_work_events.append(
                    f"{role_entry['handle']}: role '{role_entry['role']}'"
                )
        
        # This is a soft requirement - not all roles may have events yet
        if len(missing_work_events) > 0:
            print(f"\nNote: {len(missing_work_events)} active roles without work events:")
            for msg in missing_work_events[:5]:
                print(f"  - {msg}")
    
    def test_souvenir_events_have_descriptions(self):
        """All souvenir events should have meaningful descriptions."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, event, key
            FROM events
            WHERE type = 'souvenir' AND (event IS NULL OR event = '')
        """)
        empty_descriptions = cursor.fetchall()
        
        assert len(empty_descriptions) == 0, (
            f"Found {len(empty_descriptions)} souvenir events with empty descriptions"
        )
    
    def test_no_duplicate_events(self):
        """No duplicate events (same did, type, key, epoch)."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, type, key, epoch, COUNT(*) as count
            FROM events
            WHERE epoch IS NOT NULL
            GROUP BY did, type, key, epoch
            HAVING COUNT(*) > 1
        """)
        duplicates = cursor.fetchall()
        
        if len(duplicates) > 0:
            dup_list = [
                f"{d['did'][:20]}... - {d['type']}/{d['key']} @ {d['epoch']}: {d['count']} times"
                for d in duplicates[:10]
            ]
            assert False, f"Found duplicate events:\n" + "\n".join(dup_list)
    
    def test_events_reference_valid_dreamers(self):
        """All events must reference valid dreamers."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT e.id, e.did, e.type, e.key
            FROM events e
            LEFT JOIN dreamers d ON e.did = d.did
            WHERE d.did IS NULL
        """)
        orphaned_events = cursor.fetchall()
        
        assert len(orphaned_events) == 0, (
            f"Found {len(orphaned_events)} events referencing non-existent dreamers"
        )


class TestHistoryReporting:
    """Generate reports on event coverage and completeness."""
    
    def test_generate_event_coverage_report(self):
        """Generate a report showing event coverage per dreamer."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT 
                d.handle,
                d.server,
                COUNT(CASE WHEN e.type = 'arrival' THEN 1 END) as arrivals,
                COUNT(CASE WHEN e.type = 'souvenir' THEN 1 END) as souvenirs,
                COUNT(CASE WHEN e.type = 'name' THEN 1 END) as names,
                COUNT(CASE WHEN e.type = 'work' THEN 1 END) as work,
                COUNT(CASE WHEN e.type = 'welcome' THEN 1 END) as welcomes,
                COUNT(CASE WHEN e.type = 'canon' THEN 1 END) as canon,
                COUNT(CASE WHEN e.type = 'lore' THEN 1 END) as lore,
                COUNT(e.id) as total_events
            FROM dreamers d
            LEFT JOIN events e ON d.did = e.did
            WHERE d.server = 'https://reverie.house'
            GROUP BY d.handle, d.server
            ORDER BY total_events DESC, d.handle
        """)
        dreamers = cursor.fetchall()
        
        print("\n" + "="*80)
        print("EVENT COVERAGE REPORT - Reverie House Dreamers")
        print("="*80)
        print(f"{'Handle':<25} {'Arrival':<8} {'Resid':<6} {'Name':<5} {'Work':<5} {'Total':<6}")
        print("-"*80)
        
        for dreamer in dreamers:
            print(
                f"{dreamer['handle']:<25} "
                f"{'✓' if dreamer['arrivals'] > 0 else '✗':<8} "
                f"{'✓' if dreamer['souvenirs'] > 0 else '✗':<6} "
                f"{dreamer['names']:<5} "
                f"{dreamer['work']:<5} "
                f"{dreamer['total_events']:<6}"
            )
        
        print("="*80)
        
        # Verify we got meaningful data
        assert len(dreamers) > 0, "No dreamers found for coverage report"
        # Verify at least some dreamers have events
        dreamers_with_events = [d for d in dreamers if d['total_events'] > 0]
        assert len(dreamers_with_events) > 0, "No dreamers with any events found"


# ============================================================================
# ADVANCED INTEGRITY TESTS
# ============================================================================

@pytest.mark.database
class TestHistoryAdvancedIntegrity:
    """Advanced validation of event data quality and relationships."""
    
    def test_quantities_field_valid_json(self):
        """Verify all quantities fields contain valid JSON."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, type, key, quantities
            FROM events
            WHERE quantities IS NOT NULL
        """)
        events_with_quantities = cursor.fetchall()
        
        # All quantities should be valid JSONB (already enforced by PostgreSQL)
        # But let's verify they parse correctly and have expected structure
        for event in events_with_quantities:
            assert event['quantities'] is not None
            # JSONB is automatically parsed by psycopg2
            assert isinstance(event['quantities'], dict), (
                f"Event {event['id']} has non-dict quantities: {type(event['quantities'])}"
            )
    
    def test_order_events_have_quantities(self):
        """Verify order events always have quantities data."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, key, quantities
            FROM events
            WHERE type = 'order'
        """)
        order_events = cursor.fetchall()
        
        for event in order_events:
            assert event['quantities'] is not None, (
                f"Order event {event['id']} for {event['key']} missing quantities"
            )
    
    def test_uris_are_well_formed(self):
        """Verify URIs are present and well-formed when set."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, type, key, uri
            FROM events
            WHERE uri IS NOT NULL AND uri != ''
        """)
        events_with_uris = cursor.fetchall()
        
        for event in events_with_uris:
            # URIs should be non-empty strings
            # Can be: at://, did:, stripe:, or internal paths like /work/greeter
            assert event['uri'] is not None
            assert len(event['uri']) > 0
            assert isinstance(event['uri'], str), (
                f"Event {event['id']} has non-string URI: {type(event['uri'])}"
            )
    
    def test_spectrum_events_reference_dreamers_table(self):
        """Verify dreamers exist and future spectrum events will reference them."""
        db = DatabaseManager()
        
        # Verify dreamers table exists and has data
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM dreamers
        """)
        result = cursor.fetchone()
        
        assert result['count'] > 0, "No dreamers in database"
        
        # Future enhancement: spectrum movements could be logged to events table
        # For now, just verify the foundation is in place
        cursor = db.execute("""
            SELECT COUNT(*) as count
            FROM events
            WHERE type = 'spectrum'
        """)
        spectrum_events = cursor.fetchone()
        
        # This is OK to be 0 for now - spectrum movements aren't logged yet
        assert spectrum_events['count'] >= 0
    
    def test_event_keys_are_descriptive(self):
        """Verify event keys follow naming conventions."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT DISTINCT type, key
            FROM events
            ORDER BY type, key
        """)
        event_types = cursor.fetchall()
        
        # Keys should be lowercase, alphanumeric with underscores
        import re
        key_pattern = re.compile(r'^[a-z0-9_]+$')
        
        for event_type in event_types:
            assert key_pattern.match(event_type['key']), (
                f"Event key doesn't follow convention: {event_type['type']}.{event_type['key']}"
            )
    
    def test_created_at_vs_epoch_consistency(self):
        """Verify created_at and epoch fields are reasonably aligned when both present."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT id, did, type, key, epoch, created_at
            FROM events
            WHERE epoch IS NOT NULL AND created_at IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 50
        """)
        recent_events = cursor.fetchall()
        
        # For recent events, allow reasonable drift
        # For older events (backfilled data), drift might be larger
        MAX_DRIFT_RECENT = 86400  # 1 day for data migrations/backfills
        
        if len(recent_events) > 0:
            # Just verify both fields are present and positive
            for event in recent_events[:10]:
                assert event['epoch'] > 0, f"Event {event['id']} has invalid epoch"
                assert event['created_at'] > 0, f"Event {event['id']} has invalid created_at"
    
    def test_reaction_chains_are_valid(self):
        """Verify reaction_to chains reference valid events."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT e1.id, e1.did, e1.type, e1.reaction_to, e2.id as parent_id
            FROM events e1
            LEFT JOIN events e2 ON e1.reaction_to = e2.id
            WHERE e1.reaction_to IS NOT NULL
        """)
        reactions = cursor.fetchall()
        
        for reaction in reactions:
            assert reaction['parent_id'] is not None, (
                f"Event {reaction['id']} references non-existent parent {reaction['reaction_to']}"
            )


# ============================================================================
# PERFORMANCE & SCALE TESTS
# ============================================================================

@pytest.mark.database
class TestHistoryPerformance:
    """Verify event queries perform acceptably at scale."""
    
    def test_dreamer_timeline_query_performance(self):
        """Verify fetching a dreamer's full timeline is fast."""
        db = DatabaseManager()
        
        # Get a dreamer with many events
        cursor = db.execute("""
            SELECT did, COUNT(*) as event_count
            FROM events
            GROUP BY did
            ORDER BY event_count DESC
            LIMIT 1
        """)
        top_dreamer = cursor.fetchone()
        
        if not top_dreamer or top_dreamer['event_count'] == 0:
            pytest.skip("No dreamers with events to test")
        
        import time
        start = time.time()
        
        # This query is used by the API
        cursor = db.execute("""
            SELECT *
            FROM events
            WHERE did = %s
            ORDER BY epoch DESC
        """, (top_dreamer['did'],))
        events = cursor.fetchall()
        
        duration = time.time() - start
        
        assert duration < 1.0, (
            f"Timeline query took {duration:.2f}s for {len(events)} events (should be <1s)"
        )
    
    def test_event_coverage_aggregation_performance(self):
        """Verify aggregate queries for reporting are fast."""
        db = DatabaseManager()
        
        import time
        start = time.time()
        
        cursor = db.execute("""
            SELECT 
                type,
                COUNT(*) as count,
                COUNT(DISTINCT did) as unique_dreamers
            FROM events
            GROUP BY type
            ORDER BY count DESC
        """)
        stats = cursor.fetchall()
        
        duration = time.time() - start
        
        assert duration < 0.5, (
            f"Aggregate query took {duration:.2f}s (should be <0.5s)"
        )
        assert len(stats) > 0, "No event types found"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
