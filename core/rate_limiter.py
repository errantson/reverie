#!/usr/bin/env python3
"""
Persistent Rate Limiter for Reverie House
Uses PostgreSQL for storage to survive server restarts
"""

import time
from typing import Optional, Tuple, List
from threading import Lock
from core.database import DatabaseManager


class PersistentRateLimiter:
    """
    PostgreSQL-backed rate limiter with automatic cleanup
    
    Features:
    - Persistent across restarts
    - Automatic cleanup of expired entries
    - Per-endpoint and global rate limits
    - Thread-safe operations
    """
    
    def __init__(self):
        self.db = DatabaseManager()
        self.lock = Lock()
        self._init_db()
    
    def _init_db(self):
        """Create rate limit table and indexes if they don't exist"""
        try:
            self.db.execute("""
                CREATE TABLE IF NOT EXISTS rate_limits (
                    ip TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    PRIMARY KEY (ip, endpoint, timestamp)
                )
            """)
            self.db.execute("""
                CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp 
                ON rate_limits(timestamp)
            """)
            self.db.execute("""
                CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint 
                ON rate_limits(ip, endpoint)
            """)
        except Exception as e:
            print(f"Error initializing rate_limits table: {e}")
    
    def check_rate_limit(
        self, 
        ip: str, 
        endpoint: str, 
        limit: int = 100, 
        window: int = 60
    ) -> Tuple[bool, Optional[int]]:
        """
        Check if IP is within rate limit for endpoint
        
        Args:
            ip: Client IP address
            endpoint: Request endpoint path
            limit: Maximum requests allowed in window
            window: Time window in seconds
        
        Returns:
            (allowed, retry_after)
            - allowed: True if under limit, False if over
            - retry_after: seconds until limit resets (if blocked)
        """
        with self.lock:
            now = int(time.time())
            window_start = now - window
            
            try:
                # Clean old entries outside current window
                self.db.execute(
                    "DELETE FROM rate_limits WHERE timestamp < %s",
                    (window_start,)
                )
                
                # Count recent requests for this IP and endpoint
                cursor = self.db.execute("""
                    SELECT COUNT(*), MIN(timestamp) 
                    FROM rate_limits 
                    WHERE ip = %s AND endpoint = %s AND timestamp >= %s
                """, (ip, endpoint, window_start))
                
                row = cursor.fetchone()
                count = row['count'] if row else 0
                oldest = row['min'] if row else None
                
                if count >= limit:
                    # Rate limited - calculate retry time
                    retry_after = window - (now - (oldest or now))
                    return False, max(0, int(retry_after))
                
                # Record this request
                # Use ON CONFLICT DO NOTHING to handle race conditions
                self.db.execute("""
                    INSERT INTO rate_limits (ip, endpoint, timestamp) 
                    VALUES (%s, %s, %s) 
                    ON CONFLICT (ip, endpoint, timestamp) DO NOTHING
                """, (ip, endpoint, now))
                
                return True, None
            except Exception as e:
                print(f"Rate limit check error: {e}")
                return True, None  # Allow on error
                
                row = cursor.fetchone()
                count = row['count'] if row else 0
                oldest = row['min'] if row else None
                
                if count >= limit:
                    # Rate limited - calculate retry time
                    retry_after = window - (now - (oldest or now))
                    return False, max(0, int(retry_after))
                
                # Record this request
                # Use ON CONFLICT DO NOTHING to handle race conditions
                self.db.execute("""
                    INSERT INTO rate_limits (ip, endpoint, timestamp) 
                    VALUES (%s, %s, %s) 
                    ON CONFLICT (ip, endpoint, timestamp) DO NOTHING
                """, (ip, endpoint, now))
                
                return True, None
            except Exception as e:
                print(f"Rate limit check error: {e}")
                return True, None  # Allow on error
    
    def get_stats(self, ip: Optional[str] = None, hours: int = 1) -> List[dict]:
        """
        Get rate limit statistics
        
        Args:
            ip: Specific IP to get stats for (None for all IPs)
            hours: How many hours back to look
        
        Returns:
            List of dicts with statistics
        """
        try:
            since = int(time.time()) - (hours * 3600)
            
            if ip:
                cursor = self.db.execute("""
                    SELECT endpoint, COUNT(*) as requests, MAX(timestamp) as last_request
                    FROM rate_limits
                    WHERE ip = %s AND timestamp >= %s
                    GROUP BY endpoint
                    ORDER BY requests DESC
                """, (ip, since))
                
                results = [
                    {
                        'ip': ip,
                        'endpoint': row['endpoint'],
                        'requests': row['requests'],
                        'last_request': row['last_request']
                    }
                    for row in cursor.fetchall()
                ]
            else:
                cursor = self.db.execute("""
                    SELECT ip, endpoint, COUNT(*) as requests, MAX(timestamp) as last_request
                    FROM rate_limits
                    WHERE timestamp >= %s
                    GROUP BY ip, endpoint
                    ORDER BY requests DESC
                    LIMIT 100
                """, (since,))
                
                results = [
                    {
                        'ip': row['ip'],
                        'endpoint': row['endpoint'],
                        'requests': row['requests'],
                        'last_request': row['last_request']
                    }
                    for row in cursor.fetchall()
                ]
            
            return results
        except Exception as e:
            print(f"Stats error: {e}")
            return []
    
    def clear_ip(self, ip: str):
        """Clear all rate limits for a specific IP"""
        with self.lock:
            try:
                self.db.execute("DELETE FROM rate_limits WHERE ip = %s", (ip,))
            except Exception as e:
                print(f"Clear IP error: {e}")
    
    def clear_all(self):
        """Clear all rate limits (admin function)"""
        with self.lock:
            try:
                self.db.execute("DELETE FROM rate_limits")
            except Exception as e:
                print(f"Clear all error: {e}")
    
    def cleanup_old_entries(self, days: int = 7):
        """
        Remove entries older than specified days
        Run this periodically to keep database size manageable
        """
        with self.lock:
            try:
                cutoff = int(time.time()) - (days * 86400)
                cursor = self.db.execute(
                    "DELETE FROM rate_limits WHERE timestamp < %s",
                    (cutoff,)
                )
                # Note: rowcount not directly available, but deletion happens
                return 0  # Placeholder
            except Exception as e:
                print(f"Cleanup error: {e}")
                return 0


if __name__ == '__main__':
    # Test the rate limiter
    limiter = PersistentRateLimiter()
    
    print("Testing rate limiter...")
    
    # Test basic functionality
    for i in range(15):
        allowed, retry = limiter.check_rate_limit('192.168.1.1', '/test', limit=10, window=60)
        print(f"Request {i+1}: {'✓ Allowed' if allowed else f'✗ Blocked (retry in {retry}s)'}")
    
    # Test stats
    print("\nStats:")
    stats = limiter.get_stats(ip='192.168.1.1')
    for stat in stats:
        print(f"  {stat['endpoint']}: {stat['requests']} requests")
    
    print("\nTest complete!")
