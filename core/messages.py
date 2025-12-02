#!/usr/bin/env python3
"""
Message System - Core Functions

Handles creation, delivery, and management of user messages.
Messages are user-specific instances of dialogue templates.
"""

import json
import time
import asyncio
from typing import Dict, List, Optional, Any
from core.database import DatabaseManager
from core.notifications import notify_new_message


def create_message(
    user_did: str,
    dialogue_key: str,
    messages_data: List[Dict],
    source: str = 'system',
    priority: int = 50,
    expires_in_hours: Optional[int] = None
) -> int:
    """
    Create a message instance for a user.
    
    Args:
        user_did: User's DID
        dialogue_key: Key of dialogue template used
        messages_data: Full message sequence (from dialogues table)
        source: How this message was created ('system', 'admin', 'quest', 'cron')
        priority: Urgency level (higher = more important)
        expires_in_hours: Auto-delete after X hours (optional)
    
    Returns:
        int: Created message ID
    """
    db = DatabaseManager()
    
    now = int(time.time())
    expires_at = None
    if expires_in_hours:
        expires_at = now + (expires_in_hours * 3600)
    
    cursor = db.execute('''
        INSERT INTO messages (
            user_did, dialogue_key, messages_json,
            source, priority, status,
            created_at, expires_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        user_did,
        dialogue_key,
        json.dumps(messages_data),
        source,
        priority,
        'unread',
        now,
        expires_at
    ))
    
    # DatabaseManager auto-commits
    message_id = cursor.lastrowid
    
    print(f"✉️ [Messages] Created message {message_id} for {user_did[:20]}... (key: {dialogue_key})")
    
    # Send real-time notification via SSE
    try:
        notify_new_message(user_did, message_id, dialogue_key)
    except Exception as e:
        # Don't fail message creation if notification fails
        print(f"⚠️ [Messages] Failed to send notification: {e}")
    
    return message_id


def get_inbox(
    user_did: str,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Get user's inbox messages.
    
    Args:
        user_did: User's DID
        status: Filter by status ('unread', 'read', 'dismissed') or None for active (non-dismissed)
        limit: Max messages to return
        offset: Pagination offset
    
    Returns:
        Dict with messages array and counts
    """
    db = DatabaseManager()
    
    # Build query
    where_clauses = ['user_did = %s']
    params = [user_did]
    
    if status:
        where_clauses.append('status = %s')
        params.append(status)
    else:
        # By default, exclude dismissed messages (only show unread/read)
        where_clauses.append("status != 'dismissed'")
    
    where_sql = ' AND '.join(where_clauses)
    
    # Get messages with dialogue titles
    cursor = db.execute(f'''
        SELECT 
            m.id, m.dialogue_key, m.messages_json, m.source, m.priority, m.status,
            m.created_at, m.read_at, m.dismissed_at, m.expires_at,
            d.title as dialogue_title
        FROM messages m
        LEFT JOIN dialogues d ON d.key = m.dialogue_key AND d.sequence = 0
        WHERE {where_sql}
        ORDER BY m.priority DESC, m.created_at DESC
        LIMIT %s OFFSET %s
    ''', params + [limit, offset])
    
    messages = []
    for row in cursor.fetchall():
        # Parse messages_json to get preview
        msgs = json.loads(row['messages_json'])
        preview = msgs[0]['text'][:100] + '...' if msgs and len(msgs[0]['text']) > 100 else msgs[0]['text'] if msgs else ''
        
        messages.append({
            'id': row['id'],
            'dialogue_key': row['dialogue_key'],
            'title': row['dialogue_title'],  # Use title from dialogues table
            'source': row['source'],
            'priority': row['priority'],
            'status': row['status'],
            'created_at': row['created_at'],
            'read_at': row['read_at'],
            'dismissed_at': row['dismissed_at'],
            'expires_at': row['expires_at'],
            'preview': preview,
            'message_count': len(msgs)
        })
    
    # Get counts
    cursor = db.execute('''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) as unread,
            SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
            SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed
        FROM messages
        WHERE user_did = %s
    ''', (user_did,))
    
    counts = dict(cursor.fetchone())
    
    return {
        'messages': messages,
        'total': counts['total'] or 0,
        'unread': counts['unread'] or 0,
        'read': counts['read'] or 0,
        'dismissed': counts['dismissed'] or 0
    }


def get_message(message_id: int, user_did: str) -> Optional[Dict]:
    """
    Get a single message (with permission check).
    
    Args:
        message_id: Message ID
        user_did: User's DID (for permission check)
    
    Returns:
        Message dict or None if not found/unauthorized
    """
    db = DatabaseManager()
    
    cursor = db.execute('''
        SELECT 
            id, user_did, dialogue_key, messages_json, source, priority, status,
            created_at, read_at, dismissed_at, expires_at
        FROM messages
        WHERE id = %s AND user_did = %s
    ''', (message_id, user_did))
    
    row = cursor.fetchone()
    if not row:
        return None
    
    return {
        'id': row['id'],
        'dialogue_key': row['dialogue_key'],
        'messages_json': json.loads(row['messages_json']),
        'source': row['source'],
        'priority': row['priority'],
        'status': row['status'],
        'created_at': row['created_at'],
        'read_at': row['read_at'],
        'dismissed_at': row['dismissed_at'],
        'expires_at': row['expires_at']
    }


def mark_read(message_id: int, user_did: str) -> bool:
    """
    Mark message as read.
    
    Args:
        message_id: Message ID
        user_did: User's DID (for permission check)
    
    Returns:
        True if updated, False if not found/unauthorized
    """
    db = DatabaseManager()
    
    now = int(time.time())
    
    # Update message to 'read' status and clear dismissed_at (for restoring from trash)
    cursor = db.execute('''
        UPDATE messages
        SET status = 'read', read_at = %s, dismissed_at = NULL
        WHERE id = %s AND user_did = %s AND status IN ('unread', 'dismissed')
    ''', (now, message_id, user_did))
    
    db.commit()
    
    success = cursor.rowcount > 0
    if success:
        # Track interaction
        track_interaction(message_id, 'opened')
    
    return success


def mark_dismissed(message_id: int, user_did: str) -> bool:
    """
    Mark message as dismissed.
    
    Args:
        message_id: Message ID
        user_did: User's DID (for permission check)
    
    Returns:
        True if updated, False if not found/unauthorized
    """
    db = DatabaseManager()
    
    now = int(time.time())
    
    cursor = db.execute('''
        UPDATE messages
        SET status = 'dismissed', dismissed_at = %s
        WHERE id = %s AND user_did = %s
    ''', (now, message_id, user_did))
    
    db.commit()
    
    success = cursor.rowcount > 0
    if success:
        track_interaction(message_id, 'dismissed')
    
    return success


def bulk_dismiss(user_did: str, status_filter: str = 'read') -> int:
    """
    Bulk dismiss messages.
    
    Args:
        user_did: User's DID
        status_filter: Only dismiss messages with this status (e.g., 'read')
    
    Returns:
        Number of messages dismissed
    """
    db = DatabaseManager()
    
    now = int(time.time())
    
    cursor = db.execute('''
        UPDATE messages
        SET status = 'dismissed', dismissed_at = %s
        WHERE user_did = %s AND status = %s
    ''', (now, user_did, status_filter))
    
    db.commit()
    
    return cursor.rowcount


def cleanup_expired() -> int:
    """
    Delete expired messages (run via cron).
    
    Returns:
        Number of messages deleted
    """
    db = DatabaseManager()
    
    now = int(time.time())
    
    cursor = db.execute('''
        DELETE FROM messages
        WHERE expires_at IS NOT NULL AND expires_at < %s
    ''', (now,))
    
    db.commit()
    
    deleted = cursor.rowcount
    if deleted > 0:
        print(f"🗑️ [Messages] Cleaned up {deleted} expired messages")
    
    return deleted


def track_interaction(
    message_id: int,
    interaction_type: str,
    button_index: Optional[int] = None,
    button_text: Optional[str] = None
):
    """
    Track user interaction with a message (for analytics).
    
    Args:
        message_id: Message ID
        interaction_type: Type of interaction ('opened', 'button_clicked', 'dismissed')
        button_index: Index of clicked button (optional)
        button_text: Text of clicked button (optional)
    """
    db = DatabaseManager()
    
    now = int(time.time())
    
    db.execute('''
        INSERT INTO message_interactions (
            message_id, interaction_type, button_index, button_text, timestamp
        ) VALUES (%s, %s, %s, %s, %s)
    ''', (message_id, interaction_type, button_index, button_text, now))
    
    db.commit()


def get_message_stats(dialogue_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Get message analytics/statistics.
    
    Args:
        dialogue_key: Filter by specific dialogue key (optional)
    
    Returns:
        Dict with statistics (total, unread, read, dismissed counts)
    """
    db = DatabaseManager()
    
    where_clause = ''
    params = []
    if dialogue_key:
        where_clause = 'WHERE dialogue_key = %s'
        params = [dialogue_key]
    
    # Get overall summary stats
    cursor = db.execute(f'''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) as unread,
            SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
            SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed
        FROM messages
        {where_clause}
    ''', params)
    
    row = cursor.fetchone()
    
    return {
        'total': row['total'] or 0,
        'unread': row['unread'] or 0,
        'read': row['read'] or 0,
        'dismissed': row['dismissed'] or 0
    }


# Convenience function for sending to multiple users
def broadcast_message(
    user_dids: List[str],
    dialogue_key: str,
    messages_data: List[Dict],
    source: str = 'admin',
    priority: int = 70,
    expires_in_hours: Optional[int] = None
) -> List[int]:
    """
    Send a message to multiple users.
    
    Args:
        user_dids: List of user DIDs
        dialogue_key: Dialogue template key
        messages_data: Message content
        source: Source type
        priority: Message priority
        expires_in_hours: Expiration time
    
    Returns:
        List of created message IDs
    """
    message_ids = []
    for user_did in user_dids:
        msg_id = create_message(
            user_did=user_did,
            dialogue_key=dialogue_key,
            messages_data=messages_data,
            source=source,
            priority=priority,
            expires_in_hours=expires_in_hours
        )
        message_ids.append(msg_id)
    
    print(f"📬 [Messages] Broadcast {dialogue_key} to {len(user_dids)} users")
    return message_ids
