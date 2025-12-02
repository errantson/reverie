#!/usr/bin/env python3
"""
SSE (Server-Sent Events) Routes

Provides real-time push notifications to frontend clients.
"""

from flask import Blueprint, Response, request, stream_with_context
import json
import time
import queue
from core.notifications import broadcaster


notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/notifications/stream', methods=['GET'])
def notification_stream():
    """
    SSE endpoint for real-time notifications.
    
    Client connects and receives events as they happen:
    - new_message: When a message is created
    - message_count: When unread count changes
    
    Usage:
        const eventSource = new EventSource('/api/notifications/stream');
        eventSource.addEventListener('new_message', (e) => {
            const data = JSON.parse(e.data);
            console.log('New message:', data);
        });
    """
    # Get user DID from query param
    user_did = request.args.get('user_did')
    
    if not user_did:
        return {'error': 'user_did required'}, 401
    
    # Create queue for this connection (use regular Queue, not asyncio)
    q = queue.Queue(maxsize=100)
    
    def generate():
        """Generator function for SSE stream"""
        try:
            # Register connection
            broadcaster.add_connection(user_did, q)
            
            # Send initial connection event
            yield f"event: connected\ndata: {json.dumps({'user_did': user_did})}\n\n"
            
            # Keep connection alive with heartbeat
            last_heartbeat = time.time()
            
            while True:
                try:
                    # Wait for event with timeout (for heartbeat)
                    event = None
                    try:
                        # Non-blocking get with short timeout
                        event = q.get(block=True, timeout=1.0)
                    except queue.Empty:
                        pass
                    
                    if event:
                        # Send event to client
                        event_type = event.get('type', 'message')
                        event_data = event.get('data', {})
                        
                        yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"
                    
                    # Send heartbeat every 30 seconds to keep connection alive
                    now = time.time()
                    if now - last_heartbeat > 30:
                        yield f"event: ping\ndata: {json.dumps({'timestamp': int(now)})}\n\n"
                        last_heartbeat = now
                    
                except GeneratorExit:
                    break
                except Exception as e:
                    print(f"❌ [SSE] Error in stream: {e}")
                    break
        
        finally:
            # Cleanup on disconnect
            broadcaster.remove_connection(user_did, q)
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable nginx buffering
            'Connection': 'keep-alive'
        }
    )


@notifications_bp.route('/notifications/test', methods=['POST'])
def test_notification():
    """
    Test endpoint to manually trigger a notification.
    
    Body:
        {
            "user_did": "did:plc:...",
            "event_type": "new_message",
            "data": {"message_id": 123}
        }
    """
    data = request.json
    user_did = data.get('user_did')
    event_type = data.get('event_type', 'test')
    event_data = data.get('data', {})
    
    if not user_did:
        return {'error': 'user_did required'}, 400
    
    broadcaster.notify_user(user_did, event_type, event_data)
    
    return {
        'status': 'success',
        'message': f'Notification sent to {user_did[:20]}...',
        'active_connections': broadcaster.get_connection_count(user_did)
    }


@notifications_bp.route('/notifications/stats', methods=['GET'])
def notification_stats():
    """
    Get notification system statistics.
    """
    return {
        'total_connections': broadcaster.get_connection_count(),
        'users_connected': len(broadcaster.connections)
    }
