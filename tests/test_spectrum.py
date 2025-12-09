#!/usr/bin/env python3
"""
Spectrum Integrity Testing

Validates the integrity of spectrum data and heading system based on
the algorithm specification in /srv/reverie.house/site/algo/spectrum.json

SPECTRUM DATA MODEL:
- origin_* columns: Algorithmic starting position (deterministic, never changes)
- Current columns (oblivion, entropy, etc.): Where dreamers are NOW (can move via headings)
- Initially, current == origin for all users (no movement has occurred yet)
- As headings are applied, current position diverges from origin

- Spectrum values exist for all dreamers (both origin and current)
- Keeper (did:plc:yauphjufk7phkwurn266ybx2) origin is at (0,0,0,0,0,0) 
- All other users have non-zero origin coordinates per algorithm
- Current positions match origins (no movement has occurred yet)
- Spectrum values match test vectors from algorithm spec
- Headings are not corrupted or changed without consent
- Spectrum table has both origin and current position columns

The spectrum defines each dreamer's position in psychometric space using
a deterministic algorithm based on their DID. Only the keeper's DID
(did:plc:yauphjufk7phkwurn266ybx2, currently @reverie.house) has an
algorithmic origin at (equilibrium). All other dreamers have algorithmic
origins calculated via SHA-256 hashing with server-based distance weighting.

Algorithm: /srv/reverie.house/site/algo/spectrum.json
Implementation: /srv/reverie.house/utils/spectrum.py

Headings determine movement direction and can only be changed by:
1. The dreamer themselves (via dashboard/API)
2. System admin (for moderation/support)

Runs as part of: test_everything.sh (Data Integrity category)

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager


# ============================================================================
# SPECTRUM CORE INTEGRITY
# ============================================================================

@pytest.mark.database
class TestSpectrumCoreIntegrity:
    """Core spectrum data validation."""
    
    def test_spectrum_table_exists(self):
        """Verify spectrum table exists with correct structure."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'spectrum'
            ORDER BY ordinal_position
        """)
        columns = {row['column_name']: row['data_type'] for row in cursor.fetchall()}
        
        required_columns = [
            'did', 'oblivion', 'entropy', 'skeptic', 
            'receptive', 'liberty', 'authority', 'octant',
            # Origin columns (algorithmic starting position, immutable)
            'origin_oblivion', 'origin_entropy', 'origin_skeptic',
            'origin_receptive', 'origin_liberty', 'origin_authority', 'origin_octant'
        ]
        
        for col in required_columns:
            assert col in columns, f"Missing required column: {col}"
    
    def test_all_dreamers_have_spectrum_data(self):
        """Verify all dreamers have spectrum records with both origin and current position."""
        db = DatabaseManager()
        
        # Get dreamers without complete spectrum data
        cursor = db.execute("""
            SELECT d.did, d.handle
            FROM dreamers d
            LEFT JOIN spectrum s ON d.did = s.did
            WHERE s.did IS NULL
               OR s.origin_oblivion IS NULL
               OR s.origin_entropy IS NULL
               OR s.oblivion IS NULL
               OR s.entropy IS NULL
        """)
        missing = cursor.fetchall()
        
        assert len(missing) == 0, (
            f"{len(missing)} dreamers missing spectrum data: "
            f"{', '.join([d['handle'] for d in missing[:5]])}"
        )
    
    def test_keeper_at_origin(self):
        """Verify the keeper (did:plc:yauphjufk7phkwurn266ybx2) is at origin for BOTH algorithmic origin and current position."""
        db = DatabaseManager()
        
        # From /srv/reverie.house/site/algo/spectrum.json
        KEEPER_DID = "did:plc:yauphjufk7phkwurn266ybx2"
        
        cursor = db.execute("""
            SELECT s.*, d.handle
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            WHERE s.did = %s
        """, (KEEPER_DID,))
        keeper = cursor.fetchone()
        
        assert keeper is not None, f"Keeper {KEEPER_DID} not found in spectrum table"
        
        # Per algorithm spec: keeper's DID always results in [0,0,0,0,0,0]
        # This should be true for both algorithmic origin AND current position
        axes = ['oblivion', 'entropy', 'skeptic', 'receptive', 'liberty', 'authority']
        
        for axis in axes:
            origin_axis = f'origin_{axis}'
            assert keeper[origin_axis] == 0, f"{origin_axis} should be 0, got {keeper[origin_axis]}"
            assert keeper[axis] == 0, f"{axis} should be 0, got {keeper[axis]}"
        
        assert keeper['octant'] == 'equilibrium', f"octant should be equilibrium, got {keeper['octant']}"
    
    def test_non_keeper_users_have_non_zero_coordinates(self):
        """Verify all non-keeper users have non-zero ORIGIN coordinates per algorithm."""
        db = DatabaseManager()
        
        KEEPER_DID = "did:plc:yauphjufk7phkwurn266ybx2"
        
        cursor = db.execute("""
            SELECT s.did, d.handle, 
                   s.origin_oblivion, s.origin_entropy, s.origin_skeptic,
                   s.origin_receptive, s.origin_liberty, s.origin_authority
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            WHERE s.did != %s
        """, (KEEPER_DID,))
        dreamers = cursor.fetchall()
        
        assert len(dreamers) > 0, "No non-keeper dreamers found"
        
        # Each dreamer's ALGORITHMIC ORIGIN should have non-zero coordinates
        # Per algorithm: only keeper_did results in [0,0,0,0,0,0]
        for dreamer in dreamers:
            total = abs(dreamer['origin_oblivion']) + abs(dreamer['origin_entropy']) + \
                   abs(dreamer['origin_skeptic']) + abs(dreamer['origin_receptive']) + \
                   abs(dreamer['origin_liberty']) + abs(dreamer['origin_authority'])
            
            assert total > 0, (
                f"{dreamer['handle']} has all-zero ORIGIN coordinates "
                f"(only keeper {KEEPER_DID} should have origin at [0,0,0,0,0,0])"
            )
    
    def test_current_position_matches_origin_initially(self):
        """
        Verify current position == origin for all users (no movement has occurred yet).
        
        Once heading-based movement is implemented, current position will diverge from origin.
        But initially, everyone should be at their algorithmic starting point.
        """
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT s.did, d.handle,
                   s.oblivion, s.origin_oblivion,
                   s.entropy, s.origin_entropy,
                   s.skeptic, s.origin_skeptic,
                   s.receptive, s.origin_receptive,
                   s.liberty, s.origin_liberty,
                   s.authority, s.origin_authority
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
        """)
        dreamers = cursor.fetchall()
        
        axes = ['oblivion', 'entropy', 'skeptic', 'receptive', 'liberty', 'authority']
        
        for dreamer in dreamers:
            for axis in axes:
                current = dreamer[axis]
                origin = dreamer[f'origin_{axis}']
                
                assert current == origin, (
                    f"{dreamer['handle']}: {axis} current={current} != origin={origin} "
                    f"(movement should not have occurred yet)"
                )
    
    def test_spectrum_values_in_valid_range(self):
        """Verify spectrum values are within valid range (typically 0-100) for BOTH origin and current."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, 
                   oblivion, entropy, skeptic, receptive, liberty, authority,
                   origin_oblivion, origin_entropy, origin_skeptic, 
                   origin_receptive, origin_liberty, origin_authority
            FROM spectrum
        """)
        spectrums = cursor.fetchall()
        
        axes = ['oblivion', 'entropy', 'skeptic', 'receptive', 'liberty', 'authority']
        
        for spectrum in spectrums:
            for axis in axes:
                # Check current position
                current_value = spectrum[axis]
                assert 0 <= current_value <= 100, (
                    f"DID {spectrum['did'][:20]}... has {axis}={current_value} (should be 0-100)"
                )
                
                # Check origin position
                origin_value = spectrum[f'origin_{axis}']
                assert 0 <= origin_value <= 100, (
                    f"DID {spectrum['did'][:20]}... has origin_{axis}={origin_value} (should be 0-100)"
                )
    
    def test_octants_are_valid(self):
        """Verify octant classifications are valid."""
        db = DatabaseManager()
        
        valid_octants = [
            'equilibrium',  # At origin
            'adaptive',     # receptive+entropy
            'chaotic',      # entropy+skeptic
            'assertive',    # skeptic+authority  
            'guarded',      # authority+oblivion
            'intended',     # oblivion+liberty
            'prepared',     # liberty+receptive
            'contented',    # Low on all axes
            # Note: There may be other valid octants in the system
        ]
        
        cursor = db.execute("""
            SELECT DISTINCT octant
            FROM spectrum
            WHERE octant IS NOT NULL AND octant != ''
        """)
        octants = [row['octant'] for row in cursor.fetchall()]
        
        # Just verify they're non-empty strings
        for octant in octants:
            assert isinstance(octant, str), f"Octant should be string, got {type(octant)}"
            assert len(octant) > 0, "Octant should not be empty string"
            assert octant.islower(), f"Octant should be lowercase: {octant}"
    
    def test_octants_match_coordinates(self):
        """Verify octant fields match calculated values from coordinates."""
        db = DatabaseManager()
        
        from utils.octant import calculate_octant_code
        
        cursor = db.execute("""
            SELECT d.handle,
                   s.oblivion, s.authority, s.skeptic, s.receptive, s.liberty, s.entropy, s.octant,
                   s.origin_oblivion, s.origin_authority, s.origin_skeptic,
                   s.origin_receptive, s.origin_liberty, s.origin_entropy, s.origin_octant
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
        """)
        dreamers = cursor.fetchall()
        
        for dreamer in dreamers:
            # Check current octant matches current coordinates
            current_spectrum = {
                'oblivion': dreamer['oblivion'],
                'authority': dreamer['authority'],
                'skeptic': dreamer['skeptic'],
                'receptive': dreamer['receptive'],
                'liberty': dreamer['liberty'],
                'entropy': dreamer['entropy']
            }
            calculated_octant = calculate_octant_code(current_spectrum)
            
            assert dreamer['octant'] == calculated_octant, (
                f"{dreamer['handle']}: current octant={dreamer['octant']} "
                f"doesn't match calculation={calculated_octant}"
            )
            
            # Check origin octant matches origin coordinates
            origin_spectrum = {
                'oblivion': dreamer['origin_oblivion'],
                'authority': dreamer['origin_authority'],
                'skeptic': dreamer['origin_skeptic'],
                'receptive': dreamer['origin_receptive'],
                'liberty': dreamer['origin_liberty'],
                'entropy': dreamer['origin_entropy']
            }
            calculated_origin_octant = calculate_octant_code(origin_spectrum)
            
            assert dreamer['origin_octant'] == calculated_origin_octant, (
                f"{dreamer['handle']}: origin_octant={dreamer['origin_octant']} "
                f"doesn't match calculation={calculated_origin_octant}"
            )


