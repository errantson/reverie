/**
 * SSE (Server-Sent Events) Notification Client
 * 
 * Receives real-time push notifications from the server using SSE.
 * Simpler than WebSocket, perfect for server-to-client push.
 * 
 * Usage:
 *   const client = new SSENotificationClient(userDid);
 *   client.on('new_message', (data) => {
 *       console.log('New message:', data);
 *   });
 *   client.connect();
 */

class SSENotificationClient {
    constructor(userDid) {
        this.userDid = userDid;
        this.eventSource = null;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.connected = false;
        
        console.log('🔔 [SSE] Client initialized for', userDid.substring(0, 30) + '...');
    }
    
    /**
     * Register an event handler
     * @param {string} eventType - Event type ('new_message', 'message_count', etc.)
     * @param {function} handler - Handler function
     */
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }
    
    /**
     * Trigger event handlers
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     */
    trigger(eventType, data) {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error(`❌ [SSE] Error in ${eventType} handler:`, e);
            }
        });
    }
    
    /**
     * Connect to SSE stream
     */
    connect() {
        if (this.eventSource) {
            console.log('⚠️ [SSE] Already connected');
            return;
        }
        
        const url = `/api/notifications/stream?user_did=${encodeURIComponent(this.userDid)}`;
        console.log('🔌 [SSE] Connecting to', url);
        
        try {
            this.eventSource = new EventSource(url);
            
            // Connection opened
            this.eventSource.addEventListener('connected', (e) => {
                console.log('✅ [SSE] Connected');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.trigger('connected', JSON.parse(e.data));
            });
            
            // New message event
            this.eventSource.addEventListener('new_message', (e) => {
                const data = JSON.parse(e.data);
                console.log('📨 [SSE] New message:', data);
                this.trigger('new_message', data);
            });
            
            // Message count event
            this.eventSource.addEventListener('message_count', (e) => {
                const data = JSON.parse(e.data);
                console.log('📊 [SSE] Message count:', data);
                this.trigger('message_count', data);
            });
            
            // Ping/heartbeat
            this.eventSource.addEventListener('ping', (e) => {
                // Silent heartbeat, just log in verbose mode
                // console.log('💓 [SSE] Heartbeat');
            });
            
            // Error handling
            this.eventSource.onerror = (error) => {
                console.error('❌ [SSE] Connection error:', error);
                this.connected = false;
                this.trigger('disconnected', { error });
                
                // EventSource will auto-reconnect, but we track attempts
                this.reconnectAttempts++;
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('⚠️ [SSE] Max reconnect attempts reached, closing connection');
                    this.disconnect();
                } else {
                    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
                    console.log(`🔄 [SSE] Will retry connection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                }
            };
            
        } catch (e) {
            console.error('❌ [SSE] Failed to create EventSource:', e);
        }
    }
    
    /**
     * Disconnect from SSE stream
     */
    disconnect() {
        console.log('🔌 [SSE] Disconnecting...');
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.connected = false;
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    }
    
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}

// Make globally available
window.SSENotificationClient = SSENotificationClient;

console.log('✅ [SSE] Notification client loaded');
