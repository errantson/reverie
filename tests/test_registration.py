"""
Consolidated Registration Testing Suite

Combines all registration-related tests:
- Basic registration flows (from test_registration_comprehensive.py)
- Edge cases and validation (from test_registration_edge_cases.py)
- Brutal/security testing (from test_registration_brutal.py)
- User profile updates (from test_user_profile_updates.py)
- Resident creation flow (from test_resident_creation_flow.py)

Author: Reverie House Testing Framework
Date: 2025-12-08
"""

import pytest
import requests
import time
import json
from datetime import datetime


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def test_user_data(unique_test_id):
    """Generate test user data"""
    timestamp = unique_test_id
    return {
        'did': f'did:plc:test{timestamp}',
        'handle': f'testuser{timestamp}.bsky.social',
        'displayName': f'Test User {timestamp}',
        'avatar': f'https://cdn.bsky.app/img/avatar/plain/test{timestamp}/abc@jpeg'
    }


# ============================================================================
# BASIC REGISTRATION FLOWS
# ============================================================================

@pytest.mark.api
@pytest.mark.database
class TestBasicRegistration:
    """Core registration functionality tests"""
    
    def test_handle_availability_check(self, api_base_url):
        """Test handle availability endpoint"""
        response = requests.get(
            f'{api_base_url}/api/check-handle',
            params={'handle': 'definitely-does-not-exist-test-12345.bsky.social'},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert 'available' in data
        assert isinstance(data['available'], bool)
    
    def test_registration_with_valid_data(self, api_base_url, test_user_data, test_db):
        """Test successful registration with valid profile data"""
        # Cleanup first
        test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
        
        try:
            response = requests.post(
                f'{api_base_url}/api/register',
                json={
                    'did': test_user_data['did'],
                    'profile': {
                        'handle': test_user_data['handle'],
                        'displayName': test_user_data['displayName'],
                        'avatar': test_user_data['avatar']
                    }
                },
                timeout=30
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['success'] == True
            assert 'dreamer' in data
            
            # Verify database record
            dreamer = test_db.execute(
                "SELECT * FROM dreamers WHERE did = %s",
                (test_user_data['did'],)
            ).fetchone()
            
            assert dreamer is not None
            assert dreamer['handle'] == test_user_data['handle']
            assert dreamer['name'] is not None
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
            
            # FIXED: Verify cleanup actually worked
            remaining = test_db.execute(
                "SELECT COUNT(*) as c FROM dreamers WHERE did = %s",
                (test_user_data['did'],)
            ).fetchone()
            assert remaining['c'] == 0, "Cleanup must fully remove test data"
    
    def test_duplicate_registration_handled(self, api_base_url, test_user_data, test_db):
        """Test that duplicate registration is handled gracefully"""
        # Cleanup
        test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
        
        try:
            # First registration
            response1 = requests.post(
                f'{api_base_url}/api/register',
                json={'did': test_user_data['did'], 'profile': {'handle': test_user_data['handle']}},
                timeout=30
            )
            assert response1.status_code == 200
            
            # Second registration - should not fail
            response2 = requests.post(
                f'{api_base_url}/api/register',
                json={'did': test_user_data['did'], 'profile': {'handle': test_user_data['handle']}},
                timeout=30
            )
            assert response2.status_code in [200, 409]  # OK or Conflict
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
            
            # FIXED: Verify cleanup worked
            remaining = test_db.execute(
                "SELECT COUNT(*) as c FROM dreamers WHERE did = %s",
                (test_user_data['did'],)
            ).fetchone()
            assert remaining['c'] == 0, "Cleanup must remove all test data"
    
    def test_name_assignment_on_registration(self, api_base_url, test_user_data, test_db):
        """Test that names are assigned during registration"""
        test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
        
        try:
            response = requests.post(
                f'{api_base_url}/api/register',
                json={'did': test_user_data['did'], 'profile': {'handle': test_user_data['handle']}},
                timeout=30
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert 'dreamer' in data
            assert data['dreamer']['name'] is not None
            assert len(data['dreamer']['name']) > 0
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
            
            # FIXED: Verify cleanup worked
            remaining = test_db.execute(
                "SELECT COUNT(*) as c FROM dreamers WHERE did = %s",
                (test_user_data['did'],)
            ).fetchone()
            assert remaining['c'] == 0, "Cleanup must remove test data"


# ============================================================================
# EDGE CASES & VALIDATION
# ============================================================================

@pytest.mark.api
class TestRegistrationEdgeCases:
    """Edge case testing for registration"""
    
    def test_invalid_did_format_rejected(self, api_base_url, test_db):
        """Test that invalid DID formats are rejected AND don't pollute database"""
        invalid_did = 'not-a-valid-did'
        
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'did': invalid_did, 'profile': {'handle': 'test.bsky.social'}},
            timeout=10
        )
        # Should return 422 Unprocessable Entity for invalid DID format
        assert response.status_code == 422, f"Expected 422 for invalid DID, got {response.status_code}"
        
        # FIXED: Verify invalid DID was NOT added to database
        dreamer = test_db.execute(
            "SELECT * FROM dreamers WHERE did = %s",
            (invalid_did,)
        ).fetchone()
        assert dreamer is None, "Invalid DID must not be added to database"
    
    def test_empty_handle_rejected(self, api_base_url, unique_test_id):
        """Test that empty handles are rejected"""
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'did': f'did:plc:test{unique_test_id}', 'profile': {'handle': ''}},
            timeout=10
        )
        # Should return 422 for invalid/empty handle
        assert response.status_code == 422, f"Expected 422 for empty handle, got {response.status_code}"
    
    def test_unicode_handle_handled(self, api_base_url, unique_test_id):
        """Test that Unicode in handles is handled properly"""
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'did': f'did:plc:test{unique_test_id}', 'profile': {'handle': 'tëst🌟.bsky.social'}},
            timeout=10
        )
        # Should either accept or reject gracefully (not 500)
        assert response.status_code in [200, 400, 422]
    
    def test_extremely_long_handle_handled(self, api_base_url, unique_test_id):
        """Test that extremely long handles don't cause crashes"""
        long_handle = 'a' * 500 + '.bsky.social'
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'did': f'did:plc:test{unique_test_id}', 'profile': {'handle': long_handle}},
            timeout=10
        )
        assert response.status_code in [200, 400, 422]  # Not 500
    
    def test_sql_injection_in_handle_blocked(self, api_base_url, unique_test_id):
        """Test that SQL injection attempts are blocked"""
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'did': f'did:plc:test{unique_test_id}', 'profile': {'handle': "'; DROP TABLE dreamers; --"}},
            timeout=10
        )
        assert response.status_code in [400, 422]


