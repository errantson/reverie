"""
Shared rate limiting utilities for all API routes
"""

from functools import wraps
from flask import request, jsonify
from core.rate_limiter import PersistentRateLimiter
from core.admin_auth import get_client_ip

# Single shared rate limiter instance
rate_limiter = PersistentRateLimiter()
RATE_LIMIT_WINDOW = 60  # seconds


def rate_limit(requests_per_minute=100):
    """
    Rate limiting decorator
    
    Args:
        requests_per_minute: Maximum requests allowed per 60 seconds
        
    Usage:
        @bp.route('/endpoint')
        @rate_limit(30)  # 30 requests per minute
        def my_endpoint():
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = get_client_ip()
            endpoint = request.path
            
            allowed, retry_after = rate_limiter.check_rate_limit(
                ip, endpoint, limit=requests_per_minute, window=RATE_LIMIT_WINDOW
            )
            
            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after,
                    'limit': requests_per_minute,
                    'window': RATE_LIMIT_WINDOW
                }), 429
            
            return f(*args, **kwargs)
        return wrapped
    return decorator


# Default rate limits for different endpoint types
LIMITS = {
    'read': 200,      # GET endpoints (high limit)
    'write': 60,      # POST/PUT/DELETE (moderate limit)
    'auth': 20,       # Login/register (low limit)
    'expensive': 10,  # Computation-heavy endpoints
}
