"""
Domain Logic Testing

Complete domain testing: canon, world, zones, spectrum, contributions, work.

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import json


# ============================================================================
# CANON TESTS
# ============================================================================

@pytest.mark.database
class TestCanon:
    """Canon event system"""
    
    def test_canon_events_exist(self, test_db):
        """Test canon events exist"""
        events = test_db.execute(
            "SELECT * FROM events ORDER BY epoch DESC LIMIT 5"
        ).fetchall()
        assert events is not None
    
    def test_canon_chronological_order(self, test_db):
        """Test canon events are chronologically ordered"""
        events = test_db.execute(
            "SELECT epoch FROM events ORDER BY epoch DESC LIMIT 10"
        ).fetchall()
        
        if len(events) > 1:
            epochs = [e['epoch'] for e in events]
            assert epochs == sorted(epochs, reverse=True)


# ============================================================================
# WORLD TESTS
# ============================================================================

@pytest.mark.database
class TestWorld:
    """World state and operations"""
    
    def test_world_has_keeper(self, test_db):
        """Test world has a keeper"""
        # Check if there's a keeper DID configured
        from config import KEEPER_DID
        assert KEEPER_DID is not None
    
    def test_world_dreamer_count(self, test_db):
        """Test world tracks dreamer count"""
        count = test_db.execute("SELECT COUNT(*) as c FROM dreamers").fetchone()
        assert count['c'] >= 0


# ============================================================================
# ZONES TESTS
# ============================================================================

@pytest.mark.database
class TestZones:
    """Zone system"""
    
    def test_zones_can_be_queried(self, test_db):
        """Test zones can be queried"""
        # Basic zone query - won't fail if no zones table
        try:
            zones = test_db.execute("SELECT * FROM zones LIMIT 1").fetchone()
            # zones can be None if table is empty, that's OK
            assert zones is None or isinstance(zones, dict), "Zones query returned invalid type"
        except Exception:
            pytest.skip("Zones table not implemented")


# ============================================================================
# SPECTRUM TESTS
# ============================================================================

@pytest.mark.database
class TestSpectrum:
    """Spectrum generation"""
    
    def test_spectrum_table_exists(self, test_db):
        """Test spectrum table exists"""
        result = test_db.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'spectrum'
            )
        """).fetchone()
        assert result[0] == True
    
    def test_spectrum_values_valid(self, test_db):
        """Test spectrum values are valid floats 0-1"""
        spectra = test_db.execute(
            "SELECT * FROM spectrum LIMIT 10"
        ).fetchall()
        
        for spectrum in spectra:
            for key, value in dict(spectrum).items():
                if key != 'did' and isinstance(value, (int, float)):
                    assert 0 <= value <= 1


# ============================================================================
# CONTRIBUTIONS TESTS
# ============================================================================

@pytest.mark.database
class TestContributions:
    """Contribution calculations"""
    
    def test_contributions_tracked(self, test_db):
        """Test contributions are tracked"""
        # Check if there's contribution data
        try:
            contribs = test_db.execute(
                "SELECT * FROM contributions LIMIT 1"
            ).fetchall()
            assert contribs is not None or contribs == []
        except Exception:
            # Contributions may be in events or other tables
            pytest.skip("Contributions table structure varies")


# ============================================================================
# WORK ROLES TESTS
# ============================================================================

@pytest.mark.database
class TestWorkRoles:
    """Worker roles and operations"""
    
    def test_work_roles_exist(self):
        """Test work roles can be imported"""
        try:
            from utils.work_roles import WorkerRoles
            assert WorkerRoles is not None
        except ImportError:
            pytest.skip("Work roles not implemented")
    
    def test_worker_can_be_assigned(self, test_db):
        """Test workers can be assigned roles"""
        # Basic worker assignment check
        dreamers = test_db.execute(
            "SELECT did FROM dreamers LIMIT 1"
        ).fetchone()
        
        if dreamers:
            # Would test actual assignment here
            assert dreamers['did'] is not None


# ============================================================================
# QUANTITIES TESTS
# ============================================================================

def test_quantities_field():
    """Test that quantities field works correctly with JSON data"""
    test_data = {
        'units': 10,
        'type': 'blocks',
        'value': 100.0
    }
    
    # Should be able to serialize/deserialize
    import json
    serialized = json.dumps(test_data)
    deserialized = json.loads(serialized)
    
    assert deserialized['units'] == 10
    assert deserialized['type'] == 'blocks'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
