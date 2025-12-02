#!/usr/bin/env python3
"""
Notification System - Server-Sent Events (SSE)

Provides real-time push notifications to frontend clients using SSE.
SSE is simpler than WebSocket and perfect for server-to-client push.
"""

import json
import time
import queue
from collections import defaultdict
from typing import Dict, List, Optional, Set
from datetime import datetime


class NotificationBroadcaster:
    """
    Manages SSE connections and broadcasts notifications to clients.
    Thread-safe, singleton instance shared across all requests.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Map of user_did -> set of queue objects (one per SSE connection)
        self.connections: Dict[str, Set[queue.Queue]] = defaultdict(set)
        self._initialized = True
        
        print("🔔 [Notifications] Broadcaster initialized")
    
    def add_connection(self, user_did: str, q: queue.Queue):
        """Add a new SSE connection for a user"""
        self.connections[user_did].add(q)
        print(f"✅ [Notifications] Client connected for {user_did[:20]}... (total: {len(self.connections[user_did])})")
    
    def remove_connection(self, user_did: str, q: queue.Queue):
        """Remove an SSE connection when client disconnects"""
        if user_did in self.connections:
            self.connections[user_did].discard(q)
            if not self.connections[user_did]:
                del self.connections[user_did]
            print(f"🔌 [Notifications] Client disconnected for {user_did[:20]}... (remaining: {len(self.connections.get(user_did, []))})")
    
    def notify_user(self, user_did: str, event_type: str, data: dict):
        """
        Send notification to all connected clients for a user.
        
        Args:
            user_did: User's DID
            event_type: Type of event ('new_message', 'message_count', etc.)
            data: Event data dictionary
        """
        if user_did not in self.connections:
            print(f"ℹ️ [Notifications] No active connections for {user_did[:20]}...")
            return
        
        event = {
            'type': event_type,
            'data': data,
            'timestamp': int(time.time())
        }
        
        # Send to all connected clients for this user
        disconnected = set()
        for q in self.connections[user_did]:
            try:
                # Non-blocking put - if queue full, skip (client too slow)
                q.put_nowait(event)
                print(f"📨 [Notifications] Sent {event_type} to {user_did[:20]}...")
            except queue.Full:
                print(f"⚠️ [Notifications] Queue full for {user_did[:20]}... (client too slow)")
            except Exception as e:
                print(f"❌ [Notifications] Failed to send to queue: {e}")
                disconnected.add(q)
        
        # Clean up disconnected queues
        for q in disconnected:
            self.remove_connection(user_did, q)
    
    def get_connection_count(self, user_did: Optional[str] = None) -> int:
        """Get number of active connections"""
        if user_did:
            return len(self.connections.get(user_did, set()))
        return sum(len(queues) for queues in self.connections.values())


# Global singleton instance
broadcaster = NotificationBroadcaster()


def notify_new_message(user_did: str, message_id: int, dialogue_key: str):
    """
    Notify user of a new message.
    Called from create_message() in core/messages.py
    """
    broadcaster.notify_user(user_did, 'new_message', {
        'message_id': message_id,
        'dialogue_key': dialogue_key
    })


def notify_message_count(user_did: str, unread_count: int):
    """
    Notify user of updated message count.
    """
    broadcaster.notify_user(user_did, 'message_count', {
        'unread': unread_count
    })
