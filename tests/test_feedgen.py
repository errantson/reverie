"""
Feed Generator Tests

Tests for the Reverie House custom feed generator including:
- Feed database operations
- Feed skeleton generation
- Label syncing from lore.farm
- HTTP endpoints (describeFeedGenerator, getFeedSkeleton)
"""

import pytest
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock


@pytest.fixture
def feed_db(test_db):
    """Feed database with schema initialized"""
    from core.feedgen import FeedDatabase
    db = FeedDatabase()
    yield db
    # Cleanup
    test_db.execute('DELETE FROM feed_posts')
    test_db.execute('DELETE FROM feed_labels')


@pytest.fixture
def feed_generator(feed_db):
    """FeedGenerator instance for testing"""
    from core.feedgen import FeedGenerator
    generator = FeedGenerator()
    yield generator


@pytest.fixture
def mock_lore_farm():
    """Mock lore.farm API responses"""
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'labels': [
                {
                    'uri': 'at://did:plc:test123/app.bsky.feed.post/abc123',
                    'val': 'lore',
                    'created_at': '2025-12-05T10:00:00Z'
                },
                {
                    'uri': 'at://did:plc:test456/app.bsky.feed.post/def456',
                    'val': 'canon',
                    'created_at': '2025-12-05T11:00:00Z'
                }
            ]
        }
        mock_get.return_value = mock_response
        yield mock_get


class TestFeedDatabase:
    """Test feed database operations"""
    
    def test_schema_initialization(self, feed_db, test_db):
        """Test that feed database tables are created"""
        # Check feed_posts table exists
        result = test_db.fetch_one("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'feed_posts'
        """)
        assert result is not None
        
        # Check feed_labels table exists
        result = test_db.fetch_one("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'feed_labels'
        """)
        assert result is not None
    
    def test_add_new_post(self, feed_db):
        """Test adding a new post to feed database"""
        uri = 'at://did:plc:test123/app.bsky.feed.post/abc123'
        cid = 'bafyreiabc123'
        author_did = 'did:plc:test123'
        text = 'Test post content'
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Add post
        result = feed_db.add_post(uri, cid, author_did, text, created_at)
        
        # Should return True for new post
        assert result is True
        
        # Verify post was added
        post = feed_db.db.fetch_one('SELECT * FROM feed_posts WHERE uri = %s', (uri,))
        assert post is not None
        assert post['cid'] == cid
        assert post['author_did'] == author_did
        assert post['text'] == text
    
    def test_add_duplicate_post(self, feed_db):
        """Test that adding duplicate post returns False"""
        uri = 'at://did:plc:test123/app.bsky.feed.post/abc123'
        cid = 'bafyreiabc123'
        author_did = 'did:plc:test123'
        text = 'Test post'
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Add post first time
        result1 = feed_db.add_post(uri, cid, author_did, text, created_at)
        assert result1 is True
        
        # Try to add same post again
        result2 = feed_db.add_post(uri, cid, author_did, text, created_at)
        assert result2 is False
    
    def test_get_lore_feed(self, feed_db):
        """Test retrieving posts with lore labels"""
        # Add posts with lore labels
        feed_db.add_post(
            'at://did:plc:test1/app.bsky.feed.post/1',
            'cid1', 'did:plc:test1', 'Lore post',
            datetime.now(timezone.utc).isoformat()
        )
        feed_db.db.execute(
            'UPDATE feed_posts SET has_lore_label = 1 WHERE uri = %s',
            ('at://did:plc:test1/app.bsky.feed.post/1',)
        )
        
        # Add regular post
        feed_db.add_post(
            'at://did:plc:test2/app.bsky.feed.post/2',
            'cid2', 'did:plc:test2', 'Regular post',
            datetime.now(timezone.utc).isoformat()
        )
        
        # Get lore feed
        lore_posts = feed_db.get_lore_feed(limit=10)
        
        assert len(lore_posts) == 1
        assert lore_posts[0]['uri'] == 'at://did:plc:test1/app.bsky.feed.post/1'
    
    def test_update_labels(self, feed_db):
        """Test updating labels from lore.farm"""
        labels = [
            {
                'uri': 'at://did:plc:test1/app.bsky.feed.post/1',
                'val': 'lore',
                'created_at': '2025-12-05T10:00:00Z'
            },
            {
                'uri': 'at://did:plc:test2/app.bsky.feed.post/2',
                'val': 'canon',
                'created_at': '2025-12-05T11:00:00Z'
            }
        ]
        
        feed_db.update_labels(labels)
        
        # Verify labels were added
        result = feed_db.db.fetch_all('SELECT * FROM feed_labels ORDER BY uri')
        assert len(result) == 2
        assert result[0]['label_type'] in ['lore', 'canon']
        assert result[1]['label_type'] in ['lore', 'canon']