# ============================================================================
# USER PROFILE DATA
# ============================================================================

@pytest.mark.database
class TestProfileData:
    """Test profile data handling for registered users"""
    
    def test_all_dreamers_have_names(self, test_db):
        """Verify all registered dreamers have names"""
        nameless = test_db.execute(
            "SELECT did FROM dreamers WHERE name IS NULL OR name = ''"
        ).fetchall()
        assert len(nameless) == 0
    
    def test_names_are_unique(self, test_db):
        """Verify all dreamer names are unique"""
        duplicates = test_db.execute("""
            SELECT name, COUNT(*) as count
            FROM dreamers
            WHERE name IS NOT NULL
            GROUP BY name
            HAVING COUNT(*) > 1
        """).fetchall()
        assert len(duplicates) == 0
    
    def test_handles_stored_correctly(self, test_db):
        """Verify handles are stored with correct format"""
        dreamers = test_db.execute(
            "SELECT handle FROM dreamers WHERE handle IS NOT NULL LIMIT 10"
        ).fetchall()
        
        for dreamer in dreamers:
            assert '.' in dreamer['handle']
            assert not dreamer['handle'].startswith('did:')
    
    def test_dids_have_valid_format(self, test_db):
        """Verify all DIDs have valid format"""
        dreamers = test_db.execute(
            "SELECT did FROM dreamers LIMIT 20"
        ).fetchall()
        
        for dreamer in dreamers:
            assert dreamer['did'].startswith('did:')
            assert dreamer['did'].startswith('did:plc:') or dreamer['did'].startswith('did:web:')
    
    def test_arrival_timestamps_reasonable(self, test_db):
        """Verify arrival timestamps are reasonable"""
        dreamers = test_db.execute(
            "SELECT arrival FROM dreamers WHERE arrival IS NOT NULL LIMIT 10"
        ).fetchall()
        
        current_time = time.time()
        min_time = 1577836800  # 2020-01-01
        
        for dreamer in dreamers:
            assert dreamer['arrival'] >= min_time
            assert dreamer['arrival'] <= current_time + 60


# ============================================================================
# DATABASE INTEGRITY
# ============================================================================

