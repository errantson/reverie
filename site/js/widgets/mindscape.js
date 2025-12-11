/**
 * Mindscape Widget
 * Manages the user card, population display, and event stack
 */

class Mindscape {
    constructor() {
        this.session = null;
        this.dreamerData = null;
        this.worldData = null;
        this.dreamersData = null;
        this.allEvents = [];
        this.eventStack = null;
        this.init();
    }

    async init() {
        console.log('[Mindscape] Initializing...');
        this.session = window.oauthManager?.getSession();
        
        // Wait for EventStack to be available
        if (typeof EventStack === 'undefined') {
            console.warn('[Mindscape] EventStack not loaded yet, waiting...');
            setTimeout(() => this.init(), 100);
            return;
        }
        
        this.eventStack = new EventStack();
        await this.loadData();
        this.render();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    async loadData() {
        try {
            // Load events from API
            const eventsResponse = await fetch('/api/canon');
            this.allEvents = await eventsResponse.json();
            console.log(`[Mindscape] Loaded ${this.allEvents.length} events`);
            
            // Load world data for population stats
            const worldResponse = await fetch('/api/world');
            this.worldData = await worldResponse.json();
            console.log('[Mindscape] Loaded world data:', this.worldData);
            
            // Load dreamers data for population
            const dreamersResponse = await fetch('/api/dreamers');
            this.dreamersData = await dreamersResponse.json();
            console.log('[Mindscape] Loaded dreamers data');
            
            // If we have a session, load dreamer data
            if (this.session) {
                const dreamerResponse = await fetch('/api/dreamer');
                this.dreamerData = await dreamerResponse.json();
                console.log('[Mindscape] Loaded dreamer data:', this.dreamerData);
            }
        } catch (error) {
            console.error('[Mindscape] Error loading data:', error);
        }
    }

    render() {
        this.renderUserCard();
        this.renderPopulation();
        this.renderEventStack();
    }

    renderUserCard() {
        const userInfoContainer = document.getElementById('user-info');
        
        if (!userInfoContainer) {
            console.warn('[Mindscape] User info container not found');
            return;
        }

        console.log('[Mindscape] Rendering user card...', {
            session: this.session,
            dreamerData: this.dreamerData
        });

        // Render keeper-style user card
        if (this.session && this.dreamerData) {
            const arrival = this.dreamerData.arrival 
                ? new Date(this.dreamerData.arrival * 1000).toLocaleDateString() 
                : 'Unknown';
            
            const role = this.dreamerData.role || 'dreamer';
            const octant = this.dreamerData.octant || 'unknown';
            const userColor = this.dreamerData.color_hex || '#734ba1';
            
            userInfoContainer.innerHTML = `
                <div class="keeper-style-card" style="--user-color: ${userColor};">
                    <div class="user-avatar">
                        <img src="${this.session.avatar || '/assets/icon_transp.png'}" alt="${this.session.name || 'User'}">
                    </div>
                    <div class="user-details">
                        <div class="user-name">${this.session.name || 'Anonymous Dreamer'}</div>
                        <div class="user-handle">@${this.session.handle || 'unknown.handle'}</div>
                        <div class="user-metadata">
                            <div class="user-meta-item">
                                <span class="meta-label">Arrived</span>
                                <span class="meta-value">${arrival}</span>
                            </div>
                            <div class="user-meta-item">
                                <span class="meta-label">Role</span>
                                <span class="meta-value">${role}</span>
                            </div>
                        </div>
                        ${octant !== 'unknown' ? `<div class="octant-badge octant-bg-${octant}">${octant.toUpperCase()}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            userInfoContainer.innerHTML = `
                <div class="keeper-style-card guest">
                    <div class="guest-info-row">
                        <div class="user-avatar-stroke">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="user-details">
                            <div class="user-name">Guest</div>
                            <div class="user-handle">Not logged in</div>
                        </div>
                    </div>
                    <div class="guest-actions">
                        <button class="btn guest-login-btn" onclick="window.loginManager?.showLoginUI()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>DREAMWEAVER LOGIN</span>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderPopulation() {
        const populationContainer = document.getElementById('population-panel');
        
        if (!populationContainer) {
            console.warn('[Mindscape] Population container not found');
            return;
        }

        if (!this.worldData || !this.dreamersData) {
            populationContainer.innerHTML = `
                <div class="population-panel-title">Wild Mindscape</div>
                <div style="text-align: center; color: #999; padding: 20px;">Loading...</div>
            `;
            return;
        }

        const idleDreamers = this.worldData.idle_dreamers || 0;
        const dreamweavers = this.dreamersData.length || 0;
        const residents = this.dreamersData.filter(d => 
            d.server && d.server.includes('reverie.house')
        ).length || 0;

        // Format numbers
        const formatNum = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num.toLocaleString();
        };

        populationContainer.innerHTML = `
            <div class="population-panel-title">OUR WILD MINDSCAPE</div>
            <div class="population-grid">
                <div class="population-item large">
                    <div class="population-value">${idleDreamers.toLocaleString()}</div>
                    <div class="population-label">Idle Dreamers</div>
                </div>
                <div class="population-item small-grid">
                    <div>
                        <div class="population-value">${formatNum(dreamweavers)}</div>
                        <div class="population-label">Dreamweavers</div>
                    </div>
                    <div>
                        <div class="population-value">${formatNum(residents)}</div>
                        <div class="population-label">Residents</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderEventStack() {
        const container = document.getElementById('eventstack');
        if (!container) {
            console.warn('[Mindscape] Event stack container not found');
            return;
        }

        // Render all events in descending order
        this.eventStack.render(this.allEvents, container, {
            colorMode: 'auto',
            colorIntensity: 'highlight',
            sortOrder: 'desc',
            limit: 500,
            emptyMessage: 'No events recorded yet',
            onRowClick: (url) => {
                if (window.showPost) {
                    window.showPost(url);
                }
            }
        });
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-events');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '⏳';
                await this.loadData();
                this.render();
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄';
            });
        }

        // Filter button (placeholder for future filtering UI)
        const filterBtn = document.getElementById('filter-events');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                alert('Filtering options coming soon!');
            });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mindscapeWidget = new Mindscape();
    });
} else {
    window.mindscapeWidget = new Mindscape();
}
