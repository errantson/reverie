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
                color: '#C084FC',
                colorSecondary: '#A855F7',
                description: 'Purple-pink horizons',
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
                icon: '/assets/heraldry/icon_pds_witchcraft_systems.ico',
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
            },
            
            // ===================================================================
            // Discovered PDS Servers (June 2025 Network Scan)
            // ===================================================================
            
            'greysky.social': {
                id: 'greysky',
                name: 'Graysky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_graysky.png',
                color: '#374151',
                colorSecondary: '#1F2937',
                description: 'Deep grey aesthetic',
                className: 'heraldry-greysky'
            },
            'zio.blue': {
                id: 'zio',
                name: 'Zio',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_zio.png',
                color: '#F41146',
                colorSecondary: '#C40A37',
                description: 'Red skies realm',
                className: 'heraldry-zio'
            },
            'afternooncurry.com': {
                id: 'afternooncurry',
                name: 'Afternoon Curry',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_afternooncurry.png',
                color: '#FF8C00',
                colorSecondary: '#FF7500',
                description: 'Warm spiced domains',
                className: 'heraldry-afternooncurry'
            },
            'at.arles.us': {
                id: 'arles',
                name: 'Arles',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_arles.png',
                color: '#00A9FF',
                colorSecondary: '#0087CC',
                description: 'Sunlit territories',
                className: 'heraldry-arles'
            },
            'pds.atpota.to': {
                id: 'atpotato',
                name: 'AT Potato',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_pds_atpota_to.png',
                color: '#8B6F47',
                colorSecondary: '#6B5636',
                description: 'Root vegetable networks',
                className: 'heraldry-atpotato'
            },
            'pds.cauda.cloud': {
                id: 'cauda',
                name: 'Cauda Cloud',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_cauda.png',
                color: '#A0522D',
                colorSecondary: '#8B4513',
                description: 'Tail-end cloudscapes',
                className: 'heraldry-cauda'
            },
            'pds.commonscomputer.com': {
                id: 'commonscomputer',
                name: 'Commons Computer',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_pds_commonscomputer_com.png',
                color: '#10b981',
                colorSecondary: '#059669',
                description: 'Shared computing collective',
                className: 'heraldry-commonscomputer'
            },
            'pds.dholms.xyz': {
                id: 'dholms',
                name: 'DHolms',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_dholms.png',
                color: '#F4A460',
                colorSecondary: '#CD853F',
                description: 'Experimental protocol labs',
                className: 'heraldry-dholms'
            },
            'pds.numergent.com': {
                id: 'numergent',
                name: 'Numergent',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_pds_numergent_com.ico',
                color: '#0891b2',
                colorSecondary: '#0e7490',
                description: 'Numerical emergence',
                className: 'heraldry-numergent'
            },
            'pds.quimian.com': {
                id: 'quimian',
                name: 'Quimian',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_quimian.png',
                color: '#20B2AA',
                colorSecondary: '#008080',
                description: 'Blue digital gardens',
                className: 'heraldry-quimian'
            },
            'pds.robocracy.org': {
                id: 'robocracy',
                name: 'Robocracy',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_robocracy.png',
                color: '#9CA3AF',
                colorSecondary: '#6B7280',
                description: 'Automated governance',
                className: 'heraldry-robocracy'
            },
            'pds.shreyanjain.net': {
                id: 'shreyanjain',
                name: 'Shreyan Jain',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_pds_shreyanjain_net.png',
                color: '#a3eddb',
                colorSecondary: '#7dd4c4',
                description: 'Personal server realm',
                className: 'heraldry-shreyanjain'
            },
            'boobee.blue': {
                id: 'boobee',
                name: 'Boobee',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/icon_boobee.png',
                color: '#90EE90',
                colorSecondary: '#7CFC00',
                description: 'Light blue domains',
                className: 'heraldry-boobee'
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