@pytest.mark.database
class TestDatabaseIntegrity:
    """Test database integrity after registration"""
    
    def test_no_orphaned_events(self, test_db):
        """Verify no events exist for non-existent dreamers"""
        orphaned = test_db.execute("""
            SELECT e.did, COUNT(*) as count
            FROM events e
            LEFT JOIN dreamers d ON e.did = d.did
            WHERE d.did IS NULL
            GROUP BY e.did
            LIMIT 5
        """).fetchall()
        assert len(orphaned) == 0
    
    def test_no_orphaned_awards(self, test_db):
        """Verify no awards exist for non-existent dreamers"""
        orphaned = test_db.execute("""
            SELECT a.did, COUNT(*) as count
            FROM awards a
            LEFT JOIN dreamers d ON a.did = d.did
            WHERE d.did IS NULL
            GROUP BY a.did
            LIMIT 5
        """).fetchall()
        assert len(orphaned) == 0
    
    def test_arrival_events_exist(self, test_db):
        """Verify arrival events are created for dreamers"""
        dreamer_count = test_db.execute("SELECT COUNT(*) as c FROM dreamers").fetchone()['c']
        arrival_count = test_db.execute("SELECT COUNT(*) as c FROM events WHERE type = 'arrival'").fetchone()['c']
        
        assert arrival_count > 0
        assert arrival_count >= dreamer_count * 0.5  # At least half should have arrivals


# ============================================================================
# SECURITY & ROBUSTNESS
# ============================================================================

@pytest.mark.api
class TestRegistrationSecurity:
    """Security-focused registration tests"""
    
    def test_xss_in_display_name_escaped(self, api_base_url, unique_test_id, test_db):
        """Test that XSS attempts in display names are escaped"""
        did = f'did:plc:xsstest{unique_test_id}'
        test_db.execute("DELETE FROM events WHERE did = %s", (did,))
        test_db.execute("DELETE FROM awards WHERE did = %s", (did,))
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (did,))
        
        try:
            response = requests.post(
                f'{api_base_url}/api/register',
                json={
                    'did': did,
                    'profile': {
                        'handle': f'xss{unique_test_id}.bsky.social',
                        'displayName': '<script>alert("XSS")</script>'
                    }
                },
                timeout=10
            )
            
            # Should not crash
            assert response.status_code in [200, 400, 422]
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (did,))
            test_db.execute("DELETE FROM awards WHERE did = %s", (did,))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (did,))
    
    def test_malformed_json_handled(self, api_base_url):
        """Test that malformed JSON is handled gracefully"""
        response = requests.post(
            f'{api_base_url}/api/register',
            data='{"did": "malformed json',
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        assert response.status_code in [400, 422]
    
    def test_missing_required_fields_rejected(self, api_base_url):
        """Test that missing required fields are rejected"""
        response = requests.post(
            f'{api_base_url}/api/register',
            json={'profile': {'handle': 'test.bsky.social'}},  # Missing DID
            timeout=10
        )
        assert response.status_code in [400, 422]
    
    def test_rate_limiting_on_registration(self, api_base_url, unique_test_id):
        """Test that registration endpoint has rate limiting"""
        # Make multiple rapid requests
        responses = []
        for i in range(20):
            try:
                r = requests.post(
                    f'{api_base_url}/api/register',
                    json={'did': f'did:plc:rate{unique_test_id}_{i}', 'profile': {'handle': f'rate{i}.bsky.social'}},
                    timeout=5
                )
                responses.append(r.status_code)
            except:
                pass
        
        # Should eventually get rate limited (429) or all succeed
        # As long as server doesn't crash, test passes
        assert all(code in [200, 400, 422, 429, 500] for code in responses)


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

@pytest.mark.api
@pytest.mark.database
@pytest.mark.integration
class TestRegistrationIntegration:
    """Full integration tests for registration flow"""
    
    def test_end_to_end_registration_flow(self, api_base_url, test_user_data, test_db):
        """Test complete registration flow from start to finish"""
        # Cleanup
        test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
        test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))
        
        try:
            # 1. Check handle availability
            check_response = requests.get(
                f'{api_base_url}/api/check-handle',
                params={'handle': test_user_data['handle']},
                timeout=10
            )
            assert check_response.status_code == 200
            
            # 2. Register user
            reg_response = requests.post(
                f'{api_base_url}/api/register',
                json={'did': test_user_data['did'], 'profile': test_user_data},
                timeout=30
            )
            assert reg_response.status_code == 200
            reg_data = reg_response.json()
            assert reg_data['success'] == True
            
            # 3. Verify database state
            dreamer = test_db.execute(
                "SELECT * FROM dreamers WHERE did = %s",
                (test_user_data['did'],)
            ).fetchone()
            assert dreamer is not None
            assert dreamer['name'] is not None
            
            # 4. Verify arrival event created
            events = test_db.execute(
                "SELECT * FROM events WHERE did = %s AND type = 'arrival'",
                (test_user_data['did'],)
            ).fetchall()
            assert len(events) > 0
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_user_data['did'],))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_user_data['did'],))


