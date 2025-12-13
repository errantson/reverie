/**
 * ShowDreamer Widget
 * Displays a dreamer/Bluesky profile in a shadowbox overlay
 * Similar to showpost.js but for profiles
 */

class ShowDreamer {
    constructor() {
        this.shadowbox = null;
        this.container = null;
        this.loadStyles();
    }
    
    loadStyles() {
        // Helper to load stylesheet
        const loadStylesheet = (href) => {
            if (document.querySelector(`link[href*="${href}"]`)) {
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        };
        
        // Load CSS needed for profile styling
        loadStylesheet('/css/widgets/profile.css?v=4');
        loadStylesheet('/css/widgets/dreamer-hover.css');
        loadStylesheet('/css/widgets/showdreamer.css');
    }

    /**
     * Show a dreamer profile from a DID
     * @param {string} did - DID of the dreamer (did:plc:...)
     */
    async show(did) {
        console.log(`🎨 [ShowDreamer] show() called with DID: ${did}`);
        
        if (!did || !did.startsWith('did:')) {
            console.error('[ShowDreamer] Invalid DID:', did);
            return;
        }

        console.log('🎨 [ShowDreamer] Creating shadowbox...');
        
        // Create shadowbox
        this.shadowbox = new Shadowbox({
            showCloseButton: true,
            onClose: () => {
                console.log('🎨 [ShowDreamer] Shadowbox closing');
                this.cleanup();
            }
        });
        this.shadowbox.create();
        
        console.log('🎨 [ShowDreamer] Shadowbox created, fetching dreamer data...');

        // Fetch dreamer data and color BEFORE creating visible container
        try {
            const dreamerData = await this.fetchDreamer(did);
            console.log('🎨 [ShowDreamer] Dreamer data fetched:', dreamerData);
            
            const dreamerColor = dreamerData.color_hex || '#d0c7f0';
            console.log(`🎨 [ShowDreamer] Using color: ${dreamerColor}`);
            
            // Now create dreamer container with correct color from the start
            this.container = document.createElement('div');
            this.container.className = 'showdreamer-container';
            this.container.style.cssText = `
                background: white;
                border: 2px solid ${dreamerColor};
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
                --user-color: ${dreamerColor};
            `;

            
            this.shadowbox.contentContainer.appendChild(this.container);
            
            console.log('🎨 [ShowDreamer] Container created, rendering content...');
            
            // Render content
            await this.renderDreamer(dreamerData, dreamerColor);
            
            console.log('🎨 [ShowDreamer] Content rendered, fading in...');
            
            // Fade in smoothly
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
            });
            
            console.log('✅ [ShowDreamer] Popup fully displayed');
        } catch (error) {
            console.error('[ShowDreamer] Error fetching dreamer:', error);
            console.error('[ShowDreamer] Error stack:', error.stack);            // Create container for error message
            this.container = document.createElement('div');
            this.container.className = 'showdreamer-container';
            this.container.style.cssText = `
                background: white;
                border: 2px solid #d0c7f0;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            `;
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #c44;">
                    Unable to load dreamer profile
                </div>
            `;
            this.shadowbox.contentContainer.appendChild(this.container);
        }
    }

    /**
     * Fetch dreamer data from Reverie API
     */
    async fetchDreamer(did) {
        console.log(`🌐 [ShowDreamer] Fetching dreamer data for ${did}...`);
        
        const response = await fetch('/api/dreamers');
        if (!response.ok) {
            console.error(`[ShowDreamer] Failed to fetch dreamers: ${response.status} ${response.statusText}`);
            throw new Error('Failed to fetch dreamers');
        }

        const dreamers = await response.json();
        console.log(`🌐 [ShowDreamer] Received ${dreamers.length} dreamers from API`);
        
        const dreamer = dreamers.find(d => d.did === did);
        
        if (!dreamer) {
            console.error(`[ShowDreamer] Dreamer not found with DID: ${did}`);
            console.log('[ShowDreamer] Available DIDs:', dreamers.map(d => d.did).slice(0, 5));
            throw new Error('Dreamer not found');
        }
        
        console.log('✅ [ShowDreamer] Dreamer found:', dreamer.name || dreamer.handle);
        return dreamer;
    }

    /**
     * Fetch souvenirs data for the dreamer
     */
    async fetchSouvenirs(dreamer) {
        if (!dreamer.souvenirs || Object.keys(dreamer.souvenirs).length === 0) {
            return [];
        }

        try {
            const response = await fetch('/api/souvenirs');
            if (!response.ok) return [];
            
            const rawSouvenirs = await response.json();
            const userFormKeys = Object.keys(dreamer.souvenirs);
            const souvenirIcons = [];
            
            userFormKeys.forEach(formKey => {
                for (const [souvenirKey, souvenirData] of Object.entries(rawSouvenirs)) {
                    if (souvenirData.key === formKey) {
                        souvenirIcons.push({
                            icon: souvenirData.icon,
                            name: souvenirData.name,
                            key: formKey
                        });
                        break;
                    }
                }
            });
            
            return souvenirIcons;
        } catch (err) {
            console.error('[ShowDreamer] Error loading souvenirs:', err);
            return [];
        }
    }

    /**
     * Fetch recent activity (posts) for the dreamer
     */
    async fetchActivity(did, handle) {
        try {
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=10`);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.feed || [];
        } catch (error) {
            console.warn('[ShowDreamer] Could not fetch activity:', error);
            return [];
        }
    }

    /**
     * Render the dreamer profile
     */
    async renderDreamer(dreamer, color) {
        const avatar = dreamer.avatar || '/assets/icon_face.png';
        const name = dreamer.name || dreamer.display_name || dreamer.handle;
        const handle = dreamer.handle;
        const description = dreamer.description || 'Little is said. Less is known.';
        
        // Get arrival date
        const arrivalDate = dreamer.arrival ? new Date(dreamer.arrival * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'Unknown';

        // Extract RGB values from color for CSS variable
        let colorRgb = '208, 199, 240'; // default
        if (color && color.startsWith('#')) {
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);
            colorRgb = `${r}, ${g}, ${b}`;
        }
        this.container.style.setProperty('--user-color-rgb', colorRgb);

        // Fetch souvenirs
        const souvenirs = await this.fetchSouvenirs(dreamer);
        
        let souvenirsHTML = '';
        if (souvenirs.length > 0) {
            souvenirsHTML = `
                <div class="dreamer-popup-souvenirs">
                    <div class="dreamer-popup-souvenirs-label">Souvenirs</div>
                    <div class="dreamer-popup-souvenirs-icons">
                        ${souvenirs.map(s => `<img src="${s.icon}" alt="${s.name}" title="${s.name}" class="dreamer-popup-souvenir-icon">`).join('')}
                    </div>
                </div>
            `;
        }

        // Fetch and render recent activity
        const activityFeed = await this.fetchActivity(dreamer.did, handle);
        let activityHTML = '';
        if (activityFeed.length > 0) {
            const recentPosts = activityFeed.slice(0, 5);
            activityHTML = `
                <div class="dreamer-popup-activity">
                    <div class="dreamer-popup-activity-label">Recent Activity</div>
                    ${recentPosts.map(item => this.renderActivityItem(item)).join('')}
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="dreamer-popup-header" style="border-bottom: 2px solid ${color};">
                <img src="${avatar}" alt="${name}" class="dreamer-popup-avatar" onerror="this.src='/assets/icon_face.png'">
                <div class="dreamer-popup-identity">
                    <div class="dreamer-popup-name">${name}</div>
                    <div class="dreamer-popup-handle">@${handle}</div>
                </div>
            </div>
            ${description ? `<div class="dreamer-popup-description">${description}</div>` : ''}
            <div class="dreamer-popup-stats">
                <div class="dreamer-popup-stat">
                    <div class="dreamer-popup-stat-value">${arrivalDate}</div>
                    <div class="dreamer-popup-stat-label">Arrived at Reverie House</div>
                </div>
            </div>
            ${souvenirsHTML}
            ${activityHTML}
            <div class="dreamer-popup-actions">
                <a href="/dreamer?did=${encodeURIComponent(dreamer.did)}" class="dreamer-popup-btn dreamer-popup-btn-primary" target="_blank">
                    View Full Profile
                </a>
                <a href="https://bsky.app/profile/${handle}" class="dreamer-popup-btn dreamer-popup-btn-secondary" target="_blank" rel="noopener noreferrer">
                    View on Bluesky
                </a>
            </div>
        `;
    }

    /**
     * Render a single activity item (post)
     */
    renderActivityItem(feedItem) {
        const post = feedItem.post;
        const record = post.record;
        const text = record.text || '';
        const createdAt = new Date(record.createdAt);
        const timeAgo = this.getTimeAgo(createdAt);

        return `
            <div class="dreamer-popup-activity-item">
                <div class="dreamer-popup-activity-time">${timeAgo}</div>
                <div class="dreamer-popup-activity-text">${this.escapeHtml(text).substring(0, 200)}${text.length > 200 ? '...' : ''}</div>
            </div>
        `;
    }

    /**
     * Get human-readable time ago
     */
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + 'y ago';
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + 'mo ago';
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + 'd ago';
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + 'h ago';
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + 'm ago';
        
        return Math.floor(seconds) + 's ago';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Cleanup when shadowbox closes
     */
    cleanup() {
        this.container = null;
        this.shadowbox = null;
    }

    /**
     * Close the shadowbox
     */
    close() {
        if (this.shadowbox) {
            this.shadowbox.close();
        }
    }
}

// Make globally available
window.ShowDreamer = ShowDreamer;

// Helper function for easy access
window.showDreamer = function(did) {
    console.log(`🎯 [ShowDreamer] window.showDreamer() called with:`, did);
    
    // Handle event object being passed (from inline onclick)
    if (did instanceof Event || (typeof did === 'object' && did?.target)) {
        console.error('[ShowDreamer] Event object passed instead of DID - this is a bug in the onclick handler');
        return;
    }
    
    // Ensure we have a string
    if (typeof did !== 'string') {
        console.error('[ShowDreamer] Invalid argument type:', typeof did, 'Value:', did);
        return;
    }
    
    console.log(`✨ [ShowDreamer] Creating ShowDreamer instance for DID: ${did}`);
    
    const widget = new ShowDreamer();
    window.showDreamerWidget = widget; // Store globally so close button can access it
    widget.show(did);
};

console.log('✅ [ShowDreamer] Widget loaded and available');
