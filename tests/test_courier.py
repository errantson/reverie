#!/usr/bin/env python3
"""
Comprehensive Test Suite for Courier System
Tests scheduling, delivery, encryption, and error handling

SAFETY NOTES:
- Unit tests (marked with @pytest.mark.unit) use mocked dependencies
- Integration tests (marked with @pytest.mark.integration) connect to real services
- NEVER run integration tests against production database
- Run unit tests with: pytest -m unit tests/test_courier.py
"""

import pytest
import time
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import requests

# Add parent directory to path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.courier import (
    get_pending_posts,
    send_post,
    detect_facets_in_text,
    create_lore_entry,
    run_courier_service
)
from core.database import DatabaseManager
from core.encryption import encrypt_password, decrypt_password


@pytest.mark.unit
class TestFacetDetection:
    """Test automatic detection of links and mentions in text"""
    
    def test_detect_simple_url(self):
        """Should detect https URLs"""
        text = "Check out https://example.com for more info"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 1
        assert facets[0]['features'][0]['$type'] == 'app.bsky.richtext.facet#link'
        assert facets[0]['features'][0]['uri'] == 'https://example.com'
    
    def test_detect_url_without_protocol(self):
        """Should add https:// to URLs without protocol"""
        text = "Visit example.com for details"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 1
        assert facets[0]['features'][0]['uri'] == 'https://example.com'
    
    def test_detect_www_url(self):
        """Should handle www URLs"""
        text = "Go to www.example.com"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 1
        assert facets[0]['features'][0]['uri'] == 'https://www.example.com'
    
    def test_detect_multiple_urls(self):
        """Should detect multiple URLs in one text"""
        text = "Visit https://example.com and www.test.com"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 2
        assert all(f['features'][0]['$type'] == 'app.bsky.richtext.facet#link' for f in facets)
    
    @patch('core.courier.requests.get')
    def test_detect_mention(self, mock_get):
        """Should detect and resolve @mentions"""
        # Mock DID resolution
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'did': 'did:plc:test123'}
        mock_get.return_value = mock_response
        
        text = "Hello @alice.bsky.social"
        facets = detect_facets_in_text(text)
        
        # Should detect mention (may also detect the handle as a link)
        mention_facets = [f for f in facets if f['features'][0]['$type'] == 'app.bsky.richtext.facet#mention']
        assert len(mention_facets) >= 1
        assert mention_facets[0]['features'][0]['did'] == 'did:plc:test123'
    
    @patch('core.courier.requests.get')
    def test_mention_resolution_failure(self, mock_get):
        """Should skip mentions that fail to resolve"""
        mock_get.side_effect = Exception("Network error")
        
        text = "Hello @invalid.user"
        facets = detect_facets_in_text(text)
        
        # Should not have mention facet (may still detect as link)
        mention_facets = [f for f in facets if f['features'][0]['$type'] == 'app.bsky.richtext.facet#mention']
        assert len(mention_facets) == 0
    
    def test_detect_mixed_content(self):
        """Should detect both URLs and mentions together"""
        text = "Hey @alice check https://example.com"
        
        with patch('core.courier.requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {'did': 'did:plc:test123'}
            mock_get.return_value = mock_response
            
            facets = detect_facets_in_text(text)
            
            # Should have both link and mention
            types = [f['features'][0]['$type'] for f in facets]
            assert 'app.bsky.richtext.facet#link' in types
            assert 'app.bsky.richtext.facet#mention' in types
    
    def test_byte_position_calculation(self):
        """Should calculate correct byte positions for multi-byte characters"""
        text = "Visit 🎨 https://example.com 🌟"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 1
        # Verify that byte positions account for emoji (4 bytes each)
        assert facets[0]['index']['byteStart'] > 0
        assert facets[0]['index']['byteEnd'] > facets[0]['index']['byteStart']
    
    def test_no_facets_in_plain_text(self):
        """Should return empty list for text with no links or mentions"""
        text = "This is just plain text with no special content"
        facets = detect_facets_in_text(text)
        
        assert facets == []


@pytest.mark.unit
class TestEncryptionDecryption:
    """Test post text encryption/decryption"""
    
    def test_encrypt_decrypt_roundtrip(self):
        """Should successfully encrypt and decrypt text"""
        original = "This is my secret post!"
        encrypted = encrypt_password(original)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == original
        assert encrypted != original  # Ensure it's actually encrypted
    
    def test_encrypt_unicode(self):
        """Should handle unicode characters"""
        original = "Hello 世界 🌍 مرحبا"
        encrypted = encrypt_password(original)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == original
    
    def test_encrypt_empty_string(self):
        """Should handle empty strings gracefully"""
        original = ""
        
        # Empty string encryption may not be supported
        try:
            encrypted = encrypt_password(original)
            decrypted = decrypt_password(encrypted)
            assert decrypted == original
        except ValueError as e:
            # If encryption doesn't support empty strings, that's OK
            assert "empty" in str(e).lower()
    
    def test_encrypt_long_text(self):
        """Should handle text at max length (300 chars)"""
        original = "x" * 300
        encrypted = encrypt_password(original)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == original
        assert len(decrypted) == 300


@pytest.mark.database
@pytest.mark.integration
class TestDatabaseOperations:
    """Test courier database operations
    
    WARNING: These tests connect to real database.
    Only run in isolated test environment, NOT production.
    """
    
    @pytest.fixture
    def db(self):
        """Provide database instance"""
        return DatabaseManager()
    
    @pytest.fixture
    def test_user_did(self):
        """Provide test user DID"""
        return "did:plc:test_courier_user_123"
    
    @pytest.mark.integration
    def test_insert_scheduled_post(self, db, test_user_did):
        """Should insert scheduled post into database"""
        post_text = "Test scheduled post"
        encrypted_text = encrypt_password(post_text)
        scheduled_for = int(time.time()) + 3600  # 1 hour from now
        
        with db.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO courier 
                (did, post_text_encrypted, scheduled_for, created_at, status)
                VALUES (%s, %s, %s, %s, 'pending')
                RETURNING id
            ''', (test_user_did, encrypted_text, scheduled_for, int(time.time())))
            
            result = cursor.fetchone()
            courier_id = result['id']
        
        assert courier_id is not None
        
        # Verify it was inserted
        verify = db.fetch_one(
            'SELECT * FROM courier WHERE id = %s',
            (courier_id,)
        )
        
        assert verify is not None
        assert verify['did'] == test_user_did
        assert verify['status'] == 'pending'
        
        # Cleanup
        db.execute('DELETE FROM courier WHERE id = %s', (courier_id,))
    
    def test_query_pending_posts(self, db, test_user_did):
        """Should retrieve pending posts ready to send"""
        # Insert test post
        post_text = "Ready to send"
        encrypted_text = encrypt_password(post_text)
        scheduled_for = int(time.time()) - 60  # 1 minute ago (ready)
        
        with db.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO courier 
                (did, post_text_encrypted, scheduled_for, created_at, status)
                VALUES (%s, %s, %s, %s, 'pending')
                RETURNING id
            ''', (test_user_did, encrypted_text, scheduled_for, int(time.time())))
            result = cursor.fetchone()
            courier_id = result['id']
        
        # Note: get_pending_posts requires valid credentials, so we test the query directly
        now = int(time.time())
        posts = db.fetch_all('''
            SELECT id, did, post_text_encrypted, scheduled_for, status
            FROM courier
            WHERE status = 'pending' AND scheduled_for <= %s AND id = %s
        ''', (now, courier_id))
        
        assert len(posts) >= 1
        found = any(p['id'] == courier_id for p in posts)
        assert found
        
        # Cleanup
        db.execute('DELETE FROM courier WHERE id = %s', (courier_id,))
    
    def test_update_post_status(self, db, test_user_did):
        """Should update post status after sending"""
        # Insert test post
        encrypted_text = encrypt_password("Test post")
        scheduled_for = int(time.time()) + 3600
        
        with db.transaction() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO courier 
                (did, post_text_encrypted, scheduled_for, created_at, status)
                VALUES (%s, %s, %s, %s, 'pending')
                RETURNING id
            ''', (test_user_did, encrypted_text, scheduled_for, int(time.time())))
            result = cursor.fetchone()
            courier_id = result['id']
        
        # Update to sent
        db.execute('''
            UPDATE courier
            SET status = 'sent', sent_at = %s
            WHERE id = %s
        ''', (int(time.time()), courier_id))
        
        # Verify update
        verify = db.fetch_one('SELECT status, sent_at FROM courier WHERE id = %s', (courier_id,))
        assert verify['status'] == 'sent'
        assert verify['sent_at'] is not None
        
        # Cleanup
        db.execute('DELETE FROM courier WHERE id = %s', (courier_id,))


@pytest.mark.unit
class TestPostDeliveryMocked:
    """Test post delivery with mocked dependencies (SAFE unit tests)"""
    
    @pytest.fixture
    def mock_post(self):
        """Create mock post object"""
        return {
            'id': 123,
            'did': 'did:plc:test123',
            'handle': 'test.bsky.social',
            'post_text_encrypted': encrypt_password("Test post"),
            'post_images': None,
            'scheduled_for': int(time.time()),
            'is_lore': False,
            'lore_type': None,
            'canon_id': None,
            'app_password_hash': encrypt_password('test-app-password'),
            'pds_url': 'https://bsky.social'
        }
    
    @patch('core.courier.requests.post')
    @patch('core.courier.DatabaseManager')
    def test_send_post_success(self, mock_db_class, mock_post_request, mock_post):
        """Should successfully send a post to PDS"""
        # Setup mocks
        mock_db = Mock()
        mock_db_class.return_value = mock_db
        
        # Mock session creation
        session_mock = Mock()
        session_mock.status_code = 200
        session_mock.json.return_value = {
            'accessJwt': 'fake_jwt_token',
            'did': 'did:plc:test123'
        }
        
        # Mock post creation
        post_mock = Mock()
        post_mock.status_code = 200
        post_mock.json.return_value = {
            'uri': 'at://did:plc:test123/app.bsky.feed.post/abc123',
            'cid': 'bafytest'
        }
        
        # Return session then post response
        mock_post_request.side_effect = [session_mock, post_mock]
        
        # Call send_post
        result = send_post(mock_post)
        
        # Verify success
        assert result is True
        assert mock_post_request.call_count == 2  # Session + create post
    
    @patch('core.courier.requests.post')
    @patch('core.courier.DatabaseManager')
    def test_send_post_with_images(self, mock_db_class, mock_post_request, mock_post):
        """Should upload images before creating post"""
        # Add images to post
        mock_post['post_images'] = json.dumps([{
            'dataUrl': 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            'alt': 'Test image',
            'mimeType': 'image/jpeg'
        }])
        
        # Setup mocks
        mock_db = Mock()
        mock_db_class.return_value = mock_db
        
        # Mock session
        session_mock = Mock()
        session_mock.status_code = 200
        session_mock.json.return_value = {
            'accessJwt': 'fake_jwt',
            'did': 'did:plc:test123'
        }
        
        # Mock image upload
        upload_mock = Mock()
        upload_mock.status_code = 200
        upload_mock.json.return_value = {
            'blob': {
                '$type': 'blob',
                'ref': {'$link': 'bafytest'},
                'mimeType': 'image/jpeg',
                'size': 12345
            }
        }
        
        # Mock post creation
        post_mock = Mock()
        post_mock.status_code = 200
        post_mock.json.return_value = {
            'uri': 'at://test',
            'cid': 'bafytest'
        }
        
        # Return session, upload, then post
        mock_post_request.side_effect = [session_mock, upload_mock, post_mock]
        
        result = send_post(mock_post)
        
        assert result is True
        assert mock_post_request.call_count == 3  # Session + upload + post
    
    @patch('core.courier.DatabaseManager')
    def test_send_post_no_credentials(self, mock_db_class, mock_post):
        """Should fail gracefully when credentials missing"""
        mock_db = Mock()
        mock_db_class.return_value = mock_db
        mock_db.fetch_one.return_value = None  # No credentials
        
        result = send_post(mock_post)
        
        assert result is False


@pytest.mark.integration
@pytest.mark.network
class TestPostDelivery:
    """Test the post delivery mechanism (requires real network/DB)
    
    WARNING: These are integration tests. Do not run in production.
    """
    
    @pytest.fixture
    def mock_post(self):
        """Create mock post object"""
        return {
            'id': 123,
            'did': 'did:plc:testuser',
            'handle': 'test.bsky.social',
            'post_text_encrypted': encrypt_password("Test post content"),
            'post_images': None,
            'is_lore': False,
            'lore_type': None,
            'canon_id': None,
            'app_password_hash': encrypt_password('test-app-password'),
            'pds_url': 'https://bsky.social'
        }
    
    @patch('core.courier.requests.post')
    def test_successful_post_delivery(self, mock_post_request, mock_post):
        """Should successfully deliver a post"""
        # Mock session creation
        session_response = Mock()
        session_response.status_code = 200
        session_response.json.return_value = {
            'accessJwt': 'fake_jwt_token',
            'did': mock_post['did']
        }
        
        # Mock post creation
        create_response = Mock()
        create_response.status_code = 200
        create_response.json.return_value = {
            'uri': 'at://did:plc:testuser/app.bsky.feed.post/abc123',
            'cid': 'bafyreiabc123'
        }
        
        mock_post_request.side_effect = [session_response, create_response]
        
        with patch('core.courier.DatabaseManager') as mock_db_class:
            mock_db = Mock()
            mock_db_class.return_value = mock_db
            
            result = send_post(mock_post)
            
            assert result is True
            assert mock_post_request.call_count == 2
            # Verify session creation call
            assert 'createSession' in mock_post_request.call_args_list[0][0][0]
            # Verify post creation call
            assert 'createRecord' in mock_post_request.call_args_list[1][0][0]
    
    @patch('core.courier.requests.post')
    def test_auth_failure_handling(self, mock_post_request, mock_post):
        """Should handle authentication failures gracefully"""
        # Mock failed session creation (401)
        session_response = Mock()
        session_response.status_code = 401
        session_response.json.return_value = {'error': 'Invalid credentials'}
        mock_post_request.return_value = session_response
        
        with patch('core.courier.DatabaseManager') as mock_db_class:
            mock_db = Mock()
            mock_db_class.return_value = mock_db
            
            result = send_post(mock_post)
            
            assert result is False
            # Verify that post status was updated to auth_failed
            assert mock_db.execute.called
            call_args = str(mock_db.execute.call_args_list)
            assert 'auth_failed' in call_args
    
    @patch('core.courier.requests.post')
    def test_post_creation_failure(self, mock_post_request, mock_post):
        """Should handle post creation failures"""
        # Mock successful session
        session_response = Mock()
        session_response.status_code = 200
        session_response.json.return_value = {
            'accessJwt': 'fake_jwt_token',
            'did': mock_post['did']
        }
        
        # Mock failed post creation
        create_response = Mock()
        create_response.status_code = 500
        create_response.text = 'Internal server error'
        mock_post_request.side_effect = [session_response, create_response]
        
        with patch('core.courier.DatabaseManager') as mock_db_class:
            mock_db = Mock()
            mock_db_class.return_value = mock_db
            
            result = send_post(mock_post)
            
            assert result is False
            # Verify error was recorded
            assert mock_db.execute.called
    
    @patch('core.courier.requests.post')
    def test_facet_detection_in_delivery(self, mock_post_request, mock_post):
        """Should detect facets when delivering post"""
        # Update post with URL and mention
        mock_post['post_text_encrypted'] = encrypt_password(
            "Check out https://example.com @alice.bsky.social"
        )
        
        session_response = Mock()
        session_response.status_code = 200
        session_response.json.return_value = {
            'accessJwt': 'fake_jwt',
            'did': mock_post['did']
        }
        
        create_response = Mock()
        create_response.status_code = 200
        create_response.json.return_value = {
            'uri': 'at://test/post/123',
            'cid': 'cid123'
        }
        
        mock_post_request.side_effect = [session_response, create_response]
        
        with patch('core.courier.DatabaseManager') as mock_db_class:
            mock_db = Mock()
            mock_db_class.return_value = mock_db
            
            with patch('core.courier.detect_facets_in_text') as mock_detect:
                mock_detect.return_value = [
                    {
                        'index': {'byteStart': 10, 'byteEnd': 30},
                        'features': [{'$type': 'app.bsky.richtext.facet#link', 'uri': 'https://example.com'}]
                    }
                ]
                
                result = send_post(mock_post)
                
                assert result is True
                # Verify facet detection was called
                assert mock_detect.called


class TestLoreIntegration:
    """Test lore label application"""
    
    @pytest.fixture
    def mock_lore_post(self):
        """Create mock lore post"""
        return {
            'id': 456,
            'did': 'did:plc:testuser',
            'handle': 'loremaster.bsky.social',
            'is_lore': True,
            'lore_type': 'world',
            'canon_id': None
        }
    
    @patch.dict(os.environ, {'LOREFARM_KEY': 'test_lore_api_key'})
    @patch('core.courier.requests.post')
    def test_lore_label_application(self, mock_post, mock_lore_post):
        """Should apply lore label via lore.farm API"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        post_uri = 'at://did:plc:testuser/app.bsky.feed.post/lore123'
        post_cid = 'bafyrei_lore'
        post_text = "This is lore content"
        
        create_lore_entry(mock_lore_post, post_uri, post_cid, post_text)
        
        # Verify lore API was called
        assert mock_post.called
        call_args = mock_post.call_args
        assert 'lore.farm' in call_args[0][0]
        assert 'Bearer test_lore_api_key' in str(call_args)
    
    @patch.dict(os.environ, {}, clear=True)
    def test_lore_missing_api_key(self, mock_lore_post):
        """Should raise error if LOREFARM_KEY not configured"""
        with pytest.raises(Exception, match="LOREFARM_KEY not configured"):
            create_lore_entry(
                mock_lore_post,
                'at://test/post/123',
                'cid123',
                'Test lore'
            )
    
    @patch.dict(os.environ, {'LOREFARM_KEY': 'test_key'})
    @patch('core.courier.requests.post')
    def test_lore_api_failure(self, mock_post, mock_lore_post):
        """Should raise error if lore API fails"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = 'Internal error'
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception, match="Lore label failed"):
            create_lore_entry(
                mock_lore_post,
                'at://test/post/123',
                'cid123',
                'Test lore'
            )


class TestServiceLoop:
    """Test the courier service polling loop"""
    
    @patch('core.courier.get_pending_posts')
    @patch('core.courier.send_post')
    @patch('core.courier.time.sleep')
    def test_service_processes_pending_posts(self, mock_sleep, mock_send, mock_get_pending):
        """Should process pending posts in service loop"""
        # Mock pending posts
        mock_get_pending.side_effect = [
            [{'id': 1, 'handle': 'user1'}, {'id': 2, 'handle': 'user2'}],
            []  # Second iteration returns nothing (to exit loop)
        ]
        mock_send.return_value = True
        
        # Make sleep raise exception after first iteration to exit loop
        def sleep_side_effect(seconds):
            if mock_sleep.call_count > 2:
                raise KeyboardInterrupt()
        
        mock_sleep.side_effect = sleep_side_effect
        
        try:
            run_courier_service(interval=1)
        except KeyboardInterrupt:
            pass
        
        # Verify posts were sent
        assert mock_send.call_count == 2
        assert mock_get_pending.call_count >= 1
    
    @patch('core.courier.get_pending_posts')
    @patch('core.courier.send_post')
    @patch('core.courier.time.sleep')
    def test_service_handles_errors_gracefully(self, mock_sleep, mock_send, mock_get_pending):
        """Should continue running after errors"""
        mock_get_pending.side_effect = [
            Exception("Database error"),  # First iteration fails
            []  # Second iteration succeeds
        ]
        
        # Exit after second iteration
        def sleep_side_effect(seconds):
            if mock_sleep.call_count > 1:
                raise KeyboardInterrupt()
        
        mock_sleep.side_effect = sleep_side_effect
        
        try:
            run_courier_service(interval=1)
        except KeyboardInterrupt:
            pass
        
        # Verify service didn't crash
        assert mock_get_pending.call_count >= 2
    
    @patch('core.courier.get_pending_posts')
    @patch('core.courier.send_post')
    @patch('core.courier.time.sleep')
    def test_service_respects_rate_limiting(self, mock_sleep, mock_send, mock_get_pending):
        """Should wait between posts to avoid rate limiting"""
        mock_get_pending.side_effect = [
            [{'id': 1}, {'id': 2}, {'id': 3}],
            []
        ]
        mock_send.return_value = True
        
        def sleep_side_effect(seconds):
            if mock_sleep.call_count > 5:
                raise KeyboardInterrupt()
        
        mock_sleep.side_effect = sleep_side_effect
        
        try:
            run_courier_service(interval=1)
        except KeyboardInterrupt:
            pass
        
        # Verify sleep was called between posts (2 seconds each)
        sleep_calls = [call[0][0] for call in mock_sleep.call_args_list]
        assert 2 in sleep_calls  # Rate limit sleep


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_facet_detection_with_empty_string(self):
        """Should handle empty string input"""
        facets = detect_facets_in_text("")
        assert facets == []
    
    def test_facet_detection_with_very_long_url(self):
        """Should handle very long URLs"""
        long_url = "https://example.com/" + "a" * 1000
        text = f"Check this out: {long_url}"
        facets = detect_facets_in_text(text)
        
        assert len(facets) == 1
        assert facets[0]['features'][0]['uri'] == long_url
    
    def test_encryption_of_special_characters(self):
        """Should handle special characters in encryption"""
        special_text = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
        encrypted = encrypt_password(special_text)
        decrypted = decrypt_password(encrypted)
        
        assert decrypted == special_text
    
    def test_post_with_null_images(self):
        """Should handle posts with null images field"""
        mock_post = {
            'id': 999,
            'post_text_encrypted': encrypt_password("Test"),
            'post_images': None,
            'did': 'did:plc:test',
            'handle': 'test.bsky.social',
            'app_password_hash': encrypt_password('pass'),
            'pds_url': 'https://bsky.social',
            'is_lore': False
        }
        
        with patch('core.courier.requests.post') as mock_request:
            session_resp = Mock()
            session_resp.status_code = 200
            session_resp.json.return_value = {'accessJwt': 'token', 'did': 'did:plc:test'}
            
            create_resp = Mock()
            create_resp.status_code = 200
            create_resp.json.return_value = {'uri': 'at://test/post/1', 'cid': 'cid1'}
            
            mock_request.side_effect = [session_resp, create_resp]
            
            with patch('core.courier.DatabaseManager'):
                result = send_post(mock_post)
                assert result is True


class TestAPIRouteIntegration:
    """Integration tests for API routes (requires Flask app context)"""
    
    @pytest.fixture
    def app(self):
        """Create Flask app for testing"""
        # Import here to avoid circular dependencies
        from api import create_app
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_schedule_endpoint_requires_auth(self, client):
        """Schedule endpoint should require authentication"""
        response = client.post('/api/courier/schedule', json={
            'post_text': 'Test',
            'scheduled_for': int(time.time()) + 3600
        })
        
        assert response.status_code == 401
    
    def test_schedule_endpoint_validates_future_time(self, client):
        """Should reject scheduling in the past"""
        past_time = int(time.time()) - 3600
        
        response = client.post('/api/courier/schedule', 
            json={
                'post_text': 'Test',
                'scheduled_for': past_time
            },
            query_string={'user_did': 'did:plc:test123'}
        )
        
        # Should fail validation (past time)
        assert response.status_code in [400, 403]
    
    def test_get_scheduled_posts_requires_auth(self, client):
        """Get scheduled posts should require authentication"""
        response = client.get('/api/courier/scheduled')
        
        assert response.status_code == 401


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