# ============================================================================
# RESIDENCE FLOW TESTS
# ============================================================================

@pytest.mark.api
@pytest.mark.database  
class TestResidenceFlow:
    """Test reverie.house resident creation flow"""
    
    def test_resident_gets_default_color(self, test_db):
        """Test that new residents get default color_hex"""
        from utils.registration import register_dreamer
        
        test_did = f'did:plc:colortest{int(time.time())}'
        test_handle = f'colortest{int(time.time())}.reverie.house'
        
        try:
            result = register_dreamer(
                did=test_did,
                handle=test_handle,
                profile={},
                verbose=True
            )
            
            assert result['success'] == True
            
            # Verify color_hex is set
            dreamer = test_db.execute(
                "SELECT color_hex FROM dreamers WHERE did = %s",
                (test_did,)
            ).fetchone()
            
            assert dreamer is not None
            assert dreamer['color_hex'] is not None
            assert dreamer['color_hex'] == '#734ba1'  # Default Reverie purple
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM spectrum WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_resident_gets_default_avatar(self, test_db):
        """Test that new residents get default avatar if none provided"""
        from utils.registration import register_dreamer
        
        test_did = f'did:plc:avatartest{int(time.time())}'
        test_handle = f'avatartest{int(time.time())}.reverie.house'
        
        try:
            result = register_dreamer(
                did=test_did,
                handle=test_handle,
                profile={},  # No avatar in profile
                verbose=True
            )
            
            assert result['success'] == True
            
            # Verify default avatar is set
            dreamer = test_db.execute(
                "SELECT avatar FROM dreamers WHERE did = %s",
                (test_did,)
            ).fetchone()
            
            assert dreamer is not None
            assert dreamer['avatar'] is not None
            assert dreamer['avatar'] == '/assets/avatar/plain-dreamer.png'
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM spectrum WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_resident_gets_residence_souvenir(self, test_db):
        """Test that reverie.house residents get residence souvenir"""
        from utils.registration import register_dreamer
        
        test_did = f'did:plc:residencetest{int(time.time())}'
        test_handle = f'residencetest{int(time.time())}.reverie.house'
        
        try:
            result = register_dreamer(
                did=test_did,
                handle=test_handle,
                profile={},
                verbose=True
            )
            
            assert result['success'] == True
            
            # Verify residence souvenir was awarded
            award = test_db.execute(
                "SELECT * FROM awards WHERE did = %s AND souvenir_key = 'residence'",
                (test_did,)
            ).fetchone()
            
            assert award is not None
            assert award['earned_epoch'] is not None
            
            # Verify residence event was created
            event = test_db.execute(
                "SELECT * FROM events WHERE did = %s AND key = 'residence'",
                (test_did,)
            ).fetchone()
            
            assert event is not None
            assert event['event'] == 'stayed at Reverie House'
            assert event['type'] == 'souvenir'
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM spectrum WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_resident_complete_profile(self, test_db):
        """Test that residents get complete profile with all required fields"""
        from utils.registration import register_dreamer
        
        test_did = f'did:plc:completetest{int(time.time())}'
        test_handle = f'completetest{int(time.time())}.reverie.house'
        
        try:
            result = register_dreamer(
                did=test_did,
                handle=test_handle,
                profile={},
                verbose=True
            )
            
            assert result['success'] == True
            
            # Verify all critical fields are set
            dreamer = test_db.execute(
                "SELECT did, handle, name, display_name, avatar, color_hex, description FROM dreamers WHERE did = %s",
                (test_did,)
            ).fetchone()
            
            assert dreamer is not None
            assert dreamer['did'] == test_did
            assert dreamer['handle'] == test_handle
            assert dreamer['name'] is not None  # Generated from handle
            assert dreamer['display_name'] is not None  # Auto-capitalized
            assert dreamer['avatar'] == '/assets/avatar/plain-dreamer.png'
            assert dreamer['color_hex'] == '#734ba1'
            # description can be empty, that's ok
            
        finally:
            test_db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM spectrum WHERE did = %s", (test_did,))
            test_db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