class TestFeedGenerator:
    """Test feed generator logic"""
    
    def test_describe_feed_generator(self, feed_generator):
        """Test feed generator description endpoint"""
        result = feed_generator.describe_feed_generator()
        
        assert 'did' in result
        assert 'feeds' in result
        assert len(result['feeds']) >= 2
        
        # Check feed URIs
        feed_uris = [f['uri'] for f in result['feeds']]
        assert any('lore' in uri for uri in feed_uris)
        assert any('dreaming' in uri for uri in feed_uris)
    
    def test_get_feed_skeleton_lore(self, feed_generator, feed_db):
        """Test getting feed skeleton for lore feed"""
        # Add test posts
        now = datetime.now(timezone.utc)
        for i in range(5):
            feed_db.add_post(
                f'at://did:plc:test{i}/app.bsky.feed.post/{i}',
                f'cid{i}',
                f'did:plc:test{i}',
                f'Lore post {i}',
                (now - timedelta(hours=i)).isoformat()
            )
            feed_db.db.execute(
                'UPDATE feed_posts SET has_lore_label = 1 WHERE uri = %s',
                (f'at://did:plc:test{i}/app.bsky.feed.post/{i}',)
            )
        
        # Get feed skeleton
        result = feed_generator.get_feed_skeleton(
            'at://did:web:reverie.house/app.bsky.feed.generator/lore',
            limit=3
        )
        
        assert 'feed' in result
        assert len(result['feed']) == 3
        assert all('post' in item for item in result['feed'])
    
    def test_get_feed_skeleton_with_cursor(self, feed_generator, feed_db):
        """Test feed pagination with cursor"""
        # Add test posts
        now = datetime.now(timezone.utc)
        for i in range(10):
            feed_db.add_post(
                f'at://did:plc:test{i}/app.bsky.feed.post/{i}',
                f'cid{i}',
                f'did:plc:test{i}',
                f'Post {i}',
                (now - timedelta(hours=i)).isoformat()
            )
        
        # Get first page
        result1 = feed_generator.get_feed_skeleton(
            'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
            limit=5
        )
        
        assert 'cursor' in result1
        assert len(result1['feed']) == 5
        
        # Get second page using cursor
        result2 = feed_generator.get_feed_skeleton(
            'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
            limit=5,
            cursor=result1['cursor']
        )
        
        assert len(result2['feed']) == 5
        # Posts should be different
        posts1 = {item['post'] for item in result1['feed']}
        posts2 = {item['post'] for item in result2['feed']}
        assert posts1.isdisjoint(posts2)
    
    def test_get_community_dids(self, feed_generator, test_db):
        """Test getting community member DIDs"""
        # Add test dreamers
        test_db.execute("""
            INSERT INTO dreamers (did, handle, display_name, created_at)
            VALUES 
                ('did:plc:test1', 'test1.bsky.social', 'Test User 1', NOW()),
                ('did:plc:test2', 'test2.bsky.social', 'Test User 2', NOW()),
                ('did:plc:test3', 'test3.bsky.social', 'Test User 3', NOW())
        """)
        
        dids = feed_generator.get_community_dids()
        
        assert len(dids) >= 3
        assert 'did:plc:test1' in dids
        assert 'did:plc:test2' in dids
        assert 'did:plc:test3' in dids
    
    def test_sync_lore_labels(self, feed_generator, feed_db, mock_lore_farm):
        """Test syncing labels from lore.farm"""
        # Add posts that will get labels
        feed_db.add_post(
            'at://did:plc:test123/app.bsky.feed.post/abc123',
            'cid1', 'did:plc:test123', 'Post 1',
            datetime.now(timezone.utc).isoformat()
        )
        feed_db.add_post(
            'at://did:plc:test456/app.bsky.feed.post/def456',
            'cid2', 'did:plc:test456', 'Post 2',
            datetime.now(timezone.utc).isoformat()
        )
        
        # Sync labels
        feed_generator.sync_lore_labels()
        
        # Verify lore.farm was called
        mock_lore_farm.assert_called()
        
        # Verify labels were applied to posts
        post1 = feed_db.db.fetch_one(
            'SELECT * FROM feed_posts WHERE uri = %s',
            ('at://did:plc:test123/app.bsky.feed.post/abc123',)
        )
        assert post1['has_lore_label'] == 1
        
        post2 = feed_db.db.fetch_one(
            'SELECT * FROM feed_posts WHERE uri = %s',
            ('at://did:plc:test456/app.bsky.feed.post/def456',)
        )
        assert post2['has_canon_label'] == 1


