/**
 * Heraldry System - Visual Identity for Foreign PDS Servers
 * 
 * Maps PDS server domains to their visual identity (colors, icons, labels)
 * Provides utility functions for getting heraldry based on server URL or handle
 */

console.log('🛡️ Loading heraldry.js...');

class HeraldrySystem {
    constructor() {
        // Known PDS server configurations
        this.registry = {
            'reverie.house': {
                id: 'reverie',
                name: 'Reverie House',
                fullName: 'Resident Dreamweaver',
                icon: '/assets/icon.png',
                color: '#87408d',
                colorSecondary: '#6a2f70',
                description: 'Home of dreams',
                className: 'heraldry-reverie'
            },
            'bsky.network': {
                id: 'bluesky',
                name: 'Bluesky',
                fullName: 'Awakened Dreamweaver',
                icon: '/assets/bluesky.png',
                color: '#4299e1',
                colorSecondary: '#2b6cb0',
                description: 'The Bluesky network',
                className: 'heraldry-bluesky'
            },
            'northsky.social': {
                id: 'northsky',
                name: 'Northsky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_northsky.png',
                color: '#4a90e2',
                colorSecondary: '#2c5aa0',
                description: 'Northern skies, cooler blues',
                className: 'heraldry-northsky'
            },
            'aesthetic.northsky.social': {
                id: 'northsky',
                name: 'Northsky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_northsky.png',
                color: '#4a90e2',
                colorSecondary: '#2c5aa0',
                description: 'Northern skies, cooler blues',
                className: 'heraldry-northsky'
            },
            'blacksky.app': {
                id: 'blacksky',
                name: 'Blacksky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_blacksky.png',
                color: '#1a1a1a',
                colorSecondary: '#000000',
                description: 'Dark mysterious realm',
                className: 'heraldry-blacksky'
            },
            'pds.witchcraft.systems': {
                id: 'witchcraft',
                name: 'Witchcraft',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_witchcraft.png',
                color: '#8b3a9c',
                colorSecondary: '#6b2875',
                description: 'Mystical purple domains',
                className: 'heraldry-witchcraft'
            },
            'selfhosted.social': {
                id: 'selfhosted',
                name: 'Selfhosted',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_selfhosted.png',
                color: '#2d7a4f',
                colorSecondary: '#1e5a37',
                description: 'Independent green servers',
                className: 'heraldry-selfhosted'
            },
            'pds.chaos.observer': {
                id: 'chaos',
                name: 'Chaos',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_chaos.png',
                color: '#e85d04',
                colorSecondary: '#9d0208',
                description: 'Entropy and disorder',
                className: 'heraldry-chaos'
            },
            'chaos.observer': {
                id: 'chaos',
                name: 'Chaos',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_chaos.png',
                color: '#e85d04',
                colorSecondary: '#9d0208',
                description: 'Entropy and disorder',
                className: 'heraldry-chaos'
            }
        };

        // Default heraldry for unknown servers
        this.defaultHeraldry = {
            id: 'default',
            name: 'Guest',
            fullName: 'Honoured Guest',
            icon: '/assets/wild_mindscape.png',
            color: '#2d3748',
            colorSecondary: '#1a202c',
            description: 'Unknown realm',
            className: 'heraldry-default'
        };

        console.log(`🛡️ Heraldry registry loaded with ${Object.keys(this.registry).length} known servers`);
    }

