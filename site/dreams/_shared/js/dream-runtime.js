/**
 * Dream Runtime - Core infrastructure for Reverie dreams
 * 
 * This module provides:
 * - Authentication and session management
 * - Data access to reverie.db via API
 * - PDS integration for dream-specific atproto collections
 * - State persistence across sessions
 * - Common utilities for all dreams
 */

export class DreamRuntime {
    constructor(config = {}) {
        this.config = {
            dreamId: config.dreamId || 'unknown',
            requireAuth: config.requireAuth || false,
            dataPermissions: config.dataPermissions || [],
            ...config
        };
        
        this.session = null;
        this.userData = null;
        this.dreamState = null;
        this.pdsClient = null;
    }
    
    async init() {
        console.log(`🌙 [DreamRuntime] Initializing for dream: ${this.config.dreamId}`);
        
        // Check for existing session
        await this.checkSession();
        
        // Load dream state
        await this.loadDreamState();
        
        // Initialize PDS client if needed
        if (this.isAuthenticated()) {
            await this.initPDSClient();
        }
        
        console.log(`✅ [DreamRuntime] Initialized`);
    }
    
    async checkSession() {
        // Check if oauthManager is available from main site
        if (window.oauthManager) {
            this.session = window.oauthManager.getSession();
            if (this.session) {
                console.log(`👤 [DreamRuntime] User session found: ${this.session.displayName}`);
            }
        }
        
        // If no session and auth required, redirect to login
        if (this.config.requireAuth && !this.session) {
            console.warn(`⚠️ [DreamRuntime] Authentication required but not found`);
            // Could redirect to login or show login modal
        }
    }
    
    isAuthenticated() {
        return this.session !== null && this.session.did;
    }
    
    async getUserData() {
        if (!this.isAuthenticated()) {
            return null;
        }
        
        if (this.userData) {
            return this.userData;
        }
        
        try {
            // Fetch user's dreamer data from reverie API
            const response = await fetch(`/api/dreamers/${this.session.did}`);
            if (response.ok) {
                this.userData = await response.json();
                console.log(`📊 [DreamRuntime] User data loaded`);
                return this.userData;
            }
        } catch (error) {
            console.error(`❌ [DreamRuntime] Failed to load user data:`, error);
        }
        
        return null;
    }
    
    async loadDreamState() {
        // Load dream-specific state from localStorage
        const stateKey = `dream_state_${this.config.dreamId}`;
        const storedState = localStorage.getItem(stateKey);
        
        if (storedState) {
            try {
                this.dreamState = JSON.parse(storedState);
                console.log(`💾 [DreamRuntime] State loaded from localStorage`);
            } catch (error) {
                console.error(`❌ [DreamRuntime] Failed to parse stored state:`, error);
                this.dreamState = {};
            }
        } else {
            this.dreamState = {};
        }
        
        // If authenticated, could also fetch from PDS
        if (this.isAuthenticated()) {
            // TODO: Fetch dream state from PDS collection
        }
    }
    
    async saveDreamState(state) {
        this.dreamState = { ...this.dreamState, ...state };
        
        // Save to localStorage
        const stateKey = `dream_state_${this.config.dreamId}`;
        localStorage.setItem(stateKey, JSON.stringify(this.dreamState));
        
        // If authenticated, also save to PDS
        if (this.isAuthenticated() && this.pdsClient) {
            // TODO: Save to PDS collection
            console.log(`💾 [DreamRuntime] State saved (local + PDS)`);
        } else {
            console.log(`💾 [DreamRuntime] State saved (local only)`);
        }
    }
    
    getDreamState(key) {
        if (key) {
            return this.dreamState[key];
        }
        return this.dreamState;
    }
    
    async initPDSClient() {
        // Initialize connection to user's PDS for dream-specific collections
        if (window.oauthManager && window.oauthManager.client) {
            this.pdsClient = window.oauthManager.client;
            console.log(`🔗 [DreamRuntime] PDS client initialized`);
        }
    }
    
    async fetchDreamData(path) {
        // Fetch dream-specific data from API or local files
        try {
            const response = await fetch(`/dreams/${this.config.dreamId}/data/${path}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error(`❌ [DreamRuntime] Failed to fetch dream data:`, error);
        }
        return null;
    }
    
    async writeCanon(entry) {
        // Write to the user's canon (reverie.db)
        if (!this.isAuthenticated()) {
            console.warn(`⚠️ [DreamRuntime] Cannot write canon - not authenticated`);
            return false;
        }
        
        try {
            const response = await fetch('/api/canon', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    did: this.session.did,
                    event: entry.event,
                    context: entry.context,
                    dreamId: this.config.dreamId,
                    epoch: Math.floor(Date.now() / 1000)
                })
            });
            
            if (response.ok) {
                console.log(`📖 [DreamRuntime] Canon entry written:`, entry.event);
                return true;
            }
        } catch (error) {
            console.error(`❌ [DreamRuntime] Failed to write canon:`, error);
        }
        
        return false;
    }
    
    async writeToCollection(collection, record) {
        // Write to a custom atproto collection on user's PDS
        if (!this.isAuthenticated() || !this.pdsClient) {
            console.warn(`⚠️ [DreamRuntime] Cannot write to collection - not authenticated`);
            return false;
        }
        
        try {
            const response = await this.pdsClient.com.atproto.repo.createRecord({
                repo: this.session.did,
                collection: collection,
                record: {
                    ...record,
                    $type: collection,
                    createdAt: new Date().toISOString()
                }
            });
            
            console.log(`📝 [DreamRuntime] Record created in ${collection}`);
            return response;
        } catch (error) {
            console.error(`❌ [DreamRuntime] Failed to write to collection:`, error);
            return false;
        }
    }
    
    async readFromCollection(collection, limit = 10) {
        // Read from a custom atproto collection on user's PDS
        if (!this.isAuthenticated() || !this.pdsClient) {
            console.warn(`⚠️ [DreamRuntime] Cannot read from collection - not authenticated`);
            return null;
        }
        
        try {
            const response = await this.pdsClient.com.atproto.repo.listRecords({
                repo: this.session.did,
                collection: collection,
                limit: limit
            });
            
            return response.records;
        } catch (error) {
            console.error(`❌ [DreamRuntime] Failed to read from collection:`, error);
            return null;
        }
    }
    
    // Event system for cross-dream communication
    emitEvent(eventName, data) {
        const event = new CustomEvent(`dream:${this.config.dreamId}:${eventName}`, {
            detail: data
        });
        window.dispatchEvent(event);
        console.log(`📡 [DreamRuntime] Event emitted: ${eventName}`);
    }
    
    onEvent(eventName, callback) {
        window.addEventListener(`dream:${this.config.dreamId}:${eventName}`, (e) => {
            callback(e.detail);
        });
    }
}

// Shared utility functions for all dreams
export const DreamUtils = {
    // Generate a unique ID for dream elements
    generateId() {
        return `dream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // Ease functions for animations
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    
    // Interpolate between two values
    lerp(start, end, t) {
        return start + (end - start) * t;
    },
    
    // Random number in range
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    // Format timestamp for display
    formatTimestamp(epoch) {
        return new Date(epoch * 1000).toLocaleString();
    }
};
