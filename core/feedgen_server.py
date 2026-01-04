#!/usr/bin/env python3
"""
Feed Generator HTTP Server

Serves feed skeletons to Bluesky AppView via HTTPS endpoints.

Endpoints:
- GET /.well-known/did.json - DID document for did:web
- GET /xrpc/app.bsky.feed.describeFeedGenerator - List available feeds
- GET /xrpc/app.bsky.feed.getFeedSkeleton - Get feed posts
"""

import sys
import json
from pathlib import Path
from flask import Flask, request, jsonify

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.feedgen import FeedGenerator
from core.rate_limiter import PersistentRateLimiter

app = Flask(__name__)

# Configure Flask to preserve UTF-8 characters (emoji) in JSON responses
app.config['JSON_AS_ASCII'] = False

generator = FeedGenerator()
rate_limiter = PersistentRateLimiter()


def get_client_ip():
    """Get client IP from request headers or remote_addr"""
    return request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()


@app.route('/.well-known/did.json')
def did_document():
    """
    Serve DID document for did:web:reverie.house
    This identifies our feed generator service.
    """
    return jsonify({
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/multikey/v1",
            "https://w3id.org/security/suites/secp256k1-2019/v1"
        ],
        "id": "did:web:reverie.house",
        "service": [
            {
                "id": "#bsky_fg",
                "type": "BskyFeedGenerator",
                "serviceEndpoint": "https://reverie.house"
            }
        ]
    })


@app.route('/xrpc/app.bsky.feed.describeFeedGenerator')
def describe_feed_generator():
    """
    Describe the feeds available from this generator.
    Returns metadata about our feeds.
    """
    return jsonify(generator.describe_feed_generator())


@app.route('/xrpc/app.bsky.feed.getFeedSkeleton')
def get_feed_skeleton():
    """
    Get the skeleton (list of post URIs) for a feed.
    This is the main feed endpoint that Bluesky queries.
    """
    # Loose rate limiting: 200 requests per minute per IP
    # (Most feed generators don't rate limit at all, but it's good practice)
    client_ip = get_client_ip()
    allowed, retry_after = rate_limiter.check_rate_limit(
        client_ip,
        'feed_skeleton',
        limit=200,
        window=60
    )
    
    if not allowed:
        return jsonify({
            'error': 'RateLimitExceeded',
            'message': f'Slow down a bit. Try again in {retry_after} seconds.'
        }), 429
    
    feed = request.args.get('feed', '')
    limit = min(int(request.args.get('limit', 30)), 20)  # Cap at 20 for faster hydration
    cursor = request.args.get('cursor')
    
    if not feed:
        return jsonify({'error': 'MissingFeed'}), 400
    
    result = generator.get_feed_skeleton(feed, limit, cursor)
    
    if 'error' in result:
        return jsonify(result), 400
    
    return jsonify(result)


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'reverie-house-feed-generator',
        'feeds': list(generator.feeds.keys())
    })


if __name__ == '__main__':
    # Development server - in production, use gunicorn or similar
    print("🎯 Starting Feed Generator Server")
    print("=" * 60)
    print("Available feeds:")
    for feed_name, feed_info in generator.feeds.items():
        print(f"  - {feed_name}: {feed_info['name']}")
    print("\nEndpoints:")
    print("  - /.well-known/did.json")
    print("  - /xrpc/app.bsky.feed.describeFeedGenerator")
    print("  - /xrpc/app.bsky.feed.getFeedSkeleton")
    print("  - /health")
    print("\nStarting server on port 3001...")
    
    app.run(host='0.0.0.0', port=3001, debug=False)