@pytest.mark.integration
class TestFeedGeneratorServer:
    """Integration tests for feed generator HTTP endpoints"""
    
    @pytest.fixture
    def app(self):
        """Flask test client"""
        from core.feedgen_server import app
        app.config['TESTING'] = True
        return app.test_client()
    
    def test_did_document_endpoint(self, app):
        """Test /.well-known/did.json endpoint"""
        response = app.get('/.well-known/did.json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['id'] == 'did:web:reverie.house'
        assert 'service' in data
        assert any(s['type'] == 'BskyFeedGenerator' for s in data['service'])
    
    def test_describe_feed_generator_endpoint(self, app):
        """Test /xrpc/app.bsky.feed.describeFeedGenerator endpoint"""
        response = app.get('/xrpc/app.bsky.feed.describeFeedGenerator')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert 'did' in data
        assert 'feeds' in data
        assert len(data['feeds']) >= 2
    
    def test_get_feed_skeleton_endpoint(self, app, feed_db):
        """Test /xrpc/app.bsky.feed.getFeedSkeleton endpoint"""
        # Add test post
        feed_db.add_post(
            'at://did:plc:test/app.bsky.feed.post/123',
            'cid123', 'did:plc:test', 'Test',
            datetime.now(timezone.utc).isoformat()
        )
        
        response = app.get(
            '/xrpc/app.bsky.feed.getFeedSkeleton',
            query_string={
                'feed': 'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
                'limit': 10
            }
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert 'feed' in data
        assert isinstance(data['feed'], list)
    
    def test_get_feed_skeleton_missing_feed(self, app):
        """Test endpoint returns error when feed parameter missing"""
        response = app.get('/xrpc/app.bsky.feed.getFeedSkeleton')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_health_endpoint(self, app):
        """Test /health endpoint"""
        response = app.get('/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['status'] == 'ok'
        assert 'feeds' in data


@pytest.mark.slow
class TestFeedGeneratorPerformance:
    """Performance tests for feed generator"""
    
    def test_large_feed_query_performance(self, feed_generator, feed_db):
        """Test that querying large feeds is performant"""
        import time
        
        # Add 1000 posts
        now = datetime.now(timezone.utc)
        for i in range(1000):
            feed_db.add_post(
                f'at://did:plc:user{i % 100}/app.bsky.feed.post/{i}',
                f'cid{i}',
                f'did:plc:user{i % 100}',
                f'Post content {i}',
                (now - timedelta(minutes=i)).isoformat()
            )
        
        # Query should complete in under 1 second
        start = time.time()
        result = feed_generator.get_feed_skeleton(
            'at://did:web:reverie.house/app.bsky.feed.generator/dreaming',
            limit=50
        )
        elapsed = time.time() - start
        
        assert elapsed < 1.0
        assert len(result['feed']) == 50
    
    def test_label_sync_performance(self, feed_generator, feed_db, mock_lore_farm):
        """Test label sync with many posts"""
        import time
        
        # Add many posts
        now = datetime.now(timezone.utc)
        for i in range(500):
            feed_db.add_post(
                f'at://did:plc:user{i}/app.bsky.feed.post/{i}',
                f'cid{i}',
                f'did:plc:user{i}',
                f'Post {i}',
                (now - timedelta(minutes=i)).isoformat()
            )
        
        # Mock large label response
        mock_lore_farm.return_value.json.return_value = {
            'labels': [
                {
                    'uri': f'at://did:plc:user{i}/app.bsky.feed.post/{i}',
                    'val': 'lore' if i % 2 == 0 else 'canon',
                    'created_at': '2025-12-05T10:00:00Z'
                }
                for i in range(100)
            ]
        }
        
        # Sync should complete in under 5 seconds
        start = time.time()
        feed_generator.sync_lore_labels()
        elapsed = time.time() - start
        
        assert elapsed < 5.0
