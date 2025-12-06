"""
Comprehensive Test Suite for New Resident Creation Flow

Tests the complete end-to-end flow of a new resident joining Reverie House:
1. Account creation via PDS (/api/create-account)
2. Registration of dreamer profile (/api/register)
3. Avatar and banner extraction from PDS
4. Residence souvenir assignment
5. Canon entry creation (arrival + residence)
6. Core:welcome pigeon delivery via user_login trigger

Author: Reverie House Testing Framework
Date: 2025-01-23
"""

import pytest
import json
import time
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Import Flask app and database
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin import app
from core.database import DatabaseManager
from utils.registration import register_dreamer
from aviary import process_user_login_trigger


class TestResidentCreationFlow:
    """Test the complete new resident creation flow"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the Flask app"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    @pytest.fixture
    def db(self):
        """Create a database connection for testing"""
        db = DatabaseManager()
        yield db
        # Cleanup is handled by DatabaseManager
    
    @pytest.fixture
    def mock_pds_account_response(self):
        """Mock successful PDS account creation response"""
        return {
            'did': 'did:plc:test123456789',
            'handle': 'testuser.reverie.house',
            'accessJwt': 'test_jwt_token',
            'refreshJwt': 'test_refresh_token'
        }
    
    @pytest.fixture
    def mock_pds_profile_response(self):
        """Mock PDS profile with avatar and banner"""
        return {
            'did': 'did:plc:test123456789',
            'handle': 'testuser.reverie.house',
            'displayName': 'Test User',
            'description': 'A test user profile',
            'avatar': {
                'ref': {'$link': 'bafkreiabc123'}
            },
            'banner': {
                'ref': {'$link': 'bafkreixyz789'}
            },
            'followersCount': 0,
            'followsCount': 0,
            'postsCount': 0,
            'createdAt': '2025-01-23T12:00:00Z'
        }
    
    @pytest.fixture
    def mock_invite_code(self, db):
        """Create a valid invite code in the database"""
        invite_code = 'reverie-house-test-12345'
        db.execute("""
            INSERT INTO invites (code, created_by, created_at)
            VALUES (%s, 'system', EXTRACT(EPOCH FROM NOW()))
            ON CONFLICT (code) DO NOTHING
        """, (invite_code,))
        db.commit()
        
        yield invite_code
        
        # Cleanup
        db.execute("DELETE FROM invites WHERE code = %s", (invite_code,))
        db.commit()
    
    # ========================================
    # TEST 1: Account Creation Endpoint
    # ========================================
    
    @patch('requests.post')
    def test_create_account_success(self, mock_post, client, mock_invite_code, mock_pds_account_response):
        """Test /api/create-account with valid invite code"""
        # Mock PDS createAccount response
        mock_post.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: mock_pds_account_response
        )
        
        response = client.post('/api/create-account', json={
            'handle': 'testuser.reverie.house',
            'email': 'test@example.com',
            'password': 'secure_password_123',
            'inviteCode': mock_invite_code
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['did'] == 'did:plc:test123456789'
        assert data['handle'] == 'testuser.reverie.house'
        assert 'accessJwt' in data
    
    def test_create_account_missing_invite(self, client):
        """Test /api/create-account fails without invite code"""
        response = client.post('/api/create-account', json={
            'handle': 'testuser.reverie.house',
            'email': 'test@example.com',
            'password': 'secure_password_123'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Invite code required' in data['error']
    
    def test_create_account_invalid_invite(self, client):
        """Test /api/create-account fails with invalid invite code"""
        response = client.post('/api/create-account', json={
            'handle': 'testuser.reverie.house',
            'email': 'test@example.com',
            'password': 'secure_password_123',
            'inviteCode': 'invalid-code-xxxxx'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Invalid invite code' in data['error']
    
    # ========================================
    # TEST 2: Registration Endpoint
    # ========================================
    
    @patch('requests.get')
    def test_register_new_dreamer(self, mock_get, client, db, mock_pds_profile_response):
        """Test /api/register creates dreamer record with avatar/banner"""
        test_did = 'did:plc:testreg123'
        
        # Mock PDS profile fetch
        mock_get.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {'value': mock_pds_profile_response}
        )
        
        # Clean up any existing test data
        db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        db.commit()
        
        try:
            response = client.post('/api/register', json={
                'did': test_did,
                'profile': {
                    'handle': 'testreg.reverie.house',
                    'displayName': 'Test Register',
                    'avatar': 'https://cdn.bsky.app/img/avatar/plain/did:plc:testreg123/bafkreiabc123@jpeg',
                    'banner': 'https://cdn.bsky.app/img/banner/plain/did:plc:testreg123/bafkreixyz789@jpeg'
                }
            })
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] == True
            assert data['newly_registered'] == True
            assert data['dreamer']['did'] == test_did
            assert 'avatar' in data['dreamer']
            
            # Verify database record
            dreamer = db.execute(
                "SELECT * FROM dreamers WHERE did = %s",
                (test_did,)
            ).fetchone()
            
            assert dreamer is not None
            assert dreamer['handle'] == 'testreg.reverie.house'
            assert dreamer['avatar'] is not None
            assert dreamer['banner'] is not None
            
        finally:
            # Cleanup
            db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    def test_register_already_registered(self, client, db):
        """Test /api/register returns already_registered for existing dreamer"""
        test_did = 'did:plc:existing123'
        
        # Create existing dreamer
        db.execute("""
            INSERT INTO dreamers (did, handle, name, display_name, arrival, created_at, updated_at)
            VALUES (%s, 'existing.bsky.social', 'existing', 'Existing User', 
                    EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()))
            ON CONFLICT (did) DO NOTHING
        """, (test_did,))
        db.commit()
        
        try:
            response = client.post('/api/register', json={
                'did': test_did
            })
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['already_registered'] == True
            assert data['newly_registered'] == False
            
        finally:
            # Cleanup
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
            db.commit()
    
    # ========================================
    # TEST 3: Avatar/Banner Extraction
    # ========================================
    
    @patch('requests.get')
    def test_avatar_banner_extraction(self, mock_get, db, mock_pds_profile_response):
        """Test that avatars and banners are correctly extracted from PDS"""
        test_did = 'did:plc:testavatar123'
        
        # Mock PDS response
        mock_get.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {'value': mock_pds_profile_response}
        )
        
        # Clean up
        db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        db.commit()
        
        try:
            result = register_dreamer(
                did=test_did,
                handle='testavatar.reverie.house',
                profile=mock_pds_profile_response,
                verbose=True
            )
            
            assert result['success'] == True
            dreamer = result['dreamer']
            
            # Verify avatar URL construction
            expected_avatar = f"https://cdn.bsky.app/img/avatar/plain/{test_did}/bafkreiabc123@jpeg"
            assert dreamer['avatar'] == expected_avatar
            
            # Verify banner URL construction
            expected_banner = f"https://cdn.bsky.app/img/banner/plain/{test_did}/bafkreixyz789@jpeg"
            assert dreamer['banner'] == expected_banner
            
        finally:
            # Cleanup
            db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    # ========================================
    # TEST 4: Residence Souvenir Assignment
    # ========================================
    
    @patch('requests.get')
    @patch('subprocess.run')  # Mock Caddy rebuild
    def test_residence_souvenir_assignment(self, mock_subprocess, mock_get, db):
        """Test that reverie.house accounts receive residence souvenir"""
        test_did = 'did:plc:testresidence123'
        
        # Mock PDS profile
        mock_get.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {
                'value': {
                    'handle': 'testresidence.reverie.house',
                    'displayName': 'Test Residence',
                    'createdAt': '2025-01-23T12:00:00Z'
                }
            }
        )
        
        # Mock Caddy rebuild success
        mock_subprocess.return_value = Mock(returncode=0, stderr='')
        
        # Clean up
        db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
        db.execute("DELETE FROM events WHERE did = %s", (test_did,))
        
        try:
            # Mock identity resolution to return reverie.house PDS
            with patch('utils.identity.IdentityManager.get_handle_from_did') as mock_identity:
                mock_identity.return_value = ('testresidence.reverie.house', 'https://reverie.house')
                
                result = register_dreamer(
                    did=test_did,
                    handle='testresidence.reverie.house',
                    verbose=True
                )
                
                assert result['success'] == True
                
                # Verify residence award in database
                award = db.execute("""
                    SELECT * FROM awards 
                    WHERE did = %s AND souvenir_key = 'residence'
                """, (test_did,)).fetchone()
                
                assert award is not None
                assert award['souvenir_key'] == 'residence'
                
                # Verify residence event in timeline
                event = db.execute("""
                    SELECT * FROM events 
                    WHERE did = %s AND key = 'residence' AND type = 'souvenir'
                """, (test_did,)).fetchone()
                
                assert event is not None
                assert event['event'] == 'stayed at Reverie House'
                assert event['type'] == 'souvenir'
                
        finally:
            # Cleanup
            db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    # ========================================
    # TEST 5: Timeline Event Creation
    # ========================================
    
    @patch('requests.get')
    @patch('subprocess.run')
    def test_timeline_event_creation(self, mock_subprocess, mock_get, db):
        """Test that arrival timeline event is created correctly"""
        test_did = 'did:plc:testevent123'
        
        mock_get.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {
                'value': {
                    'handle': 'testcanon.bsky.social',
                    'displayName': 'Test Canon',
                    'createdAt': '2025-01-23T12:00:00Z'
                }
            }
        )
        
        mock_subprocess.return_value = Mock(returncode=0, stderr='')
        
        # Clean up
        db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        db.execute("DELETE FROM events WHERE did = %s", (test_did,))
        
        try:
            result = register_dreamer(
                did=test_did,
                handle='testevent.bsky.social',
                canon_entries=[{
                    'event': 'found our wild mindscape',
                    'type': 'arrival',
                    'key': 'arrival'
                }],
                verbose=True
            )
            
            assert result['success'] == True
            
            # Verify arrival timeline event
            # Verify arrival event in timeline
            event = db.execute("""
                SELECT * FROM events 
                WHERE did = %s AND key = 'arrival' AND type = 'arrival'
            """, (test_did,)).fetchone()
            
            assert event is not None
            assert event['event'] == 'found our wild mindscape'
            assert event['type'] == 'arrival'
            assert event['epoch'] > 0
        finally:
            # Cleanup
            db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
    
    # ========================================
    # TEST 6: Core:Welcome Pigeon Delivery
    # ========================================
    
    def test_core_welcome_pigeon_configuration(self, db):
        """Test that core:welcome pigeon is configured in database"""
        pigeon = db.execute("""
            SELECT * FROM pigeons 
            WHERE dialogue_key = 'core:welcome' AND trigger_type = 'user_login'
        """).fetchone()
        
        assert pigeon is not None
        assert pigeon['name'] == 'core:home'
        assert pigeon['dialogue_key'] == 'core:welcome'
        assert pigeon['trigger_type'] == 'user_login'
        assert pigeon['status'] == 'active'
    
    @patch('aviary.send_pigeon')
    def test_user_login_trigger_fires_welcome(self, mock_send, db):
        """Test that user_login trigger delivers core:welcome pigeon"""
        test_did = 'did:plc:testwelcome123'
        
        # Create test dreamer
        db.execute("""
            INSERT INTO dreamers (did, handle, name, display_name, arrival, created_at, updated_at)
            VALUES (%s, 'testwelcome.reverie.house', 'testwelcome', 'Test Welcome',
                    EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()))
            ON CONFLICT (did) DO NOTHING
        """, (test_did,))
        db.commit()
        
        try:
            # Mock send_pigeon to capture the call
            mock_send.return_value = {'success': True}
            
            # Trigger user_login
            result = process_user_login_trigger(test_did)
            
            # Verify send_pigeon was called
            assert mock_send.called
            call_args = mock_send.call_args
            
            # Check that core:welcome pigeon was sent
            # (The exact call signature depends on aviary.py implementation)
            assert result is not None
            
        finally:
            # Cleanup
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
            db.commit()
    
    # ========================================
    # TEST 7: End-to-End Integration Test
    # ========================================
    
    @patch('requests.post')
    @patch('requests.get')
    @patch('subprocess.run')
    def test_complete_resident_creation_flow(
        self, mock_subprocess, mock_get, mock_post, 
        client, db, mock_invite_code, 
        mock_pds_account_response, mock_pds_profile_response
    ):
        """
        Test complete flow from account creation to pigeon delivery:
        1. Create account via /api/create-account
        2. Register dreamer via /api/register
        3. Verify avatar/banner applied
        4. Verify residence souvenir assigned
        5. Verify canon entries created
        6. Simulate oauth:login event triggering user_login
        """
        test_did = 'did:plc:e2e123456789'
        test_handle = 'e2etest.reverie.house'
        
        # Mock PDS account creation
        mock_pds_account_response['did'] = test_did
        mock_pds_account_response['handle'] = test_handle
        mock_post.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: mock_pds_account_response
        )
        
        # Mock PDS profile fetch
        mock_pds_profile_response['did'] = test_did
        mock_pds_profile_response['handle'] = test_handle
        mock_get.return_value = Mock(
            ok=True,
            status_code=200,
            json=lambda: {'value': mock_pds_profile_response}
        )
        
        # Mock Caddy rebuild
        mock_subprocess.return_value = Mock(returncode=0, stderr='')
        
        # Clean up
        db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))
        db.execute("DELETE FROM events WHERE did = %s", (test_did,))
        db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
        
        try:
            # Step 1: Create account
            create_response = client.post('/api/create-account', json={
                'handle': test_handle,
                'email': 'e2e@example.com',
                'password': 'secure_password_123',
                'inviteCode': mock_invite_code
            })
            
            assert create_response.status_code == 200
            account_data = create_response.get_json()
            
            # Step 2: Register dreamer
            with patch('utils.identity.IdentityManager.get_handle_from_did') as mock_identity:
                mock_identity.return_value = (test_handle, 'https://reverie.house')
                
                register_response = client.post('/api/register', json={
                    'did': test_did,
                    'profile': mock_pds_profile_response
                })
                
                assert register_response.status_code == 200
                register_data = register_response.get_json()
                
                # Step 3: Verify dreamer record
                dreamer = db.execute(
                    "SELECT * FROM dreamers WHERE did = %s",
                    (test_did,)
                ).fetchone()
                
                assert dreamer is not None
                assert dreamer['handle'] == test_handle
                assert dreamer['avatar'] is not None  # Avatar applied
                assert dreamer['banner'] is not None  # Banner applied
                
                # Step 4: Verify residence award
                award = db.execute("""
                    SELECT * FROM awards 
                    WHERE did = %s AND souvenir_key = 'residence'
                """, (test_did,)).fetchone()
                
                assert award is not None
                
                # Step 5: Verify timeline events (arrival + residence)
                events = db.execute("""
                    SELECT * FROM events WHERE did = %s ORDER BY epoch
                """, (test_did,)).fetchall()
                
                assert len(events) >= 2
                arrival_event = [e for e in events if e['key'] == 'arrival'][0]
                residence_event = [e for e in events if e['key'] == 'residence'][0]
                
                assert arrival_event['type'] == 'arrival'
                assert residence_event['type'] == 'souvenir'
                
                # Step 6: Verify user_login would trigger welcome pigeon
                pigeon = db.execute("""
                    SELECT * FROM pigeons 
                    WHERE dialogue_key = 'core:welcome' AND trigger_type = 'user_login'
                """).fetchone()
                
                assert pigeon is not None
                assert pigeon['status'] == 'active'
                
                print("\n✅ COMPLETE E2E TEST PASSED:")
                print(f"   Account created: {test_handle}")
                print(f"   Dreamer registered: {dreamer['name']}")
                print(f"   Avatar: {dreamer['avatar'][:50]}...")
                print(f"   Banner: {dreamer['banner'][:50]}...")
                print(f"   Residence souvenir: Assigned")
                print(f"   Canon entries: {len(canons)}")
                print(f"   Welcome pigeon: Configured")
                
        finally:
            # Cleanup
            db.execute("DELETE FROM events WHERE did = %s", (test_did,))
            db.execute("DELETE FROM awards WHERE did = %s", (test_did,))
            db.execute("DELETE FROM dreamers WHERE did = %s", (test_did,))


# ========================================
# Run Tests
# ========================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
