/**
 * Cheerful Role Component
 * 
 * Handles the Cheerful multi-worker role:
 * - Cheerful list display
 * - Spreading cheer stats
 * - Auto-liking behavior
 */

class CheerfulRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'cheerful-content-section';
        this.workers = [];
        this.stats = null;
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadCheerfulList = this.loadCheerfulList.bind(this);
        this.loadCheerfulStats = this.loadCheerfulStats.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('cheerful');
    }
    
    /**
     * Initialize the role
     */
    init() {
        this.setupEventListeners();
        return this;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('role:changed', (event) => {
            if (event.detail.role === 'cheerful') {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Listen for activation/deactivation
        if (window.WorkEvents) {
            window.WorkEvents.on(window.WorkEvents.EVENTS.CHEERFUL_ACTIVATED, () => {
                this.loadCheerfulList();
                this.loadCheerfulStats();
            });
            window.WorkEvents.on(window.WorkEvents.EVENTS.CHEERFUL_STEPPED_DOWN, () => {
                this.loadCheerfulList();
                this.loadCheerfulStats();
            });
        }
    }
    
    /**
     * Show the cheerful content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadCheerfulList();
            this.loadCheerfulStats();
        }
    }
    
    /**
     * Hide the cheerful content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load cheerful members list
     */
    async loadCheerfulList() {
        const listContainer = document.getElementById('cheerful-list');
        if (!listContainer) return;
        
        try {
            const response = await fetch('/api/work/cheerful/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            this.workers = data.role_info?.workers || [];
            
            if (this.workers.length === 0) {
                listContainer.innerHTML = `
                    <div class="cheerful-empty">
                        <div class="cheerful-empty-text">No Cheerful members yet</div>
                        <p style="color: #888; font-size: 0.75rem; margin-top: 0.5rem;">Be the first to spread cheer</p>
                    </div>
                `;
                return;
            }
            
            // Fetch all worker details in parallel
            const workerDetails = await Promise.all(this.workers.map(async (worker) => {
                const dreamer = await window.workCore?.fetchDreamerInfo(worker.did);
                return {
                    did: worker.did,
                    handle: dreamer?.handle || 'unknown',
                    displayName: dreamer?.display_name || dreamer?.handle || 'Unknown',
                    avatar: dreamer?.avatar || '/assets/default-avatar.png',
                    color: dreamer?.color_hex || '#e05ecf'
                };
            }));
            
            // Build the list HTML
            const listHTML = workerDetails.map(w => {
                const bgColor = w.color + '20'; // 20 is hex for ~12% opacity
                return `
                    <div class="cheerful-row" style="background: ${bgColor}; border-left: 3px solid ${w.color};">
                        <a href="/dreamer?did=${encodeURIComponent(w.did)}" class="cheerful-link dreamer-link" data-did="${w.did}">
                            <img src="${w.avatar}" alt="${w.handle}" class="cheerful-avatar" style="border-color: ${w.color};">
                            <span class="cheerful-name" style="color: ${w.color};">${w.displayName}</span>
                        </a>
                    </div>
                `;
            }).join('');
            
            listContainer.innerHTML = listHTML;
            
            // Initialize dreamer hover
            setTimeout(() => {
                if (window.DreamerHover) window.DreamerHover.init();
            }, 100);
            
        } catch (error) {
            console.error('Failed to load cheerful list:', error);
            listContainer.innerHTML = '<div class="cheerful-empty">Error loading cheerful members</div>';
        }
    }
    
    /**
     * Load cheerful stats
     */
    async loadCheerfulStats() {
        try {
            const response = await fetch('/api/work/cheerful/stats');
            if (response.ok) {
                this.stats = await response.json();
                this.renderStats();
            }
        } catch (error) {
            console.error('Failed to load cheerful stats:', error);
        }
    }
    
    /**
     * Render stats
     */
    renderStats() {
        if (!this.stats) return;
        
        const membersEl = document.getElementById('cheerful-total-members');
        const likesEl = document.getElementById('cheerful-total-likes');
        const cheeredEl = document.getElementById('cheerful-folks-cheered');
        
        if (membersEl) membersEl.textContent = this.stats.totalMembers || this.workers.length || 0;
        if (likesEl) likesEl.textContent = this.stats.totalLikes || 0;
        if (cheeredEl) cheeredEl.textContent = this.stats.folksCheered || 0;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CheerfulRole;
}

// Make available globally
window.CheerfulRole = CheerfulRole;