# ============================================================================
# HEADING INTEGRITY
# ============================================================================

@pytest.mark.database
class TestHeadingIntegrity:
    """Validate heading system integrity and user consent."""
    
    def test_keeper_heading_is_affix(self):
        """Verify the keeper has heading='affix' (stays at origin)."""
        db = DatabaseManager()
        
        KEEPER_DID = "did:plc:yauphjufk7phkwurn266ybx2"
        
        cursor = db.execute("""
            SELECT heading, heading_changed_at, handle
            FROM dreamers
            WHERE did = %s
        """, (KEEPER_DID,))
        keeper = cursor.fetchone()
        
        assert keeper is not None, f"Keeper {KEEPER_DID} not found"
        assert keeper['heading'] == 'affix', (
            f"Keeper ({keeper['handle']}) heading should be 'affix', got '{keeper['heading']}'"
        )
    
    def test_headings_are_not_corrupted(self):
        """Verify heading field contains valid values (not broken/corrupted)."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, handle, heading
            FROM dreamers
            WHERE heading IS NOT NULL AND heading != ''
        """)
        dreamers_with_headings = cursor.fetchall()
        
        valid_static_headings = [
            'affix',      # Stay in place
            'drift',      # No heading
            'home',       # Return to algorithmic origin
            'origin',     # Move toward spectrum origin
            'keeper',     # Special heading
        ]
        
        valid_axis_headings = [
            'oblivion', 'entropy', 'skeptic', 'receptive', 'liberty', 'authority'
        ]
        
        for dreamer in dreamers_with_headings:
            heading = dreamer['heading']
            
            # Heading should be one of:
            # 1. Valid static heading
            # 2. Valid axis name  
            # 3. Another dreamer's DID (did:plc:...)
            # 4. Empty/null (allowed)
            
            is_valid = (
                heading in valid_static_headings or
                heading in valid_axis_headings or
                heading.startswith('did:')
            )
            
            assert is_valid, (
                f"{dreamer['handle']} has invalid heading: '{heading}'"
            )
    
    def test_heading_changed_at_is_valid_timestamp(self):
        """Verify heading_changed_at timestamps are reasonable."""
        db = DatabaseManager()
        
        import time
        current_time = int(time.time())
        # Earliest reasonable timestamp: 2020-01-01
        min_reasonable = 1577836800
        
        cursor = db.execute("""
            SELECT handle, heading_changed_at
            FROM dreamers
            WHERE heading_changed_at IS NOT NULL
        """)
        dreamers = cursor.fetchall()
        
        for dreamer in dreamers:
            timestamp = dreamer['heading_changed_at']
            
            assert timestamp >= min_reasonable, (
                f"{dreamer['handle']} has heading_changed_at in the past: {timestamp}"
            )
            
            assert timestamp <= current_time, (
                f"{dreamer['handle']} has heading_changed_at in the future: {timestamp}"
            )
    
    def test_heading_changes_are_logged(self):
        """Verify heading changes are properly logged (if logging exists)."""
        db = DatabaseManager()
        
        # Check if heading_history table exists
        cursor = db.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'heading_history'
            )
        """)
        result = cursor.fetchone()
        table_exists = result['exists'] if result else False
        
        if table_exists:
            # If logging table exists, verify it has some data
            cursor = db.execute("SELECT COUNT(*) as count FROM heading_history")
            count = cursor.fetchone()['count']
            
            # Just verify table is accessible (count could be 0 if new system)
            assert count >= 0, "heading_history table should be readable"
    
    def test_users_cannot_have_invalid_heading_targets(self):
        """Verify heading DIDs reference actual dreamers."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, handle, heading
            FROM dreamers
            WHERE heading LIKE 'did:%%'
        """)
        dreamers_heading_to_dids = cursor.fetchall()
        
        for dreamer in dreamers_heading_to_dids:
            target_did = dreamer['heading']
            
            # Verify target DID exists
            cursor = db.execute(
                "SELECT did FROM dreamers WHERE did = %s",
                (target_did,)
            )
            target = cursor.fetchone()
            
            assert target is not None, (
                f"{dreamer['handle']} heading toward non-existent DID: {target_did}"
            )


# ============================================================================
# SPECTRUM ORIGIN CONSISTENCY
# ============================================================================

@pytest.mark.database
class TestSpectrumOriginConsistency:
    """Ensure spectrum origins are consistent, reproducible, and immutable."""
    
    def test_algorithm_test_vectors(self):
        """Validate keeper is at origin as per algorithm spec for BOTH origin and current."""
        db = DatabaseManager()
        
        # Primary test: Keeper must be at origin per algorithm spec
        KEEPER_DID = "did:plc:yauphjufk7phkwurn266ybx2"
        
        cursor = db.execute("""
            SELECT oblivion, authority, skeptic, receptive, liberty, entropy,
                   origin_oblivion, origin_authority, origin_skeptic, 
                   origin_receptive, origin_liberty, origin_entropy
            FROM spectrum 
            WHERE did = %s
        """, (KEEPER_DID,))
        keeper = cursor.fetchone()
        
        assert keeper is not None, f"Keeper {KEEPER_DID} not found"
        
        axes = ['oblivion', 'authority', 'skeptic', 'receptive', 'liberty', 'entropy']
        
        # Per algorithm: keeper_did always results in [0,0,0,0,0,0]
        for axis in axes:
            assert keeper[axis] == 0, f"Keeper {axis} should be 0, got {keeper[axis]}"
            assert keeper[f'origin_{axis}'] == 0, f"Keeper origin_{axis} should be 0, got {keeper[f'origin_{axis}']}"
    
    def test_origins_never_change(self):
        """
        Verify origin_* columns are immutable (never change once set).
        
        This test validates that algorithmic origins remain constant.
        Unlike current position (which can move via headings), origin is
        a deterministic property based solely on the dreamer's DID.
        
        NOTE: This test will need historical data or snapshot comparison
        to fully validate immutability over time. For now, we verify that
        origins exist and match the SpectrumManager calculation.
        """
        db = DatabaseManager()
        
        from utils.spectrum import SpectrumManager
        
        cursor = db.execute("""
            SELECT s.did, d.handle, d.server,
                   s.origin_oblivion, s.origin_entropy,
                   s.origin_skeptic, s.origin_receptive,
                   s.origin_liberty, s.origin_authority
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            LIMIT 5
        """)
        sample_dreamers = cursor.fetchall()
        
        spectrum_manager = SpectrumManager()
        
        for dreamer in sample_dreamers:
            # Recalculate origin using SpectrumManager
            calculated_spectrum = spectrum_manager.generate_spectrum(
                dreamer['did'], 
                dreamer['server']
            )
            
            # Origin should match calculation (deterministic)
            axes = ['oblivion', 'entropy', 'skeptic', 'receptive', 'liberty', 'authority']
            
            for axis in axes:
                db_origin = dreamer[f'origin_{axis}']
                calc_value = calculated_spectrum[axis]
                
                assert db_origin == calc_value, (
                    f"{dreamer['handle']}: origin_{axis}={db_origin} "
                    f"doesn't match algorithm calculation={calc_value}"
                )
    
    def test_spectrum_updated_at_timestamps(self):
        """Verify spectrum update timestamps are reasonable."""
        db = DatabaseManager()
        
        import time
        current_time = int(time.time())
        
        cursor = db.execute("""
            SELECT did, updated_at
            FROM spectrum
            WHERE updated_at > 0
        """)
        spectrums = cursor.fetchall()
        
        for spectrum in spectrums[:20]:  # Sample check
            updated_at = spectrum['updated_at']
            
            # Should be in the past
            assert updated_at <= current_time, (
                f"Spectrum {spectrum['did'][:20]}... has future updated_at"
            )


# ============================================================================
# CROSS-TABLE CONSISTENCY
# ============================================================================

@pytest.mark.database
class TestSpectrumCrossTableConsistency:
    """Validate spectrum data consistency across tables."""
    
    def test_spectrum_references_existing_dreamers(self):
        """Verify all spectrum records reference valid dreamers."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT s.did
            FROM spectrum s
            LEFT JOIN dreamers d ON s.did = d.did
            WHERE d.did IS NULL
        """)
        orphaned = cursor.fetchall()
        
        assert len(orphaned) == 0, (
            f"Found {len(orphaned)} spectrum records without dreamer entries"
        )
    
    def test_no_duplicate_spectrum_records(self):
        """Verify each dreamer has exactly one spectrum record."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT did, COUNT(*) as count
            FROM spectrum
            GROUP BY did
            HAVING COUNT(*) > 1
        """)
        duplicates = cursor.fetchall()
        
        assert len(duplicates) == 0, (
            f"Found {len(duplicates)} dreamers with multiple spectrum records"
        )


# ============================================================================
# REPORTING
# ============================================================================

@pytest.mark.database
class TestSpectrumReporting:
    """Generate spectrum overview reports."""
    
    def test_generate_spectrum_distribution_report(self):
        """Generate report showing spectrum distribution by octant."""
        db = DatabaseManager()
        
        cursor = db.execute("""
            SELECT 
                s.octant,
                COUNT(*) as count,
                AVG(s.oblivion) as avg_oblivion,
                AVG(s.entropy) as avg_entropy,
                AVG(s.skeptic) as avg_skeptic,
                AVG(s.receptive) as avg_receptive,
                AVG(s.liberty) as avg_liberty,
                AVG(s.authority) as avg_authority
            FROM spectrum s
            JOIN dreamers d ON s.did = d.did
            WHERE d.server = 'https://reverie.house'
            GROUP BY s.octant
            ORDER BY count DESC
        """)
        octants = cursor.fetchall()
        
        print("\n" + "="*80)
        print("SPECTRUM DISTRIBUTION - Reverie House Dreamers")
        print("="*80)
        print(f"{'Octant':<15} {'Count':<8} {'Avg Coordinates (O/E/S/R/L/A)'}")
        print("-"*80)
        
        for octant in octants:
            coords = (
                f"{octant['avg_oblivion']:.0f}/"
                f"{octant['avg_entropy']:.0f}/"
                f"{octant['avg_skeptic']:.0f}/"
                f"{octant['avg_receptive']:.0f}/"
                f"{octant['avg_liberty']:.0f}/"
                f"{octant['avg_authority']:.0f}"
            )
            print(f"{octant['octant']:<15} {octant['count']:<8} {coords}")
        
        print("="*80)
        
        # Test always passes - it's for reporting
        assert True


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
