
class Sidebar {
    constructor(container) {
        this.container = container;
        this.dreamers = [];
        this.dreamersLoaded = false; // Track if dreamers have been loaded
        this.hoverWidget = null;
        this.carouselIndex = 0; // Track current carousel view
        this.carouselInterval = null; // Auto-rotation timer
        this.guardianRules = null; // Guardian filtering rules
        this.aggregateBarred = null; // Aggregate barred list for guests AND users with shield ON
        this.guardianRulesLoaded = false; // Track if guardian rules have been loaded
        this.communityShieldEnabled = true; // Default ON, will be updated when user data loads
        this.searchOperationId = 0; // Prevent race conditions in search
        this.searchOperationId = 0; // Prevent race conditions in search
        this.render();
        this.initialize();
    }
    
    async loadGuardianRules() {
        try {
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            
            if (token) {
                // Logged-in user: check if they're a ward/charge
                const response = await fetch('/api/guardian/my-rules', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    this.guardianRules = await response.json();
                }
                
                // Check if user has community shield enabled
                // We need to get this from the dreamer data or shield API
                try {
                    const shieldResponse = await fetch('/api/user/shield', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (shieldResponse.ok) {
                        const shieldData = await shieldResponse.json();
                        this.communityShieldEnabled = shieldData.community_shield !== false;
                    }
                } catch (e) {
                    console.warn('[Sidebar] Failed to check shield status:', e);
                    this.communityShieldEnabled = true; // Default to ON for safety
                }
                
                // If shield is enabled, also load aggregate barred list
                if (this.communityShieldEnabled) {
                    const aggregateResponse = await fetch('/api/guardian/aggregate-barred');
                    if (aggregateResponse.ok) {
                        this.aggregateBarred = await aggregateResponse.json();
                    }
                } else {
                    this.aggregateBarred = null;
                }
            } else {
                // Guest user: load aggregate barred list
                this.guardianRules = null;
                this.communityShieldEnabled = true; // Guests always have shield ON
                
                const response = await fetch('/api/guardian/aggregate-barred');
                if (response.ok) {
                    this.aggregateBarred = await response.json();
                }
            }
            this.guardianRulesLoaded = true;
        } catch (error) {
            console.warn('[Sidebar] Failed to load guardian rules:', error);
            this.guardianRules = null;
            this.aggregateBarred = null;
            this.guardianRulesLoaded = true;
        }
    }
    
    // Wait for guardian rules to be loaded (with timeout)
    async ensureGuardianRulesLoaded() {
        if (this.guardianRulesLoaded) return;
        
        // Wait up to 2 seconds for rules to load
        for (let i = 0; i < 20; i++) {
            if (this.guardianRulesLoaded) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Apply guardian filtering to a list of dreamers
    filterDreamersByGuardian(dreamers) {
        if (!dreamers) {
            return dreamers;
        }
        
        let filtered = dreamers;
        let beforeCount = filtered.length;
        
        // Apply user's own barred users first
        if (this.guardianRules?.own_barred_dids?.length > 0) {
            const ownBarredDids = new Set(this.guardianRules.own_barred_dids);
            filtered = filtered.filter(d => !ownBarredDids.has(d.did));
            beforeCount = filtered.length;
        }
        
        // Ward/charge filtering (guardian relationship)
        if (this.guardianRules?.has_guardian) {
            if (this.guardianRules.filter_mode === 'whitelist') {
                const allowedDids = new Set(this.guardianRules.filter_dids);
                filtered = filtered.filter(d => allowedDids.has(d.did));
            } else if (this.guardianRules.filter_mode === 'blacklist') {
                const barredDids = new Set(this.guardianRules.filter_dids);
                filtered = filtered.filter(d => !barredDids.has(d.did));
            }
            // Note: still apply aggregate below if shield is on
        }
        
        // Aggregate filtering (for guests AND logged-in users with Community Shield ON)
        if (this.aggregateBarred?.barred_dids?.length > 0) {
            const barredDids = new Set(this.aggregateBarred.barred_dids);
            filtered = filtered.filter(d => !barredDids.has(d.did));
        }
        
        return filtered;
    }
    
    // Check if a specific dreamer is allowed to be viewed
    isDreamerAllowed(dreamer) {
        if (this.guardianRules?.own_barred_dids?.length > 0) {
            const ownBarredDids = new Set(this.guardianRules.own_barred_dids);
            if (ownBarredDids.has(dreamer?.did)) {
                return false;
            }
        }
        
        if (!this.guardianRules?.has_guardian || !dreamer) {
            return true; // No guardian rules = allow all
        }
        
        if (this.guardianRules.filter_mode === 'whitelist') {
            // Ward: only allowed to see dreamers in allowed list
            const allowedDids = new Set(this.guardianRules.filter_dids);
            return allowedDids.has(dreamer.did);
        } else if (this.guardianRules.filter_mode === 'blacklist') {
            // Charge: not allowed to see dreamers in barred list
            const barredDids = new Set(this.guardianRules.filter_dids);
            return !barredDids.has(dreamer.did);
        }
        
        return true;
    }
    
    // Get the guardian dreamer object (for redirects)
    getGuardianDreamer() {
        if (!this.guardianRules?.guardian_did) return null;
        return this.dreamers.find(d => d.did === this.guardianRules.guardian_did);
    }
    
    getServerIcon(dreamer) {
        // Determine server icon using heraldry system
        // Priority: Use actual server field if available (authoritative)
        if (dreamer.server === 'https://reverie.house') {
            return '/assets/icon.png';
        } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
            return '/assets/bluesky.png';
        } else if (dreamer.server) {
            // Use heraldry system for foreign PDS (server field is authoritative)
            const heraldry = window.heraldrySystem ? window.heraldrySystem.getByServer(dreamer.server) : null;
            return heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';
        } else {
            // Fallback: try to determine from handle
            const heraldry = window.heraldrySystem ? window.heraldrySystem.getByHandle(dreamer.handle) : null;
            return heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';
        }
    }
    render() {
        this.container.innerHTML = `
            <div class="carousel-detached">
                <div class="carousel-content"></div>
                <div class="carousel-controls">
                    <!-- ACTIVE: sparkles/stars (active energy) -->
                    <button class="carousel-btn" data-view="0" title="Active Dreamweavers">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 3v3m6.366-.366-2.12 2.12M21 12h-3m.366 6.366-2.12-2.12M12 21v-3m-6.366.366 2.12-2.12M3 12h3m-.366-6.366 2.12 2.12"></path>
                        </svg>
                    </button>
                    <!-- RECENT: clock/time -->
                    <button class="carousel-btn" data-view="1" title="Recent Visitors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </button>
                    <!-- TOP PATRON: heart (support/love) -->
                    <button class="carousel-btn" data-view="2" title="Top Patrons">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    <!-- CONTRIBUTORS: feather/quill (writing) -->
                    <button class="carousel-btn" data-view="3" title="Contributors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                            <line x1="16" y1="8" x2="2" y2="22"></line>
                            <line x1="17.5" y1="15" x2="9" y2="15"></line>
                        </svg>
                    </button>
                    <!-- CURRENT WORKERS: tool/wrench (working) -->
                    <button class="carousel-btn" data-view="4" title="Current Workers">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                        </svg>
                    </button>
                    <!-- HONOURED GUESTS: handshake -->
                    <button class="carousel-btn" data-view="5" title="Honoured Guests">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m11 17 2 2a1 1 0 1 0 3-3"></path>
                            <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"></path>
                            <path d="m21 3 1 11h-2"></path>
                            <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"></path>
                            <path d="M3 4h8"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="search-dreamers-detached">
                <div class="search-dreamers-title">Search Dreamers</div>
                <div class="search-bar">
                    <input type="text" id="search-input" placeholder="Enter dreamer name...">
                    <button id="refresh-button">
                        <img src="/assets/refresh.svg" alt="Refresh">
                    </button>
                </div>
                <div class="dreamers-list">
                    <div class="autofill-container"></div>   
                </div>
            </div>
            <!-- Invitation box temporarily hidden
            <div class="invite-text">
                Are you a dreamweaver?<br>
                <a href="https://bsky.app/profile/reverie.house/post/3lljjzcydwc25" target="_blank">Introduce Yourself</a>
            </div>
            -->
        `;
    }
    initialize() {
        const searchInput = this.container.querySelector('#search-input');
        const autofillContainer = this.container.querySelector('.autofill-container');
        const refreshButton = this.container.querySelector('#refresh-button');
        
        // Load guardian rules first
        this.loadGuardianRules();
        
        // Listen for OAuth profile loaded to reload guardian rules
        window.addEventListener('oauth:profile-loaded', () => {
            this.loadGuardianRules().then(() => {
                // Re-render carousel and search results if rules changed
                if (this.guardianRules?.has_guardian && this.dreamersLoaded) {
                    this.loadCarousel();
                    if (searchInput && autofillContainer) {
                        this.updateSearchResults(searchInput.value, autofillContainer);
                    }
                }
            });
        });
        
        // Load dynamic carousel (views will load their own content when shown)
        this.loadCarousel(); // Initialize carousel
        
        // Setup carousel button listeners
        const carouselBtns = this.container.querySelectorAll('.carousel-btn');
        carouselBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewIndex = parseInt(btn.getAttribute('data-view'));
                this.setCarouselView(viewIndex);
            });
        });
        
        // Handle browser back/forward navigation
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.did && this.dreamersLoaded) {
                const dreamer = this.dreamers.find(d => d.did === event.state.did);
                if (dreamer) {
                    this.displayDreamer(dreamer, { skipPushState: true });
                }
            } else if (this.dreamersLoaded) {
                this.handleUrlParams();
            }
        });
        
        fetch('/api/dreamers')
            .then(response => response.json())
            .then(data => {
                this.dreamers = data;
                this.dreamersLoaded = true;
                window.AvatarCache?.populateFromDreamers?.(data);
                
                // Initialize hover widget after dreamers are loaded
                if (typeof DreamerHoverWidget !== 'undefined') {
                    this.hoverWidget = new DreamerHoverWidget(this.dreamers);
                    this.hoverWidget.init();
                                    } else {
                    console.warn('DreamerHoverWidget not loaded');
                }
                
                // Wait for guardian rules before handling URL params (for redirect protection)
                this.ensureGuardianRulesLoaded().then(() => {
                    this.handleUrlParams();
                });
                if (searchInput.value === '') {
                    searchInput.dispatchEvent(new Event('input'));
                }
            })
            .catch(error => {
                console.error('Error loading dreamers data:', error);
                const profileDetails = document.getElementById('profile-details');
                if (profileDetails) {
                    profileDetails.innerHTML = '<p>Error loading dreamer data. Please refresh the page.</p>';
                }
            });
        if (searchInput && autofillContainer) {
            searchInput.addEventListener('input', () => {    
                this.updateSearchResults(searchInput.value, autofillContainer);
            });
        }
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {  
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }
    
    async loadTopContributors() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch all dreamers with their scores
            const response = await fetch('/api/dreamers');
            let allDreamers = await response.json();
            
            // Apply guardian filtering
            allDreamers = this.filterDreamersByGuardian(allDreamers);
            
            // Calculate non-patron contribution (subtract patron_score from contribution_score)
            // This shows canon+lore contributions only, excluding financial patronage
            const topContributors = allDreamers
                .map(d => ({
                    ...d,
                    non_patron_contribution: (d.contribution_score || 0) - (d.patron_score || 0)
                }))
                .filter(d => d.non_patron_contribution > 0)
                .sort((a, b) => b.non_patron_contribution - a.non_patron_contribution)
                .slice(0, 3);
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.top-contributors-container');
            if (!container) return;
            
            if (topContributors.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; font-style: italic; padding: 20px; text-align: center;">No contributors yet</div>';
                return;
            }
            
            container.innerHTML = topContributors.map(dreamer => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon
                const serverIconSrc = this.getServerIcon(dreamer);
                
                const contributionScore = dreamer.non_patron_contribution;
                
                return `
                    <div class="top-contributor-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 10px; color: ${userColor}; font-weight: 600;">${contributionScore}</span>
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle;">
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.top-contributor-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading top contributors:', error);
        }
    }
    
    async loadCurrentWorkers() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch dreamers and their roles
            const response = await fetch('/api/dreamers');
            let allDreamers = await response.json();
            
            // Apply guardian filtering
            allDreamers = this.filterDreamersByGuardian(allDreamers);
            
            // Fetch active roles from database
            const rolesResponse = await fetch('/api/work/active-roles');
            let activeRoles = [];
            if (rolesResponse.ok) {
                activeRoles = await rolesResponse.json();
            }
            
            // Match dreamers with their active roles. The server may return
            // different status strings (e.g. 'working' rather than 'active'),
            // so normalize and accept any reasonable active/retiring values.
            const acceptedStatuses = new Set(['working', 'active', 'retiring']);
            const workersWithRoles = activeRoles
                .filter(role => acceptedStatuses.has((role.status || '').toString().toLowerCase()))
                .map(role => {
                    // role might carry a `did` key or other identifier; be defensive
                    const roleDid = role.did || role.actor || role.handle || null;
                    if (!roleDid) return null;
                    const dreamer = allDreamers.find(d => d.did === roleDid || d.did === roleDid.toString());
                    return dreamer ? { ...dreamer, role: role.role || role.role_name || role.roleName } : null;
                })
                .filter(Boolean);
            
            // Randomly select 3 workers
            const shuffled = workersWithRoles.sort(() => 0.5 - Math.random());
            const selectedWorkers = shuffled.slice(0, 3);
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.current-workers-container');
            if (!container) return;
            
            if (selectedWorkers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; font-style: italic; padding: 20px; text-align: center;">No active workers</div>';
                return;
            }
            
            container.innerHTML = selectedWorkers.map(dreamer => {                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Capitalize role name and get role-specific color
                const roleKey = dreamer.role.toLowerCase();
                const roleName = dreamer.role.charAt(0).toUpperCase() + dreamer.role.slice(1);
                const roleColor = `var(--role-${roleKey})`;
                const roleBg = `var(--role-${roleKey}-light)`;
                
                return `
                    <div class="current-worker-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${roleBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${roleColor};">${dreamer.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 10px; color: ${roleColor}; font-weight: 600;">${roleName}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.current-worker-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading current workers:', error);
        }
    }
    
    async loadRecentArrivals() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch more than needed to account for filtered-out users
            const response = await fetch('/api/dreamers/recent?limit=15');
            let recentDreamers = await response.json();
            
            // Apply guardian filtering then slice to show exactly 3
            recentDreamers = this.filterDreamersByGuardian(recentDreamers).slice(0, 3);
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.recent-arrivals-container');
            if (!container) return;
            
            if (!recentDreamers || recentDreamers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; padding: 8px;">No recent arrivals</div>';
                return;
            }
            
            container.innerHTML = recentDreamers.map(dreamer => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL (same logic as regular results)
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon (same logic as regular results)
                let serverIconSrc = '';
                let serverIconStyle = '';
                if (dreamer.server === 'https://reverie.house') {
                    if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = '';
                    } else {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    }
                } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
                    if (dreamer.handle.endsWith('bsky.social')) {
                        serverIconSrc = '/assets/bluesky.png';
                        serverIconStyle = '';
                    } else if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    } else {
                        serverIconSrc = '/assets/bluesky.svg';
                        serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                    }
                } else {
                    const heraldry = window.heraldrySystem ? window.heraldrySystem.getByDreamer(dreamer || u || match) : null;
                    serverIconSrc = heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';
                    serverIconStyle = '';
                }
                
                return `
                    <div class="recent-arrival-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div class="sidebar-handle-container" style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle; flex-shrink: 0;${serverIconStyle}">
                                <a class="sidebar-handle" href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: ${userColor}; text-decoration: none;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.recent-arrival-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading recent arrivals:', error);
        }
    }

    async loadActiveDreamweavers() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch labels from lore.farm to find recent canon and lore posts
            const labelsResponse = await fetch('https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=*&limit=100');
            if (!labelsResponse.ok) throw new Error('Failed to fetch labels');
            
            const labelsData = await labelsResponse.json();
            const labels = labelsData.labels || [];
            
            // Fetch all dreamers to match DIDs
            const dreamersResponse = await fetch('/api/dreamers');
            let allDreamers = await dreamersResponse.json();
            
            // Apply guardian filtering
            allDreamers = this.filterDreamersByGuardian(allDreamers);
            
            // Filter out @reverie.house
            const reverieDreamer = allDreamers.find(d => d.handle === 'reverie.house');
            const reverieDid = reverieDreamer?.did;
            
            // Find most recent canon post (excluding @reverie.house)
            const canonLabels = labels
                .filter(l => l.val === 'canon:reverie.house')
                .sort((a, b) => new Date(b.cts) - new Date(a.cts));
            
            console.log('[Active Dreamweavers] Canon labels found:', canonLabels.length);
            
            let canonDreamer = null;
            for (const label of canonLabels) {
                const uri = label.uri;
                const did = uri.split('/')[2]; // Extract DID from at://did/...
                console.log('[Active Dreamweavers] Checking canon label:', did, 'reverieDid:', reverieDid);
                if (did !== reverieDid) {
                    canonDreamer = allDreamers.find(d => d.did === did);
                    if (canonDreamer) {
                        console.log('[Active Dreamweavers] Found canon dreamer:', canonDreamer.name);
                        break;
                    }
                }
            }
            
            // Find two most recent lore posts (excluding @reverie.house and canon dreamer)
            const loreLabels = labels
                .filter(l => l.val.startsWith('lore:') && l.val !== 'canon:reverie.house')
                .sort((a, b) => new Date(b.cts) - new Date(a.cts));
            
            console.log('[Active Dreamweavers] Lore labels found:', loreLabels.length);
            
            const loreDreamers = [];
            const seenDids = new Set();
            
            // Add canon dreamer to seenDids so they don't appear twice
            if (canonDreamer) {
                seenDids.add(canonDreamer.did);
                console.log('[Active Dreamweavers] Excluding canon dreamer from lore:', canonDreamer.name);
            }
            
            for (const label of loreLabels) {
                if (loreDreamers.length >= 2) break;
                const uri = label.uri;
                const did = uri.split('/')[2];
                if (did !== reverieDid && !seenDids.has(did)) {
                    const dreamer = allDreamers.find(d => d.did === did);
                    if (dreamer) {
                        console.log('[Active Dreamweavers] Adding lore dreamer:', dreamer.name);
                        loreDreamers.push(dreamer);
                        seenDids.add(did);
                    }
                }
            }
            
            console.log('[Active Dreamweavers] Final count - Canon:', canonDreamer ? 1 : 0, 'Lore:', loreDreamers.length);
            
            // Combine: 1 canon + 2 lore
            const activeDreamers = [];
            if (canonDreamer) activeDreamers.push({ dreamer: canonDreamer, type: 'canon' });
            loreDreamers.forEach(d => activeDreamers.push({ dreamer: d, type: 'lore' }));
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.active-dreamweavers-container');
            if (!container) return;
            
            if (activeDreamers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; padding: 8px;">No active dreamweavers</div>';
                return;
            }
            
            container.innerHTML = activeDreamers.map(({ dreamer, type }) => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon
                let serverIconSrc = '';
                let serverIconStyle = '';
                if (dreamer.server === 'https://reverie.house') {
                    if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = '';
                    } else {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    }
                } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
                    if (dreamer.handle.endsWith('bsky.social')) {
                        serverIconSrc = '/assets/bluesky.png';
                        serverIconStyle = '';
                    } else if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    } else {
                        serverIconSrc = '/assets/bluesky.svg';
                        serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                    }
                } else {
                    const heraldry = window.heraldrySystem ? window.heraldrySystem.getByDreamer(dreamer || u || match) : null;
                    serverIconSrc = heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';
                    serverIconStyle = '';
                }
                
                return `
                    <div class="active-dreamer-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div class="sidebar-handle-container" style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle; flex-shrink: 0;${serverIconStyle}">
                                <a class="sidebar-handle" href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: ${userColor}; text-decoration: none;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.active-dreamer-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading active dreamweavers:', error);
        }
    }

    async loadHonouredGuests() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch all dreamers
            const response = await fetch('/api/dreamers');
            let allDreamers = await response.json();
            
            // Apply guardian filtering
            allDreamers = this.filterDreamersByGuardian(allDreamers);
            
            // Filter for users NOT on reverie.house or bsky.social servers
            const guests = allDreamers.filter(d => {
                if (!d.server) return false;
                const server = d.server.toLowerCase();
                // Exclude reverie.house and bsky.network/bsky.social servers
                return !server.includes('reverie.house') && 
                       !server.includes('bsky.social') && 
                       !server.includes('bsky.network');
            });
            
            // Shuffle and take 1
            const shuffled = guests.sort(() => Math.random() - 0.5);
            const selectedGuests = shuffled.slice(0, 1);
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.honoured-guests-container');
            if (!container) return;
            
            if (selectedGuests.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; font-style: italic; padding: 20px; text-align: center;">No honoured guests</div>';
                return;
            }
            
            container.innerHTML = selectedGuests.map(dreamer => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon - use wild mindscape icon for external servers
                const serverIconSrc = this.getServerIcon(dreamer);
                const serverIconStyle = '';
                
                console.log(`[Honoured Guest] ${dreamer.name} (${dreamer.handle}) - Server: ${dreamer.server} - Icon: ${serverIconSrc}`);
                
                return `
                    <div class="honoured-guest-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div class="sidebar-handle-container" style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle; flex-shrink: 0;${serverIconStyle}">
                                <a class="sidebar-handle" href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: ${userColor}; text-decoration: none;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.honoured-guest-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading honoured guests:', error);
        }
    }

    async loadGreatPatrons() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch all dreamers
            const response = await fetch('/api/dreamers');
            let allDreamers = await response.json();
            
            // Apply guardian filtering
            allDreamers = this.filterDreamersByGuardian(allDreamers);
            
            // Sort by patron_score (not patronage) and take top 3
            const topPatrons = allDreamers
                .filter(d => (d.patron_score || 0) > 0)
                .sort((a, b) => (b.patron_score || 0) - (a.patron_score || 0))
                .slice(0, 3);
            
            const container = this.container.querySelector('.carousel-container') || this.container.querySelector('.great-patrons-container');
            if (!container) return;
            
            if (topPatrons.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; font-style: italic; padding: 20px; text-align: center;">No patrons yet</div>';
                return;
            }
            
            container.innerHTML = topPatrons.map(dreamer => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon
                const serverIconSrc = this.getServerIcon(dreamer);
                
                const patronScore = dreamer.patron_score || 0;
                
                return `
                    <div class="great-patron-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 10px; color: ${userColor}; font-weight: 600;">${patronScore}</span>
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle;">
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.great-patron-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading great patrons:', error);
        }
    }
    
    async loadActiveDreamers() {
        try {
            // Ensure guardian rules are loaded before filtering
            await this.ensureGuardianRulesLoaded();
            
            // Fetch more than needed to account for filtered-out users
            const response = await fetch('/api/dreamers/active?limit=10');
            let activeDreamers = await response.json();
            
            // Apply guardian filtering then slice to show exactly 3
            activeDreamers = this.filterDreamersByGuardian(activeDreamers || []).slice(0, 3);
            
            const container = this.container.querySelector('.active-dreamers-container');
            if (!container) return;
            
            if (!activeDreamers || activeDreamers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; padding: 8px;">No active dreamers</div>';
                return;
            }
            
            container.innerHTML = activeDreamers.map(dreamer => {
                // Apply user's color
                const userColor = dreamer.color_hex || '#734ba1';
                const userColorBg = this.hexToRgba(userColor, 0.12);
                
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon
                let serverIconSrc = '';
                let serverIconStyle = '';
                if (dreamer.server === 'https://reverie.house') {
                    if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = '';
                    } else {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    }
                } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
                    if (dreamer.handle.endsWith('bsky.social')) {
                        serverIconSrc = '/assets/bluesky.png';
                        serverIconStyle = '';
                    } else if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = '/assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    } else {
                        serverIconSrc = '/assets/bluesky.svg';
                        serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                    }
                } else {
                    const heraldry = window.heraldrySystem ? window.heraldrySystem.getByDreamer(dreamer || u || match) : null;
                    serverIconSrc = heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';
                    serverIconStyle = '';
                }
                
                return `
                    <div class="active-dreamer-item" data-did="${encodeURIComponent(dreamer.did)}" style="background-color: ${userColorBg};">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${dreamer.name}</span>
                            </div>
                            <div class="sidebar-handle-container" style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle; flex-shrink: 0;${serverIconStyle}">
                                <a class="sidebar-handle" href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: ${userColor}; text-decoration: none;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.active-dreamer-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    const dreamer = this.dreamers.find(d => d.did === did);
                    if (dreamer) {
                        this.displayDreamer(dreamer);
                    }
                });
            });
            
        } catch (error) {
            console.error('Error loading active dreamers:', error);
        }
    }
    
    // Build a clean dreamer URL: prefer ?handle=, fall back to ?did= with unencoded colons
    static dreamerUrl(dreamer) {
        if (dreamer.handle) return `/dreamer?handle=${encodeURIComponent(dreamer.handle)}`;
        return `/dreamer?did=${dreamer.did}`; // colons are valid in query values
    }

    async handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        let foundDreamer;
        
        // Check query parameters for dreamer lookup (local list first)
        if (params.has('handle')) {
            const queryHandle = params.get('handle').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.handle.toLowerCase() === queryHandle);
            // API fallback — the dreamer may be freshly registered and not yet in the bulk list
            if (!foundDreamer) {
                try {
                    const res = await fetch(`/api/dreamer/by-handle/${encodeURIComponent(queryHandle)}`);
                    if (res.ok) {
                        const apiDreamer = await res.json();
                        // Merge into local list so subsequent lookups work
                        if (apiDreamer && apiDreamer.did) {
                            this.dreamers.push(apiDreamer);
                            foundDreamer = apiDreamer;
                        }
                    }
                } catch (e) { /* silent */ }
            }
        } else if (params.has('did')) {
            const queryDid = params.get('did').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.did.toLowerCase() === queryDid);
        } else if (params.has('name')) {
            const queryName = params.get('name').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.name.toLowerCase() === queryName);
        }
        
        if (foundDreamer) {
            // Check if user is allowed to see this dreamer
            if (!this.isDreamerAllowed(foundDreamer)) {
                console.log(`[Sidebar] User not allowed to view ${foundDreamer.handle}, redirecting to guardian`);
                const guardian = this.getGuardianDreamer();
                if (guardian) {
                    // Update URL to guardian's page
                    const newUrl = Sidebar.dreamerUrl(guardian);
                    window.history.replaceState({ did: guardian.did }, '', newUrl);
                    this.displayDreamer(guardian, { skipPushState: true });
                    return;
                }
            }
            this.displayDreamer(foundDreamer, { skipPushState: true });
        } else {
            this.displayRandomProfile();
        }
    }
    displayDreamer(dreamer, options = {}) {
        const skipPushState = options.skipPushState || false;
        const skipGuardianCheck = options.skipGuardianCheck || false;
        
        // Check if user is allowed to view this dreamer (unless we're already redirecting)
        if (!skipGuardianCheck && !this.isDreamerAllowed(dreamer)) {
            console.log(`[Sidebar] User not allowed to view ${dreamer?.handle}, redirecting to guardian`);
            const guardian = this.getGuardianDreamer();
            if (guardian && guardian.did !== dreamer?.did) {
                // Update URL to guardian's page
                if (!skipPushState && window.location.pathname.includes('dreamer')) {
                    const newUrl = Sidebar.dreamerUrl(guardian);
                    window.history.replaceState({ did: guardian.did }, '', newUrl);
                }
                this.displayDreamer(guardian, { skipPushState: true, skipGuardianCheck: true });
                return;
            }
        }
        
        if (dreamer && dreamer.did && dreamer.handle) {
            localStorage.setItem('lastViewedDreamer', JSON.stringify({
                did: dreamer.did,
                handle: dreamer.handle,
                name: dreamer.display_name || dreamer.name
            }));
            if (window.spectrumDrawer && typeof window.spectrumDrawer.updateAvatarButton === 'function') {
                window.spectrumDrawer.updateAvatarButton();
            }
            
            // Update URL to reflect current dreamer (for sharing/bookmarking)
            if (!skipPushState && window.location.pathname.includes('dreamer')) {
                const newUrl = Sidebar.dreamerUrl(dreamer);
                window.history.pushState({ did: dreamer.did }, '', newUrl);
            }
        }
        const profileContainer = document.getElementById('profile-container');
        if (profileContainer) {
            profileContainer.classList.add('loading');
            profileContainer.classList.remove('loaded');
            setTimeout(() => {
                if (window.profileWidget && typeof window.profileWidget.displayProfile === 'function') {
                    window.profileWidget.displayProfile(dreamer);
                }
                setTimeout(() => {
                    profileContainer.classList.remove('loading');
                    profileContainer.classList.add('loaded');
                }, 50);
            }, 150);
        } else {
            if (window.profileWidget && typeof window.profileWidget.displayProfile === 'function') {
                window.profileWidget.displayProfile(dreamer);
            }
        }
    }
    
    hexToRgba(hex, alpha = 0.12) {
        // Convert hex color to rgba with specified alpha
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    shuffleArray(array) {
        // Fisher-Yates shuffle for reliable randomization
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async updateSearchResults(query, container) {
        // Increment operation ID to track this search request
        const currentOperationId = ++this.searchOperationId;
        
        container.innerHTML = '';
        
        // If dreamers haven't loaded yet and not searching, show loading placeholders
        if (!this.dreamersLoaded && !query) {
            for (let i = 0; i < 4; i++) {
                const item = document.createElement('div');
                item.className = 'dreamer-item';
                item.style.backgroundColor = 'rgba(115, 75, 161, 0.12)';
                item.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; opacity: 0.5;">
                    <div style="width:20px; height:20px; border-radius: 50%; background: #ccc;"></div>
                    <span style="color: #999;">Loading...</span>
                </div>`;
                container.appendChild(item);
            }
            return;
        }
        
        // Ensure guardian rules are loaded before filtering
        await this.ensureGuardianRulesLoaded();
        
        // Check if this search operation is still current (prevents race conditions)
        if (currentOperationId !== this.searchOperationId) {
            return; // A newer search has started, abandon this one
        }
        
        // Get base list of dreamers, applying guardian filter
        let baseDreamers = this.filterDreamersByGuardian(this.dreamers);
        
        let results = query ?
            baseDreamers.filter(d => 
                d.name.toLowerCase().includes(query.toLowerCase()) ||
                d.handle.toLowerCase().includes(query.toLowerCase()) ||
                (d.display_name && d.display_name.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, 4) :
            this.shuffleArray(baseDreamers.slice()).slice(0, 4);
        
        // Ensure we never show more than 4 results
        results = results.slice(0, 4);
        
        // Clear container again before adding results (in case of race condition)
        container.innerHTML = '';
        
        results.forEach((match, index) => {
            const item = document.createElement('div');       
            item.className = 'dreamer-item';
            
            // Apply user's color
            const userColor = match.color_hex || '#734ba1';
            const userColorBg = this.hexToRgba(userColor, 0.12);
            item.style.backgroundColor = userColorBg;
            
            // Get avatar URL
            let avatarUrl = '/assets/icon_face.png';
            if (match.avatar?.url) {
                avatarUrl = match.avatar.url;
            } else if (match.avatar?.ref?.$link) {
                const ext = (match.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${match.did}/${match.avatar.ref.$link}@${ext}`;
            } else if (typeof match.avatar === 'string' && match.avatar) {
                avatarUrl = match.avatar;
            }
            
            // Get server icon (smaller, for handle)
            let serverIconSrc = '';
            let serverIconStyle = '';
            if (match.server === 'https://reverie.house') {
                if (match.handle.endsWith('reverie.house')) {
                    serverIconSrc = '/assets/icon.png';      
                    serverIconStyle = '';
                } else {
                    serverIconSrc = '/assets/icon.png';      
                    serverIconStyle = 'filter: saturate(40%);';    
                }
            } else if (match.server && match.server.includes('bsky.network')) {
                if (match.handle.endsWith('bsky.social')) {  
                    serverIconSrc = '/assets/bluesky.png';
                    serverIconStyle = '';
                } else if (match.handle.endsWith('reverie.house')) {
                    serverIconSrc = '/assets/icon.png';      
                    serverIconStyle = 'filter: saturate(40%);';    
                } else {
                    serverIconSrc = '/assets/bluesky.svg';
                    serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                }
            } else {
                const heraldry = window.heraldrySystem ? window.heraldrySystem.getByDreamer(match) : null;
                    serverIconSrc = heraldry ? heraldry.icon : '/assets/wild_mindscape.svg';       
                serverIconStyle = '';
            }
            
            item.innerHTML = `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'"> 
                    <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(match.did)}" style="text-align: left; cursor: pointer; color: ${userColor};">${match.name}</span>
                </div>
                <div class="sidebar-handle-container" style="display: flex; align-items: center; gap: 4px;">
                    <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle; flex-shrink: 0;${serverIconStyle}">
                    <a class="sidebar-handle" href="https://bsky.app/profile/${match.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: ${userColor}; text-decoration: none;">@${match.handle}</a>
                </div>
            </div>`;
            item.addEventListener('click', () => {
                this.displayDreamer(match);
            });
            container.appendChild(item);
        });
    }
    
    // Carousel management methods
    async loadCarousel() {
        // Pre-load carousel views (expanded to include top contributors and honoured guests)
        this.carouselData = [
            { title: 'ACTIVE DREAMWEAVERS', loader: () => this.loadActiveDreamweavers() },
            { title: 'Recent Visitors', loader: () => this.loadRecentArrivals() },
            { title: 'TOP PATRONS', loader: () => this.loadGreatPatrons() },
            { title: 'TOP CONTRIBUTORS', loader: () => this.loadTopContributors() },
            { title: 'CURRENT WORKERS', loader: () => this.loadCurrentWorkers() },
            { title: 'HONOURED GUESTS', loader: () => this.loadHonouredGuests() }
        ];
        
        // Load initial view (restore from localStorage or default to 0)
        const savedView = parseInt(localStorage.getItem('sidebarCarouselView')) || 0;
        this.setCarouselView(savedView);
    }
    
    async setCarouselView(index) {
        this.carouselIndex = index;
        const view = this.carouselData[index];
        const container = this.container.querySelector('.carousel-content');
        
        // Save to localStorage
        localStorage.setItem('sidebarCarouselView', index);
        
        // Update active button state
        const buttons = this.container.querySelectorAll('.carousel-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        buttons[index].classList.add('active');
        
        // Set title and load content immediately (no fade)
        container.innerHTML = `
            <div class="carousel-title">${view.title}</div>
            <div class="carousel-container"></div>
        `;
        
        await view.loader();
    }
    
    // Auto-rotation removed for snappier UX
    
    displayRandomProfile() {
        // Filter dreamers by guardian rules first
        let allowedDreamers = this.filterDreamersByGuardian(this.dreamers);
        
        // Prefer reverie.house dreamers
        const reverieDreamers = allowedDreamers.filter(d => d.server === 'https://reverie.house');
        if (reverieDreamers.length > 0) {
            const randomDreamer = reverieDreamers[Math.floor(Math.random() * reverieDreamers.length)];
            this.displayDreamer(randomDreamer);
        } else if (allowedDreamers.length > 0) {
            const randomDreamer = allowedDreamers[Math.floor(Math.random() * allowedDreamers.length)];
            this.displayDreamer(randomDreamer);
        } else {
            // No allowed dreamers - show guardian if available
            const guardian = this.getGuardianDreamer();
            if (guardian) {
                this.displayDreamer(guardian);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {        
    const container = document.getElementById('search-container');
    if (container) {
        window.sidebarWidget = new Sidebar(container);       
    }
});
window.Sidebar = Sidebar;