    /**
     * Get heraldry for a DID by resolving its PDS from DID document
     * @param {string} did - User DID
     * @returns {Promise<Object>} Heraldry configuration
     */
    async getByDID(did) {
        if (!did) return this.defaultHeraldry;
        
        try {
            // Fetch DID document from PLC directory
            const response = await fetch(`https://plc.directory/${did}`);
            if (!response.ok) return this.defaultHeraldry;
            
            const didDoc = await response.json();
            const service = didDoc.service?.find(s => s.id === '#atproto_pds');
            const serviceEndpoint = service?.serviceEndpoint;
            
            if (serviceEndpoint) {
                return this.getByServer(serviceEndpoint);
            }
        } catch (error) {
            console.warn('🛡️ Failed to resolve PDS from DID:', did, error);
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a PDS server URL
     * @param {string} serverUrl - Full PDS URL (e.g., "https://pds.chaos.observer")
     * @returns {Object} Heraldry configuration
     */
    getByServer(serverUrl) {
        if (!serverUrl) return this.defaultHeraldry;
        
        console.log(`🛡️ getByServer called with: ${serverUrl}`);
        
        // Extract domain from URL
        try {
            const url = new URL(serverUrl);
            const hostname = url.hostname;
            
            // Check registry for exact match
            if (this.registry[hostname]) {
                console.log(`🛡️ Exact match found for ${hostname}:`, this.registry[hostname].name);
                return this.registry[hostname];
            }
            
            // Check for partial matches (e.g., pds.chaos.observer matches chaos.observer)
            const parts = hostname.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
                const subdomain = parts.slice(i).join('.');
                if (this.registry[subdomain]) {
                    console.log(`🛡️ Subdomain match found for ${subdomain}:`, this.registry[subdomain].name);
                    return this.registry[subdomain];
                }
            }
        } catch (error) {
            console.warn('🛡️ Invalid server URL:', serverUrl);
        }
        
        console.log(`🛡️ No match found for ${serverUrl}, using default`);
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a handle
     * @param {string} handle - User handle (e.g., "chaos.observer")
     * @returns {Object} Heraldry configuration
     */
    getByHandle(handle) {
        if (!handle) return this.defaultHeraldry;
        
        // Extract domain from handle
        const parts = handle.split('.');
        if (parts.length < 2) return this.defaultHeraldry;
        
        // Check for full handle match
        if (this.registry[handle]) {
            return this.registry[handle];
        }
        
        // Check for domain match (last 2 parts usually)
        const domain = parts.slice(-2).join('.');
        if (this.registry[domain]) {
            return this.registry[domain];
        }
        
        // Check for any subdomain match
        for (let i = 0; i < parts.length - 1; i++) {
            const subdomain = parts.slice(i).join('.');
            if (this.registry[subdomain]) {
                return this.registry[subdomain];
            }
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a dreamer object
     * @param {Object} dreamer - Dreamer object with server property
     * @returns {Object} Heraldry configuration
     */
    getByDreamer(dreamer) {
        if (!dreamer) return this.defaultHeraldry;
        
        // Try server URL first
        if (dreamer.server) {
            const heraldry = this.getByServer(dreamer.server);
            if (heraldry.id !== 'default') return heraldry;
        }
        
        // Fallback to handle
        if (dreamer.handle) {
            return this.getByHandle(dreamer.handle);
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Register a new server heraldry
     * @param {string} domain - Server domain
     * @param {Object} config - Heraldry configuration
     */
    register(domain, config) {
        this.registry[domain] = {
            id: config.id || domain.replace(/\./g, '_'),
            name: config.name || domain,
            fullName: config.fullName || domain,
            icon: config.icon || this.defaultHeraldry.icon,
            color: config.color || this.defaultHeraldry.color,
            colorSecondary: config.colorSecondary || config.color || this.defaultHeraldry.colorSecondary,
            description: config.description || '',
            className: config.className || `heraldry-${config.id || domain.replace(/\./g, '_')}`
        };
        console.log(`🛡️ Registered heraldry for ${domain}`);
    }

    /**
     * Get all registered servers
     * @returns {Array} Array of server configurations
     */
    getAllServers() {
        return Object.keys(this.registry).map(domain => ({
            domain,
            ...this.registry[domain]
        }));
    }

    /**
     * Check if a server is registered
     * @param {string} serverUrl - Server URL or domain
     * @returns {boolean}
     */
    isKnown(serverUrl) {
        const heraldry = this.getByServer(serverUrl);
        return heraldry.id !== 'default';
    }
}

// Create global instance
window.heraldrySystem = new HeraldrySystem();

console.log('✅ Heraldry system initialized');
