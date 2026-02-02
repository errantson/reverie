#!/usr/bin/env python3
"""
🌜 REVERIE ESSENTIAL
Account Rate Limiter - Last-line defense against spam/negative labels

Global rate limiting for @reverie.house account actions.
This is the FINAL check before ANY post, like, or reply is sent.
If this fails, the action is blocked regardless of what triggered it.

Uses database persistence to survive container restarts and
provides conservative limits well under Bluesky's actual limits.
"""

import time
from typing import Dict, Optional, Tuple
from datetime import datetime
from core.database import DatabaseManager


class AccountRateLimiter:
    """
    Global rate limiter for @reverie.house account.
    
    This is the last-line defense against triggering spam detection
    or negative labels on Bluesky. All account actions MUST pass
    through this limiter before execution.
    
    Limits are intentionally conservative - well under Bluesky's
    actual rate limits to maintain a good reputation.
    """
    
    # Conservative limits (roughly 10-20% of Bluesky's actual limits)
    # These are designed to NEVER trigger any spam detection
    LIMITS = {
        'post': {
            'per_minute': 2,       # Max 2 posts per minute (burst protection)
            'per_hour': 15,        # Max 15 posts per hour
            'per_day': 100,        # Max 100 posts per day
        },
        'like': {
            'per_minute': 5,       # Max 5 likes per minute
            'per_hour': 30,        # Max 30 likes per hour  
            'per_day': 200,        # Max 200 likes per day
        },
        'reply': {
            'per_minute': 2,       # Max 2 replies per minute (same as post)
            'per_hour': 15,        # Max 15 replies per hour
            'per_day': 100,        # Max 100 replies per day
        },
        'follow': {
            'per_minute': 2,       # Max 2 follows per minute
            'per_hour': 10,        # Max 10 follows per hour
            'per_day': 50,         # Max 50 follows per day
        }
    }
    
    # Time windows in seconds
    WINDOWS = {
        'per_minute': 60,
        'per_hour': 3600,
        'per_day': 86400,
    }
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern - one rate limiter for all."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._ensure_table()
    
    def _ensure_table(self):
        """Create the rate limiting table if it doesn't exist."""
        try:
            db = DatabaseManager()
            db.execute("""
                CREATE TABLE IF NOT EXISTS reverie_account_actions (
                    id SERIAL PRIMARY KEY,
                    action_type TEXT NOT NULL,
                    action_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    target_uri TEXT,
                    metadata JSONB
                )
            """)
            
            # Index for fast lookups by action type and time
            db.execute("""
                CREATE INDEX IF NOT EXISTS idx_account_actions_type_time 
                ON reverie_account_actions (action_type, action_time)
            """)
            
        except Exception as e:
            print(f"⚠️  Rate limiter table setup error: {e}")
    
    def _count_recent_actions(self, action_type: str, seconds: int) -> int:
        """Count actions of a type within the last N seconds."""
        try:
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT COUNT(*) as count FROM reverie_account_actions
                WHERE action_type = %s 
                AND action_time > NOW() - INTERVAL '%s seconds'
            """, (action_type, seconds))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
            
        except Exception as e:
            print(f"⚠️  Rate limit count error: {e}")
            # On error, be conservative and assume we're at limit
            return 999
    
    def _record_action(self, action_type: str, target_uri: str = None, metadata: Dict = None):
        """Record an action in the rate limit table. Records are kept permanently for audit."""
        try:
            db = DatabaseManager()
            
            import json
            meta_json = json.dumps(metadata) if metadata else None
            
            db.execute("""
                INSERT INTO reverie_account_actions (action_type, target_uri, metadata)
                VALUES (%s, %s, %s)
            """, (action_type, target_uri, meta_json))
            
        except Exception as e:
            print(f"⚠️  Rate limit record error: {e}")
    
    def check_limit(self, action_type: str) -> Tuple[bool, str]:
        """
        Check if an action is allowed under rate limits.
        
        Args:
            action_type: 'post', 'like', 'reply', or 'follow'
            
        Returns:
            (allowed: bool, reason: str)
        """
        if action_type not in self.LIMITS:
            return False, f"Unknown action type: {action_type}"
        
        limits = self.LIMITS[action_type]
        
        # Check each time window
        for window_name, limit in limits.items():
            seconds = self.WINDOWS[window_name]
            count = self._count_recent_actions(action_type, seconds)
            
            if count >= limit:
                return False, f"Rate limit exceeded: {count}/{limit} {action_type}s {window_name}"
        
        return True, "OK"
    
    def can_post(self) -> Tuple[bool, str]:
        """Check if @reverie.house can post right now."""
        return self.check_limit('post')
    
    def can_like(self) -> Tuple[bool, str]:
        """Check if @reverie.house can like right now."""
        return self.check_limit('like')
    
    def can_reply(self) -> Tuple[bool, str]:
        """Check if @reverie.house can reply right now."""
        return self.check_limit('reply')
    
    def can_follow(self) -> Tuple[bool, str]:
        """Check if @reverie.house can follow right now."""
        return self.check_limit('follow')
    
    def record_post(self, target_uri: str = None):
        """Record that a post was made."""
        self._record_action('post', target_uri)
    
    def record_like(self, target_uri: str = None):
        """Record that a like was made."""
        self._record_action('like', target_uri)
    
    def record_reply(self, target_uri: str = None):
        """Record that a reply was made."""
        self._record_action('reply', target_uri)
    
    def record_follow(self, target_did: str = None):
        """Record that a follow was made."""
        self._record_action('follow', target_did)
    
    def get_current_usage(self) -> Dict:
        """Get current usage statistics for monitoring."""
        stats = {}
        
        for action_type, limits in self.LIMITS.items():
            stats[action_type] = {}
            for window_name, limit in limits.items():
                seconds = self.WINDOWS[window_name]
                count = self._count_recent_actions(action_type, seconds)
                stats[action_type][window_name] = {
                    'used': count,
                    'limit': limit,
                    'remaining': max(0, limit - count),
                    'percentage': round(count / limit * 100, 1)
                }
        
        return stats
    
    def get_status_summary(self) -> str:
        """Get a human-readable status summary."""
        usage = self.get_current_usage()
        lines = ["📊 @reverie.house Rate Limit Status:"]
        
        for action_type, windows in usage.items():
            hourly = windows.get('per_hour', {})
            used = hourly.get('used', 0)
            limit = hourly.get('limit', 0)
            pct = hourly.get('percentage', 0)
            
            if pct >= 80:
                emoji = "🔴"
            elif pct >= 50:
                emoji = "🟡"
            else:
                emoji = "🟢"
            
            lines.append(f"  {emoji} {action_type}: {used}/{limit} per hour ({pct}%)")
        
        return "\n".join(lines)
    
    def get_historical_stats(self, days: int = 30) -> Dict:
        """
        Get historical action counts for auditing.
        Records are kept permanently - this gives you the full picture.
        
        Args:
            days: Number of days to look back (default 30)
            
        Returns:
            Dict with daily breakdown of actions
        """
        try:
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT 
                    action_type,
                    DATE(action_time) as action_date,
                    COUNT(*) as count
                FROM reverie_account_actions
                WHERE action_time > NOW() - INTERVAL '%s days'
                GROUP BY action_type, DATE(action_time)
                ORDER BY action_date DESC, action_type
            """, (days,))
            
            results = cursor.fetchall()
            
            # Organize by date
            by_date = {}
            for row in results:
                date_str = str(row['action_date'])
                if date_str not in by_date:
                    by_date[date_str] = {}
                by_date[date_str][row['action_type']] = row['count']
            
            # Get totals
            cursor = db.execute("""
                SELECT action_type, COUNT(*) as total
                FROM reverie_account_actions
                WHERE action_time > NOW() - INTERVAL '%s days'
                GROUP BY action_type
            """, (days,))
            
            totals = {row['action_type']: row['total'] for row in cursor.fetchall()}
            
            return {
                'days': days,
                'by_date': by_date,
                'totals': totals
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def get_total_actions_ever(self) -> Dict:
        """Get total count of all actions ever recorded."""
        try:
            db = DatabaseManager()
            cursor = db.execute("""
                SELECT action_type, COUNT(*) as total
                FROM reverie_account_actions
                GROUP BY action_type
            """)
            
            return {row['action_type']: row['total'] for row in cursor.fetchall()}
            
        except Exception as e:
            return {'error': str(e)}


# Singleton instance for easy import
account_rate_limiter = AccountRateLimiter()


def check_reverie_rate_limit(action_type: str) -> Tuple[bool, str]:
    """
    Convenience function to check rate limits.
    
    Usage:
        allowed, reason = check_reverie_rate_limit('post')
        if not allowed:
            print(f"Rate limited: {reason}")
            return
    """
    return account_rate_limiter.check_limit(action_type)


def record_reverie_action(action_type: str, target: str = None):
    """
    Convenience function to record an action.
    
    Usage:
        record_reverie_action('like', post_uri)
    """
    if action_type == 'post':
        account_rate_limiter.record_post(target)
    elif action_type == 'like':
        account_rate_limiter.record_like(target)
    elif action_type == 'reply':
        account_rate_limiter.record_reply(target)
    elif action_type == 'follow':
        account_rate_limiter.record_follow(target)
