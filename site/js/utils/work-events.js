/**
 * Work Events System
 * 
 * Centralized event emitter for work-related state changes.
 * Allows different pages/widgets to stay in sync.
 * Uses BroadcastChannel for cross-tab communication.
 */

class WorkEvents {
    constructor() {
        this.listeners = {};
        
        // Use BroadcastChannel for cross-tab/cross-page communication
        try {
            this.channel = new BroadcastChannel('work-events');
            this.channel.onmessage = (event) => {
                console.log(`📨 [WorkEvents] Received from other tab:`, event.data);
                this._triggerListeners(event.data.event, event.data.data);
            };
            console.log('✅ [WorkEvents] Event system initialized with BroadcastChannel');
        } catch (error) {
            console.warn('⚠️ [WorkEvents] BroadcastChannel not available, falling back to local events only');
            this.channel = null;
        }
    }

    /**
     * Register event listener
     * 
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} - Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);

        // Return unsubscribe function
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Trigger local listeners without broadcasting
     * 
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    _triggerListeners(event, data) {
        console.log(`🔔 [WorkEvents] Triggering local listeners for ${event}`, `Listener count: ${this.listeners[event]?.length || 0}`);
        
        if (!this.listeners[event]) {
            console.warn(`⚠️ [WorkEvents] No listeners registered for ${event}`);
            return;
        }

        this.listeners[event].forEach((callback, index) => {
            try {
                console.log(`  └─ [WorkEvents] Calling listener #${index + 1} for ${event}`);
                callback(data);
            } catch (error) {
                console.error(`❌ [WorkEvents] Error in ${event} listener #${index + 1}:`, error);
            }
        });
    }

    /**
     * Emit event to all listeners (local and cross-tab)
     * 
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        console.log(`📢 [WorkEvents] Emitting ${event}`, data);
        
        // Trigger local listeners
        this._triggerListeners(event, data);
        
        // Broadcast to other tabs/pages
        if (this.channel) {
            try {
                this.channel.postMessage({ event, data });
                console.log(`📡 [WorkEvents] Broadcasted to other tabs: ${event}`);
            } catch (error) {
                console.error(`❌ [WorkEvents] Error broadcasting ${event}:`, error);
            }
        }
    }

    /**
     * Remove all listeners for an event
     */
    off(event) {
        delete this.listeners[event];
    }
    
    /**
     * Close the broadcast channel (cleanup)
     */
    close() {
        if (this.channel) {
            this.channel.close();
        }
    }
}

// Event types
WorkEvents.EVENTS = {
    // Greeter events
    GREETER_ACTIVATED: 'greeter:activated',
    GREETER_STEPPED_DOWN: 'greeter:stepped-down',
    GREETER_STATUS_CHANGED: 'greeter:status-changed',
    
    // Mapper events
    MAPPER_ACTIVATED: 'mapper:activated',
    MAPPER_STEPPED_DOWN: 'mapper:stepped-down',
    MAPPER_STATUS_CHANGED: 'mapper:status-changed',
    
    // Credential events
    CREDENTIALS_CONNECTED: 'credentials:connected',
    CREDENTIALS_DISCONNECTED: 'credentials:disconnected',
    
    // Role events
    ROLE_ACTIVATED: 'role:activated',
    ROLE_DEACTIVATED: 'role:deactivated',
    
    // Status refresh
    STATUS_REFRESH_NEEDED: 'status:refresh-needed'
};

// Export singleton instance
window.WorkEvents = new WorkEvents();

// Also expose event types
window.WorkEvents.EVENTS = WorkEvents.EVENTS;

console.log('✅ [WorkEvents] Event types registered:', Object.keys(WorkEvents.EVENTS));
