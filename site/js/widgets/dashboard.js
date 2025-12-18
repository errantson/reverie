class Dashboard {
    constructor(container) {
        this.container = container;
        this.session = null;
        this.dreamerData = null;
        this.headings = [];
        this.currentView = 'xy';
        this.colorUpdateDebounceTimer = null;
        this.octantDisplay = null;
        this.messagesPollingInterval = null;
        this.currentTab = 'details'; // Track current tab
        this.loadStyles();
        this.init();
    }

    loadStyles() {
        // Load dashboard CSS
        if (!document.querySelector('link[href*="css/widgets/dashboard.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/dashboard.css?v=26';
            document.head.appendChild(link);
        }
        
        // Load credential modal CSS
        if (!document.querySelector('link[href*="css/widgets/credential_modal.css"]')) {
            const modalLink = document.createElement('link');
            modalLink.rel = 'stylesheet';
            modalLink.href = '/css/widgets/credential_modal.css';
            document.head.appendChild(modalLink);
        }
        
        // Load octants CSS for standardized octant colors
        if (!document.querySelector('link[href*="css/octants.css"]')) {
            const octantsLink = document.createElement('link');
            octantsLink.rel = 'stylesheet';
            octantsLink.href = '/css/octants.css';
            document.head.appendChild(octantsLink);
        }
        
        // Load octant utility for calculations
        if (!document.querySelector('script[src*="js/utils/octant.js"]')) {
            const octantScript = document.createElement('script');
            octantScript.type = 'module';
            octantScript.src = '/js/utils/octant.js';
            document.head.appendChild(octantScript);
        }
        
        if (!document.querySelector('script[src*="js/utils/num_nom.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/utils/num_nom.js';
            document.head.appendChild(script);
        }
        
        // Load credential modal widget
        if (!document.querySelector('script[src*="js/widgets/credential_modal.js"]')) {
            const modalScript = document.createElement('script');
            modalScript.src = '/js/widgets/credential_modal.js';
            document.head.appendChild(modalScript);
        }
        
        // Load app password request widget
        if (!document.querySelector('script[src*="js/widgets/apppassreq.js"]')) {
            const appPassReqScript = document.createElement('script');
            appPassReqScript.src = '/js/widgets/apppassreq.js';
            document.head.appendChild(appPassReqScript);
        }
        
        // Load work events for cross-page synchronization
        if (!document.querySelector('script[src*="js/utils/work-events.js"]')) {
            const workEventsScript = document.createElement('script');
            workEventsScript.src = '/js/utils/work-events.js';
            document.head.appendChild(workEventsScript);
        }
        
        // Load step down widget
        if (!document.querySelector('script[src*="js/widgets/stepdown.js"]')) {
            const stepDownScript = document.createElement('script');
            stepDownScript.src = '/js/widgets/stepdown.js';
            document.head.appendChild(stepDownScript);
        }
        
        // Load user status utility
        if (!document.querySelector('script[src*="js/utils/user-status.js"]')) {
            const userStatusScript = document.createElement('script');
            userStatusScript.src = '/js/utils/user-status.js';
            document.head.appendChild(userStatusScript);
        }
        
        // Load octant display widget
        if (!document.querySelector('script[src*="js/widgets/octantdisplay.js"]')) {
            const octantDisplayScript = document.createElement('script');
            octantDisplayScript.src = '/js/widgets/octantdisplay.js';
            document.head.appendChild(octantDisplayScript);
        }
        
        // Load spectrum calculator modal widget
        if (!document.querySelector('script[src*="js/widgets/spectrumcalculator-modal.js"]')) {
            const spectrumModalScript = document.createElement('script');
            spectrumModalScript.src = '/js/widgets/spectrumcalculator-modal.js';
            document.head.appendChild(spectrumModalScript);
        }
        
        // Load delete account modal widget
        if (!document.querySelector('script[src*="js/widgets/deleteaccount.js"]')) {
            const deleteAccountScript = document.createElement('script');
            deleteAccountScript.src = '/js/widgets/deleteaccount.js';
            document.head.appendChild(deleteAccountScript);
        }
        
        // Load change handle widget
        if (!document.querySelector('script[src*="js/widgets/changehandle.js"]')) {
            const changeHandleScript = document.createElement('script');
            changeHandleScript.src = '/js/widgets/changehandle.js';
            document.head.appendChild(changeHandleScript);
        }
        
        // Load calendar widget CSS
        if (!document.querySelector('link[href*="css/calendar.css"]')) {
            const calendarCss = document.createElement('link');
            calendarCss.rel = 'stylesheet';
            calendarCss.href = '/css/calendar.css';
            document.head.appendChild(calendarCss);
        }
        
        // Load calendar widget script
        if (!document.querySelector('script[src*="js/calendar.js"]')) {
            const calendarScript = document.createElement('script');
            calendarScript.src = '/js/calendar.js';
            document.head.appendChild(calendarScript);
        }
    }

    /**
     * Get OAuth access token from current session
     * @returns {Promise<string|null>} OAuth access token or null if not authenticated
     */
    async getOAuthToken() {
        const session = window.oauthManager?.getSession();
        if (!session) {
            console.warn('[Dashboard] No OAuth session available');
            return null;
        }
        
        // Get backend token (from auto-register endpoint)
        const backendToken = localStorage.getItem('oauth_token');
        if (backendToken) {
            return backendToken;
        }
        
        console.warn('[Dashboard] No OAuth token available');
        return null;
    }

    /**
     * Check if current OAuth session has required scope
     * @param {string} scope - Required scope (e.g., 'write', 'atproto')
     * @returns {boolean} True if scope is granted
     */
    hasScope(scope) {
        const session = window.oauthManager?.getSession();
        if (!session || !session.scope) return false;
        
        // Check if scope contains the required permission
        const scopes = session.scope.split(' ');
        return scopes.includes(scope) || scopes.includes('atproto transition:generic');
    }

    /**
     * Show login required modal
     * @param {string} action - User-facing description of the action
     */
    showLoginRequired(action = 'perform this action') {
        const modal = document.createElement('div');
        modal.className = 'permission-request-modal';
        modal.innerHTML = `
            <div class="permission-modal-overlay" onclick="this.closest('.permission-request-modal').remove()"></div>
            <div class="permission-modal-content">
                <div class="permission-modal-icon">🔐</div>
                <h3 class="permission-modal-title">Login Required</h3>
                <p class="permission-modal-description">
                    To ${action}, please log in with your Bluesky account.
                </p>
                <div class="permission-modal-actions">
                    <button class="permission-btn-cancel" onclick="this.closest('.permission-request-modal').remove()">
                        Cancel
                    </button>
                    <button class="permission-btn-grant" onclick="window.location.href='/login.html'">
                        Log In
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Request scope upgrade for write operations
     * Shows user-friendly modal explaining why permission is needed
     * @param {string} action - User-facing description of the action
     */
    async requestWritePermission(action = 'perform this action') {
        const modal = document.createElement('div');
        modal.className = 'permission-request-modal';
        modal.innerHTML = `
            <div class="permission-modal-overlay" onclick="this.closest('.permission-request-modal').remove()"></div>
            <div class="permission-modal-content">
                <div class="permission-modal-icon">🔐</div>
                <h3 class="permission-modal-title">Permission Required</h3>
                <p class="permission-modal-description">
                    To ${action}, we need permission to write to your Bluesky profile.
                </p>
                <p class="permission-modal-details">
                    You'll be redirected to Bluesky to approve this permission.
                    You can revoke it anytime in your Bluesky settings.
                </p>
                <div class="permission-modal-actions">
                    <button class="permission-btn-cancel" onclick="this.closest('.permission-request-modal').remove()">
                        Cancel
                    </button>
                    <button class="permission-btn-grant" onclick="window.dashboardWidget.grantWritePermission('${action.replace(/'/g, "\\'")}')">
                        Grant Permission
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Initiate OAuth scope upgrade flow
     * @param {string} action - Action that triggered the request (for analytics)
     */
    async grantWritePermission(action) {
        console.log(`[Dashboard] Requesting write permission for: ${action}`);
        
        // Store the action in sessionStorage so we can resume after OAuth redirect
        sessionStorage.setItem('oauth_pending_action', action);
        
        // Request upgraded scope
        if (window.oauthManager && window.oauthManager.requestScope) {
            await window.oauthManager.requestScope('atproto transition:generic');
        } else {
            console.error('[Dashboard] OAuth manager not available for scope request');
            alert('Unable to request permissions. Please refresh the page and try again.');
        }
    }

    /**
     * Resume action after OAuth permission grant
     * Called from callback handler
     */
    async resumePendingAction() {
        const pendingAction = sessionStorage.getItem('oauth_pending_action');
        if (!pendingAction) return;
        
        console.log(`[Dashboard] Resuming action after OAuth grant: ${pendingAction}`);
        sessionStorage.removeItem('oauth_pending_action');
        
        // Show success notification
        this.showSuccessNotification(`Permission granted! You can now ${pendingAction}.`);
    }

    /**
     * Wrap write operations with permission check
     * @param {Function} operation - Async function to execute
     * @param {string} actionDescription - User-facing action description
     */
    async withWritePermission(operation, actionDescription) {
        // Check if we have OAuth session
        const token = await this.getOAuthToken();
        if (!token) {
            this.showLoginRequired(actionDescription);
            return;
        }
        
        // Check if we have write scope
        if (!this.hasScope('atproto transition:generic')) {
            await this.requestWritePermission(actionDescription);
            return; // Operation will resume after OAuth callback
        }
        
        // Execute operation
        try {
            await operation();
        } catch (error) {
            // Check if error is due to insufficient permissions
            if (error.message?.includes('InvalidToken') || error.message?.includes('403')) {
                console.warn('[Dashboard] Token invalid or insufficient permissions');
                await this.requestWritePermission(actionDescription);
            } else {
                throw error; // Re-throw other errors
            }
        }
    }

    async init() {
        this.session = window.oauthManager?.getSession();
        
        if (!this.session) {
            this.renderNoSession();
            return;
        }

        // Color manager will handle color loading
        if (window.colorManager) {
            await window.colorManager.init();
        }

        this.renderLoading();
        await this.loadData();
        
        // Check for auth issues before rendering
        await this.checkAuthStatus();
        
        this.render();
        
        // Update status after render (with delay to ensure DOM is ready)
        setTimeout(() => this.updateStatusDisplay(), 100);
        
        // Set up work event listeners for live updates
        this.setupWorkEventListeners();
    }
    
    setupWorkEventListeners() {
        // Wait for WorkEvents to be available
        if (!window.WorkEvents) {
            setTimeout(() => this.setupWorkEventListeners(), 500);
            return;
        }
        
        // Listen for greeter status changes from work.html
        window.WorkEvents.on(window.WorkEvents.EVENTS.GREETER_ACTIVATED, () => {
            console.log('🔔 [Dashboard] Greeter activated - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.GREETER_STEPPED_DOWN, () => {
            console.log('🔔 [Dashboard] Greeter stepped down - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.GREETER_STATUS_CHANGED, () => {
            console.log('🔔 [Dashboard] Greeter status changed - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        // Listen for mapper status changes from work.html
        window.WorkEvents.on(window.WorkEvents.EVENTS.MAPPER_ACTIVATED, () => {
            console.log('🔔 [Dashboard] Mapper activated - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.MAPPER_STEPPED_DOWN, () => {
            console.log('🔔 [Dashboard] Mapper stepped down - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.MAPPER_STATUS_CHANGED, () => {
            console.log('🔔 [Dashboard] Mapper status changed - refreshing roles section');
            this.renderRolesCharacterSection();
            this.refreshUserStatus();
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.CREDENTIALS_CONNECTED, () => {
            console.log('🔔 [Dashboard] Credentials connected - refreshing roles section');
            this.renderRolesCharacterSection();
            this.updateStatusDisplay();
            // Update schedule input state to reflect credentials are now available
            if (this.currentTab === 'compose') {
                this.updateScheduleInputState();
            }
        });
        
        window.WorkEvents.on(window.WorkEvents.EVENTS.CREDENTIALS_DISCONNECTED, () => {
            console.log('🔔 [Dashboard] Credentials disconnected - refreshing roles section');
            this.renderRolesCharacterSection();
            this.updateStatusDisplay();
            // Update schedule input state to reflect credentials are no longer available
            if (this.currentTab === 'compose') {
                this.updateScheduleInputState();
            }
        });
        
        console.log('✅ [Dashboard] Work event listeners set up');
    }
    
    async loadData() {
        console.log('🔄 [Dashboard] loadData() called');
        try {
            console.log('🌐 [Dashboard] Fetching /api/dreamers');
            const response = await fetch('/api/dreamers');
            if (!response.ok) throw new Error('Failed to load dreamer data');
            
            const allDreamers = await response.json();
            console.log('📥 [Dashboard] Received', allDreamers.length, 'dreamers from API');
            
            this.dreamerData = allDreamers.find(d => d.did === this.session.did);
            
            if (!this.dreamerData) {
                throw new Error('Your profile was not found in the database. You may need to register.');
            }
            
            console.log('✅ [Dashboard] Found dreamer data:', {
                display_name: this.dreamerData.display_name,
                avatar: this.dreamerData.avatar?.substring(0, 60) + '...',
                handle: this.dreamerData.handle
            });
            
            // Update color manager with fresh user color
            const userColor = this.dreamerData.color_hex || '#734ba1';
            if (window.colorManager) {
                window.colorManager.setColor(userColor, 'user');
                
                // Cache for next time
                const cacheKey = `reverie_color_${this.session.did}`;
                localStorage.setItem(cacheKey, userColor);
            } else {
                // Fallback if color manager not available
                document.documentElement.style.setProperty('--reverie-core-color', userColor);
            }
            
            if (this.dreamerData.entropy !== undefined) {
                this.dreamerData.chaos = this.dreamerData.entropy;
                this.dreamerData.order = this.dreamerData.oblivion;
                this.dreamerData.guarded = this.dreamerData.liberty;
                this.dreamerData.assertive = this.dreamerData.authority;
            }
            
            const headingsResponse = await fetch('/api/headings');
            if (headingsResponse.ok) {
                this.headings = await headingsResponse.json();
            }
            
            await this.loadLoreCount();
            console.log('✅ [Dashboard] loadData() complete');
        } catch (error) {
            console.error('❌ [Dashboard] Error in loadData():', error);
            this.renderError(error);
        }
    }
    
    async loadLoreCount() {
        try {
            // PERFORMANCE: Add 2 second timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const handle = this.dreamerData.handle;
            const response = await fetch(
                `https://lore.farm/xrpc/com.atproto.label.queryLabels?limit=5000`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error('Failed to load labels');
            
            const data = await response.json();
            const labels = data.labels || [];
            
            const userLabels = labels.filter(label => label.uri && label.uri.includes(this.dreamerData.did));
            const loreCount = userLabels.filter(l => l.val && l.val.startsWith('lore:')).length;
            const canonCount = userLabels.filter(l => l.val && l.val.startsWith('canon:')).length;
            
            this.loreCount = loreCount;
            this.canonCount = canonCount;
            this.totalLoreCount = loreCount + canonCount;
        } catch (error) {
            // Silent fail if lore.farm is down
            this.loreCount = 0;
            this.canonCount = 0;
            this.totalLoreCount = 0;
        }
    }

    renderNoSession() {
        this.container.innerHTML = `
            <div class="dashboard-container">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 20px; text-align: center; color: #666;">
                    <div style="font-size: 3rem;">🔒</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--reverie-core-color, #734ba1);">
                        Please log in to view your dashboard
                    </div>
                    <div style="font-size: 0.9rem; max-width: 400px; line-height: 1.6;">
                        Your personal dashboard shows your profile, spectrum scores, octant placement, souvenirs, and more.
                    </div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="dashboard-loading">
                <div>Loading your dashboard...</div>
            </div>
        `;
    }

    renderError(error) {
        this.container.innerHTML = `
            <div class="dashboard-container">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 20px; text-align: center; color: #666;">
                    <div style="font-size: 3rem;">⚠️</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: #d9534f;">
                        Failed to load dashboard
                    </div>
                    <div style="font-size: 0.9rem; max-width: 400px; line-height: 1.6;">
                        ${error.message || 'An unexpected error occurred'}
                    </div>
                </div>
            </div>
        `;
    }

    getServerLabel(server) {
        const serverClean = (server || 'https://reverie.house').replace(/^https?:\/\//, '');
        if (serverClean === 'reverie.house') {
            return 'Residence';
        } else if (serverClean.endsWith('bsky.network')) {
            return 'Homestar';
        }
        return 'Domain';
    }
    
    getServerUrl(server) {
        const serverClean = (server || 'https://reverie.house').replace(/^https?:\/\//, '');
        // For bsky.network homestars, link to Bluesky
        if (serverClean.endsWith('bsky.network')) {
            return 'https://bsky.app';
        }
        // For custom PDS (pds.domain.com), link to the actual domain
        if (serverClean.startsWith('pds.')) {
            return 'https://' + serverClean.replace(/^pds\./, '');
        }
        // Otherwise use the full server URL as-is
        return server || 'https://reverie.house';
    }
    
    getServerDisplay(server) {
        const serverClean = (server || 'reverie.house').replace(/^https?:\/\//, '');
        // For bsky.network homestars, extract the homestar name (e.g., "porcini" from "porcini.us-east.host.bsky.network")
        if (serverClean.endsWith('bsky.network')) {
            const homestarMatch = serverClean.match(/^([^.]+)\./);
            return homestarMatch ? homestarMatch[1] : serverClean;
        }
        // Remove 'pds.' prefix for cleaner display
        return serverClean.replace(/^pds\./, '');
    }
    
    getPdsStatusMessage(server) {
        const serverClean = (server || 'reverie.house').replace(/^https?:\/\//, '');
        if (serverClean === 'reverie.house') {
            return 'personal dream stowage is active';
        }
        return '';
    }

    async render() {
        console.log('🎨 [Dashboard] render() called');
        if (!this.dreamerData) {
            console.warn('⚠️ [Dashboard] render() called but dreamerData is null/undefined');
            return;
        }

        console.log('🎨 [Dashboard] Rendering with data:', {
            display_name: this.dreamerData.display_name,
            avatar: this.dreamerData.avatar?.substring(0, 60) + '...',
            handle: this.dreamerData.handle
        });

        const d = this.dreamerData;
        
        const canonHtml = await this.renderCanonLog();
        const souvenirBoxHtml = await this.renderSouvenirBox();
        
        this.container.innerHTML = `
            <div class="dashboard-content">
            <div class="dashboard-container">
                <!-- Profile Header / Namebar -->
                <div class="dashboard-header">
                    <div class="dashboard-avatar-section">
                        <div class="dashboard-avatar" onclick="window.dashboardWidget.showAvatarUpload()" style="cursor: pointer;" title="Click to update avatar">
                            <img src="${d.avatar || '/assets/icon_face.png'}" 
                                 alt="${d.display_name || d.handle}"
                                 onerror="this.src='/assets/icon_face.png'">
                        </div>
                        <div class="dashboard-avatar-hint">click to change</div>
                    </div>
                    <div class="dashboard-identity">
                        <h1 class="dashboard-display-name" onclick="window.dashboardWidget.editDisplayName()" style="cursor: pointer;" title="Click to edit">
                            ${d.display_name || d.handle}
                        </h1>
                        <div class="dashboard-handle">
                            <a href="https://bsky.app/profile/${d.handle}" target="_blank" rel="noopener">@${d.handle}</a>
                        </div>
                        <div class="dashboard-status" id="dashboardStatusDisplay">calculating...</div>
                        <div class="dashboard-contribution" id="dashboardContribution">
                            calculating...
                        </div>
                        <div class="dashboard-arrival">
                            ${this.formatArrival(d.arrival)}
                        </div>
                    </div>
                    
                    <!-- Top Right Boxes: Octant, Souvenirs, and Canon -->
                    <div class="dashboard-right-boxes">
                        <!-- Octant/Spectrum Box (now using OctantDisplay widget) -->
                        <div class="dashboard-square-box octant-box" id="dashboardOctantBox">
                            <!-- Octant display widget will be rendered here -->
                        </div>
                        
                        <!-- Souvenirs Box -->
                        <div class="dashboard-square-box souvenirs-box">
                            <div class="square-box-title">Souvenirs</div>
                            <div class="square-box-content souvenirs-grid-compact">
                                ${souvenirBoxHtml}
                            </div>
                        </div>
                        
                        <!-- Canon Box (moved from left column) -->
                        <div class="dashboard-square-box canon-box">
                            <div class="square-box-title">Recent Canon</div>
                            <div class="square-box-content canon-list-compact">
                                ${canonHtml}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Dashboard Grid -->
                <div class="dashboard-grid">
                    <!-- Left Column: Heading and Controls -->
                    <div class="dashboard-card">
                        <div class="spectrum-heading-combined">
                            <!-- Condensed Roles/Character Section -->
                            <div class="roles-character-section" id="rolesCharacterSection">
                                <!-- Will be populated by JS -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="dashboard-card dashboard-system-controls">
                        <div class="system-controls-content">
                            <div class="system-control-section">
                                <div class="dashboard-tabs">
                                    <button class="dashboard-tab active" id="composeTab" onclick="window.dashboardWidget.switchTab('compose')">
                                        <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; top: 3px;">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        Compose
                                    </button>
                                    <button class="dashboard-tab" id="detailsTab" onclick="window.dashboardWidget.switchTab('details')">
                                        <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; top: 3px;">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        Details
                                    </button>
                                    <button class="dashboard-tab" id="phaneraColorTab" onclick="window.dashboardWidget.switchTab('phanera')">
                                        <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; top: 3px;">
                                            <circle cx="13.5" cy="6.5" r=".5"></circle>
                                            <circle cx="17.5" cy="10.5" r=".5"></circle>
                                            <circle cx="8.5" cy="7.5" r=".5"></circle>
                                            <circle cx="6.5" cy="12.5" r=".5"></circle>
                                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
                                        </svg>
                                        Aesthetic
                                    </button>
                                    <button class="dashboard-tab" id="messagesTab" onclick="window.dashboardWidget.switchTab('messages')">
                                        <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; top: 3px;">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                        Messages
                                        <span class="dashboard-tab-badge" id="dashboardMessagesBadge" style="display: none;"></span>
                                    </button>
                                </div>
                                
                                <div class="dashboard-tab-content" id="composeContent" style="display: block;">
                                    ${this.renderComposeForm()}
                                </div>
                                
                                <div class="dashboard-tab-content" id="detailsContent" style="display: none;">
                                    <!-- Split column layout for bio and reading -->
                                    <div class="dashboard-details-split">
                                        <div class="dashboard-details-left">
                                            <div class="dashboard-description-container">
                                                <div class="section-title-bio">Current Bio</div>
                                                <textarea 
                                                    class="dashboard-description-textarea-tall" 
                                                    id="descriptionTextarea"
                                                    placeholder="Add a description about yourself..."
                                                    maxlength="300"
                                                >${d.description || d.bio || ''}</textarea>
                                                <div class="dashboard-description-status" id="descriptionStatus"></div>
                                            </div>
                                        </div>
                                        
                                        <div class="dashboard-details-right">
                                            <div class="recently-read-container">
                                                <div class="section-title-bio">Recently Read</div>
                                                <div class="recently-read-add">
                                                    <input type="text" 
                                                           class="recently-read-input" 
                                                           id="bookTitleInput" 
                                                           placeholder="Book Title"
                                                           maxlength="100">
                                                    <input type="text" 
                                                           class="recently-read-input" 
                                                           id="bookAuthorInput" 
                                                           placeholder="Author Name"
                                                           maxlength="100">
                                                    <button class="recently-read-btn" id="addBookButton" onclick="window.dashboardWidget.addBook()">
                                                        Update Book
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="account-info-grid-two-column">
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">Name</span>
                                            <a href="/dreamer.html?did=${d.did}" class="dashboard-info-value dashboard-info-link" title="View dreamer profile">${d.name || d.handle}</a>
                                        </div>
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">Pseudonyms</span>
                                            <span class="dashboard-info-value info-truncate" title="${d.alt_names || 'none'}">${this.renderAltNames(d.alt_names)}</span>
                                        </div>
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">Handle</span>
                                            <a href="https://bsky.app/profile/${d.handle}" target="_blank" rel="noopener" class="dashboard-info-value dashboard-info-link" title="View on Bluesky">@${d.handle}</a>
                                        </div>
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">${this.getServerLabel(d.server)}</span>
                                            <a href="${this.getServerUrl(d.server)}" target="_blank" rel="noopener" class="dashboard-info-value dashboard-info-link info-truncate" title="${this.getServerUrl(d.server)}">${this.getServerDisplay(d.server)}</a>
                                        </div>
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">Patronage</span>
                                            <span class="dashboard-info-value" title="${d.patronage || 0} cents total from book purchases">${d.patronage || 0}</span>
                                        </div>
                                        <div class="account-info-row">
                                            <span class="dashboard-info-label">Dream ID</span>
                                            <span class="dashboard-info-value dashboard-info-monospace info-clickable" 
                                                  id="did-copy-target"
                                                  onclick="const el = this; navigator.clipboard.writeText('${d.did}').then(() => { const orig = el.textContent; el.textContent = '✓ copied!'; setTimeout(() => el.textContent = orig, 2000); })" 
                                                  title="Click to copy: ${d.did}">${d.did.replace('did:plc:', '')}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="dashboard-tab-content" id="messagesContent" style="display: none;">
                                    <div class="messages-with-kindred-layout">
                                        <div class="messages-main-panel">
                                            <div class="dashboard-messages-container" id="dashboardMessagesContainer">
                                                <!-- Messages will be loaded here -->
                                                <div class="dashboard-messages-loading">Loading messages...</div>
                                            </div>
                                        </div>
                                        <div class="messages-kindred-sidebar">
                                            <div id="kindredContainer" class="kindred-container">
                                                ${await this.renderKindred()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="dashboard-tab-content" id="phaneraColorContent" style="display: none;">
                                    <div class="color-control-grid">
                                        <div class="color-left-column">
                                            ${await this.renderPhaneraSelector()}
                                            <div class="phanera-image-display" id="phaneraImageDisplay">
                                                <img src="${this.getPhaneraImagePath(d.phanera, d.souvenirs)}" 
                                                     alt="Phanera" 
                                                     class="phanera-preview-image"
                                                     onerror="this.src='/souvenirs/residence/phanera.png'">
                                            </div>
                                        </div>
                                        <div class="color-right-column">
                                            <div class="color-input-row">
                                                <div class="color-preview-swatch" id="colorPreviewSwatch" style="background-color: ${d.color_hex || '#734ba1'};"></div>
                                                <input type="text" 
                                                       id="colorHexInput" 
                                                       class="color-hex-input-inline"
                                                       value="${d.color_hex || '#734ba1'}"
                                                       maxlength="7">
                                                <button class="color-save-btn-inline" id="colorSaveBtn" onclick="window.dashboardWidget.saveColor()">
                                                    Save
                                                </button>
                                            </div>
                                            <div class="color-picker-inline" id="colorPickerInline">
                                                <div class="color-picker-main">
                                                    <div class="color-shade-picker" id="colorShadePicker">
                                                        <canvas id="colorShadeCanvas" width="180" height="180"></canvas>
                                                        <div class="color-shade-cursor" id="colorShadeCursor"></div>
                                                    </div>
                                                    <div class="color-hue-slider" id="colorHueSlider">
                                                        <canvas id="colorHueCanvas" width="20" height="180"></canvas>
                                                        <div class="color-hue-cursor" id="colorHueCursor"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="color-preset-buttons">
                                                <button class="color-preset-btn" onclick="window.dashboardWidget.setDefaultColor()">
                                                    Default
                                                </button>
                                                <button class="color-preset-btn" onclick="window.dashboardWidget.setRandomColor()">
                                                    Random
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Account Actions Inline -->
                            <div class="system-control-section account-actions-inline">
                                ${this.renderAccountActions()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        `;

        // Initialize the octant display widget
        setTimeout(() => this.initializeOctantDisplay(), 50);

        setTimeout(() => this.initializeCurrentHeadingDisplay(), 100);
        
        setTimeout(() => this.initializeOctantExplainer(), 200);
        
        setTimeout(() => this.initializeColorPicker(), 100);
        
        setTimeout(() => this.setupPhaneraImageClick(), 100);
        
        // Update contribution counter with real counts from lore.farm
        setTimeout(() => this.updateContributionDisplay(), 100);
        
        // Initialize dashboard background based on phanera preference from localStorage
        const initialPref = this.getDashboardPhaneraPref();
        // Initializing background
        setTimeout(() => this.applyDashboardBackground(initialPref), 300);
        
        // Initialize roles/character section
        setTimeout(() => this.renderRolesCharacterSection(), 100);
        
        // Load compose tab (since it's the default active tab)
        setTimeout(() => this.switchTab('compose'), 150);
        
        // Initialize message badge count
        setTimeout(() => this.updateInitialMessageBadge(), 200);
    }
    
    async initializeOctantDisplay() {
        const octantContainer = this.container.querySelector('#dashboardOctantBox');
        if (!octantContainer) return;
        
        if (window.OctantDisplay && this.dreamerData) {
            // Destroy old widget if it exists
            if (this.octantDisplay) {
                this.octantDisplay.destroy();
            }
            
            // Create new widget without polling (dashboard updates manually)
            this.octantDisplay = new window.OctantDisplay(octantContainer, {
                did: this.dreamerData.did,
                pollingInterval: null, // No auto-polling in dashboard
                onSetHeading: null, // No heading button in dashboard view
                showHeader: true, // Show octant name
                showFooter: false  // Hide heading info in compact dashboard view
            });
            
            // Update with current dreamer data
            await this.octantDisplay.updateDreamer(this.dreamerData);
        } else {
            // Retry if widget not loaded yet
            setTimeout(() => this.initializeOctantDisplay(), 100);
        }
    }
    
    setupPhaneraImageClick() {
        const phaneraImg = this.container.querySelector('.phanera-preview-image');
        if (phaneraImg && window.Shadowbox) {
            phaneraImg.style.cursor = 'pointer';
            phaneraImg.addEventListener('click', () => {
                const imageUrl = phaneraImg.src;
                const imageName = this.dreamerData?.phanera || 'Phanera';
                window.Shadowbox.show(imageUrl, imageName, {
                    enableBubbles: false,
                    enableGrowth: false
                });
            });
        }
    }
    
    initializeOctantExplainer() {
        if (window.octantExplainerWidget) {
            const octantTriggers = this.container.querySelectorAll('.octant-explainer-trigger');
            octantTriggers.forEach(el => {
                // Get the octant color from the octant box
                const octantBox = el.closest('[data-octant]');
                let color = null;
                
                if (octantBox) {
                    const octantKey = octantBox.getAttribute('data-octant');
                    const computedStyle = getComputedStyle(octantBox);
                    color = computedStyle.backgroundColor;
                }
                
                window.octantExplainerWidget.attach(el, null, color);
            });
        } else {
            setTimeout(() => this.initializeOctantExplainer(), 500);
        }
    }
    
    async initializeCurrentHeadingDisplay() {
        const currentHeading = this.dreamerData.heading || '';
        if (currentHeading.startsWith('did:')) {
            try {
                const response = await fetch('/api/dreamers');
                const dreamers = await response.json();
                const targetDreamer = dreamers.find(d => d.did === currentHeading);
                
                if (targetDreamer) {
                    this.selectedHeadingDreamer = { did: targetDreamer.did, name: targetDreamer.name };
                    
                    const select = document.getElementById('headingSelect');
                    if (select) {
                        const option = select.querySelector('#dreamerHeadingSelected');
                        if (option) {
                            option.textContent = `Toward ${targetDreamer.name}`;
                        }
                    }
                }
            } catch (error) {
            }
        }
    }

    renderHeadingSelector() {
        const currentHeading = this.dreamerData.heading || '';
        const isHeadingToDreamer = currentHeading.startsWith('did:');
        
        return `
            <div class="heading-selector">
                <span class="heading-label">Heading</span>
                <select class="heading-select" id="headingSelect" onchange="window.dashboardWidget.onHeadingSelectChange(this.value)">
                    <option value="" ${currentHeading === '' && !isHeadingToDreamer ? 'selected' : ''}>Drift</option>
                    <option value="affix" ${currentHeading === 'affix' ? 'selected' : ''}>Affix</option>
                    <option value="origin" ${currentHeading === 'origin' ? 'selected' : ''}>Origin</option>
                    <option value="home" ${currentHeading === 'home' ? 'selected' : ''}>Home</option>
                    <option disabled>───────────</option>
                    <option value="liberty" ${currentHeading === 'liberty' ? 'selected' : ''}>Liberty</option>
                    <option value="authority" ${currentHeading === 'authority' ? 'selected' : ''}>Authority</option>
                    <option value="entropy" ${currentHeading === 'entropy' ? 'selected' : ''}>Entropy</option>
                    <option value="oblivion" ${currentHeading === 'oblivion' ? 'selected' : ''}>Oblivion</option>
                    <option value="receptive" ${currentHeading === 'receptive' ? 'selected' : ''}>Receptive</option>
                    <option value="skeptic" ${currentHeading === 'skeptic' ? 'selected' : ''}>Skeptic</option>
                    <option disabled>───────────</option>
                    ${isHeadingToDreamer ? '<option value="dreamer:selected" id="dreamerHeadingSelected" selected>Toward [Loading...]</option>' : ''}
                    <option value="dreamer:search">Toward Dreamer...</option>
                </select>
                <button class="heading-confirm-btn" id="headingConfirmBtn" onclick="window.dashboardWidget.updateHeading()">
                    SET
                </button>
            </div>
        `;
    }
    
    renderAccountActions() {
        const hasAdminToken = !!localStorage.getItem('admin_token');
        const handle = this.dreamerData?.handle || '';
        const isReverieHost = handle === 'reverie.house' || handle.endsWith('.reverie.house');
        
        // Only show Delete Account button for reverie.house users
        const deleteAccountButton = isReverieHost ? `
            <button class="account-action-compact delete-account-action" onclick="window.dashboardWidget.handleDeleteAccount()" title="Delete Account">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Delete Account
            </button>
        ` : '';
        
        return `
            <div class="account-actions-inline-container">
                ${deleteAccountButton}
                <button class="account-action-compact logout-btn logout-flush-right" onclick="window.dashboardWidget.handleLogout()" title="Logout">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                </button>
            </div>
        `;
    }
    
    async handleLogout() {
        // Logout from OAuth
        if (window.oauthManager && typeof window.oauthManager.logout === 'function') {
            await window.oauthManager.logout();
        }
        
        // Also clear admin token if present
        localStorage.removeItem('admin_token');
        
        // Reload the page to refresh all UI
        window.location.reload();
    }
    
    handleShareLore() {
        console.log('📝 [Dashboard] Share Lore button clicked');
        
        // Check if user is logged in
        const session = window.oauthManager?.getSession?.();
        if (!session) {
            console.log('⚠️ [Dashboard] No session, showing login');
            // Trigger login
            if (window.loginWidget && window.loginWidget.showLoginPopup) {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        // Open share lore modal
        if (window.shareLoreWidget) {
            console.log('✅ [Dashboard] Opening share lore modal');
            window.shareLoreWidget.show();
        } else {
            console.error('❌ [Dashboard] shareLoreWidget not available');
            alert('Share Lore feature is loading. Please try again in a moment.');
        }
    }
    
    handleDeleteAccount() {
        console.log('🗑️ [Dashboard] Delete Account button clicked');
        
        // Check if user is logged in
        const session = window.oauthManager?.getSession?.();
        if (!session) {
            console.log('⚠️ [Dashboard] No session, cannot delete account');
            return;
        }
        
        // Check if user is on reverie.house
        const handle = this.dreamerData?.handle || '';
        const isResident = handle === 'reverie.house' || handle.endsWith('.reverie.house');
        if (!isResident) {
            console.log('⚠️ [Dashboard] Delete account only available for reverie.house users');
            return;
        }
        
        // Ensure modal is loaded and initialized
        const openModal = () => {
            if (window.deleteAccountModal) {
                console.log('✅ [Dashboard] Opening delete account modal');
                window.deleteAccountModal.open(session);
            } else if (window.DeleteAccountModal) {
                // Class is loaded but not instantiated yet
                console.log('🔄 [Dashboard] Initializing delete account modal');
                window.deleteAccountModal = new window.DeleteAccountModal();
                window.deleteAccountModal.open(session);
            } else {
                console.error('❌ [Dashboard] DeleteAccountModal not available');
                alert('Delete Account feature is loading. Please try again in a moment.');
            }
        };
        
        openModal();
    }
    
    async onHeadingSelectChange(value) {
        if (value === 'dreamer:search') {
            this.openDreamerSearchModal();
        }
    }
    
    openDreamerSearchModal() {
        const modalHTML = `
            <div class="dreamer-modal-overlay" id="dreamerModalOverlay" onclick="window.dashboardWidget.closeDreamerSearchModal()">
                <div class="dreamer-modal-box" onclick="event.stopPropagation()">
                    <div class="dreamer-modal-header">
                        <h3>Select a Dreamer</h3>
                        <button class="dreamer-modal-close" onclick="window.dashboardWidget.closeDreamerSearchModal()">✕</button>
                    </div>
                    <div class="dreamer-modal-body">
                        <input type="text" 
                               id="dreamerSearchInput" 
                               class="dreamer-search-input-modal" 
                               placeholder="Type to search dreamers..." 
                               autofocus />
                        <div id="dreamerSearchResults" class="dreamer-search-results-modal"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        setTimeout(() => {
            this.setupDreamerSearch();
            const input = document.getElementById('dreamerSearchInput');
            if (input) input.focus();
        }, 100);
    }
    
    closeDreamerSearchModal() {
        const modal = document.getElementById('dreamerModalOverlay');
        if (modal) {
            modal.remove();
        }
        
        const currentHeading = this.dreamerData.heading || '';
        if (!currentHeading.startsWith('did:')) {
            const select = document.getElementById('headingSelect');
            if (select) {
                select.value = currentHeading;
            }
        }
    }
    
    async setupDreamerSearch() {
        const input = document.getElementById('dreamerSearchInput');
        const resultsDiv = document.getElementById('dreamerSearchResults');
        
        if (!input || !resultsDiv) return;
        
        let allDreamers = [];
        try {
            const response = await fetch('/api/dreamers');
            allDreamers = await response.json();
        } catch (error) {
            resultsDiv.innerHTML = '<div class="search-hint">Failed to load dreamers</div>';
            return;
        }
        
        const showResults = (query) => {
            if (!query) {
                resultsDiv.innerHTML = '<div class="search-hint">Type to search dreamers...</div>';
                return;
            }
            
            const filtered = allDreamers.filter(d => 
                d.name.toLowerCase().includes(query.toLowerCase()) ||
                d.handle.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10);
            
            if (filtered.length === 0) {
                resultsDiv.innerHTML = '<div class="search-hint">No dreamers found</div>';
                return;
            }
            
            resultsDiv.innerHTML = filtered.map(d => `
                <div class="dreamer-search-result" onclick="window.dashboardWidget.selectDreamerHeading('${d.did}', '${d.name.replace(/'/g, "\\'")}')">
                    <img src="${d.avatar || '/assets/icon_face.png'}" alt="${d.name}" class="dreamer-result-avatar" onerror="this.src='/assets/icon_face.png'">
                    <div class="dreamer-result-info">
                        <div class="dreamer-result-name">${d.name}</div>
                        <div class="dreamer-result-handle">@${d.handle}</div>
                    </div>
                </div>
            `).join('');
        };
        
        input.addEventListener('input', (e) => showResults(e.target.value));
        showResults('');
    }
    
    async selectDreamerHeading(did, name) {
        this.selectedHeadingDreamer = { did, name };
        
        this.closeDreamerSearchModal();
        
        const select = document.getElementById('headingSelect');
        if (select) {
            let dreamerOption = select.querySelector('#dreamerHeadingSelected');
            
            if (!dreamerOption) {
                const searchOption = select.querySelector('option[value="dreamer:search"]');
                dreamerOption = document.createElement('option');
                dreamerOption.id = 'dreamerHeadingSelected';
                dreamerOption.value = 'dreamer:selected';
                select.insertBefore(dreamerOption, searchOption);
            }
            
            dreamerOption.textContent = `Toward ${name}`;
            dreamerOption.selected = true;
        }
        
        const confirmBtn = document.getElementById('headingConfirmBtn');
        if (confirmBtn) confirmBtn.disabled = false;
    }

    async renderSouvenirs() {
        try {
            return '';
        } catch (error) {
            return '';
        }
    }
    
    async renderCanonLog() {
        try {
            const response = await fetch('/api/canon');
            if (!response.ok) throw new Error('Failed to load canon');
            
            const canon = await response.json();
            const dreamerEvents = canon.filter(entry => 
                entry.did && entry.did.toLowerCase() === this.dreamerData.did.toLowerCase()
            );
            
            dreamerEvents.sort((a, b) => b.epoch - a.epoch);
            
            const recentEvents = dreamerEvents.slice(0, 3);
            
            if (recentEvents.length === 0) {
                return '<div class="dashboard-canon-empty">No canon events yet</div>';
            }
            
            const entries = recentEvents.map(ev => {
                let eventText = ev.event;
                if (ev.url && ev.url.trim()) {
                    eventText = `<a href="${ev.url}" target="_blank" rel="noopener">${ev.event}</a>`;
                }
                return `<div class="canon-mini-entry">${eventText}</div>`;
            });
            
            return entries.join('');
            
        } catch (error) {
            return '<div class="dashboard-canon-empty">Error loading canon</div>';
        }
    }
    
    async renderSouvenirBox() {
        try {
            const souvenirs = this.dreamerData.souvenirs || {};
            const souvenirKeys = Object.keys(souvenirs);
            
            if (souvenirKeys.length === 0) {
                return '<div class="souvenirs-empty">No souvenirs yet</div>';
            }
            
            // Show up to 6 souvenirs, then show "+N more" indicator
            const displayCount = Math.min(6, souvenirKeys.length);
            const remainingCount = souvenirKeys.length - displayCount;
            
            let html = '';
            
            // Render souvenir items
            for (let i = 0; i < displayCount; i++) {
                const key = souvenirKeys[i];
                const souvenirName = key.split('/').pop() || key;
                html += `
                    <div class="dashboard-souvenir-item" title="${souvenirName}">
                        <img src="/souvenirs/${key}/icon.png" 
                             alt="${souvenirName}"
                             onerror="this.src='/assets/icon_face.png'">
                    </div>
                `;
            }
            
            // Add "more" indicator if there are additional souvenirs
            if (remainingCount > 0) {
                html += `<div class="souvenirs-more">+${remainingCount}</div>`;
            }
            
            return html;
            
        } catch (error) {
            console.error('Error rendering souvenirs:', error);
            return '<div class="souvenirs-empty">Error loading souvenirs</div>';
        }
    }
    
    renderComposeForm() {
        return `
            <div class="compose-container">
                <!-- Main compose area - switches between text and attachments -->
                <div class="compose-view" id="composeView">
                    <!-- Text view (default) -->
                    <div class="compose-text-view" id="composeTextView">
                        <div class="compose-text-full">
                            <div class="compose-text-header">
                                <div class="compose-text-title">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                    Compose Dream
                                </div>
                                <div class="compose-text-count" id="composeCharCount">0/300</div>
                            </div>
                            
                            <div class="compose-textarea-wrapper">
                                <textarea 
                                    class="dashboard-description-textarea-tall compose-textarea-main" 
                                    id="composePostText"
                                    placeholder="What's on your mind?"
                                ></textarea>
                            </div>
                            
                            <!-- Image toggle button - bottom left of container -->
                            <button class="compose-view-toggle-btn" id="composeCourierBtnInline" onclick="window.dashboardWidget.toggleCourierScheduleView()" title="View scheduled posts">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 6v6l4 2"></path>
                                    <circle cx="12" cy="12" r="8"></circle>
                                </svg>
                            </button>
                            <button class="compose-view-toggle-btn" id="composeMediaBtnInline" onclick="window.dashboardWidget.toggleAttachmentsView()" title="Add images">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </button>
                            <span class="compose-view-toggle-text" id="composeMediaText">0/4 Images</span>
                        </div>
                    </div>
                    
                    <!-- Attachments view (toggled) -->
                    <div class="compose-attachments-view" id="composeAttachmentsView" style="display: none;">
                        <div class="compose-attachments-full">
                            <div class="compose-attachments-header">
                                <div class="compose-attachments-title">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                    Image Attachments
                                </div>
                                <div class="compose-attachments-count" id="composeAttachmentsCount">0/4</div>
                            </div>
                            
                            <div class="compose-image-preview-large" id="composeImagePreview">
                                <div class="compose-image-empty-large">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                    <p style="color: #999;">No images attached yet</p>
                                    <button class="compose-attach-btn-large" onclick="document.getElementById('composeImageInput').click()">
                                        Choose Images
                                    </button>
                                </div>
                            </div>
                            
                            <input type="file" 
                                   id="composeImageInput" 
                                   accept="image/jpeg,image/png,image/gif,image/webp"
                                   multiple
                                   style="display: none;"
                                   onchange="window.dashboardWidget.handleImageSelect(event)">
                            
                            <!-- Bottom action bar -->
                            <div class="compose-attachments-footer">
                                <!-- Toggle buttons - bottom left -->
                                <button class="compose-view-toggle-btn" id="composeCourierBtnInAttachments" onclick="window.dashboardWidget.toggleCourierScheduleView()" title="View scheduled posts">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 6v6l4 2"></path>
                                        <circle cx="12" cy="12" r="8"></circle>
                                    </svg>
                                </button>
                                <button class="compose-view-toggle-btn" id="composeTextBtnInAttachments" onclick="window.dashboardWidget.toggleAttachmentsView()" title="Back to compose">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <span class="compose-view-toggle-text" id="composeMediaTextInAttachments">0/4 Images</span>
                                
                                <!-- Carousel navigation arrows -->
                                <div class="compose-carousel-nav">
                                    <button class="compose-carousel-btn" onclick="window.dashboardWidget.scrollImagesLeft()" title="Scroll left">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                        </svg>
                                    </button>
                                    <button class="compose-carousel-btn" onclick="window.dashboardWidget.scrollImagesRight()" title="Scroll right">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </button>
                                </div>
                                
                                <!-- Add more button - adjacent to toggle -->
                                <button class="compose-add-more-btn-footer" id="composeAddMoreBtn" onclick="document.getElementById('composeImageInput').click()" title="Add another image">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    <span class="compose-add-more-text">Add Image</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Courier Schedule view (toggled) -->
                    <div class="compose-courier-schedule-view" id="composeCourierScheduleView" style="display: none;">
                        <div class="compose-courier-schedule-full">
                            <div class="compose-courier-schedule-header">
                                <div class="compose-courier-schedule-title">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 6v6l4 2"></path>
                                        <circle cx="12" cy="12" r="8"></circle>
                                    </svg>
                                    Courier Schedule
                                </div>
                                <div class="compose-courier-schedule-count" id="composeCourierScheduleCount">0 scheduled</div>
                            </div>
                            
                            <div class="compose-courier-schedule-table" id="composeCourierScheduleTable">
                                <div class="compose-courier-schedule-empty">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M12 6v6l4 2"></path>
                                        <circle cx="12" cy="12" r="8"></circle>
                                    </svg>
                                    <p style="color: #999;">No scheduled posts</p>
                                </div>
                            </div>
                            
                            <!-- Bottom action bar -->
                            <div class="compose-courier-schedule-footer">
                                <!-- Toggle buttons - bottom left -->
                                <button class="compose-view-toggle-btn" id="composeCourierBtnInSchedule" onclick="window.dashboardWidget.toggleCourierScheduleView()" title="Back to compose">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="compose-view-toggle-btn" id="composeMediaBtnInSchedule" onclick="window.dashboardWidget.toggleAttachmentsView()" title="Add images">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                </button>
                                <span class="compose-view-toggle-text" id="composeMediaTextInSchedule">0/4 Images</span>
                                
                                <!-- Pagination arrows - bottom right -->
                                <div class="compose-courier-schedule-pagination">
                                    <button class="compose-courier-schedule-page-btn" onclick="window.dashboardWidget.courierSchedulePrevPage()" title="Previous page" disabled>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                        </svg>
                                    </button>
                                    <span class="compose-courier-schedule-page-info" id="composeCourierPageInfo">Page 1</span>
                                    <button class="compose-courier-schedule-page-btn" onclick="window.dashboardWidget.courierScheduleNextPage()" title="Next page" disabled>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="compose-footer">
                    <div class="compose-footer-left">
                        <div class="compose-schedule-display" id="composeScheduleDisplay" onclick="window.dashboardWidget.openCalendarPicker()">
                            <svg class="compose-schedule-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span class="compose-schedule-placeholder">Click to Schedule</span>
                        </div>
                        
                        <input type="hidden" id="composeScheduleTime">
                    </div>
                    <div class="compose-footer-right">
                        <label class="compose-lore-toggle">
                            <input type="checkbox" id="composeIsLore" class="compose-lore-checkbox">
                            <span class="compose-lore-label">LORE</span>
                        </label>
                    </div>
                    <div class="compose-footer-actions">
                        <button class="compose-footer-btn compose-footer-btn-secondary" onclick="window.dashboardWidget.clearCompose()">Clear</button>
                        <button class="compose-footer-btn compose-footer-btn-primary compose-footer-btn-fixed" id="composeSubmitBtn" onclick="window.dashboardWidget.submitCompose()">Post</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    async renderPhaneraSelector() {
        // Dashboard phanera selector has only two options: None and Collective
        // This is stored in localStorage, not the database
        const currentPref = this.getDashboardPhaneraPref();
        
        return `
            <div class="phanera-selector-inline">
                <select class="phanera-select" id="phaneraSelect" onchange="window.dashboardWidget.updateDashboardPhanera(this.value)">
                    <option value="none" ${currentPref === 'none' ? 'selected' : ''}>None</option>
                    <option value="collective" ${currentPref === 'collective' ? 'selected' : ''}>Collective</option>
                </select>
            </div>
        `;
    }

    /**
     * Get dashboard phanera preference from localStorage
     */
    getDashboardPhaneraPref() {
        const key = `dashboard_phanera_${this.session?.did || 'guest'}`;
        return localStorage.getItem(key) || 'none';
    }

    /**
     * Set dashboard phanera preference in localStorage
     */
    setDashboardPhaneraPref(value) {
        const key = `dashboard_phanera_${this.session?.did || 'guest'}`;
        localStorage.setItem(key, value);
    }
    
    getPhaneraImagePath(phanera, souvenirs) {
        if (!phanera || phanera === '') {
            return '/souvenirs/residence/phanera.png';
        }
        
        if (souvenirs && souvenirs[phanera]) {
            return `/souvenirs/${phanera}/phanera.png`;
        }
        
        return '/souvenirs/residence/phanera.png';
    }
    
    async renderKindred() {
        try {
            const did = this.session?.did || this.dreamerData?.did;
            if (!did) {
                return '<div class="kindred-empty">Not logged in</div>';
            }
            
            const response = await fetch(`/api/kindred?did=${encodeURIComponent(did)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch kindred');
            }
            
            const kindred = await response.json();
            
            // Check if user has any kindred
            const hasKindred = kindred && kindred.length > 0;
            
            // Always show 4 cells, fill with empty if needed
            let selected = [];
            if (hasKindred) {
                const shuffled = kindred.sort(() => 0.5 - Math.random());
                selected = shuffled.slice(0, 4);
            }
            
            // Pad with empty cells to always have 4
            while (selected.length < 4) {
                selected.push(null);
            }
            
            const currentHeadingDid = this.dreamerData?.heading_dreamer_did;
            
            // Build title with conditional message
            const titleHtml = hasKindred 
                ? '<div class="section-title-kindred">Kindred</div>'
                : '<div class="section-title-kindred">Kindred <span style="font-style: italic; font-weight: normal; opacity: 0.6; font-size: 0.7rem; text-transform: lowercase;">(no kindred yet)</span></div>';
            
            return `
                ${titleHtml}
                <div class="dashboard-kindred-list">
                    ${selected.map(k => {
                        if (k) {
                            return `
                                <div class="dashboard-kindred-card" data-dreamer-did="${k.did}" data-dreamer-handle="${k.handle}">
                                    <a href="/dreamer.html?did=${k.did}" 
                                       class="dashboard-kindred-link"
                                       data-dreamer-did="${k.did}"
                                       data-dreamer-handle="${k.handle}">
                                        <img src="${k.avatar || '/assets/icon_face.png'}" 
                                             alt="${k.name}"
                                             class="dashboard-kindred-avatar"
                                             onerror="this.src='/assets/icon_face.png'">
                                        <span class="dashboard-kindred-name">${k.name}</span>
                                    </a>
                                </div>
                            `;
                        } else {
                            // Empty cell
                            return `
                                <div class="dashboard-kindred-card dashboard-kindred-empty">
                                    <div class="dashboard-kindred-placeholder">
                                        <div class="dashboard-kindred-avatar-empty"></div>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
            
        } catch (error) {
            return '<div class="kindred-empty">Error loading kindred</div>';
        }
    }
    
    async setHeadingToKindred(did, name) {
        try {
            // Get auth token
            const token = await this.getOAuthToken();
            if (!token) {
                throw new Error('Please login');
            }
            
            const response = await fetch('/api/heading/set', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    did: this.session.did,
                    heading: did,
                    name: this.dreamerData.display_name || this.dreamerData.handle
                })
            });

            if (!response.ok) throw new Error('Failed to set heading');

            this.dreamerData.heading = 'dreamer';
            this.dreamerData.heading_dreamer_did = did;
            this.dreamerData.heading_dreamer_name = name;
            
            const headingSelectorContainer = document.querySelector('.heading-selector-container');
            if (headingSelectorContainer) {
                headingSelectorContainer.innerHTML = await this.renderHeadingSelector();
            }
            
            const kindredContainer = document.getElementById('kindredContainer');
            if (kindredContainer) {
                kindredContainer.innerHTML = await this.renderKindred();
            }

        } catch (error) {
            alert('Failed to set heading. Please try again.');
        }
    }
    
    async updatePhanera(phaneraKey) {
        if (!phaneraKey) {
            phaneraKey = '';
        }

        await this.withWritePermission(async () => {
            try {
                const token = await this.getOAuthToken();
                if (!token) {
                    console.warn('🎨 [Dashboard] No auth token, phanera will not be saved to server');
                    return;
                }

                const response = await fetch('/api/dreamers/phanera', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        did: this.session.did,
                        phanera: phaneraKey
                    })
                });

            if (!response.ok) {
                const error = await response.json();
                console.error('🎨 [Dashboard] Failed to save phanera:', error);
                throw new Error(error.message || 'Failed to update phanera');
            }

            console.log('✅ [Dashboard] Phanera saved to server:', phaneraKey);
            this.dreamerData.phanera = phaneraKey;
            
            const phaneraImageDisplay = document.querySelector('.phanera-preview-image');
            if (phaneraImageDisplay) {
                phaneraImageDisplay.src = this.getPhaneraImagePath(phaneraKey, this.dreamerData.souvenirs);
            }
            
            const previewImg = document.getElementById('phaneraPreviewImg');
            if (previewImg) {
                if (phaneraKey) {
                    previewImg.src = `/souvenirs/${phaneraKey}/phanera.png`;
                } else {
                    previewImg.src = '/assets/icon_face.png';
                }
            }
            
            // Dispatch custom event for homepage to listen to
            window.dispatchEvent(new CustomEvent('phaneraUpdated', {
                detail: {
                    phanera: phaneraKey,
                    did: this.session.did
                }
            }));

            } catch (error) {
                console.error('🎨 [Dashboard] Error updating phanera:', error);
                alert('Failed to update phanera. Please try again.');
            }
        }, 'update your aesthetic preferences');
    }

    /**
     * Update dashboard phanera preference (None or Collective)
     * This is stored in localStorage, not the database
     */
    async updateDashboardPhanera(value) {
        try {
            this.setDashboardPhaneraPref(value);
            await this.applyDashboardBackground(value);
        } catch (error) {
            console.error('❌ [Dashboard] Failed to update dashboard phanera:', error);
            alert('Failed to update phanera preference. Please try again.');
        }
    }

    /**
     * Apply background to dashboard based on preference
     */
    async applyDashboardBackground(preference) {
        const drawerBody = document.querySelector('.drawer-body');
        if (!drawerBody) {
            console.warn('⚠️ [Dashboard] Drawer body not found');
            return;
        }

        if (preference === 'collective') {
            const collectivePhanera = await this.getCollectivePhanera();
            this.showDashboardBackground(drawerBody, collectivePhanera, 'collective');
        } else {
            const userPhanera = this.dreamerData.phanera || 'residence/home';
            this.showDashboardBackground(drawerBody, userPhanera, 'none');
        }
    }

    /**
     * Get the most popular phanera selection from all dreamers
     */
    async getCollectivePhanera() {
        try {
            const response = await fetch('/api/dreamers');
            if (!response.ok) {
                console.warn('⚠️ [Dashboard] Failed to fetch dreamers for collective phanera');
                return 'residence/home';
            }

            const dreamers = await response.json();
            
            // Count phanera occurrences (excluding empty strings and 'collective')
            const phaneraCount = {};
            for (const dreamer of dreamers) {
                const phanera = dreamer.phanera;
                if (phanera && phanera !== '' && phanera !== 'collective') {
                    phaneraCount[phanera] = (phaneraCount[phanera] || 0) + 1;
                }
            }

            // Find most popular
            let mostPopular = 'residence/home';
            let maxCount = 0;
            
            for (const [phanera, count] of Object.entries(phaneraCount)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostPopular = phanera;
                }
            }

            return mostPopular;
        } catch (error) {
            console.error('❌ [Dashboard] Error getting collective phanera:', error);
            return 'residence/home';
        }
    }

    /**
     * Show phanera background on dashboard
     */
    showDashboardBackground(container, phaneraKey, mode = 'collective') {
        // Get or create background div
        let bgDiv = container.querySelector('.dashboard-phanera-background');
        
        if (!bgDiv) {
            bgDiv = document.createElement('div');
            bgDiv.className = 'dashboard-phanera-background';
            bgDiv.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 0;
                pointer-events: none;
                opacity: 0;
                transition: all 0.8s ease-in-out;
            `;
            container.insertBefore(bgDiv, container.firstChild);
        }

        const userColor = this.dreamerData?.color_hex || '#734ba1';

        const img = document.createElement('img');
        img.src = `/souvenirs/${phaneraKey}/phanera.png`;
        img.alt = mode === 'collective' ? `Collective Phanera` : `Your Phanera`;
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
        `;

        img.onload = () => {
            bgDiv.innerHTML = '';
            bgDiv.appendChild(img);
            
            if (mode === 'none') {
                // User color overlay mode
                bgDiv.style.opacity = '0.4';
                bgDiv.style.filter = `sepia(1) saturate(2) hue-rotate(0deg)`;
                bgDiv.style.background = userColor;
                bgDiv.style.mixBlendMode = 'multiply';
                img.style.filter = `grayscale(0.3)`;
                img.style.opacity = '0.6';
            } else {
                // Collective mode
                bgDiv.style.opacity = '0.3';
                bgDiv.style.filter = 'none';
                bgDiv.style.background = 'transparent';
                bgDiv.style.mixBlendMode = 'normal';
                img.style.filter = 'none';
                img.style.opacity = '1';
            }
        };

        img.onerror = () => {
            console.error(`❌ [Dashboard] Failed to load phanera image: ${phaneraKey}`);
        };

        if (container.style.position !== 'relative' && container.style.position !== 'absolute') {
            container.style.position = 'relative';
        }

        const content = container.querySelector('.dashboard-content');
        if (content) {
            content.style.position = 'relative';
            content.style.zIndex = '1';
        }
    }

    getOctantInfo(octantFromDB) {
        // Calculate octant from spectrum scores
        const spectrum = this.dreamerData?.spectrum || this.dreamerData;
        
        // If we don't have valid spectrum data, return equilibrium
        if (!spectrum) {
            return {
                octantKey: 'equilibrium',
                color: 'var(--octant-equilibrium)',
                darkenedColor: 'var(--octant-equilibrium-dark)',
                textColor: '#000000',
                descColor: '#000000',
                description: 'Equilibrium',
                name: 'Equilibrium',
                primaryAxes: [],
                axes: '',
                balancedAxes: []
            };
        }
        
        // Calculate differences for each axis pair
        const x = (spectrum.entropy || 0) - (spectrum.oblivion || 0);
        const y = (spectrum.liberty || 0) - (spectrum.authority || 0);
        const z = (spectrum.receptive || 0) - (spectrum.skeptic || 0);
        
        // Count how many axes are balanced (difference = 0)
        const balancedAxes = [];
        if (x === 0) balancedAxes.push('entropy/oblivion');
        if (y === 0) balancedAxes.push('liberty/authority');
        if (z === 0) balancedAxes.push('receptive/skeptic');
        
        // Check for equilibrium (all three paired axes are balanced)
        if (balancedAxes.length === 3) {
            return {
                octantKey: 'equilibrium',
                color: 'var(--octant-equilibrium)',
                darkenedColor: 'var(--octant-equilibrium-dark)',
                textColor: '#000000',
                descColor: '#000000',
                description: 'Equilibrium',
                name: 'Equilibrium',
                primaryAxes: [],
                axes: '',
                balancedAxes: []
            };
        }
        
        // Check for singling (two axes balanced)
        if (balancedAxes.length === 2) {
            return {
                octantKey: 'singling',
                color: 'var(--octant-singling)',
                darkenedColor: 'var(--octant-singling-dark)',
                textColor: '#000000',
                descColor: '#000000',
                description: 'Singling',
                name: 'Singling',
                primaryAxes: [],
                axes: '',
                balancedAxes: balancedAxes
            };
        }
        
        // Check for confused (one axis balanced)
        if (balancedAxes.length === 1) {
            return {
                octantKey: 'confused',
                color: 'var(--octant-confused)',
                darkenedColor: 'var(--octant-confused-dark)',
                textColor: '#000000',
                descColor: '#000000',
                description: 'Confused',
                name: 'Confused',
                primaryAxes: [],
                axes: '',
                balancedAxes: balancedAxes
            };
        }
        
        const xSign = x >= 0 ? '+' : '-';
        const ySign = y >= 0 ? '+' : '-';
        const zSign = z >= 0 ? '+' : '-';
        
        const octantCode = xSign + ySign + zSign;
        
        // Map octant codes to CSS class names (matching octants.css)
        const octantCodeToName = {
            '+++': 'adaptive',      // Entropy • Liberty • Receptive
            '++-': 'chaotic',       // Entropy • Liberty • Skeptic
            '+-+': 'intended',      // Entropy • Authority • Receptive
            '+--': 'prepared',      // Entropy • Authority • Skeptic
            '-++': 'contented',     // Oblivion • Liberty • Receptive
            '-+-': 'assertive',     // Oblivion • Liberty • Skeptic
            '--+': 'ordered',       // Oblivion • Authority • Receptive
            '---': 'guarded'        // Oblivion • Authority • Skeptic
        };
        
        const octantDisplayNames = {
            'adaptive': 'Adaptive',
            'chaotic': 'Chaotic',
            'intended': 'Intended',
            'prepared': 'Prepared',
            'contented': 'Contented',
            'assertive': 'Assertive',
            'ordered': 'Ordered',
            'guarded': 'Guarded'
        };
        
        const octantPrimaryAxes = {
            'adaptive': ['entropy', 'receptive', 'liberty'],
            'chaotic': ['entropy', 'skeptic', 'liberty'],
            'intended': ['entropy', 'receptive', 'authority'],
            'prepared': ['entropy', 'skeptic', 'authority'],
            'contented': ['oblivion', 'receptive', 'liberty'],
            'assertive': ['oblivion', 'skeptic', 'liberty'],
            'ordered': ['oblivion', 'receptive', 'authority'],
            'guarded': ['oblivion', 'skeptic', 'authority']
        };
        
        const octantName = octantCodeToName[octantCode] || 'equilibrium';
        const displayName = octantDisplayNames[octantName] || 'Equilibrium';
        
        const primaryAxes = octantPrimaryAxes[octantName] || [];
        const axes = primaryAxes.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(' • ');

        return {
            octantKey: octantName,
            octantCode: octantCode,
            color: `var(--octant-${octantName})`,
            darkenedColor: `var(--octant-${octantName}-dark)`,
            textColor: '#000000', // Will be determined by CSS
            descColor: '#000000',
            description: displayName,
            name: displayName,
            primaryAxes: primaryAxes,
            axes: axes
        };
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        let date;
        if (typeof dateString === 'number') {
            date = new Date(dateString > 10000000000 ? dateString : dateString * 1000);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) return 'Unknown';
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        const formattedDate = date.toLocaleDateString('en-US', options);
        
        let relative;
        if (diffDays === 0) {
            relative = 'Today';
        } else if (diffDays === 1) {
            relative = 'Yesterday';
        } else if (diffDays < 7) {
            relative = `${diffDays}d ago`;
        } else if (diffDays < 30) {
            relative = `${Math.floor(diffDays / 7)}w ago`;
        } else if (diffDays < 365) {
            relative = `${Math.floor(diffDays / 30)}mo ago`;
        } else {
            const years = Math.floor(diffDays / 365);
            relative = `${years}y ago`;
        }
        
        return `${formattedDate} (${relative})`;
    }
    
    formatArrival(dateString) {
        if (window.NumNom && window.NumNom.formatArrivalTime) {
            return window.NumNom.formatArrivalTime(dateString);
        }
        return this.formatDate(dateString);
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'unknown';
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        return `${Math.floor(diffDays / 365)}y ago`;
    }

    async formatContribution(dreamer) {
        // Fetch real canon and lore counts from lore.farm labels
        let canonCount = 0;
        let loreCount = 0;
        
        // PERFORMANCE: Check cache first (5 minute TTL)
        const cacheKey = `lore_counts_${dreamer.did}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                canonCount = data.canonCount;
                loreCount = data.loreCount;
            } else {
                // Cache expired, fetch fresh data
                try {
                    // PERFORMANCE: Add 2 second timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    
                    const labelsResponse = await fetch(
                        `https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=at://${dreamer.did}/*&limit=1000`,
                        { signal: controller.signal }
                    );
                    clearTimeout(timeoutId);
                    
                    if (labelsResponse.ok) {
                        const labelsData = await labelsResponse.json();
                        const labels = labelsData.labels || [];
                        
                        // Count canon and lore labels that belong to this user
                        labels.forEach(label => {
                            if (label.uri && label.uri.startsWith(`at://${dreamer.did}/`)) {
                                if (label.val === 'canon:reverie.house') {
                                    canonCount++;
                                } else if (label.val === 'lore:reverie.house') {
                                    loreCount++;
                                }
                            }
                        });
                        
                        // Cache the results
                        sessionStorage.setItem(cacheKey, JSON.stringify({
                            timestamp: Date.now(),
                            data: { canonCount, loreCount }
                        }));
                    }
                } catch (error) {
                    // Silent fail if lore.farm is down - use fallback
                    if (error.name !== 'AbortError') {
                        console.error('Error fetching label counts:', error);
                    }
                    canonCount = dreamer.canon_contribution || 0;
                    loreCount = dreamer.lore_contribution || 0;
                }
            }
        } else {
            // No cache, fetch fresh data
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                const labelsResponse = await fetch(
                    `https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=at://${dreamer.did}/*&limit=1000`,
                    { signal: controller.signal }
                );
                clearTimeout(timeoutId);
                
                if (labelsResponse.ok) {
                    const labelsData = await labelsResponse.json();
                    const labels = labelsData.labels || [];
                    
                    labels.forEach(label => {
                        if (label.uri && label.uri.startsWith(`at://${dreamer.did}/`)) {
                            if (label.val === 'canon:reverie.house') {
                                canonCount++;
                            } else if (label.val === 'lore:reverie.house') {
                                loreCount++;
                            }
                        }
                    });
                    
                    // Cache the results
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        data: { canonCount, loreCount }
                    }));
                }
            } catch (error) {
                // Silent fail if lore.farm is down
                if (error.name !== 'AbortError') {
                    console.error('Error fetching label counts:', error);
                }
                canonCount = dreamer.canon_contribution || 0;
                loreCount = dreamer.lore_contribution || 0;
            }
        }
        
        const patronScore = dreamer.patronage || 0;
        const totalContribution = (canonCount * 30) + (loreCount * 10) + patronScore;
        
        return `
            <span class="contribution-label">Contribution:</span> 
            <span class="contribution-value">${totalContribution}</span><br>
            <span class="contribution-breakdown">(${canonCount} canon · ${loreCount} lore · ${patronScore} patron)</span>
        `;
    }
    
    async updateContributionDisplay() {
        const contributionEl = this.container.querySelector('#dashboardContribution');
        if (contributionEl && this.dreamerData) {
            const contributionHtml = await this.formatContribution(this.dreamerData);
            contributionEl.innerHTML = contributionHtml;
        }
    }

    initializeColorPicker() {
        this.hueCanvas = document.getElementById('colorHueCanvas');
        this.shadeCanvas = document.getElementById('colorShadeCanvas');
        this.hueCursor = document.getElementById('colorHueCursor');
        this.shadeCursor = document.getElementById('colorShadeCursor');
        this.previewSwatch = document.getElementById('colorPreviewSwatch');
        this.hexInput = document.getElementById('colorHexInput');

        if (!this.hueCanvas || !this.shadeCanvas) return;

        this.cleanupColorPickerListeners();

        const currentColor = this.dreamerData.color_hex || '#734ba1';
        const { h, s, v } = this.hexToHSV(currentColor);
        this.currentHue = h;
        this.currentSat = s;
        this.currentBri = v;

        this.drawHueBar();
        this.drawShadeSelector();
        
        this.updateHueCursor();
        this.updateShadeCursor();
        
        this.updateColorPreview();

        this.attachColorPickerListeners();
    }
    
    cleanupColorPickerListeners() {
        if (this.hueMouseMoveHandler) {
            document.removeEventListener('mousemove', this.hueMouseMoveHandler);
            document.removeEventListener('mouseup', this.hueMouseUpHandler);
        }
        if (this.shadeMouseMoveHandler) {
            document.removeEventListener('mousemove', this.shadeMouseMoveHandler);
            document.removeEventListener('mouseup', this.shadeMouseUpHandler);
        }
        
        if (this.hueCanvas && this.hueMouseDownHandler) {
            this.hueCanvas.removeEventListener('mousedown', this.hueMouseDownHandler);
        }
        if (this.shadeCanvas && this.shadeMouseDownHandler) {
            this.shadeCanvas.removeEventListener('mousedown', this.shadeMouseDownHandler);
        }
        
        if (this.hexInput && this.hexInputHandler) {
            this.hexInput.removeEventListener('input', this.hexInputHandler);
        }
    }

    hexToHSV(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        let s = max === 0 ? 0 : delta / max;
        let v = max;

        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
            } else if (max === g) {
                h = ((b - r) / delta + 2) / 6;
            } else {
                h = ((r - g) / delta + 4) / 6;
            }
        }

        return { h: h * 360, s, v };
    }

    hsvToHex(h, s, v) {
        h = h / 360;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        let r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        const toHex = (n) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    drawHueBar() {
        const ctx = this.hueCanvas.getContext('2d');
        const width = this.hueCanvas.width;
        const height = this.hueCanvas.height;

        for (let y = 0; y < height; y++) {
            const hue = (y / height) * 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.fillRect(0, y, width, 1);
        }
    }

    drawShadeSelector() {
        const ctx = this.shadeCanvas.getContext('2d');
        const width = this.shadeCanvas.width;
        const height = this.shadeCanvas.height;

        ctx.fillStyle = `hsl(${this.currentHue}, 100%, 50%)`;
        ctx.fillRect(0, 0, width, height);

        const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
        whiteGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        whiteGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = whiteGradient;
        ctx.fillRect(0, 0, width, height);

        const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
        blackGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        blackGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        ctx.fillStyle = blackGradient;
        ctx.fillRect(0, 0, width, height);
    }

    updateHueCursor() {
        const y = (this.currentHue / 360) * this.hueCanvas.height;
        this.hueCursor.style.top = `${y}px`;
    }

    updateShadeCursor() {
        const x = this.currentSat * this.shadeCanvas.width;
        const y = (1 - this.currentBri) * this.shadeCanvas.height;
        this.shadeCursor.style.left = `${x}px`;
        this.shadeCursor.style.top = `${y}px`;
    }

    updateColorPreview() {
        const hexColor = this.hsvToHex(this.currentHue, this.currentSat, this.currentBri);
        this.previewSwatch.style.backgroundColor = hexColor;
        this.hexInput.value = hexColor;
    }

    attachColorPickerListeners() {
        let hueMouseDown = false;
        const updateHue = (e) => {
            const rect = this.hueCanvas.getBoundingClientRect();
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            this.currentHue = (y / rect.height) * 360;
            this.updateHueCursor();
            this.drawShadeSelector();
            this.updateShadeCursor();
            this.updateColorPreview();
            this.updateColor(this.hexInput.value);
        };

        this.hueMouseDownHandler = (e) => {
            hueMouseDown = true;
            updateHue(e);
        };

        this.hueMouseMoveHandler = (e) => {
            if (hueMouseDown) updateHue(e);
        };

        this.hueMouseUpHandler = () => {
            hueMouseDown = false;
        };

        this.hueCanvas.addEventListener('mousedown', this.hueMouseDownHandler);
        document.addEventListener('mousemove', this.hueMouseMoveHandler);
        document.addEventListener('mouseup', this.hueMouseUpHandler);

        let shadeMouseDown = false;
        const updateShade = (e) => {
            const rect = this.shadeCanvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            this.currentSat = x / rect.width;
            this.currentBri = 1 - (y / rect.height);
            this.updateShadeCursor();
            this.updateColorPreview();
            this.updateColor(this.hexInput.value);
        };

        this.shadeMouseDownHandler = (e) => {
            shadeMouseDown = true;
            updateShade(e);
        };

        this.shadeMouseMoveHandler = (e) => {
            if (shadeMouseDown) updateShade(e);
        };

        this.shadeMouseUpHandler = () => {
            shadeMouseDown = false;
        };

        this.shadeCanvas.addEventListener('mousedown', this.shadeMouseDownHandler);
        document.addEventListener('mousemove', this.shadeMouseMoveHandler);
        document.addEventListener('mouseup', this.shadeMouseUpHandler);

        this.hexInputHandler = (e) => {
            let hex = e.target.value.trim().toUpperCase();
            
            // Auto-add # prefix if missing
            if (!hex.startsWith('#')) {
                hex = '#' + hex;
                e.target.value = hex; // Update the input field with the corrected value
            }
            
            // Validate and apply color
            if (/^#[0-9A-F]{6}$/.test(hex)) {
                const { h, s, v } = this.hexToHSV(hex);
                this.currentHue = h;
                this.currentSat = s;
                this.currentBri = v;
                this.updateHueCursor();
                this.drawShadeSelector();
                this.updateShadeCursor();
                this.previewSwatch.style.backgroundColor = hex;
                this.updateColor(hex);
            }
        };

        this.hexInput.addEventListener('input', this.hexInputHandler);
    }

    async updateColor(hexColor) {
        if (!hexColor || !hexColor.match(/^#[0-9A-F]{6}$/i)) {
            return;
        }

        document.documentElement.style.setProperty('--reverie-core-color', hexColor);

        if (this.colorUpdateDebounceTimer) {
            clearTimeout(this.colorUpdateDebounceTimer);
        }

        this.colorUpdateDebounceTimer = setTimeout(async () => {
            try {
                // Get auth token
                const token = await this.getOAuthToken();
                
                if (!token) {
                    console.warn('🎨 [Dashboard] No auth token, color will not be saved to server');
                    return;
                }

                const response = await fetch('/api/dreamers/color', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        did: this.session.did,
                        color_hex: hexColor
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('🎨 [Dashboard] Failed to save color:', error);
                    throw new Error(error.message || 'Failed to update color');
                }

                console.log('✅ [Dashboard] Color saved to server:', hexColor);
                this.dreamerData.color_hex = hexColor;
                
            } catch (error) {
                console.error('🎨 [Dashboard] Error saving color:', error);
            }
        }, 300); // Wait 300ms after user stops dragging before sending API request
    }
    
    async saveColor() {
        let hexColor = this.hexInput.value.trim().toUpperCase();
        
        // Auto-add # prefix if missing
        if (!hexColor.startsWith('#')) {
            hexColor = '#' + hexColor;
            this.hexInput.value = hexColor; // Update the input field
        }
        
        // Validate hex color
        if (!hexColor || !hexColor.match(/^#[0-9A-F]{6}$/i)) {
            alert('Please enter a valid hex color (e.g., #734BA1)');
            return;
        }
        
        const btn = document.getElementById('colorSaveBtn');
        const originalText = btn.textContent;
        
        try {
            btn.textContent = 'Saving...';
            btn.disabled = true;
            
            const token = await this.getOAuthToken();
            
            if (!token) {
                this.showLoginRequired('save your color preference');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }
            
            const response = await fetch('/api/dreamers/color', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    did: this.session.did,
                    color_hex: hexColor
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save color');
            }
            
            // Success feedback
            btn.textContent = 'SAVED';
            btn.style.background = '#22c55e';
            btn.style.borderColor = '#22c55e';
            
            // Update local data
            this.dreamerData.color_hex = hexColor;
            document.documentElement.style.setProperty('--reverie-core-color', hexColor);
            
            // Update color manager
            if (window.colorManager) {
                window.colorManager.setColor(hexColor, 'user');
            }
            
            console.log('✅ [Dashboard] Color saved:', hexColor);
            
            // Reset button after delay
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('🎨 [Dashboard] Error saving color:', error);
            btn.textContent = '✗ Error';
            btn.style.background = '#ef4444';
            btn.style.borderColor = '#ef4444';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.disabled = false;
            }, 2000);
            
            alert(`Failed to save color: ${error.message}`);
        }
    }
    
    setDefaultColor() {
        const defaultColor = '#734ba1';
        this.setColor(defaultColor);
    }
    
    setRandomColor() {
        // Generate a random saturated color
        const hue = Math.floor(Math.random() * 360);
        const saturation = 50 + Math.floor(Math.random() * 30); // 50-80%
        const lightness = 40 + Math.floor(Math.random() * 20); // 40-60%
        
        // Convert HSL to RGB
        const h = hue / 360;
        const s = saturation / 100;
        const l = lightness / 100;
        
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        // Convert to hex
        const toHex = (x) => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        const hexColor = '#' + toHex(r) + toHex(g) + toHex(b);
        this.setColor(hexColor.toUpperCase());
    }
    
    setColor(hexColor) {
        // Update the hex input
        if (this.hexInput) {
            this.hexInput.value = hexColor;
        }
        
        // Update the preview swatch
        if (this.previewSwatch) {
            this.previewSwatch.style.backgroundColor = hexColor;
        }
        
        // Update the color picker position
        const { h, s, v } = this.hexToHSV(hexColor);
        this.currentHue = h;
        
        // Update canvases
        this.drawShadeCanvas();
        this.drawHueCanvas();
        
        // Update cursors
        if (this.shadeCursor) {
            this.shadeCursor.style.left = (s * 100) + '%';
            this.shadeCursor.style.top = ((1 - v) * 100) + '%';
        }
        
        if (this.hueCursor) {
            this.hueCursor.style.top = (h / 360 * 100) + '%';
        }
    }

    getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    async updateHeading() {
        const select = document.getElementById('headingSelect');
        const btn = document.getElementById('headingConfirmBtn');
        
        if (!select || !btn) return;

        let headingValue = select.value;
        
        if (headingValue === 'dreamer:selected' && this.selectedHeadingDreamer) {
            headingValue = this.selectedHeadingDreamer.did;
        } else if (headingValue === 'dreamer:selected' || headingValue === 'dreamer:current') {
            alert('Please select a dreamer from the modal');
            return;
        }
        
        if (!headingValue && headingValue !== '') {
            alert('Please select a heading');
            return;
        }

        btn.disabled = true;
        btn.textContent = '...';

        try {
            // Get auth token
            const token = await this.getOAuthToken();
            if (!token) {
                throw new Error('Please login');
            }
            
            const response = await fetch('/api/heading/set', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    did: this.session.did,
                    heading: headingValue,
                    name: this.dreamerData.display_name || this.dreamerData.handle
                })
            });

            if (!response.ok) throw new Error('Failed to update heading');

            const result = await response.json();
            if (result.success) {
                this.dreamerData.heading = headingValue;
                
                btn.textContent = '✓';
                btn.style.background = '#00b894';
                
                setTimeout(async () => {
                    btn.textContent = 'SET';
                    btn.style.background = '';
                    btn.disabled = false;
                    await this.loadData();
                }, 1500);

            } else {
                throw new Error(result.error || 'Failed to update heading');
            }
        } catch (error) {
            alert('Failed to update heading. Please try again.');
            btn.textContent = 'SET';
            btn.disabled = false;
        }
    }

    async changeHandle() {
        const select = document.getElementById('handleSelect');
        const btn = document.getElementById('handleConfirmBtn');
        
        if (!select || !btn) return;
        
        const selectedHandle = select.value;
        if (!selectedHandle) return;
        
        // Extract the name portion from handle (e.g., "cousin" from "cousin.reverie.house")
        const name = selectedHandle.replace('.reverie.house', '');
        
        btn.disabled = true;
        btn.textContent = '...';
        
        try {
            const token = await this.getOAuthToken();
            if (!token) {
                throw new Error('Please login');
            }
            
            const response = await fetch('/api/user/set-primary-name', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: name })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to change handle');
            }
            
            const result = await response.json();
            
            // Update local data
            this.dreamerData.handle = selectedHandle;
            
            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent('handle-changed', { 
                detail: { 
                    newHandle: selectedHandle,
                    newName: name,
                    primaryName: result.primary_name,
                    altNames: result.alt_names
                } 
            }));
            
            btn.textContent = 'OK';
            btn.style.background = '#00b894';
            
            setTimeout(async () => {
                btn.textContent = 'CHANGE';
                btn.style.background = '';
                btn.disabled = false;
            }, 1500);
            
        } catch (error) {
            console.error('Failed to change handle:', error);
            alert('Failed to change handle. Please try again.');
            btn.textContent = 'CHANGE';
            btn.disabled = false;
        }
    }

    initMiniSpectrum() {
        const canvas = document.getElementById('dashboardMiniCanvas');
        if (!canvas || !this.dreamerData) return;

        const ctx = canvas.getContext('2d');
        this.drawSpectrum(ctx, canvas.width, canvas.height);

        this.updateAxisLabels();

        let isDragging = false;
        let lastX = 0, lastY = 0;
        let rotation = { x: 20, y: -30 };

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            
            rotation.y += deltaX * 0.5;
            rotation.x += deltaY * 0.5;
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            this.drawSpectrum(ctx, canvas.width, canvas.height, rotation);
        });

        canvas.addEventListener('mouseup', () => isDragging = false);
        canvas.addEventListener('mouseleave', () => isDragging = false);
    }

    drawSpectrum(ctx, width, height, rotation = { x: 20, y: -30 }) {
        ctx.clearRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = 60;

        const spectrum = this.dreamerData.spectrum || this.dreamerData;
        
        let x, y, z;
        if (this.currentView === 'xy') {
            x = ((spectrum.skeptic ?? 0) - (spectrum.receptive ?? 0)) / 100;
            y = ((spectrum.entropy ?? spectrum.chaos ?? 0) - (spectrum.oblivion ?? spectrum.order ?? 0)) / 100;
            z = 0;
        } else if (this.currentView === 'xz') {
            x = ((spectrum.skeptic ?? 0) - (spectrum.receptive ?? 0)) / 100;
            z = ((spectrum.liberty ?? spectrum.guarded ?? 0) - (spectrum.authority ?? spectrum.assertive ?? 0)) / 100;
            y = 0;
        } else { // yz
            y = ((spectrum.entropy ?? spectrum.chaos ?? 0) - (spectrum.oblivion ?? spectrum.order ?? 0)) / 100;
            z = ((spectrum.liberty ?? spectrum.guarded ?? 0) - (spectrum.authority ?? spectrum.assertive ?? 0)) / 100;
            x = 0;
        }

        ctx.strokeStyle = '#d0c7f0';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(centerX - scale, centerY);
        ctx.lineTo(centerX + scale, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - scale);
        ctx.lineTo(centerX, centerY + scale);
        ctx.stroke();

        const pointX = centerX + (x * scale);
        const pointY = centerY - (y * scale);

        ctx.fillStyle = 'rgba(115, 75, 161, 0.3)';
        ctx.beginPath();
        ctx.arc(pointX, pointY, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#734ba1';
        ctx.beginPath();
        ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    updateAxisLabels() {
        const topLabel = document.getElementById('dashboardAxisTop');
        const bottomLabel = document.getElementById('dashboardAxisBottom');
        const leftLabel = document.getElementById('dashboardAxisLeft');
        const rightLabel = document.getElementById('dashboardAxisRight');

        if (this.currentView === 'xy') {
            topLabel.textContent = 'CHAOS';
            bottomLabel.textContent = 'ORDER';
            leftLabel.textContent = 'SKEP';
            rightLabel.textContent = 'RCPT';
        } else if (this.currentView === 'xz') {
            topLabel.textContent = 'GUARD';
            bottomLabel.textContent = 'ASRT';
            leftLabel.textContent = 'SKEP';
            rightLabel.textContent = 'RCPT';
        } else { // yz
            topLabel.textContent = 'CHAOS';
            bottomLabel.textContent = 'ORDER';
            leftLabel.textContent = 'GUARD';
            rightLabel.textContent = 'ASRT';
        }
    }

    changeView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.mini-view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        const canvas = document.getElementById('dashboardMiniCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            this.drawSpectrum(ctx, canvas.width, canvas.height);
            this.updateAxisLabels();
        }
    }
    
    // ========================================================================
    // STATUS DISPLAY
    // ========================================================================
    
    async updateStatusDisplay() {
        const statusEl = document.getElementById('dashboardStatusDisplay');
        if (!statusEl) {
            console.warn('[Dashboard] Status element not found');
            // Retry once after a delay in case DOM isn't ready
            setTimeout(() => {
                const retryEl = document.getElementById('dashboardStatusDisplay');
                if (retryEl && this.dreamerData) {
                    this.displayStatus(retryEl);
                }
            }, 500);
            return;
        }
        
        if (!this.dreamerData) {
            console.warn('[Dashboard] Dreamer data not loaded yet for status display');
            statusEl.textContent = 'loading...';
            return;
        }
        
        this.displayStatus(statusEl);
    }
    
    displayStatus(statusEl) {
        // Use status from database if available, otherwise default to 'dreamer'
        const status = this.dreamerData.status || 'dreamer';
        statusEl.textContent = status;
        console.log(`[Dashboard] Status displayed: ${status}`);
    }
    
    async refreshUserStatus() {
        console.log('🔄 [Dashboard] refreshUserStatus() called');
        const token = await this.getOAuthToken();
        if (!token) {
            console.warn('⚠️ [Dashboard] No auth token for status refresh');
            return;
        }
        
        try {
            const response = await fetch('/api/user/refresh-status', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ [Dashboard] Status refreshed from server:', data.status);
                
                // Update local dreamer data
                if (this.dreamerData) {
                    this.dreamerData.status = data.status;
                }
                
                // Update status display
                const statusEl = document.getElementById('dashboardStatusDisplay');
                if (statusEl) {
                    statusEl.textContent = data.status;
                }
            } else {
                console.warn('⚠️ [Dashboard] Failed to refresh status:', response.status);
            }
        } catch (error) {
            console.error('❌ [Dashboard] Error refreshing status:', error);
        }
    }
    
    // ========================================================================
    // ROLES / CHARACTER SECTION (Condensed)
    // ========================================================================
    
    async renderRolesCharacterSection() {
        const section = document.getElementById('rolesCharacterSection');
        if (!section) return;
        
        try {
            const workerRoles = [];
            let isCharacter = false;
            let isConnected = false;
            let credentialUpdateDate = null;
            
            // Fetch worker roles
            try {
                // Check greeter status
                const greeterResponse = await fetch('/api/work/greeter/status', {
                    headers: { 'Authorization': `Bearer ${await this.getOAuthToken()}` }
                });
                if (greeterResponse.ok) {
                    const greeterData = await greeterResponse.json();
                    if (greeterData.is_worker) {
                        workerRoles.push({
                            role: 'Greeter',
                            status: greeterData.status
                        });
                    }
                }
                
                // Check mapper status
                const mapperResponse = await fetch('/api/work/mapper/status', {
                    headers: { 'Authorization': `Bearer ${await this.getOAuthToken()}` }
                });
                if (mapperResponse.ok) {
                    const mapperData = await mapperResponse.json();
                    if (mapperData.is_worker) {
                        workerRoles.push({
                            role: 'Mapper',
                            status: mapperData.status
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch worker roles:', error);
            }
            
            // Fetch character status
            try {
                const statusResponse = await fetch('/api/lore/character-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ did: this.session.did })
                });
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    isCharacter = statusData.is_character || false;
                }
            } catch (error) {
                console.warn('Failed to fetch character status:', error);
            }
            
            // Fetch app password status - simple check: does user have credentials?
            try {
                const token = await this.getOAuthToken();
                
                if (token) {
                    const credResponse = await fetch('/api/user/credentials/status', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (credResponse.ok) {
                        const credData = await credResponse.json();
                        isConnected = credData.connected || false;
                        credentialUpdateDate = credData.created_at || null;
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch credential status:', error);
            }
            
            // Build HTML - Tools section first, then Controls
            let html = '';
            
            // Tools Section
            html += '<div class="section-title-tools">Tools</div>';
            html += '<div class="tools-list">';
            
            // Heading Selector Tool
            const currentHeading = this.dreamerData.heading || '';
            const isHeadingToDreamer = currentHeading.startsWith('did:');
            html += `
                <div class="tool-row heading-tool">
                    <span class="tool-label">Heading</span>
                    <select class="heading-select" id="headingSelect" onchange="window.dashboardWidget.onHeadingSelectChange(this.value)">
                        <option value="" ${currentHeading === '' && !isHeadingToDreamer ? 'selected' : ''}>Drift</option>
                        <option value="affix" ${currentHeading === 'affix' ? 'selected' : ''}>Affix</option>
                        <option value="origin" ${currentHeading === 'origin' ? 'selected' : ''}>Origin</option>
                        <option value="home" ${currentHeading === 'home' ? 'selected' : ''}>Home</option>
                        <option disabled>───────────</option>
                        <option value="liberty" ${currentHeading === 'liberty' ? 'selected' : ''}>Liberty</option>
                        <option value="authority" ${currentHeading === 'authority' ? 'selected' : ''}>Authority</option>
                        <option value="entropy" ${currentHeading === 'entropy' ? 'selected' : ''}>Entropy</option>
                        <option value="oblivion" ${currentHeading === 'oblivion' ? 'selected' : ''}>Oblivion</option>
                        <option value="receptive" ${currentHeading === 'receptive' ? 'selected' : ''}>Receptive</option>
                        <option value="skeptic" ${currentHeading === 'skeptic' ? 'selected' : ''}>Skeptic</option>
                        <option disabled>───────────</option>
                        ${isHeadingToDreamer ? '<option value="dreamer:selected" id="dreamerHeadingSelected" selected>Toward [Loading...]</option>' : ''}
                        <option value="dreamer:search">Toward Dreamer...</option>
                    </select>
                    <button class="tool-btn heading-set-btn" id="headingConfirmBtn" onclick="window.dashboardWidget.updateHeading()">
                        SET
                    </button>
                </div>
            `;
            
            // Handle Selector Tool - build available handles from name + alts
            const availableHandles = [];
            if (this.dreamerData.name) {
                availableHandles.push(`${this.dreamerData.name}.reverie.house`);
            }
            if (this.dreamerData.alt_names) {
                const alts = this.dreamerData.alt_names.split(',').map(a => a.trim()).filter(a => a);
                alts.forEach(alt => availableHandles.push(`${alt}.reverie.house`));
            }
            const currentHandle = this.dreamerData.handle || '';
            
            if (availableHandles.length > 0) {
                html += `
                    <div class="tool-row handle-tool">
                        <span class="tool-label">Handle</span>
                        <select class="handle-select" id="handleSelect">
                            ${availableHandles.map(h => `<option value="${h}" ${h === currentHandle ? 'selected' : ''}>@${h}</option>`).join('')}
                        </select>
                        <button class="tool-btn handle-set-btn" id="handleConfirmBtn" onclick="window.dashboardWidget.changeHandle()">
                            CHANGE
                        </button>
                    </div>
                `;
            }
            
            // Check if mapper is available (for tools that need it)
            let mapperAvailable = false;
            try {
                const mapperInfoResponse = await fetch('/api/work/mapper/info');
                if (mapperInfoResponse.ok) {
                    const mapperData = await mapperInfoResponse.json();
                    mapperAvailable = mapperData.status === 'active' && mapperData.workers?.length > 0;
                }
            } catch (error) {
                console.warn('Failed to check mapper availability:', error);
            }
            
            // Spectrum Calculator Tool
            html += `
                <div class="tool-row">
                    <span class="tool-label">Spectrum Calculator</span>
                    <button class="tool-btn ${mapperAvailable ? 'available' : 'unavailable'}" 
                            onclick="window.dashboardWidget.openSpectrumCalculator()">
                        ${mapperAvailable ? 'USE TOOL' : 'NEEDS MAPPER'}
                    </button>
                </div>
            `;
            
            // Share Lore Tool
            html += `
                <div class="tool-row">
                    <span class="tool-label">Share Lore</span>
                    <button class="tool-btn available" 
                            onclick="window.dashboardWidget.handleShareLore()">
                        USE TOOL
                    </button>
                </div>
            `;
            
            html += '</div>';
            
            // Controls Section
            html += '<div class="section-title-controls">Controls</div>';
            html += '<div class="roles-character-list">';
            
            // Show character toggle at the top
            html += `
                <div class="character-row">
                    <span class="character-label">Approved for Lore</span>
                    <label class="character-toggle">
                        <input type="checkbox" 
                               id="characterToggle" 
                               ${isCharacter ? 'checked' : ''}
                               onchange="window.dashboardWidget.toggleCharacter(this.checked)">
                        <span class="character-toggle-slider"></span>
                    </label>
                </div>
            `;
            
            // Show worker roles with step down button
            if (workerRoles.length > 0) {
                workerRoles.forEach(role => {
                    const roleLabel = role.role === 'Greeter' 
                        ? 'Greeter of Reveries' 
                        : 'Spectrum Mapper';
                    const stepDownFunction = role.role === 'Greeter'
                        ? 'stepDownGreeter'
                        : 'stepDownMapper';
                    
                    html += `
                        <div class="role-row">
                            <span class="role-name">${roleLabel}</span>
                            <button class="role-stepdown-btn" onclick="window.dashboardWidget.${stepDownFunction}()">
                                STEP DOWN
                            </button>
                        </div>
                    `;
                });
            }
            
            // App password connection row (now inside the list)
            if (isConnected) {
                // Format the date as MM/DD/YY
                let dateString = 'unknown';
                if (credentialUpdateDate) {
                    const date = new Date(credentialUpdateDate);
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const year = String(date.getFullYear()).slice(-2);
                    dateString = `${month}/${day}/${year}`;
                }
                
                html += `
                    <div class="app-password-row connected">
                        <span class="app-password-label">
                            App Password
                            <span class="app-password-date">updated ${dateString}</span>
                        </span>
                        <button class="disconnect-btn-small" onclick="window.dashboardWidget.disconnectAppPassword()">
                            DISCONNECT
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="app-password-row disconnected">
                        <input type="text" 
                               id="appPasswordInline" 
                               class="app-password-inline-input"
                               placeholder="xxxx-xxxx-xxxx-xxxx"
                               maxlength="19"
                               autocomplete="off"
                               autocorrect="off"
                               autocapitalize="off"
                               spellcheck="false">
                        <button class="connect-btn-small" onclick="window.dashboardWidget.connectAppPassword()">
                            CONNECT
                        </button>
                        <button class="create-btn-small" onclick="window.open('https://bsky.app/settings/app-passwords', '_blank')" title="Create a new app password on Bluesky">
                            CREATE
                        </button>
                    </div>
                `;
            }
            
            // Bluesky Settings row at the bottom (for reverie.house users)
            const isReverieHost = this.dreamerData?.handle?.endsWith('.reverie.house') || false;
            if (isReverieHost) {
                const handle = this.dreamerData?.handle || '';
                html += `
                    <div class="bluesky-settings-row">
                        <span class="app-password-label">
                            Bluesky
                            <span class="app-password-date">${handle}</span>
                        </span>
                        <a href="https://bsky.app/settings" target="_blank" rel="noopener" class="disconnect-btn-small">
                            SETTINGS
                        </a>
                    </div>
                `;
            }
            
            html += '</div>';
            
            section.innerHTML = html;
            
            // Setup app password input formatting if not connected
            if (!isConnected) {
                const input = document.getElementById('appPasswordInline');
                if (input) {
                    input.addEventListener('input', (e) => {
                        let value = e.target.value.replace(/-/g, '').replace(/\s/g, '');
                        if (value.length > 16) value = value.substring(0, 16);
                        const formatted = value.match(/.{1,4}/g)?.join('-') || value;
                        e.target.value = formatted;
                        
                        // Clear any previous error state
                        e.target.classList.remove('invalid');
                        const status = document.getElementById('appPasswordStatus');
                        if (status) status.textContent = '';
                    });
                }
            }
            
        } catch (error) {
            console.error('Failed to render roles/character section:', error);
            section.innerHTML = '<div class="roles-character-error">Failed to load</div>';
        }
    }
    
    async toggleCharacter(enabled) {
        try {
            // Get auth token
            const token = await this.getOAuthToken();
            
            if (!token) {
                throw new Error('Not authenticated. Please log in.');
            }
            
            if (enabled) {
                const payload = {
                    userDid: this.session.did,
                    characterName: this.session.handle || this.session.did
                };
                console.log('🎭 Registering character:', payload);
                
                const response = await fetch('/api/lore/register-character', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Register character failed:', response.status, errorData);
                    throw new Error(errorData.error || 'Failed to register as character');
                }
                
                const result = await response.json();
                console.log('✅ Character registered:', result);
            } else {
                const payload = { 
                    userDid: this.session.did,
                    characterName: this.session.handle || this.session.did
                };
                console.log('🎭 Unregistering character:', payload);
                
                const response = await fetch('/api/lore/unregister-character', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Unregister character failed:', response.status, errorData);
                    throw new Error(errorData.error || 'Failed to unregister as character');
                }
                
                const result = await response.json();
                console.log('✅ Character unregistered:', result);
            }
            
            // Refresh user status in database
            console.log('🔄 [Dashboard] Refreshing user status after character toggle');
            try {
                const statusResponse = await fetch('/api/user/refresh-status', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    console.log('✅ [Dashboard] Status refreshed:', statusData.status);
                    
                    // Update local dreamer data
                    if (this.dreamerData) {
                        this.dreamerData.status = statusData.status;
                    }
                    
                    // Update status display
                    const statusEl = document.getElementById('dashboardStatusDisplay');
                    if (statusEl) {
                        statusEl.textContent = statusData.status;
                    }
                } else {
                    console.warn('⚠️ [Dashboard] Failed to refresh status');
                }
            } catch (error) {
                console.error('❌ [Dashboard] Error refreshing status:', error);
            }
            
            // Refresh the section
            await this.renderRolesCharacterSection();
            
        } catch (error) {
            console.error('Failed to toggle character:', error);
            // Revert checkbox
            const checkbox = document.getElementById('characterToggle');
            if (checkbox) checkbox.checked = !enabled;
            alert(`Failed to ${enabled ? 'enable' : 'disable'} character status: ${error.message}`);
        }
    }
    
    async stepDownGreeter() {
        // Use the StepDownWidget if available
        if (window.StepDownWidget) {
            window.StepDownWidget.show('greeter', async () => {
                try {
                    const token = await this.getOAuthToken();
                    const response = await fetch('/api/work/greeter/step-down', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Step down failed:', response.status, errorText);
                        throw new Error('Failed to step down');
                    }
                    
                    // Emit event for cross-page synchronization
                    if (window.WorkEvents) {
                        window.WorkEvents.emit(window.WorkEvents.EVENTS.GREETER_STEPPED_DOWN, {
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Refresh user status in database
                    console.log('🔄 [Dashboard] Refreshing user status after stepping down');
                    try {
                        const statusResponse = await fetch('/api/user/refresh-status', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log('✅ [Dashboard] Status refreshed:', statusData.status);
                            
                            // Update local dreamer data and display
                            if (this.dreamerData) {
                                this.dreamerData.status = statusData.status;
                            }
                            const statusEl = document.getElementById('dashboardStatusDisplay');
                            if (statusEl) {
                                statusEl.textContent = statusData.status;
                            }
                        }
                    } catch (error) {
                        console.error('❌ [Dashboard] Error refreshing status:', error);
                    }
                    
                    // Refresh the section
                    await this.renderRolesCharacterSection();
                } catch (error) {
                    console.error('Failed to step down:', error);
                    alert('Failed to step down from Greeter role');
                }
            });
        }
    }
    
    async stepDownMapper() {
        // Use the StepDownWidget if available
        if (window.StepDownWidget) {
            window.StepDownWidget.show('mapper', async () => {
                try {
                    const token = await this.getOAuthToken();
                    const response = await fetch('/api/work/mapper/step-down', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Step down failed:', response.status, errorText);
                        throw new Error('Failed to step down');
                    }
                    
                    // Emit event for cross-page synchronization
                    if (window.WorkEvents) {
                        window.WorkEvents.emit(window.WorkEvents.EVENTS.MAPPER_STEPPED_DOWN, {
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Refresh user status in database
                    console.log('🔄 [Dashboard] Refreshing user status after stepping down');
                    try {
                        const statusResponse = await fetch('/api/user/refresh-status', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log('✅ [Dashboard] Status refreshed:', statusData.status);
                            
                            // Update local dreamer data and display
                            if (this.dreamerData) {
                                this.dreamerData.status = statusData.status;
                            }
                            const statusEl = document.getElementById('dashboardStatusDisplay');
                            if (statusEl) {
                                statusEl.textContent = statusData.status;
                            }
                        }
                    } catch (error) {
                        console.error('❌ [Dashboard] Error refreshing status:', error);
                    }
                    
                    // Refresh the section
                    await this.renderRolesCharacterSection();
                } catch (error) {
                    console.error('Failed to step down:', error);
                    alert('Failed to step down from Mapper role');
                }
            });
        }
    }
    
    async openSpectrumCalculator() {
        // Check if the modal is available
        if (window.spectrumCalculatorModal) {
            await window.spectrumCalculatorModal.open();
        } else {
            console.error('Spectrum Calculator modal not available');
            alert('Spectrum Calculator is not available. Please refresh the page.');
        }
    }
    
    async connectAppPassword() {
        // Support both sidebar and dashboard compose inputs
        const sidebarInput = document.getElementById('appPasswordInline');
        const dashboardInput = document.getElementById('dashboardAppPassword');
        const input = dashboardInput || sidebarInput;
        
        const sidebarStatus = document.getElementById('appPasswordStatus');
        const dashboardStatus = document.getElementById('dashboardAppPasswordStatus');
        const status = dashboardStatus || sidebarStatus;
        
        const sidebarButton = document.querySelector('.connect-btn-small');
        const dashboardButton = document.querySelector('.compose-password-btn');
        const button = dashboardButton || sidebarButton;
        
        if (!input || !button) return;
        
        const password = input.value.trim();
        
        // Validate format - remove spaces and dashes for counting
        const cleaned = password.replace(/\s/g, '').replace(/-/g, '');
        
        // Check length
        if (cleaned.length !== 16) {
            input.classList.add('invalid');
            if (status) {
                status.innerHTML = `<span style="color: #dc3545;">✗ Must be 16 characters (${cleaned.length} entered)</span>`;
                status.className = 'app-password-status error';
            }
            
            // Shake animation
            input.style.animation = 'shake 0.5s';
            setTimeout(() => input.style.animation = '', 500);
            return;
        }
        
        // Check for valid characters (alphanumeric only)
        if (!/^[a-zA-Z0-9]+$/.test(cleaned)) {
            input.classList.add('invalid');
            if (status) {
                status.innerHTML = '<span style="color: #dc3545;">✗ Only letters and numbers allowed</span>';
                status.className = 'app-password-status error';
            }
            
            // Shake animation
            input.style.animation = 'shake 0.5s';
            setTimeout(() => input.style.animation = '', 500);
            return;
        }
        
        // Update button state
        const originalText = button.innerHTML;
        button.innerHTML = '⏳ CHECKING...';
        button.disabled = true;
        button.style.opacity = '0.6';
        if (status) {
            status.textContent = '';
        }
        input.classList.remove('invalid');
        
        // Hide CREATE button immediately
        const createButton = document.querySelector('.create-btn-small');
        if (createButton) {
            createButton.style.display = 'none';
        }
        
        try {
            const token = await this.getOAuthToken();
            const response = await fetch('/api/user/credentials/connect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ app_password: password })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                // Show error with icon and animation
                input.classList.add('invalid');
                if (status) {
                    const errorMsg = data.detail || data.error || 'Invalid Password';
                    status.innerHTML = `<span style="color: #dc3545;">✗ ${errorMsg}</span>`;
                    status.className = 'app-password-status error';
                }
                
                // Shake animation
                input.style.animation = 'shake 0.5s';
                setTimeout(() => input.style.animation = '', 500);
                
                // Also show a celebration popup if available
                if (window.showCelebration) {
                    window.showCelebration('App Password is Invalid', 'error');
                }
                
                // Reset button
                button.innerHTML = originalText;
                button.disabled = false;
                button.style.opacity = '1';
                return;
            }
            
            // Success! Show success state with icon and animation
            input.classList.remove('invalid');
            input.classList.add('success');
            if (status) {
                status.innerHTML = '<span style="color: #28a745;">✓ Connected!</span>';
                status.className = 'app-password-status success';
            }
            button.innerHTML = '✓ CONNECTED';
            button.style.background = '#28a745';
            button.style.borderColor = '#28a745';
            
            // Show celebration if available
            if (window.showCelebration) {
                window.showCelebration('App Password Connected!', 'success');
            }
            
            // Pulse animation on input
            input.style.animation = 'pulse 0.5s';
            setTimeout(() => input.style.animation = '', 500);
            
            // Clear input value
            input.value = '';
            
            // Dispatch event for other components
            if (window.WorkEvents) {
                window.WorkEvents.emit(window.WorkEvents.EVENTS.CREDENTIALS_CONNECTED, {
                    did: this.session?.did
                });
            }
            
            // Refresh the section after a brief delay to show new UI
            setTimeout(async () => {
                // Update dreamer data
                await this.loadData();
                
                // Refresh the sidebar section to show disconnect button
                await this.renderRolesCharacterSection();
                
                // If we're on the compose tab, refresh credentials check
                const composeTab = document.getElementById('composeTab');
                if (composeTab && composeTab.classList.contains('active')) {
                    this.checkComposeCredentials();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Failed to connect app password:', error);
            input.classList.add('invalid');
            if (status) {
                status.innerHTML = '<span style="color: #dc3545;">✗ Network Error</span>';
                status.className = 'app-password-status error';
            }
            
            // Shake animation
            input.style.animation = 'shake 0.5s';
            setTimeout(() => input.style.animation = '', 500);
            
            // Reset button
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.opacity = '1';
        }
    }

    async disconnectAppPassword() {
        if (!confirm('Disconnect your app password? This will disable all worker roles.')) {
            return;
        }
        
        try {
            const userDid = this.data?.did;
            if (!userDid) {
                throw new Error('User DID not available');
            }
            
            const response = await fetch(`/api/credentials/disconnect?user_did=${encodeURIComponent(userDid)}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.error || 'Failed to disconnect');
            }
            
            alert('App password disconnected successfully');
            
            // Refresh the section
            await this.renderRolesCharacterSection();
            
        } catch (error) {
            console.error('Failed to disconnect app password:', error);
            alert(`Failed to disconnect: ${error.message}`);
        }
    }

    showAvatarUpload() {
        const modal = document.createElement('div');
        modal.className = 'avatar-upload-modal';
        modal.innerHTML = `
            <div class="avatar-upload-content">
                <h3>Shapeshift</h3>
                <p>Choose a new visage for yourself across our wild mindscape</p>
                
                <div class="avatar-preview-area">
                    <img id="avatarPreview" src="${this.dreamerData.avatar || '/assets/icon_face.png'}" alt="Avatar preview">
                </div>
                
                <div class="avatar-file-input-group">
                    <input type="file" 
                           id="avatarFileInput" 
                           accept="image/png,image/jpeg,image/jpg"
                           onchange="window.dashboardWidget.previewImage(this)">
                    <label for="avatarFileInput" class="file-input-label">
                        Choose Image
                    </label>
                    <span class="file-input-hint">PNG or JPEG, max 1MB</span>
                </div>
                
                <div class="avatar-upload-actions">
                    <button class="cancel-btn" onclick="this.closest('.avatar-upload-modal').remove()">Cancel</button>
                    <button class="upload-btn" onclick="window.dashboardWidget.uploadAvatar()">Upload Avatar</button>
                </div>
                <div class="avatar-upload-status" id="avatarUploadStatus"></div>
            </div>
        `;
        
        // Prevent modal clicks from propagating to drawer
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        document.body.appendChild(modal);
    }

    editDisplayName() {
        const currentName = this.dreamerData.display_name || this.dreamerData.handle;
        const modal = document.createElement('div');
        modal.className = 'edit-name-modal';
        modal.innerHTML = `
            <div class="edit-name-widget">
                <h3>Edit Name</h3>
                <p>Update your displayed name across all our wild mindscape.</p>
                
                <div class="edit-name-field">
                    <label>Name</label>
                    <input type="text" 
                           id="displayNameInput" 
                           class="edit-name-input"
                           value="${currentName}"
                           maxlength="64"
                           autocomplete="off">
                </div>
                
                <div class="edit-name-actions">
                    <button class="cancel-btn" onclick="this.closest('.edit-name-modal').remove()">Cancel</button>
                    <button class="save-btn" onclick="window.dashboardWidget.saveDisplayName()">Save</button>
                </div>
                <div class="edit-name-status" id="editNameStatus"></div>
            </div>
        `;
        
        // Prevent modal clicks from propagating to drawer
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        document.body.appendChild(modal);
        
        // Focus input and select text
        setTimeout(() => {
            const input = document.getElementById('displayNameInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    async saveDisplayName() {
        console.log('🔄 [Dashboard] saveDisplayName() called');
        const input = document.getElementById('displayNameInput');
        const statusEl = document.getElementById('editNameStatus');
        const newName = input.value.trim();

        if (!newName) {
            statusEl.textContent = 'Please enter a display name';
            statusEl.className = 'edit-name-status error';
            return;
        }

        console.log('📝 [Dashboard] Updating display name to:', newName);
        statusEl.textContent = 'Updating display name...';
        statusEl.className = 'edit-name-status uploading';

        try {
            const token = await this.getOAuthToken();
            console.log('🌐 [Dashboard] Sending API request to /api/user/update-profile');
            const response = await fetch('/api/user/update-profile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ displayName: newName })
            });

            const data = await response.json();
            console.log('📥 [Dashboard] API response:', data);

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update display name');
            }

            statusEl.textContent = 'Display name updated successfully!';
            statusEl.className = 'edit-name-status success';

            // Update the display name in the dashboard immediately
            console.log('🔄 [Dashboard] Updating display name in DOM');
            const displayNameEl = document.querySelector('.dashboard-display-name');
            if (displayNameEl) {
                console.log('✅ [Dashboard] Found .dashboard-display-name, updating to:', newName);
                displayNameEl.textContent = newName;
            } else {
                console.warn('⚠️ [Dashboard] Could not find .dashboard-display-name element');
            }
            
            // Update in drawer if it exists
            const drawerNameEl = document.querySelector('.drawer-display-name');
            if (drawerNameEl) {
                console.log('✅ [Dashboard] Found .drawer-display-name, updating to:', newName);
                drawerNameEl.textContent = newName;
            } else {
                console.warn('⚠️ [Dashboard] Could not find .drawer-display-name element');
            }
            
            // Reload dreamer data from database to refresh all displays
            console.log('🔄 [Dashboard] Calling loadData() to refresh from database');
            await this.loadData();
            console.log('✅ [Dashboard] loadData() complete, new dreamerData:', this.dreamerData);
            
            // Refresh OAuth session to update drawer
            if (window.oauthManager && window.oauthManager.loadProfile) {
                console.log('🔄 [Dashboard] Refreshing OAuth session for drawer update');
                const session = window.oauthManager.getSession();
                if (session) {
                    await window.oauthManager.loadProfile(session);
                    console.log('✅ [Dashboard] OAuth session refreshed');
                }
            }
            
            // Update profile widget if it exists
            if (window.profileWidget && window.profileWidget.refresh) {
                console.log('🔄 [Dashboard] Refreshing profile widget');
                await window.profileWidget.refresh();
                console.log('✅ [Dashboard] Profile widget refreshed');
            } else {
                console.warn('⚠️ [Dashboard] Profile widget not available for refresh');
            }

            console.log('✅ [Dashboard] Display name update complete, closing modal in 1.5s');
            setTimeout(() => {
                document.querySelector('.edit-name-modal').remove();
            }, 1500);

        } catch (error) {
            console.error('❌ [Dashboard] Error updating display name:', error);
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'edit-name-status error';
        }
    }

    previewImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('avatarPreview');
                if (preview) {
                    preview.src = e.target.result;
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    async uploadAvatar() {
        console.log('🔄 [Dashboard] uploadAvatar() called');
        const fileInput = document.getElementById('avatarFileInput');
        const statusEl = document.getElementById('avatarUploadStatus');

        if (!fileInput.files || !fileInput.files[0]) {
            statusEl.textContent = 'Please select an image';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        const file = fileInput.files[0];
        console.log('📁 [Dashboard] Selected file:', file.name, 'Size:', file.size, 'bytes');

        // Validate file size (1MB max)
        if (file.size > 1024 * 1024) {
            statusEl.textContent = 'Image must be smaller than 1MB';
            statusEl.className = 'avatar-upload-status error';
            return;
        }

        statusEl.textContent = 'Uploading avatar...';
        statusEl.className = 'avatar-upload-status uploading';

        try {
            const token = await this.getOAuthToken();
            const formData = new FormData();
            formData.append('avatar', file);

            console.log('🌐 [Dashboard] Sending API request to /api/user/update-avatar');
            const response = await fetch('/api/user/update-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            console.log('📥 [Dashboard] API response:', data);

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update avatar');
            }

            statusEl.textContent = 'Avatar updated successfully!';
            statusEl.className = 'avatar-upload-status success';

            // Reload dreamer data to get updated avatar URL from database
            console.log('🔄 [Dashboard] Calling loadData() to refresh from database');
            await this.loadData();
            console.log('✅ [Dashboard] loadData() complete, new avatar URL:', this.dreamerData.avatar);
            
            // Re-render the dashboard with new data
            console.log('🔄 [Dashboard] Calling render() to update dashboard display');
            this.render();
            console.log('✅ [Dashboard] Dashboard re-rendered');
            
            // Refresh OAuth session to update drawer
            if (window.oauthManager && window.oauthManager.loadProfile) {
                console.log('🔄 [Dashboard] Refreshing OAuth session for drawer update');
                const session = window.oauthManager.getSession();
                if (session) {
                    await window.oauthManager.loadProfile(session);
                    console.log('✅ [Dashboard] OAuth session refreshed, drawer should update');
                }
            }
            
            // Update profile widget if it exists
            if (window.profileWidget && window.profileWidget.refresh) {
                console.log('🔄 [Dashboard] Refreshing profile widget');
                await window.profileWidget.refresh();
                console.log('✅ [Dashboard] Profile widget refreshed');
            } else {
                console.warn('⚠️ [Dashboard] Profile widget not available for refresh');
            }

            console.log('✅ [Dashboard] Avatar update complete, closing modal in 1.5s');
            setTimeout(() => {
                document.querySelector('.avatar-upload-modal').remove();
            }, 1500);

        } catch (error) {
            console.error('❌ [Dashboard] Error uploading avatar:', error);
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.className = 'avatar-upload-status error';
        }
    }

    renderAltNames(altNames) {
        if (!altNames || altNames === 'none' || !altNames.trim()) {
            return 'none';
        }
        
        // Split by comma and create clickable text
        const names = altNames.split(',').map(n => n.trim()).filter(n => n);
        return names.map(name => 
            `<span class="alt-name-link" onclick="window.dashboardWidget.swapNameWithAlt('${name}')" title="Click to set as primary">${name}</span>`
        ).join(', ');
    }
    
    getScoreClass(axis1, axis2, octantInfo, dreamerData) {
        // Helper function to determine CSS classes for score display
        const spectrum = dreamerData.spectrum || dreamerData;
        const val1 = spectrum[axis1] || 0;
        const val2 = spectrum[axis2] || 0;
        
        // Check if this axis pair is balanced
        const axisKey = `${axis1}/${axis2}`;
        const reverseKey = `${axis2}/${axis1}`;
        const isBalanced = octantInfo.balancedAxes && 
                          (octantInfo.balancedAxes.includes(axisKey) || 
                           octantInfo.balancedAxes.includes(reverseKey));
        
        if (isBalanced) {
            // Both axes in a balanced pair should be shown as dominant with special styling
            return 'score-balanced score-balanced-pair';
        }
        
        // Normal behavior - higher value gets highlighted
        return val1 > val2 ? 'score-higher' : '';
    }

    async swapNameWithAlt(altName) {
        console.log(`🔄 [Dashboard] Swapping primary name with alt: ${altName}`);

        try {
            const token = await this.getOAuthToken();
            if (!token) {
                alert('You must be logged in to change your primary name');
                return;
            }

            const response = await fetch('/api/user/set-primary-name', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: altName })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to swap name');
            }

            const result = await response.json();
            console.log('✅ [Dashboard] Name swapped successfully:', result);

            // Update local data without full reload
            this.dreamerData.name = result.primary_name;
            this.dreamerData.alt_names = result.alt_names;
            
            // Update all fields in account info grid
            const nameRows = document.querySelectorAll('.account-info-row');
            for (const row of nameRows) {
                const label = row.querySelector('.dashboard-info-label');
                if (!label) continue;
                
                if (label.textContent === 'Name') {
                    const valueEl = row.querySelector('.dashboard-info-value');
                    if (valueEl) {
                        valueEl.textContent = result.primary_name;
                        console.log('✅ [Dashboard] Updated Name field to:', result.primary_name);
                    }
                } else if (label.textContent === 'Pseudonyms') {
                    const valueEl = row.querySelector('.dashboard-info-value');
                    if (valueEl) {
                        valueEl.innerHTML = this.renderAltNames(result.alt_names);
                        valueEl.title = result.alt_names || 'none';
                        console.log('✅ [Dashboard] Updated Pseudonyms list to:', result.alt_names);
                    }
                }
            }

        } catch (error) {
            console.error('❌ [Dashboard] Error swapping name:', error);
            alert(`Failed to swap name: ${error.message}`);
        }
    }
    
    switchTab(tabName) {
        console.log(`🔄 [Dashboard] Switching to ${tabName} tab`);
        
        // Clear schedule refresh interval if leaving compose tab
        if (this.currentTab === 'compose' && tabName !== 'compose' && this.scheduleRefreshInterval) {
            clearInterval(this.scheduleRefreshInterval);
            this.scheduleRefreshInterval = null;
            console.log('🗑️ [Compose] Cleared schedule auto-refresh');
        }
        
        this.currentTab = tabName;
        
        const phaneraTab = document.getElementById('phaneraColorTab');
        const detailsTab = document.getElementById('detailsTab');
        const messagesTab = document.getElementById('messagesTab');
        const composeTab = document.getElementById('composeTab');
        const phaneraContent = document.getElementById('phaneraColorContent');
        const detailsContent = document.getElementById('detailsContent');
        const messagesContent = document.getElementById('messagesContent');
        const composeContent = document.getElementById('composeContent');
        
        if (!phaneraTab || !detailsTab || !messagesTab || !phaneraContent || !detailsContent || !messagesContent) {
            console.error('❌ [Dashboard] Tab elements not found');
            return;
        }
        
        // Remove all active states
        phaneraTab.classList.remove('active');
        detailsTab.classList.remove('active');
        messagesTab.classList.remove('active');
        if (composeTab) composeTab.classList.remove('active');
        
        // Hide all content
        phaneraContent.style.display = 'none';
        detailsContent.style.display = 'none';
        messagesContent.style.display = 'none';
        if (composeContent) composeContent.style.display = 'none';
        
        // Activate selected tab
        if (tabName === 'phanera') {
            phaneraTab.classList.add('active');
            phaneraContent.style.display = 'block';
        } else if (tabName === 'details') {
            detailsTab.classList.add('active');
            detailsContent.style.display = 'block';
            
            // Set up description editing if not already set up
            setTimeout(() => this.setupDescriptionEditing(), 100);
            
            // Load recently read books
            setTimeout(() => this.loadRecentlyReadBooks(), 100);
            
            // Setup autocomplete for book inputs
            setTimeout(() => this.setupBookAutocomplete(), 150);
        } else if (tabName === 'messages') {
            messagesTab.classList.add('active');
            messagesContent.style.display = 'block';
            
            // Load messages when tab is shown
            this.loadMessagesTab();
            
            // Also update the header badge
            if (window.header && window.header.updateMessageBadge) {
                window.header.updateMessageBadge();
            }
        } else if (tabName === 'compose') {
            if (composeTab && composeContent) {
                composeTab.classList.add('active');
                composeContent.style.display = 'block';
                
                // Set up compose tab
                setTimeout(() => this.setupComposeTab(), 100);
            }
        }
    }
    
    async loadMessagesTab() {
        const container = document.getElementById('dashboardMessagesContainer');
        if (!container) return;
        
        // Initialize pagination state if not exists
        if (!this.messagesPagination) {
            this.messagesPagination = {
                page: 0,
                perPage: 4,
                showingDismissed: false
            };
        }
        
        try {
            // Get user DID from OAuth manager
            const userDid = window.oauthManager?.currentSession?.did;
            
            if (!userDid) {
                console.warn('[Dashboard] No user DID available, cannot load messages');
                messagesContent.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
                        <div style="font-size: 0.875rem;">Log in to view messages</div>
                    </div>
                `;
                return;
            }
            
            console.log(`📬 [Dashboard] Loading messages for ${userDid.substring(0, 30)}...`);
            
            // Fetch all messages (both active and dismissed)
            const response = await fetch(`/api/messages/inbox?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error('Failed to load messages');
            }
            
            const allMessages = result.data.messages || [];
            
            // Filter based on view: dismissed (has dismissed_at) vs active (no dismissed_at)
            let filteredMessages = allMessages;
            if (this.messagesPagination.showingDismissed) {
                // Show only dismissed messages (those with dismissed_at set)
                const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
                filteredMessages = allMessages.filter(m => {
                    return m.dismissed_at && m.dismissed_at >= sevenDaysAgo;
                });
            } else {
                // Show only active messages (those without dismissed_at)
                filteredMessages = allMessages.filter(m => !m.dismissed_at);
            }
            
            // Count unread messages (from all active messages, not filtered)
            const unreadCount = allMessages.filter(m => m.status === 'unread').length;
            
            // Update badge
            this.updateMessagesBadge(unreadCount);
            
            // Sort messages: unread first, then by created_at
            const sorted = filteredMessages.sort((a, b) => {
                if (a.status !== b.status) {
                    return a.status === 'unread' ? -1 : 1;
                }
                return b.created_at - a.created_at;
            });
            
            // Calculate pagination
            const totalPages = Math.ceil(sorted.length / this.messagesPagination.perPage);
            const startIdx = this.messagesPagination.page * this.messagesPagination.perPage;
            const endIdx = startIdx + this.messagesPagination.perPage;
            const pageMessages = sorted.slice(startIdx, endIdx);
            
            // Build messages HTML
            let html = '';
            
            // Add trash notice if showing dismissed messages (always show in trash view)
            if (this.messagesPagination.showingDismissed) {
                html += `
                    <div class="dashboard-messages-trash-notice">
                        messages are removed after one week
                    </div>
                `;
            }
            
            html += '<div class="dashboard-messages-list">';
            
            if (sorted.length === 0) {
                // Empty state - single centered message that fills the full height
                const emptyText = this.messagesPagination.showingDismissed ? 'Trash Is Empty' : 'No Messages Yet';
                const emptySubtext = this.messagesPagination.showingDismissed 
                    ? 'delete messages to place them in trash'
                    : 'messages from other dreamweavers will appear here';
                
                html += `
                    <div class="dashboard-messages-empty-full">
                        <div style="opacity: 0.6; font-size: 0.875rem;">${emptyText}</div>
                        <div style="font-size: 0.75rem; opacity: 0.5; margin-top: 0.25rem;">
                            ${emptySubtext}
                        </div>
                    </div>
                `;
            } else {
                // Render messages (always show 4 slots)
                for (let i = 0; i < this.messagesPagination.perPage; i++) {
                    if (pageMessages[i]) {
                        html += this.renderDashboardMessage(pageMessages[i]);
                    } else {
                        // Empty placeholder row to maintain height
                        html += '<div class="dashboard-message-row dashboard-message-placeholder"></div>';
                    }
                }
            }
            
            html += '</div>';
            
            // Always add pagination nav for consistent layout
            html += `
                <div class="dashboard-messages-nav">
                    <button class="dashboard-messages-nav-btn dashboard-messages-trash-btn" 
                            onclick="window.dashboardWidget.toggleMessagesTrash()">
                        ${this.messagesPagination.showingDismissed ? '← Back to Messages' : 'Trash'}
                    </button>
                    <div class="dashboard-messages-nav-right">
                        <button class="dashboard-messages-nav-btn" 
                                ${this.messagesPagination.page === 0 || sorted.length === 0 ? 'disabled' : ''}
                                onclick="window.dashboardWidget.prevMessagesPage()">
                            ← Prev
                        </button>
                        <span class="dashboard-messages-nav-info">
                            ${sorted.length > 0 ? `Page ${this.messagesPagination.page + 1} of ${totalPages}` : 'No messages'}
                        </span>
                        <button class="dashboard-messages-nav-btn" 
                                ${this.messagesPagination.page >= totalPages - 1 || sorted.length === 0 ? 'disabled' : ''}
                                onclick="window.dashboardWidget.nextMessagesPage()">
                            Next →
                        </button>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
            
            // Attach click handlers (only to actual message rows)
            container.querySelectorAll('.dashboard-message-row:not(.dashboard-message-placeholder)').forEach(row => {
                row.addEventListener('click', async (e) => {
                    // Don't trigger if clicking action buttons
                    if (e.target.closest('.dashboard-message-dismiss')) return;
                    if (e.target.closest('.dashboard-message-restore')) return;
                    
                    const messageId = parseInt(row.dataset.id);
                    await this.viewDashboardMessage(messageId);
                });
            });
            
            // Attach dismiss handlers
            container.querySelectorAll('.dashboard-message-dismiss').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const messageId = parseInt(btn.dataset.id);
                    await this.dismissDashboardMessage(messageId);
                });
            });
            
            // Attach restore handlers
            container.querySelectorAll('.dashboard-message-restore').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const messageId = parseInt(btn.dataset.id);
                    await this.restoreDashboardMessage(messageId);
                });
            });
            
        } catch (error) {
            console.error('❌ [Dashboard] Failed to load messages:', error);
            container.innerHTML = `
                <div class="dashboard-messages-list">
                    <div class="dashboard-messages-error">
                        <div style="opacity: 0.6;">Failed to load messages</div>
                        <div style="font-size: 0.875rem; opacity: 0.5; margin-top: 0.5rem;">
                            Please try again later
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    nextMessagesPage() {
        this.messagesPagination.page++;
        this.loadMessagesTab();
    }
    
    prevMessagesPage() {
        this.messagesPagination.page = Math.max(0, this.messagesPagination.page - 1);
        this.loadMessagesTab();
    }
    
    toggleMessagesTrash() {
        // Toggle between active and dismissed messages
        this.messagesPagination.showingDismissed = !this.messagesPagination.showingDismissed;
        this.messagesPagination.page = 0; // Reset to first page
        this.loadMessagesTab();
    }
    
    renderDashboardMessage(msg) {
        const isUnread = msg.status === 'unread';
        const isDismissed = msg.status === 'dismissed';
        const timeAgo = this.getTimeAgo(msg.created_at);
        
        // Get preview text
        let preview = '';
        try {
            const messages = JSON.parse(msg.messages_json);
            if (messages.length > 0) {
                preview = messages[0].text.substring(0, 60);
                if (messages[0].text.length > 60) preview += '...';
            }
        } catch (e) {
            preview = '';
        }
        
        // Determine button based on whether we're showing dismissed messages
        const actionButton = this.messagesPagination.showingDismissed
            ? `<button class="dashboard-message-restore" data-id="${msg.id}" title="Restore message">RESTORE</button>`
            : `<button class="dashboard-message-dismiss" data-id="${msg.id}" title="Dismiss message">DISMISS</button>`;
        
        return `
            <div class="dashboard-message-row ${isUnread ? 'unread' : ''}" data-id="${msg.id}">
                <span class="dashboard-message-title">${msg.title || msg.dialogue_key}</span>
                ${preview ? `<span class="dashboard-message-preview">${preview}</span>` : ''}
                <div class="dashboard-message-meta">
                    <span class="dashboard-message-sender">errantson</span>
                    <span class="dashboard-message-time">${timeAgo}</span>
                    ${actionButton}
                </div>
            </div>
        `;
    }
    
    async viewDashboardMessage(messageId) {
        try {
            // Get user DID
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                console.error('❌ [Dashboard] No user DID available');
                return;
            }
            
            // Fetch full message with user_did parameter
            const response = await fetch(`/api/messages/${messageId}?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error('Failed to load message');
            }
            
            const msg = result.data;
            
            // Parse messages
            let messages;
            try {
                messages = JSON.parse(msg.messages_json);
            } catch (e) {
                console.error('❌ Failed to parse messages_json:', e);
                return;
            }
            
            // Mark as read with user_did parameter
            await fetch(`/api/messages/${messageId}/read?user_did=${encodeURIComponent(userDid)}`, { method: 'POST' });
            
            // Update header badge immediately after marking as read
            if (window.header && window.header.updateMessageBadge) {
                window.header.updateMessageBadge();
            }
            
            // Show in shadowbox dialogue
            if (window.Shadowbox) {
                const shadowbox = new window.Shadowbox({
                    showCloseButton: false
                });
                
                // Prepare user context for variable replacement
                const userContext = {
                    name: this.dreamerData?.display_name || 'Dreamer',
                    handle: this.dreamerData?.handle || 'unknown'
                };
                
                await shadowbox.showDialogueData({
                    key: msg.dialogue_key,
                    messages: messages,
                    userContext: userContext
                }, this);
                
                // Reload messages after shadowbox closes
                await this.loadMessagesTab();
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            } else {
                console.error('❌ [Dashboard] Shadowbox not available');
            }
        } catch (error) {
            console.error('❌ [Dashboard] Failed to view message:', error);
        }
    }
    
    async dismissDashboardMessage(messageId) {
        try {
            // Get user DID
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                console.error('❌ [Dashboard] No user DID available');
                return;
            }
            
            console.log(`🗑️ [Dashboard] Dismissing message ${messageId}...`);
            
            // Dismiss with user_did parameter
            const response = await fetch(`/api/messages/${messageId}/dismiss?user_did=${encodeURIComponent(userDid)}`, { method: 'POST' });
            
            console.log(`📡 [Dashboard] Dismiss response status: ${response.status}`);
            
            const result = await response.json();
            
            console.log('📊 [Dashboard] Dismiss result:', result);
            
            if (result.status === 'success') {
                console.log('✅ [Dashboard] Dismiss succeeded, reloading messages...');
                // Reload messages
                await this.loadMessagesTab();
                
                // Update badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            } else {
                console.warn('⚠️ [Dashboard] Dismiss result status not success:', result);
            }
        } catch (error) {
            console.error('❌ [Dashboard] Failed to dismiss message:', error);
        }
    }
    
    async restoreDashboardMessage(messageId) {
        try {
            // Get user DID
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                console.error('❌ [Dashboard] No user DID available');
                return;
            }
            
            console.log(`♻️ [Dashboard] Restoring message ${messageId}...`);
            
            // Mark as read to un-dismiss (restore to read status)
            const response = await fetch(`/api/messages/${messageId}/read?user_did=${encodeURIComponent(userDid)}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ [Dashboard] Restore succeeded, reloading messages...');
                // Reload messages
                await this.loadMessagesTab();
                
                // Update badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            }
        } catch (error) {
            console.error('❌ [Dashboard] Failed to restore message:', error);
        }
    }
    
    getTimeAgo(timestamp) {
        const seconds = Math.floor(Date.now() / 1000) - timestamp;
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp * 1000).toLocaleDateString();
    }
    
    updateMessagesBadge(count) {
        const badge = document.getElementById('dashboardMessagesBadge');
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    async updateInitialMessageBadge() {
        try {
            // Get user DID from OAuth session
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                console.log('ℹ️ [Dashboard] No user DID for initial badge check');
                return;
            }
            
            console.log('📬 [Dashboard] Checking initial message count...');
            const response = await fetch(`/api/messages/count?user_did=${encodeURIComponent(userDid)}`);
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                console.log('📊 [Dashboard] Initial message count:', result.data);
                this.updateMessagesBadge(result.data.unread);
                
                // Also update header badge
                if (window.header && window.header.updateMessageBadge) {
                    window.header.updateMessageBadge();
                }
            }
        } catch (error) {
            console.error('❌ [Dashboard] Error fetching initial message count:', error);
        }
    }
    
    setupDescriptionEditing() {
        const textarea = document.getElementById('descriptionTextarea');
        const statusEl = document.getElementById('descriptionStatus');
        
        if (!textarea || !statusEl) return;
        
        // Remove existing listeners to prevent duplicates
        const newTextarea = textarea.cloneNode(true);
        textarea.parentNode.replaceChild(newTextarea, textarea);
        
        let saveTimer = null;
        
        const saveDescription = async () => {
            const newDescription = newTextarea.value.trim();
            
            // Don't save if unchanged
            if (newDescription === (this.dreamerData.description || this.dreamerData.bio || '')) {
                statusEl.textContent = '';
                return;
            }
            
            statusEl.textContent = 'Saving...';
            statusEl.style.color = '#666';
            
            try {
                const token = await this.getOAuthToken();
                if (!token) {
                    throw new Error('You must be logged in to update description');
                }
                
                const response = await fetch('/api/user/update-description', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        did: this.session.did,
                        description: newDescription
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to update description');
                }
                
                const result = await response.json();
                console.log('✅ [Dashboard] Description saved:', result);
                
                // Update local data
                this.dreamerData.description = newDescription;
                
                // Success feedback
                statusEl.textContent = 'Saved ✓';
                statusEl.style.color = '#22c55e';
                
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 2000);
                
            } catch (error) {
                console.error('❌ [Dashboard] Error saving description:', error);
                statusEl.textContent = `Error: ${error.message}`;
                statusEl.style.color = '#ef4444';
                
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);
            }
        };
        
        // Auto-save on input with debounce
        newTextarea.addEventListener('input', () => {
            if (saveTimer) clearTimeout(saveTimer);
            statusEl.textContent = 'Typing...';
            statusEl.style.color = '#999';
            
            saveTimer = setTimeout(() => {
                saveDescription();
            }, 1000); // Save 1 second after user stops typing
        });
        
        // Also save on blur (when clicking away)
        newTextarea.addEventListener('blur', () => {
            if (saveTimer) clearTimeout(saveTimer);
            saveDescription();
        });
    }
    
    // ============================================================================
    // BIBLIO.BOND INTEGRATION - Recently Read Books
    // ============================================================================
    
    async loadRecentlyReadBooks() {
        const titleInput = document.getElementById('bookTitleInput');
        const authorInput = document.getElementById('bookAuthorInput');
        const addButton = document.getElementById('addBookButton');
        
        if (!titleInput || !authorInput || !addButton) return;
        
        try {
            // Fetch books from biblio.bond via our user's DID
            const did = this.session?.did;
            if (!did) {
                // Clear inputs if not logged in
                titleInput.value = '';
                authorInput.value = '';
                this.currentBookUri = null;
                return;
            }
            
            // Call biblio.bond API
            const response = await fetch(`https://biblio.bond/api/books/${encodeURIComponent(did)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch books');
            }
            
            const books = await response.json();
            
            if (!books || books.length === 0) {
                // No books yet - clear inputs, use "Add Book" mode
                titleInput.value = '';
                authorInput.value = '';
                addButton.textContent = 'Add Book';
                this.currentBookUri = null;
                return;
            }
            
            // Sort by created_at descending, get the most recent
            const mostRecent = books
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            
            // Autofill inputs with latest book
            titleInput.value = mostRecent.title || '';
            authorInput.value = mostRecent.author || '';
            
            // Store URI for potential updates
            this.currentBookUri = mostRecent.uri || null;
            
            // Change button to "Update Book"
            addButton.textContent = 'Update Book';
            
        } catch (error) {
            console.error('❌ [Dashboard] Error loading books:', error);
            // On error, clear inputs
            titleInput.value = '';
            authorInput.value = '';
            addButton.textContent = 'Add Book';
            this.currentBookUri = null;
        }
    }
    
    setupBookAutocomplete() {
        const titleInput = document.getElementById('bookTitleInput');
        const authorInput = document.getElementById('bookAuthorInput');
        
        if (!titleInput || !authorInput) return;
        
        let autocompleteTimeout = null;
        let autocompleteContainer = null;
        
        // Create autocomplete container
        const createAutocompleteContainer = (input) => {
            if (autocompleteContainer) {
                autocompleteContainer.remove();
            }
            
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.className = 'book-autocomplete-dropdown';
            autocompleteContainer.style.cssText = `
                position: absolute;
                background: white;
                border: 2px solid #d0c7f0;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                width: ${input.offsetWidth}px;
                display: none;
            `;
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(autocompleteContainer);
            return autocompleteContainer;
        };
        
        const showAutocomplete = async (query, input) => {
            if (query.length < 2) {
                if (autocompleteContainer) {
                    autocompleteContainer.style.display = 'none';
                }
                return;
            }
            
            try {
                const response = await fetch(`https://biblio.bond/api/autocomplete?q=${encodeURIComponent(query)}`);
                const results = await response.json();
                
                if (!autocompleteContainer) {
                    createAutocompleteContainer(input);
                }
                
                if (results.length === 0) {
                    autocompleteContainer.style.display = 'none';
                    return;
                }
                
                autocompleteContainer.innerHTML = '';
                results.forEach(book => {
                    const item = document.createElement('div');
                    item.className = 'book-autocomplete-item';
                    item.style.cssText = `
                        padding: 8px;
                        cursor: pointer;
                        border-bottom: 1px solid #eee;
                        font-size: 0.8rem;
                    `;
                    item.innerHTML = `
                        <div style="font-weight: 600; color: #333;">${this.escapeHtml(book.title)}</div>
                        <div style="font-size: 0.75rem; color: #666; font-style: italic;">by ${this.escapeHtml(book.author)}</div>
                    `;
                    item.addEventListener('mouseenter', () => {
                        item.style.background = '#f5f5f5';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.background = 'white';
                    });
                    item.addEventListener('click', () => {
                        titleInput.value = book.title;
                        authorInput.value = book.author;
                        autocompleteContainer.style.display = 'none';
                    });
                    autocompleteContainer.appendChild(item);
                });
                
                autocompleteContainer.style.display = 'block';
            } catch (error) {
                console.error('❌ [Dashboard] Autocomplete error:', error);
            }
        };
        
        // Add input listeners for both fields
        [titleInput, authorInput].forEach(input => {
            input.addEventListener('input', (e) => {
                clearTimeout(autocompleteTimeout);
                autocompleteTimeout = setTimeout(() => {
                    showAutocomplete(e.target.value.trim(), input);
                }, 300);
            });
            
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (autocompleteContainer) {
                        autocompleteContainer.style.display = 'none';
                    }
                }, 200);
            });
        });
    }
    
    async addBook() {
        const titleInput = document.getElementById('bookTitleInput');
        const authorInput = document.getElementById('bookAuthorInput');
        const addButton = document.getElementById('addBookButton');
        
        if (!titleInput || !authorInput || !addButton) return;
        
        const title = titleInput.value.trim();
        const author = authorInput.value.trim();
        
        if (!title || !author) {
            alert('Please enter both title and author');
            return;
        }
        
        try {
            const did = this.session?.did;
            if (!did) {
                alert('You must be logged in');
                return;
            }
            
            // Get user's AT Protocol credentials
            const session = window.oauthManager?.getSession();
            if (!session || !session.accessJwt) {
                // Show app password request modal for Reverie House authority
                if (window.appPasswordRequest) {
                    window.appPasswordRequest.show({
                        title: 'Add Books via biblio.bond',
                        description: 'To add books to your reading record, we need permission to create <strong>biblio.bond.book</strong> records in your Bluesky repository.',
                        featureName: 'biblio.bond'
                    }, async (appPassword) => {
                        try {
                            // Connect credentials using the app password
                            const response = await fetch('/api/connect-bluesky', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Auth-Token': window.oauthManager?.getAuthToken() || localStorage.getItem('reverie_token') || ''
                                },
                                body: JSON.stringify({ appPassword })
                            });
                            
                            if (!response.ok) {
                                throw new Error('Failed to connect credentials');
                            }
                            
                            console.log('✅ [Dashboard] Credentials connected, retrying add book');
                            
                            // Reload page to refresh session
                            window.location.reload();
                        } catch (error) {
                            console.error('❌ [Dashboard] Error connecting credentials:', error);
                            throw error;
                        }
                    });
                } else {
                    alert('Please connect your Bluesky credentials in Workshop > Credentials');
                }
                return;
            }
            
            // Create biblio.bond.book record via AT Protocol
            const now = new Date().toISOString();
            const record = {
                '$type': 'biblio.bond.book',
                'title': title,
                'author': author,
                'stamps': [],
                'createdAt': now
            };
            
            console.log('📚 [Dashboard] Creating book record:', record);
            
            // Use XRPC to create the record
            const response = await fetch(`https://${session.pdsUrl || 'bsky.social'}/xrpc/com.atproto.repo.createRecord`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.accessJwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    repo: did,
                    collection: 'biblio.bond.book',
                    record: record
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                
                // Check if it's a token verification error - show credentials modal
                if (error.message && (error.message.includes('Token could not be verified') || 
                    error.message.includes('Invalid token') || 
                    error.message.includes('ExpiredToken'))) {
                    console.log('🔑 [Dashboard] Token verification failed, showing credentials modal');
                    
                    if (window.appPasswordRequest) {
                        window.appPasswordRequest.show({
                            title: 'Reconnect Reverie House',
                            description: 'Your Bluesky credentials have expired. Please reconnect to continue adding books.',
                            featureName: 'biblio.bond'
                        }, async (appPassword) => {
                            try {
                                const response = await fetch('/api/connect-bluesky', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-Auth-Token': window.oauthManager?.getAuthToken() || localStorage.getItem('reverie_token') || ''
                                    },
                                    body: JSON.stringify({ appPassword })
                                });
                                
                                if (!response.ok) {
                                    throw new Error('Failed to reconnect credentials');
                                }
                                
                                window.location.reload();
                            } catch (error) {
                                console.error('❌ [Dashboard] Error reconnecting:', error);
                                throw error;
                            }
                        });
                    }
                    return;
                }
                
                throw new Error(error.message || 'Failed to create book record');
            }
            
            const result = await response.json();
            console.log('✅ [Dashboard] Book created:', result);
            
            // Reload to update button text and currentBookUri
            await this.loadRecentlyReadBooks();
            
        } catch (error) {
            console.error('❌ [Dashboard] Error adding book:', error);
            
            // Check if error message indicates token issues
            if (error.message && (error.message.includes('Token could not be verified') || 
                error.message.includes('Invalid token') || 
                error.message.includes('ExpiredToken'))) {
                console.log('🔑 [Dashboard] Token error caught in catch block, showing credentials modal');
                
                if (window.appPasswordRequest) {
                    window.appPasswordRequest.show({
                        title: 'Reconnect Reverie House',
                        description: 'Your Bluesky credentials have expired. Please reconnect to continue adding books.',
                        featureName: 'biblio.bond'
                    }, async (appPassword) => {
                        try {
                            const response = await fetch('/api/connect-bluesky', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Auth-Token': window.oauthManager?.getAuthToken() || localStorage.getItem('reverie_token') || ''
                                },
                                body: JSON.stringify({ appPassword })
                            });
                            
                            if (!response.ok) {
                                throw new Error('Failed to reconnect credentials');
                            }
                            
                            window.location.reload();
                        } catch (error) {
                            console.error('❌ [Dashboard] Error reconnecting:', error);
                            throw error;
                        }
                    });
                }
                return;
            }
            
            alert(`Error adding book: ${error.message}`);
        }
    }
    
    // ========================================================================
    // COMPOSE TAB FUNCTIONS
    // ========================================================================
    
    async setupComposeTab() {
        console.log('📝 [Dashboard] Setting up Compose tab');
        
        // Check if user has app password for scheduling
        const hasAppPassword = await this.hasAppPassword();
        
        // Set up character counter
        const textarea = document.getElementById('composePostText');
        const charCount = document.getElementById('composeCharCount');
        const submitBtn = document.getElementById('composeSubmitBtn');
        
        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                const count = textarea.value.length;
                charCount.textContent = `${count}/300`;
                
                // Update color classes based on character count
                charCount.classList.remove('warning', 'error');
                const isOverLimit = count > 300;
                
                if (isOverLimit) {
                    charCount.classList.add('error');
                    textarea.classList.add('over-limit');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.style.opacity = '0.5';
                        submitBtn.style.cursor = 'not-allowed';
                    }
                } else {
                    textarea.classList.remove('over-limit');
                    if (submitBtn && !submitBtn.dataset.processing) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                    }
                    
                    if (count > 280) {
                        charCount.classList.add('error');
                    } else if (count > 250) {
                        charCount.classList.add('warning');
                    }
                }
            });
        }
        
        // Set up lore toggle
        const loreToggle = document.getElementById('composeIsLore');
        const loreOptions = document.getElementById('composeLoreOptions');
        
        if (loreToggle && loreOptions) {
            // Show lore options by default since it's checked
            loreOptions.style.display = 'block';
            
            loreToggle.addEventListener('change', () => {
                loreOptions.style.display = loreToggle.checked ? 'block' : 'none';
            });
        }
        
        // Set up schedule time listener
        const scheduleTime = document.getElementById('composeScheduleTime');
        
        if (scheduleTime && submitBtn) {
            // If no app password, show modal when trying to schedule
            scheduleTime.addEventListener('click', async (e) => {
                const hasPassword = await this.hasAppPassword();
                if (!hasPassword) {
                    e.preventDefault();
                    scheduleTime.blur();
                    this.showAppPasswordModal();
                }
            });
            
            scheduleTime.addEventListener('change', () => {
                if (scheduleTime.value) {
                    submitBtn.textContent = 'Schedule';
                    submitBtn.classList.add('is-scheduling');
                } else {
                    submitBtn.textContent = 'Post';
                    submitBtn.classList.remove('is-scheduling');
                }
            });
            
            // Also update on input (for better UX)
            scheduleTime.addEventListener('input', () => {
                if (scheduleTime.value) {
                    submitBtn.textContent = 'Schedule';
                    submitBtn.classList.add('is-scheduling');
                } else {
                    submitBtn.textContent = 'Post';
                    submitBtn.classList.remove('is-scheduling');
                }
            });
        }
        
        // Load canons for lore options
        await this.loadCanonsForCompose();
        
        // Load scheduled posts
        await this.loadScheduledPosts();
        
        // Update schedule input state based on credentials
        await this.updateScheduleInputState();
    }
    
    showAppPasswordModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">App Password Required</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1rem; color: #666; font-size: 0.9rem;">
                        To schedule posts for later delivery, you need to connect an app password. 
                        <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer" style="color: #734ba1; text-decoration: none; font-weight: 600;">Create one in your Bluesky settings</a>, 
                        then enter it below.
                    </p>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 0.5rem;">App Password</label>
                        <input 
                            type="text" 
                            id="modalAppPassword" 
                            class="modal-form-input" 
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            autocomplete="off" 
                            autocorrect="off" 
                            autocapitalize="off" 
                            spellcheck="false"
                            style="font-family: 'SF Mono', Monaco, monospace;">
                    </div>
                    <div id="modalAppPasswordStatus" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="modal-btn primary" onclick="window.dashboardWidget.connectAppPasswordFromModal()">Connect</button>
                </div>
            </div>
        `;
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
        
        // Set up auto-formatting for app password
        const passwordInput = modal.querySelector('#modalAppPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/-/g, '');
                if (value.length > 16) {
                    value = value.slice(0, 16);
                }
                
                let formatted = '';
                for (let i = 0; i < value.length; i++) {
                    if (i > 0 && i % 4 === 0) {
                        formatted += '-';
                    }
                    formatted += value[i];
                }
                
                e.target.value = formatted;
            });
            
            passwordInput.focus();
        }
    }
    
    async connectAppPasswordFromModal() {
        const passwordInput = document.getElementById('modalAppPassword');
        const status = document.getElementById('modalAppPasswordStatus');
        
        if (!passwordInput || !status) return;
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            status.innerHTML = '<span style="color: #dc2626;">Please enter an app password</span>';
            return;
        }
        
        status.innerHTML = '<span style="color: #666;">Connecting...</span>';
        
        try {
            const userDid = this.data?.did;
            if (!userDid) {
                status.innerHTML = '<span style="color: #dc2626;">Error: User not authenticated</span>';
                return;
            }
            
            const response = await fetch(`/api/credentials/connect?user_did=${encodeURIComponent(userDid)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ app_password: password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                status.innerHTML = '<span style="color: #16a34a;">✓ Connected successfully!</span>';
                
                // Emit credentials connected event
                if (window.WorkEvents) {
                    window.WorkEvents.emit(window.WorkEvents.EVENTS.CREDENTIALS_CONNECTED);
                }
                
                setTimeout(() => {
                    document.querySelector('.modal-overlay').remove();
                    // Refresh the compose tab to update schedule input state
                    this.switchTab('compose');
                }, 1000);
            } else {
                status.innerHTML = `<span style="color: #dc2626;">Error: ${data.error || 'Failed to connect'}</span>`;
            }
        } catch (error) {
            console.error('Error connecting app password:', error);
            status.innerHTML = '<span style="color: #dc2626;">Network error. Please try again.</span>';
        }
    }
    
    async loadCanonsForCompose() {
        try {
            const response = await fetch('/api/canon');
            const result = await response.json();
            
            if (result.status === 'success') {
                const select = document.getElementById('composeCanonId');
                if (select) {
                    result.data.forEach(canon => {
                        const option = document.createElement('option');
                        option.value = canon.id;
                        option.textContent = canon.title;
                        select.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('❌ [Compose] Failed to load canons:', error);
        }
    }
    
    setSchedule(minutesFromNow) {
        const datetime = document.getElementById('composeScheduleTime');
        if (!datetime) return;
        
        const now = new Date();
        now.setMinutes(now.getMinutes() + minutesFromNow);
        
        // Format for datetime-local input
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        datetime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    /**
     * Detect facets (mentions and links) in post text
     * Returns array of facet objects in AT Protocol format
     */
    async detectFacets(text) {
        const facets = [];
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        
        // Detect mentions (@handle)
        const mentionRegex = /(@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)/g;
        let match;
        
        const mentionPromises = [];
        const mentionMatches = [];
        
        while ((match = mentionRegex.exec(text)) !== null) {
            const handle = match[0].substring(1); // Remove @ prefix
            mentionMatches.push({
                handle,
                fullMatch: match[0],
                index: match.index
            });
            
            // Queue the DID resolution
            mentionPromises.push(
                fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => data?.did || null)
                    .catch(() => null)
            );
        }
        
        // Resolve all mentions in parallel
        const resolvedDids = await Promise.all(mentionPromises);
        
        // Add facets for successfully resolved mentions
        for (let i = 0; i < mentionMatches.length; i++) {
            const did = resolvedDids[i];
            if (did) {
                const m = mentionMatches[i];
                const start = this.getByteOffset(text, m.index);
                const end = this.getByteOffset(text, m.index + m.fullMatch.length);
                
                facets.push({
                    index: {
                        byteStart: start,
                        byteEnd: end
                    },
                    features: [{
                        $type: 'app.bsky.richtext.facet#mention',
                        did: did
                    }]
                });
            }
        }
        
        // Detect URLs - including bare domains like reverie.house
        // Pattern matches:
        // 1. URLs with http:// or https://
        // 2. URLs starting with www.
        // 3. Bare domains like reverie.house at word boundary (not preceded by @)
        // First pass: full URLs with protocol
        const urlWithProtocol = /https?:\/\/[^\s]+/g;
        while ((match = urlWithProtocol.exec(text)) !== null) {
            const url = match[0];
            const start = this.getByteOffset(text, match.index);
            const end = this.getByteOffset(text, match.index + url.length);
            
            facets.push({
                index: { byteStart: start, byteEnd: end },
                features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
            });
        }
        
        // Second pass: www URLs
        const wwwUrls = /www\.[^\s]+/g;
        while ((match = wwwUrls.exec(text)) !== null) {
            const url = match[0];
            const start = this.getByteOffset(text, match.index);
            const end = this.getByteOffset(text, match.index + url.length);
            
            facets.push({
                index: { byteStart: start, byteEnd: end },
                features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://' + url }]
            });
        }
        
        // Third pass: bare domains (like reverie.house, biblio.bond)
        // Must be at start of string or preceded by whitespace (not @ for mentions)
        const bareDomains = /(?:^|(?<=\s))([a-zA-Z0-9-]+\.)+(?:house|com|org|net|io|dev|app|social|me|co|farm|bond|center|ca|quest|town)(?:\/[^\s]*)?/g;
        while ((match = bareDomains.exec(text)) !== null) {
            const url = match[0];
            // Skip if this URL position was already matched by protocol URLs
            const start = this.getByteOffset(text, match.index);
            const end = this.getByteOffset(text, match.index + url.length);
            
            // Check if this range overlaps with existing facets
            const overlaps = facets.some(f => 
                (start >= f.index.byteStart && start < f.index.byteEnd) ||
                (end > f.index.byteStart && end <= f.index.byteEnd)
            );
            
            if (!overlaps) {
                facets.push({
                    index: { byteStart: start, byteEnd: end },
                    features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://' + url }]
                });
            }
        }
        
        return facets.length > 0 ? facets : null;
    }
    
    /**
     * Get byte offset for UTF-8 encoded text
     */
    getByteOffset(text, charIndex) {
        const encoder = new TextEncoder();
        const substring = text.substring(0, charIndex);
        return encoder.encode(substring).length;
    }
    
    /**
     * Update facets info display
     */
    updateFacetsDisplay(text) {
        // Update rich text preview with inline formatting
        const preview = document.getElementById('composeRichPreview');
        if (!preview) return;
        
        if (!text || text.trim().length === 0) {
            preview.style.display = 'none';
            return;
        }
        
        // Show preview and render formatted text
        preview.style.display = 'block';
        preview.innerHTML = this.renderRichTextPreview(text);
    }
    
    /**
     * Render rich text preview with inline formatting
     */
    renderRichTextPreview(text) {
        let html = text;
        
        // Escape HTML first
        html = html.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');
        
        // Detect and highlight @mentions
        html = html.replace(/@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g, 
            '<span class="richtext-mention">$&</span>');
        
        // Detect and highlight URLs - including bare domains
        // First handle full URLs with protocol
        html = html.replace(/(https?:\/\/[^\s<]+)/g, 
            '<span class="richtext-link">$1</span>');
        
        // Then handle bare domains (careful not to double-match)
        // Match common TLDs when not already wrapped in a span
        html = html.replace(/(?<!span class="richtext-link">)(?<!https?:\/\/)((?:[a-zA-Z0-9-]+\.)+(?:house|com|org|net|io|dev|app|social|me|co|farm|bond|center|ca|quest|town)(?:\/[^\s<]*)?)/g, 
            '<span class="richtext-link">$1</span>');
        
        // Convert line breaks
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
    
    /**
     * Toggle between text and attachments view
     */
    toggleAttachmentsView() {
        const textView = document.getElementById('composeTextView');
        const attachmentsView = document.getElementById('composeAttachmentsView');
        const courierScheduleView = document.getElementById('composeCourierScheduleView');
        
        if (!textView || !attachmentsView) return;
        
        const isShowingAttachments = attachmentsView.style.display !== 'none';
        
        if (isShowingAttachments) {
            // Switch to text view
            textView.style.display = 'block';
            attachmentsView.style.display = 'none';
            if (courierScheduleView) courierScheduleView.style.display = 'none';
        } else {
            // Switch to attachments view
            textView.style.display = 'none';
            attachmentsView.style.display = 'block';
            if (courierScheduleView) courierScheduleView.style.display = 'none';
        }
    }
    
    /**
     * Toggle Courier Schedule view
     */
    async toggleCourierScheduleView() {
        const textView = document.getElementById('composeTextView');
        const attachmentsView = document.getElementById('composeAttachmentsView');
        const courierScheduleView = document.getElementById('composeCourierScheduleView');
        
        if (!textView || !attachmentsView || !courierScheduleView) return;
        
        const isShowingCourierSchedule = courierScheduleView.style.display !== 'none';
        
        if (isShowingCourierSchedule) {
            // Switch to text view
            textView.style.display = 'block';
            attachmentsView.style.display = 'none';
            courierScheduleView.style.display = 'none';
        } else {
            // Check if user has app password before showing schedule view
            const userDid = window.oauthManager?.currentSession?.did || this.session?.did;
            if (!userDid) {
                console.warn('⚠️ [Courier] No user DID found');
                return;
            }
            
            // Check credentials
            try {
                const credsCheck = await fetch(`/api/credentials/status?user_did=${encodeURIComponent(userDid)}`);
                const credsData = await credsCheck.json();
                
                if (!credsData.has_credentials) {
                    console.log('⚠️ [Courier] No valid credentials, showing app password modal');
                    
                    // Show app password request modal
                    if (window.appPasswordRequest) {
                        window.appPasswordRequest.show({
                            title: 'Connect Your Account',
                            description: 'To schedule posts for later delivery, you need to connect an app password. This grants Reverie House authority to post on your behalf at the scheduled time.',
                            featureName: 'courier scheduling'
                        }, async (appPassword) => {
                            console.log('📝 [Courier] App password provided, saving...');
                            
                            // Save the app password
                            try {
                                const saveResponse = await fetch(`/api/credentials/connect?user_did=${encodeURIComponent(userDid)}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ app_password: appPassword })
                                });
                                
                                if (!saveResponse.ok) {
                                    const errorData = await saveResponse.json();
                                    throw new Error(errorData.error || 'Failed to save credentials');
                                }
                                
                                console.log('✅ [Courier] Credentials saved, showing schedule view');
                                window.appPasswordRequest.close();
                                
                                // Now show the schedule view
                                textView.style.display = 'none';
                                attachmentsView.style.display = 'none';
                                courierScheduleView.style.display = 'block';
                                this.loadCourierSchedule();
                            } catch (error) {
                                console.error('❌ [Courier] Failed to save credentials:', error);
                                alert(`Failed to save credentials: ${error.message}`);
                            }
                        });
                    } else {
                        // Fallback if app password modal not loaded
                        console.error('❌ [Courier] AppPasswordRequest not available');
                        alert('App password is required to schedule posts. Please refresh the page and try again.');
                    }
                    return;
                }
            } catch (error) {
                console.error('❌ [Courier] Error checking credentials:', error);
                // Continue anyway - server will handle missing credentials
            }
            
            // Switch to courier schedule view
            textView.style.display = 'none';
            attachmentsView.style.display = 'none';
            courierScheduleView.style.display = 'block';
            
            // Load scheduled posts
            this.loadCourierSchedule();
        }
    }
    
    /**
     * Load courier schedule (scheduled posts)
     */
    async loadCourierSchedule(page = 1) {
        console.log('🔄 [Courier] === LOADING SCHEDULE ===');
        console.log('🔄 [Courier] Page:', page);
        console.log('🔄 [Courier] Session exists:', !!this.session);
        
        if (!this.session) {
            console.warn('⚠️ [Courier] No session, aborting');
            return;
        }
        
        this.courierSchedulePage = page;
        const perPage = 10;
        
        const tableContainer = document.getElementById('composeCourierScheduleTable');
        const countDisplay = document.getElementById('composeCourierScheduleCount');
        const pageInfo = document.getElementById('composeCourierPageInfo');
        
        if (!tableContainer) {
            console.warn('⚠️ [Courier] Table container not found');
            return;
        }
        
        // Show loading
        tableContainer.innerHTML = '<div class="compose-courier-schedule-loading">LOADING</div>';
        
        try {
            const userDid = this.session?.did || window.oauthManager?.currentSession?.did;
            if (!userDid) {
                throw new Error('User session not found');
            }
            
            console.log('🔄 [Courier] User DID:', userDid);
            const url = `/api/courier/scheduled?user_did=${encodeURIComponent(userDid)}&status=pending&limit=20`;
            console.log('🔄 [Courier] Request URL:', url);
            
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            console.log('🔄 [Courier] Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [Courier] Error response:', errorText);
                throw new Error('Failed to load scheduled posts');
            }
            
            const data = await response.json();
            console.log('🔄 [Courier] Response data:', data);
            
            const scheduledPosts = data.posts || [];
            console.log('🔄 [Courier] Scheduled posts count:', scheduledPosts.length);
            console.log('🔄 [Courier] Scheduled posts:', scheduledPosts);
            
            // Update count
            if (countDisplay) {
                countDisplay.textContent = `${scheduledPosts.length} scheduled`;
            }
            
            // Paginate
            const totalPages = Math.ceil(scheduledPosts.length / perPage);
            const startIdx = (page - 1) * perPage;
            const endIdx = startIdx + perPage;
            const pagePosts = scheduledPosts.slice(startIdx, endIdx);
            
            // Update page info
            if (pageInfo) {
                pageInfo.textContent = totalPages > 0 ? `Page ${page} of ${totalPages}` : 'Page 1';
            }
            
            // Update pagination buttons
            const prevBtn = tableContainer.parentElement.querySelector('.compose-courier-schedule-page-btn:first-of-type');
            const nextBtn = tableContainer.parentElement.querySelector('.compose-courier-schedule-page-btn:last-of-type');
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;
            
            // Render posts
            if (pagePosts.length === 0) {
                tableContainer.innerHTML = `
                    <div class="compose-courier-schedule-empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <p style="color: #999;">No scheduled posts</p>
                    </div>
                `;
            } else {
                let html = '<div class="compose-courier-schedule-rows">';
                
                for (const post of pagePosts) {
                    // Convert Unix timestamp (seconds) to milliseconds for JavaScript Date
                    const scheduledDate = new Date(post.scheduled_for * 1000);
                    const dateStr = scheduledDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    const timeStr = scheduledDate.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                    });
                    
                    const preview = post.post_preview || post.post_text?.substring(0, 60) || 'No text';
                    const truncated = (post.post_text?.length > 60) ? '...' : '';
                    const isLore = post.is_lore ? true : false;
                    const loreClass = isLore ? ' is-lore' : '';
                    const loreBadge = isLore ? '<span class="compose-courier-schedule-lore-badge">LORE</span>' : '';
                    
                    html += `
                        <div class="compose-courier-schedule-row${loreClass}">
                            <div class="compose-courier-schedule-row-main">
                                <div class="compose-courier-schedule-row-time">
                                    <span class="compose-courier-schedule-row-date">${dateStr}</span>
                                    <span class="compose-courier-schedule-row-clock">${timeStr}</span>
                                </div>
                                ${loreBadge}<div class="compose-courier-schedule-row-preview">${preview}${truncated}</div>
                            </div>
                            <div class="compose-courier-schedule-row-actions">
                                <button class="compose-courier-schedule-action-btn" onclick="window.dashboardWidget.editScheduledPost('${post.id}')" title="Edit">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="compose-courier-schedule-action-btn compose-courier-schedule-action-btn-delete" onclick="window.dashboardWidget.deleteScheduledPost('${post.id}')" title="Delete">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                }
                
                html += '</div>';
                tableContainer.innerHTML = html;
            }
            
        } catch (error) {
            console.error('Error loading courier schedule:', error);
            tableContainer.innerHTML = `
                <div class="compose-courier-schedule-error">
                    <p style="color: #dc2626;">Failed to load scheduled posts</p>
                    <button class="compose-footer-btn compose-footer-btn-secondary" onclick="window.dashboardWidget.loadCourierSchedule()">Retry</button>
                </div>
            `;
        }
    }
    
    /**
     * Navigate to next page of courier schedule
     */
    courierScheduleNextPage() {
        this.loadCourierSchedule((this.courierSchedulePage || 1) + 1);
    }
    
    /**
     * Navigate to previous page of courier schedule
     */
    courierSchedulePrevPage() {
        const currentPage = this.courierSchedulePage || 1;
        if (currentPage > 1) {
            this.loadCourierSchedule(currentPage - 1);
        }
    }
    
    /**
     * Edit a scheduled post
     */
    async editScheduledPost(postId) {
        try {
            // Convert postId to number (comes as string from onclick)
            const postIdNum = parseInt(postId);
            
            // Fetch the scheduled post details
            const userDid = this.session?.did || window.oauthManager?.currentSession?.did;
            if (!userDid) {
                alert('Not logged in. Please log in first.');
                return;
            }
            
            const response = await fetch(`/api/courier/scheduled?user_did=${encodeURIComponent(userDid)}&status=all&limit=100`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch post details');
            }
            
            const data = await response.json();
            console.log('📋 [Dashboard] Fetched posts:', data.posts?.length, 'posts');
            console.log('🔍 [Dashboard] Looking for post ID:', postIdNum);
            
            const post = data.posts.find(p => p.id === postIdNum);
            
            if (!post) {
                console.error('❌ [Dashboard] Post not found. Available IDs:', data.posts.map(p => p.id));
                throw new Error('Post not found');
            }
            
            console.log('✅ [Dashboard] Found post:', post);
            
            // Open composer widget with pre-filled data
            if (!window.ComposerWidget) {
                console.error('❌ [Dashboard] ComposerWidget not loaded');
                alert('Composer not available. Please refresh the page.');
                return;
            }
            
            new window.ComposerWidget({
                mode: 'edit',
                courierId: postIdNum,
                prefillText: post.post_text || '',
                prefillImages: post.post_images || [],
                scheduledFor: post.scheduled_for,
                isLore: post.is_lore || false,
                onSuccess: () => {
                    console.log('✅ [Dashboard] Post edited successfully');
                    this.loadCourierSchedule(this.courierSchedulePage || 1);
                }
            });
            
        } catch (error) {
            console.error('❌ [Dashboard] Error editing post:', error);
            alert('Failed to load post for editing. Please try again.');
        }
    }
    
    /**
     * Delete a scheduled post (immediate, no confirmation)
     */
    async deleteScheduledPost(postId) {
        console.log('🗑️ [Dashboard] deleteScheduledPost called - deleting immediately');
        console.log('   postId:', postId);
        
        try {
            const userDid = this.session?.did || window.oauthManager?.currentSession?.did;
            console.log('👤 [Dashboard] User DID:', userDid);
            
            if (!userDid) {
                throw new Error('User session not found');
            }
            
            const deleteUrl = `/api/courier/${postId}?user_did=${encodeURIComponent(userDid)}`;
            console.log('🔍 [Dashboard] DELETE URL:', deleteUrl);
            console.log('📡 [Dashboard] Sending DELETE request...');
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            console.log('📡 [Dashboard] Delete response received');
            console.log('   Status:', response.status);
            console.log('   OK:', response.ok);
            console.log('   Headers:', [...response.headers.entries()]);
            
            const responseText = await response.text();
            console.log('📡 [Dashboard] Response text:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('📡 [Dashboard] Response JSON:', data);
            } catch (e) {
                console.error('❌ [Dashboard] Failed to parse response as JSON:', e);
                data = { error: responseText };
            }
            
            if (!response.ok) {
                console.error('❌ [Dashboard] Delete failed with status:', response.status);
                console.error('   Error data:', data);
                throw new Error(data.error || 'Failed to delete post');
            }
            
            console.log('✅ [Dashboard] Delete successful:', data);
            console.log('🔄 [Dashboard] Reloading schedule...');
            
            // Reload the schedule
            this.loadCourierSchedule(this.courierSchedulePage || 1);
            
            console.log('✅ [Dashboard] Schedule reload initiated');
            
        } catch (error) {
            console.error('❌ [Dashboard] Error in confirmDeleteScheduledPost:', error);
            console.error('   Error name:', error.name);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            alert('Failed to delete scheduled post. Please try again.');
        }
    }
    
    /**
     * Handle image file selection
     */
    async handleImageSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        // Store selected images (max 4 per Bluesky)
        const maxImages = 4;
        this.selectedImages = this.selectedImages || [];
        
        for (let i = 0; i < files.length && this.selectedImages.length < maxImages; i++) {
            const file = files[i];
            
            // Validate file size (1MB max per Bluesky spec)
            if (file.size > 1000000) {
                alert(`Image "${file.name}" is too large. Max size is 1MB.`);
                continue;
            }
            
            // Read file as data URL for preview
            const reader = new FileReader();
            reader.onload = (e) => {
                this.selectedImages.push({
                    file: file,
                    dataUrl: e.target.result,
                    alt: ''
                });
                this.updateImagePreview();
            };
            reader.readAsDataURL(file);
        }
        
        // Clear input so same file can be selected again
        event.target.value = '';
    }
    
    /**
     * Update image preview display
     */
    updateImagePreview() {
        const preview = document.getElementById('composeImagePreview');
        const mediaText = document.getElementById('composeMediaText');
        const mediaTextInAttachments = document.getElementById('composeMediaTextInAttachments');
        const mediaTextInSchedule = document.getElementById('composeMediaTextInSchedule');
        const count = document.getElementById('composeAttachmentsCount');
        
        if (!preview) return;
        
        // Update text indicator in all views
        const imageCountText = `${this.selectedImages?.length || 0}/4 Images`;
        if (mediaText) {
            mediaText.textContent = imageCountText;
        }
        if (mediaTextInAttachments) {
            mediaTextInAttachments.textContent = imageCountText;
        }
        if (mediaTextInSchedule) {
            mediaTextInSchedule.textContent = imageCountText;
        }
        
        // Update count
        if (count && this.selectedImages) {
            count.textContent = `${this.selectedImages.length}/4`;
        }
        
        if (!this.selectedImages || this.selectedImages.length === 0) {
            preview.innerHTML = `
                <div class="compose-image-empty-large">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p style="color: #999;">No images attached yet</p>
                    <button class="compose-attach-btn-large" onclick="document.getElementById('composeImageInput').click()">
                        Choose Images
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '<div class="compose-images-grid-large">';
        
        this.selectedImages.forEach((img, index) => {
            const isEditingAlt = img.editingAlt || false;
            html += `
                <div class="compose-image-item-large" id="composeImageItem${index}">
                    <div class="compose-image-preview-wrapper">
                        <img src="${img.dataUrl}" alt="${img.alt || 'Preview ' + (index + 1)}" style="${isEditingAlt ? 'display:none;' : ''}">
                        <button class="compose-image-remove-large" onclick="window.dashboardWidget.removeImage(${index})" title="Remove image">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <button class="compose-image-alt-btn ${isEditingAlt ? 'active' : ''}" 
                                onclick="window.dashboardWidget.toggleAltEditor(${index})" 
                                title="${img.alt ? 'Edit alt text' : 'Add alt text'}"
                                style="${isEditingAlt ? 'display:none;' : ''}">
                            ${img.alt ? 'ALT ✓' : 'ALT'}
                        </button>
                        ${isEditingAlt ? `
                        <div class="compose-image-alt-editor">
                            <textarea class="compose-image-alt-textarea" 
                                      id="composeAltText${index}"
                                      placeholder="Describe this image for accessibility..."
                                      maxlength="100">${img.alt || ''}</textarea>
                            <div class="compose-image-alt-actions">
                                <button class="compose-image-alt-save" onclick="window.dashboardWidget.saveAltText(${index})">Save</button>
                                <button class="compose-image-alt-cancel" onclick="window.dashboardWidget.cancelAltEdit(${index})">Cancel</button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        preview.innerHTML = html;
        
        // Update the add more button state
        const addMoreBtn = document.getElementById('composeAddMoreBtn');
        if (addMoreBtn) {
            if (this.selectedImages.length >= 4) {
                addMoreBtn.disabled = true;
                addMoreBtn.style.opacity = '0.5';
                addMoreBtn.style.cursor = 'not-allowed';
                addMoreBtn.title = 'Maximum 4 images';
            } else {
                addMoreBtn.disabled = false;
                addMoreBtn.style.opacity = '1';
                addMoreBtn.style.cursor = 'pointer';
                addMoreBtn.title = 'Add another image';
            }
        }
    }
    
    /**
     * Remove image from selection
     */
    removeImage(index) {
        if (!this.selectedImages) return;
        this.selectedImages.splice(index, 1);
        this.updateImagePreview();
    }
    
    /**
     * Scroll image carousel left
     */
    scrollImagesLeft() {
        const container = document.querySelector('.compose-images-grid-large');
        if (!container) return;
        
        const itemWidth = container.querySelector('.compose-image-item-large')?.offsetWidth || 0;
        const gap = 8; // matching CSS gap
        container.scrollBy({
            left: -(itemWidth + gap),
            behavior: 'smooth'
        });
    }
    
    /**
     * Scroll image carousel right
     */
    scrollImagesRight() {
        const container = document.querySelector('.compose-images-grid-large');
        if (!container) return;
        
        const itemWidth = container.querySelector('.compose-image-item-large')?.offsetWidth || 0;
        const gap = 8; // matching CSS gap
        container.scrollBy({
            left: (itemWidth + gap),
            behavior: 'smooth'
        });
    }
    
    /**
     * Toggle alt text editor for an image
     */
    toggleAltEditor(index) {
        if (!this.selectedImages || !this.selectedImages[index]) return;
        this.selectedImages[index].editingAlt = true;
        this.updateImagePreview();
        
        // Focus the textarea after render
        setTimeout(() => {
            const textarea = document.getElementById(`composeAltText${index}`);
            if (textarea) {
                textarea.focus();
            }
        }, 50);
    }
    
    /**
     * Save alt text from editor
     */
    saveAltText(index) {
        if (!this.selectedImages || !this.selectedImages[index]) return;
        const textarea = document.getElementById(`composeAltText${index}`);
        if (textarea) {
            this.selectedImages[index].alt = textarea.value;
        }
        this.selectedImages[index].editingAlt = false;
        this.updateImagePreview();
    }
    
    /**
     * Cancel alt text editing
     */
    cancelAltEdit(index) {
        if (!this.selectedImages || !this.selectedImages[index]) return;
        this.selectedImages[index].editingAlt = false;
        this.updateImagePreview();
    }
    
    /**
     * Update image alt text (legacy - keeping for compatibility)
     */
    updateImageAlt(index, altText) {
        if (!this.selectedImages || !this.selectedImages[index]) return;
        this.selectedImages[index].alt = altText;
    }
    
    /**
     * Upload images to Bluesky and get blob refs
     */
    async uploadImages(pdsUrl, accessJwt) {
        if (!this.selectedImages || this.selectedImages.length === 0) {
            return null;
        }
        
        const uploadedBlobs = [];
        
        for (const img of this.selectedImages) {
            try {
                // Upload image
                const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessJwt}`,
                        'Content-Type': img.file.type
                    },
                    body: img.file
                });
                
                if (!response.ok) {
                    console.error('Image upload failed:', await response.text());
                    continue;
                }
                
                const data = await response.json();
                uploadedBlobs.push({
                    alt: img.alt || '',
                    image: data.blob
                });
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        }
        
        return uploadedBlobs.length > 0 ? uploadedBlobs : null;
    }
    
    async submitCompose() {
        const textarea = document.getElementById('composePostText');
        const scheduleTime = document.getElementById('composeScheduleTime');
        const isLore = document.getElementById('composeIsLore');
        const submitBtn = document.getElementById('composeSubmitBtn');
        
        if (!textarea) {
            console.error('❌ [Compose] Textarea not found');
            return;
        }
        
        const postText = textarea.value.trim();
        if (!postText) {
            alert('Please enter some text for your post');
            textarea.focus();
            return;
        }
        
        // Check character limit
        if (postText.length > 300) {
            alert('Post text must be 300 characters or less. Please shorten your message.');
            textarea.focus();
            return;
        }
        
        try {
            submitBtn.disabled = true;
            
            const userDid = window.oauthManager?.currentSession?.did || this.session?.did;
            if (!userDid) {
                throw new Error('Not authenticated. Please log in.');
            }
            
            // Check if scheduling (has a datetime value)
            const isScheduling = scheduleTime && scheduleTime.value;
            
            console.log('🔍 [Compose] Schedule check:', {
                hasScheduleTimeElement: !!scheduleTime,
                scheduleTimeValue: scheduleTime?.value,
                scheduleTimeType: typeof scheduleTime?.value,
                isScheduling: isScheduling
            });
            
            if (isScheduling) {
                // SCHEDULING PATH - requires app password
                // Check if user has valid credentials before proceeding (unless just saved)
                if (this._credentialsJustSaved) {
                    console.log('✅ [Compose] Credentials just saved, skipping check');
                    delete this._credentialsJustSaved;
                } else {
                    try {
                        const credsCheck = await fetch(`/api/credentials/status?user_did=${encodeURIComponent(userDid)}`);
                        const credsData = await credsCheck.json();
                        
                        if (!credsData.has_credentials) {
                            console.log('⚠️ [Compose] No valid credentials for scheduling, showing app password modal');
                            console.log('⚠️ [Compose] window.appPasswordRequest exists:', !!window.appPasswordRequest);
                            console.log('⚠️ [Compose] window.appPasswordRequest type:', typeof window.appPasswordRequest);
                            console.log('⚠️ [Compose] AppPasswordRequest class exists:', !!window.AppPasswordRequest);
                            
                            // Show app password request modal
                            if (window.appPasswordRequest) {
                                console.log('✅ [Compose] Calling window.appPasswordRequest.show()');
                                console.log('✅ [Compose] appPasswordRequest.show method exists:', !!window.appPasswordRequest.show);
                                console.log('✅ [Compose] appPasswordRequest.show type:', typeof window.appPasswordRequest.show);
                                
                                try {
                                    window.appPasswordRequest.show({
                                        title: 'Connect Your Account',
                                        description: 'To schedule posts for later delivery, you need to connect an app password. This grants Reverie House authority to post on your behalf at the scheduled time.',
                                        featureName: 'courier scheduling'
                                    }, async (appPassword) => {
                                        console.log('📝 [Compose] App password provided, saving...');
                                        
                                        // Save the app password
                                        try {
                                            const saveResponse = await fetch(`/api/credentials/connect?user_did=${encodeURIComponent(userDid)}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ app_password: appPassword })
                                            });
                                            
                                            if (!saveResponse.ok) {
                                                const errorData = await saveResponse.json();
                                                throw new Error(errorData.error || 'Failed to save credentials');
                                            }
                                            
                                            console.log('✅ [Compose] Credentials saved, retrying schedule...');
                                            window.appPasswordRequest.close();
                                            
                                            // Mark that credentials were just saved to skip check
                                            this._credentialsJustSaved = true;
                                            
                                            // Retry the submit
                                            this.submitCompose();
                                        } catch (error) {
                                            console.error('❌ [Compose] Failed to save credentials:', error);
                                            alert(`Failed to save credentials: ${error.message}`);
                                            submitBtn.disabled = false;
                                            submitBtn.textContent = 'Schedule';
                                        }
                                    });
                                    console.log('✅ [Compose] Modal show() called successfully');
                                } catch (error) {
                                    console.error('❌ [Compose] Error calling modal.show():', error);
                                    console.error('❌ [Compose] Error stack:', error.stack);
                                    // Fallback to old dialog
                                    this.showCredentialsRequiredDialog('schedule');
                                    submitBtn.disabled = false;
                                    submitBtn.textContent = 'Schedule';
                                    return;
                                }
                            } else {
                                // Fallback to old dialog if app password modal not loaded
                                this.showCredentialsRequiredDialog('schedule');
                            }
                            
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Schedule';
                            return;
                        }
                    } catch (error) {
                        console.error('❌ [Compose] Error checking credentials:', error);
                        // Continue anyway - server will handle missing credentials
                    }
                }
                
                // Note: Scheduling uses backend because it needs to store for later execution
                submitBtn.textContent = 'Scheduling...';
                
                // Get auth token for backend
                const token = await this.getOAuthToken();
                
                // The value is already a Unix timestamp (stored by calendar widget)
                let scheduledFor;
                const storedValue = scheduleTime.value;
                
                console.log('🔍 [Compose] Converting schedule time:', {
                    storedValue: storedValue,
                    storedValueType: typeof storedValue,
                    isNumeric: !isNaN(storedValue),
                    parsedInt: parseInt(storedValue)
                });
                
                if (!isNaN(storedValue) && storedValue !== '') {
                    // Already a timestamp
                    scheduledFor = parseInt(storedValue);
                } else {
                    // Fallback: try to parse as date string
                    console.warn('⚠️ [Compose] Value is not numeric, trying date parse');
                    scheduledFor = Math.floor(new Date(storedValue).getTime() / 1000);
                }
                
                const now = Math.floor(Date.now() / 1000);
                
                console.log('🔍 [Compose] Schedule validation:', {
                    scheduledFor: scheduledFor,
                    scheduledForType: typeof scheduledFor,
                    isNaN: isNaN(scheduledFor),
                    now: now,
                    difference: scheduledFor - now,
                    scheduledDate: new Date(scheduledFor * 1000).toISOString()
                });
                
                if (isNaN(scheduledFor) || scheduledFor <= now) {
                    const errorMsg = isNaN(scheduledFor) 
                        ? 'Invalid schedule time format' 
                        : 'Schedule time must be in the future';
                    alert(errorMsg);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Schedule';
                    console.error('❌ [Compose] Schedule validation failed:', {
                        scheduledFor,
                        now,
                        isNaN: isNaN(scheduledFor)
                    });
                    return;
                }
                
                // Prepare image data for scheduling
                let imageData = null;
                if (this.selectedImages && this.selectedImages.length > 0) {
                    console.log('📷 [Compose] Preparing', this.selectedImages.length, 'images for scheduling');
                    imageData = this.selectedImages.map(img => ({
                        dataUrl: img.dataUrl,
                        alt: img.alt || '',
                        fileName: img.file?.name || 'image.jpg',
                        mimeType: img.file?.type || 'image/jpeg'
                    }));
                }
                
                const payload = {
                    post_text: postText,
                    scheduled_for: scheduledFor,
                    is_lore: isLore?.checked || false,
                    post_images: imageData
                };
                
                console.log('📬 [Compose] === SCHEDULING POST ===');
                console.log('📬 [Compose] User DID:', userDid);
                console.log('📬 [Compose] Has Token:', !!token);
                console.log('📬 [Compose] Has Images:', !!imageData, imageData?.length || 0);
                console.log('📬 [Compose] Payload:', payload);
                console.log('📬 [Compose] URL:', `/api/courier/schedule?user_did=${encodeURIComponent(userDid)}`);
                
                const response = await fetch(`/api/courier/schedule?user_did=${encodeURIComponent(userDid)}`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log('📬 [Compose] Response status:', response.status, response.statusText);
                console.log('📬 [Compose] Response headers:', [...response.headers.entries()]);
                
                const responseText = await response.text();
                console.log('📬 [Compose] Response body (raw):', responseText);
                
                let result;
                try {
                    result = JSON.parse(responseText);
                    console.log('📬 [Compose] Response body (parsed):', result);
                } catch (e) {
                    console.error('❌ [Compose] Failed to parse response as JSON:', e);
                    throw new Error(`Server returned invalid JSON: ${responseText}`);
                }
                
                if (result.status !== 'success') {
                    console.error('❌ [Compose] Scheduling failed:', result);
                    // Check if it's a credentials error
                    if (result.error && (result.error.includes('credentials') || result.error.includes('password'))) {
                        this.showCredentialsRequiredDialog('schedule');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Schedule';
                        return;
                    }
                    throw new Error(result.error || 'Failed to schedule post');
                }
                
                console.log('✅ [Compose] Post scheduled successfully!');
                console.log('✅ [Compose] Courier ID:', result.courier_id);
                console.log('✅ [Compose] Scheduled for:', result.scheduled_for);
                
                // Clear the form
                textarea.value = '';
                if (scheduleTime) scheduleTime.value = '';
                if (isLore) isLore.checked = false;
                this.selectedImages = [];
                this.updateImagePreview();
                
                this.showSuccessNotification('Post scheduled successfully!');
                
                // ALWAYS reload courier schedule after successful scheduling
                console.log('🔄 [Compose] Reloading courier schedule...');
                await this.loadCourierSchedule(1);
                console.log('✅ [Compose] Courier schedule reloaded');
                
                // Switch to courier schedule view so user can see their scheduled post
                console.log('📬 [Compose] Switching to courier schedule view...');
                this.toggleCourierScheduleView();
                console.log('✅ [Compose] Switched to courier schedule view');
                
            } else {
                // IMMEDIATE POST PATH
                submitBtn.textContent = 'Posting...';
                
                console.log('📬 [Compose] Posting immediately');
                console.log('📬 [Compose] User DID:', userDid);
                
                // Check session type: OAuth or PDS
                const pdsSessionStr = localStorage.getItem('pds_session');
                const isOAuthSession = window.oauthManager?.currentSession && !pdsSessionStr;
                
                let result;
                
                if (isOAuthSession) {
                    // OAuth path - post directly via OAuth client
                    console.log('📬 [Compose] Using OAuth client');
                    
                    // Detect facets for the post (mentions and links)
                    const facets = await this.detectFacets(postText);
                    if (facets && facets.length > 0) {
                        console.log('🔗 [Compose] Detected facets for OAuth post:', facets.length);
                    }
                    
                    // Build custom record with facets if detected
                    const customRecord = facets ? { facets: facets } : null;
                    
                    result = await window.oauthManager.createPost(postText, customRecord);
                    console.log('✅ [Compose] Post created via OAuth:', result);
                } else if (pdsSessionStr) {
                    // PDS session - post directly to PDS using stored accessJwt
                    // Note: PDS URL comes from didDoc.service, NOT from handle domain
                    console.log('📬 [Compose] Using PDS session (direct posting)');
                    try {
                        const pdsSession = JSON.parse(pdsSessionStr);
                        const accessJwt = pdsSession.accessJwt;
                        const pdsUrl = pdsSession.didDoc?.service?.[0]?.serviceEndpoint || 'https://reverie.house';
                        const handle = pdsSession.handle || 'unknown';
                        
                        if (!accessJwt) {
                            throw new Error('No access token found in PDS session. Please log in again.');
                        }
                        
                        console.log('📬 [Compose] Handle:', handle);
                        console.log('📬 [Compose] PDS Server (from didDoc):', pdsUrl);
                        
                        // Upload images if any
                        let embedImages = null;
                        if (this.selectedImages && this.selectedImages.length > 0) {
                            console.log('📷 [Compose] Uploading', this.selectedImages.length, 'image(s)...');
                            embedImages = await this.uploadImages(pdsUrl, accessJwt);
                            if (embedImages) {
                                console.log('✅ [Compose] Images uploaded:', embedImages.length);
                            }
                        }
                        
                        // Detect facets (mentions and links)
                        const facets = await this.detectFacets(postText);
                        if (facets) {
                            console.log('🔗 [Compose] Detected facets:', facets.length);
                        }
                        
                        // Create post record
                        const record = {
                            $type: 'app.bsky.feed.post',
                            text: postText,
                            createdAt: new Date().toISOString()
                        };
                        
                        // Add facets if detected
                        if (facets) {
                            record.facets = facets;
                        }
                        
                        // Add embed if images uploaded
                        if (embedImages && embedImages.length > 0) {
                            record.embed = {
                                $type: 'app.bsky.embed.images',
                                images: embedImages
                            };
                        }
                        
                        // Post directly to PDS
                        const response = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessJwt}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                repo: userDid,
                                collection: 'app.bsky.feed.post',
                                record: record
                            })
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            
                            // Check if token expired
                            if (errorData.error === 'ExpiredToken' || errorData.message?.includes('expired')) {
                                console.log('🔄 [Compose] Token expired, attempting refresh...');
                                
                                // Try to refresh the session
                                const refreshJwt = pdsSession.refreshJwt;
                                if (refreshJwt) {
                                    try {
                                        const refreshResponse = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${refreshJwt}`,
                                                'Content-Type': 'application/json'
                                            }
                                        });
                                        
                                        if (refreshResponse.ok) {
                                            const refreshData = await refreshResponse.json();
                                            // Update session with new tokens
                                            pdsSession.accessJwt = refreshData.accessJwt;
                                            pdsSession.refreshJwt = refreshData.refreshJwt;
                                            localStorage.setItem('pds_session', JSON.stringify(pdsSession));
                                            
                                            console.log('✅ [Compose] Session refreshed, retrying post...');
                                            
                                            // Retry the post with new token
                                            const retryResponse = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': `Bearer ${refreshData.accessJwt}`,
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({
                                                    repo: userDid,
                                                    collection: 'app.bsky.feed.post',
                                                    record: record
                                                })
                                            });
                                            
                                            if (!retryResponse.ok) {
                                                const retryError = await retryResponse.json().catch(() => ({}));
                                                throw new Error(retryError.message || `PDS error: ${retryResponse.status}`);
                                            }
                                            
                                            result = await retryResponse.json();
                                            console.log('✅ [Compose] Post created after token refresh:', result);
                                        } else {
                                            throw new Error('Session refresh failed. Please log in again.');
                                        }
                                    } catch (refreshError) {
                                        console.error('❌ [Compose] Token refresh failed:', refreshError);
                                        throw new Error('Session expired. Please log in again.');
                                    }
                                } else {
                                    throw new Error('Session expired and no refresh token available. Please log in again.');
                                }
                            } else {
                                throw new Error(errorData.message || `PDS error: ${response.status}`);
                            }
                        } else {
                            result = await response.json();
                            console.log('✅ [Compose] Post created via PDS session:', result);
                        }
                    } catch (error) {
                        console.error('❌ [Compose] PDS posting error:', error);
                        throw error;
                    }
                } else {
                    // No valid session - should not happen
                    throw new Error('No valid session found. Please log in again.');
                }
                
                // If lore checkbox is checked, apply the lore label via backend API
                // (Works for both OAuth and PDS sessions)
                if (isLore?.checked && result.uri) {
                    console.log('🏷️ [Compose] Applying lore label to post:', result.uri);
                    try {
                        const token = await this.getOAuthToken();
                        const labelResponse = await fetch('/api/lore/apply-label', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({
                                uri: result.uri,
                                userDid: userDid,
                                label: 'lore:reverie.house'
                            })
                        });
                        
                        if (labelResponse.ok) {
                            console.log('✅ [Compose] Lore label applied');
                        } else {
                            console.warn('⚠️ [Compose] Failed to apply lore label, but post was successful');
                        }
                    } catch (labelError) {
                        console.warn('⚠️ [Compose] Error applying lore label:', labelError);
                    }
                }
                
                this.showSuccessNotification('Post published successfully!');
            }
            
            // Clear form on success
            this.clearCompose();
            
        } catch (error) {
            console.error('❌ [Compose] Error submitting post:', error);
            console.error('❌ [Compose] Error stack:', error.stack);
            
            // Show a user-friendly error message
            let errorMessage = error.message || 'Unknown error occurred';
            
            // Add helpful context based on error type
            if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                errorMessage = 'Authentication failed. Please try logging in again.';
            } else if (errorMessage.includes('500')) {
                errorMessage = 'Server error. Please try again in a moment.';
            } else if (errorMessage.includes('deleted by another process')) {
                errorMessage = 'Session expired. Please refresh the page and log in again.';
            }
            
            this.showErrorNotification(errorMessage);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = scheduleTime?.value ? 'Schedule' : 'Post';
        }
    }
    
    showCredentialsRequiredDialog(action = 'post') {
        /**
         * Show a friendly dialog when credentials are needed
         */
        const actionText = action === 'schedule' ? 'schedule posts' : 'post to Bluesky';
        
        if (confirm(`To ${actionText}, you need to connect an app password.\n\nWould you like to go to the Controls section now?`)) {
            // Switch to details tab and scroll to app password section
            this.switchTab('details');
            
            // Highlight the app password row
            setTimeout(() => {
                const appPasswordRow = document.querySelector('.app-password-row');
                if (appPasswordRow) {
                    appPasswordRow.style.background = 'rgba(255, 193, 7, 0.1)';
                    appPasswordRow.style.border = '2px solid rgba(255, 193, 7, 0.5)';
                    appPasswordRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Remove highlight after a few seconds
                    setTimeout(() => {
                        appPasswordRow.style.background = '';
                        appPasswordRow.style.border = '';
                    }, 3000);
                }
            }, 300);
        }
    }
    
    showSuccessNotification(message) {
        /**
         * Show a success notification
         */
        const notification = document.createElement('div');
        notification.className = 'compose-notification compose-notification-success';
        notification.innerHTML = `
            <div class="compose-notification-icon">✓</div>
            <div class="compose-notification-text">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('visible'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    showErrorNotification(message) {
        /**
         * Show an error notification
         */
        const notification = document.createElement('div');
        notification.className = 'compose-notification compose-notification-error';
        notification.innerHTML = `
            <div class="compose-notification-icon">✗</div>
            <div class="compose-notification-text">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('visible'), 10);
        
        // Remove after 5 seconds (errors stay longer)
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    clearCompose() {
        const textarea = document.getElementById('composePostText');
        const scheduleTime = document.getElementById('composeScheduleTime');
        const isLore = document.getElementById('composeIsLore');
        const charCount = document.getElementById('composeCharCount');
        const submitBtn = document.getElementById('composeSubmitBtn');
        
        if (textarea) textarea.value = '';
        if (charCount) {
            charCount.textContent = '0/300';
            charCount.classList.remove('warning', 'error');
        }
        if (scheduleTime) scheduleTime.value = '';
        if (isLore) isLore.checked = false;
        if (submitBtn) submitBtn.textContent = 'Post';
        
        // Clear schedule display
        this.updateScheduleDisplay(null);
        
        // Clear images
        this.selectedImages = [];
        this.updateImagePreview();
        this.updateFacetsDisplay('');
        
        // Switch back to text view if in attachments view
        const textView = document.getElementById('composeTextView');
        const attachmentsView = document.getElementById('composeAttachmentsView');
        const mediaBtn = document.getElementById('composeMediaBtn');
        
        if (textView && attachmentsView && mediaBtn) {
            textView.style.display = 'block';
            attachmentsView.style.display = 'none';
            mediaBtn.classList.remove('active');
        }
    }
    
    /**
     * Update submit button text based on schedule time
     */
    updateScheduleButton() {
        const scheduleTime = document.getElementById('composeScheduleTime');
        const submitBtn = document.getElementById('composeSubmitBtn');
        
        if (!scheduleTime || !submitBtn) return;
        
        if (scheduleTime.value) {
            submitBtn.textContent = 'Schedule';
        } else {
            submitBtn.textContent = 'Post';
        }
    }
    
    /**
     * Open custom calendar picker
     */
    async openCalendarPicker() {
        console.log('📅 [Compose] openCalendarPicker() called');
        
        // Check if user has valid credentials
        const userDid = this.data?.did;
        console.log('📅 [Compose] userDid:', userDid);
        console.log('📅 [Compose] this.data:', this.data);
        
        if (userDid) {
            console.log('📅 [Compose] Checking credentials for user:', userDid);
            try {
                const credsCheck = await fetch(`/api/credentials/status?user_did=${encodeURIComponent(userDid)}`);
                console.log('📅 [Compose] Credentials check response status:', credsCheck.status);
                const credsData = await credsCheck.json();
                console.log('📅 [Compose] Credentials data:', credsData);
                
                if (!credsData.has_credentials) {
                    console.log('⚠️ [Compose] No valid credentials, showing app password modal');
                    
                    // Show app password request modal
                    if (window.appPasswordRequest) {
                        window.appPasswordRequest.show({
                            title: 'Connect Your Account',
                            description: 'To schedule posts for later delivery, you need to connect an app password. This grants Reverie House authority to post on your behalf at the scheduled time.',
                            featureName: 'courier scheduling'
                        }, async (appPassword) => {
                            console.log('📝 [Compose] App password provided, saving...');
                            
                            // Save the app password
                            try {
                                const saveResponse = await fetch(`/api/credentials/connect?user_did=${encodeURIComponent(userDid)}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ app_password: appPassword })
                                });
                                
                                if (!saveResponse.ok) {
                                    const errorData = await saveResponse.json();
                                    throw new Error(errorData.error || 'Failed to save credentials');
                                }
                                
                                console.log('✅ [Compose] Credentials saved, reloading compose tab...');
                                window.appPasswordRequest.close();
                                
                                // Reload the compose tab to show connected state
                                await this.loadComposeTab();
                                
                                // Show success message
                                alert('✅ App password connected! You can now schedule posts.');
                            } catch (error) {
                                console.error('❌ [Compose] Failed to save credentials:', error);
                                alert(`Failed to save credentials: ${error.message}`);
                            }
                        });
                        return; // Stop here - don't open calendar
                    } else {
                        console.error('❌ [Compose] AppPasswordRequest not available');
                        alert('Please enter your app password in the field above to schedule posts.');
                        return; // Stop here
                    }
                }
            } catch (error) {
                console.error('❌ [Compose] Error checking credentials:', error);
            }
        }
        
        console.log('📅 [Compose] window.calendarWidget exists:', !!window.calendarWidget);
        console.log('📅 [Compose] window.calendarWidget type:', typeof window.calendarWidget);
        
        if (window.calendarWidget) {
            console.log('📅 [Compose] window.calendarWidget.show exists:', typeof window.calendarWidget.show);
        }
        
        if (!window.calendarWidget || typeof window.calendarWidget.show !== 'function') {
            console.error('❌ [Compose] Calendar widget not available. Please refresh the page.');
            console.error('❌ [Compose] Debug info:', {
                calendarWidget: window.calendarWidget,
                showMethod: window.calendarWidget?.show,
                scripts: Array.from(document.querySelectorAll('script[src*="calendar"]')).map(s => s.src)
            });
            alert('Calendar widget not loaded. Please refresh the page.');
            return;
        }
        
        console.log('✅ [Compose] Calendar widget is functional, opening picker...');
        
        const scheduleTime = document.getElementById('composeScheduleTime');
        const currentValue = scheduleTime ? scheduleTime.value : null;
        
        console.log('📅 [Compose] Current schedule value:', currentValue);
        
        // Parse current value if exists
        let initialDate = null;
        if (currentValue) {
            initialDate = new Date(parseInt(currentValue) * 1000);
            console.log('📅 [Compose] Parsed initial date:', initialDate);
        }
        
        // Show calendar with callback (bind context to preserve 'this')
        const self = this;
        console.log('📅 [Compose] Setting up calendar callback, self context:', typeof self);
        
        window.calendarWidget.show(initialDate, (selectedDate) => {
            console.log('📅 [Compose] ===== CALLBACK TRIGGERED =====');
            console.log('📅 [Compose] selectedDate received:', selectedDate);
            console.log('📅 [Compose] selectedDate type:', typeof selectedDate);
            console.log('📅 [Compose] self context available:', typeof self);
            console.log('📅 [Compose] self.updateScheduleDisplay:', typeof self.updateScheduleDisplay);
            console.log('📅 [Compose] self.updateScheduleButton:', typeof self.updateScheduleButton);
            
            if (selectedDate) {
                // Store as Unix timestamp
                const timestamp = Math.floor(selectedDate.getTime() / 1000);
                console.log('📅 [Compose] Calculated timestamp:', timestamp);
                console.log('📅 [Compose] scheduleTime element:', scheduleTime);
                
                scheduleTime.value = timestamp;
                console.log('📅 [Compose] Set scheduleTime.value to:', scheduleTime.value);
                
                // Update display
                console.log('📅 [Compose] Calling updateScheduleDisplay...');
                self.updateScheduleDisplay(selectedDate);
                console.log('📅 [Compose] Calling updateScheduleButton...');
                self.updateScheduleButton();
                console.log('✅ [Compose] Display updates complete');
            } else {
                // Clear
                console.log('📅 [Compose] Clearing schedule');
                scheduleTime.value = '';
                self.updateScheduleDisplay(null);
                self.updateScheduleButton();
            }
            console.log('📅 [Compose] ===== CALLBACK COMPLETE =====');
        });
    }
    
    /**
     * Update schedule display text
     */
    updateScheduleDisplay(date) {
        console.log('📝 [Compose] updateScheduleDisplay called with:', date);
        const display = document.getElementById('composeScheduleDisplay');
        console.log('📝 [Compose] Display element:', display);
        
        if (!display) {
            console.error('❌ [Compose] composeScheduleDisplay element not found!');
            return;
        }
        
        if (date) {
            // Format: "Dec 1, 2025 at 3:30 PM"
            const options = { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            };
            const formatted = date.toLocaleString('en-US', options);
            console.log('📝 [Compose] Formatted date string:', formatted);
            
            display.innerHTML = `<span class="compose-schedule-text">${formatted}</span>`;
            display.classList.add('has-schedule');
            console.log('✅ [Compose] Display updated with scheduled time');
        } else {
            display.innerHTML = '<span class="compose-schedule-placeholder">Click to Schedule</span>';
            display.classList.remove('has-schedule');
            console.log('📝 [Compose] Display cleared (no schedule)');
        }
        
        console.log('📝 [Compose] Final display.innerHTML:', display.innerHTML);
    }
    
    async loadScheduledPosts() {
        const container = document.getElementById('composeScheduledList');
        if (!container) return;
        
        const section = container.closest('.compose-scheduled');
        
        try {
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                if (section) section.style.display = 'none';
                return;
            }
            
            container.innerHTML = '<div class="compose-scheduled-loading">Loading...</div>';
            if (section) section.style.display = 'block';
            
            const response = await fetch(`/api/courier/scheduled?user_did=${encodeURIComponent(userDid)}&status=pending&limit=20`);
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error(result.error || 'Failed to load scheduled posts');
            }
            
            const posts = result.posts || [];
            
            if (posts.length === 0) {
                if (section) section.style.display = 'none';
                return;
            }
            
            if (section) section.style.display = 'block';
            container.innerHTML = posts.map(post => this.renderScheduledPost(post)).join('');
            
        } catch (error) {
            console.error('❌ [Compose] Error loading scheduled posts:', error);
            container.innerHTML = '<div class="compose-scheduled-error">Failed to load scheduled posts</div>';
            if (section) section.style.display = 'block';
        }
    }
    
    setupComposeTab() {
        console.log('🎨 [Compose] Setting up compose tab');
        
        // Set up auto-refresh for schedule viewer (every 30 seconds)
        if (this.scheduleRefreshInterval) {
            clearInterval(this.scheduleRefreshInterval);
        }
        this.scheduleRefreshInterval = setInterval(() => {
            if (this.currentTab === 'compose') {
                console.log('🔄 [Compose] Auto-refreshing schedule viewer');
                this.loadCourierSchedule(this.courierSchedulePage || 1);
            }
        }, 30000); // 30 seconds
        
        // Check calendar widget availability
        if (window.calendarWidget) {
            console.log('✅ [Compose] Calendar widget available');
        } else {
            console.warn('⚠️ [Compose] Calendar widget not found, attempting to initialize...');
            // Try to load calendar.js if not already loaded
            if (!document.querySelector('script[src*="calendar.js"]')) {
                console.log('📅 [Compose] Loading calendar.js...');
                const script = document.createElement('script');
                script.src = '/js/calendar.js';
                script.onload = () => {
                    console.log('✅ [Compose] Calendar.js loaded, widget available:', !!window.calendarWidget);
                };
                script.onerror = () => {
                    console.error('❌ [Compose] Failed to load calendar.js');
                };
                document.head.appendChild(script);
            } else {
                console.warn('⚠️ [Compose] calendar.js script tag exists but window.calendarWidget is undefined');
            }
        }
        
        // Initialize image storage
        this.selectedImages = [];
        
        // Set up character counter and facet detection
        const textarea = document.getElementById('composePostText');
        const charCount = document.getElementById('composeCharCount');
        
        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                const length = textarea.value.length;
                charCount.textContent = `${length}/300`;
                
                // Color coding
                charCount.classList.remove('warning', 'error');
                if (length > 280) {
                    charCount.classList.add('error');
                } else if (length > 250) {
                    charCount.classList.add('warning');
                }
                
                // Update facets display
                this.updateFacetsDisplay(textarea.value);
            });
        }
        
        // Check credentials and show notice if needed
        this.checkComposeCredentials();
        
        // Note: Scheduled posts are now in the Courier Schedule view (hourglass icon)
        // this.loadScheduledPosts(); // Removed - using Courier Schedule view instead
    }
    
    async checkComposeCredentials() {
        /**
         * Check if user has app password connected
         * Show notice if not
         */
        const notice = document.getElementById('composeCredentialsNotice');
        if (!notice) return;
        
        try {
            const token = await this.getOAuthToken();
            if (!token) {
                notice.style.display = 'block';
                return;
            }
            
            const response = await fetch('/api/user/credentials/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.connected) {
                    notice.style.display = 'none';
                } else {
                    notice.style.display = 'block';
                }
            } else {
                // Can't check, hide notice
                notice.style.display = 'none';
            }
        } catch (error) {
            console.warn('[Compose] Could not check credentials:', error);
            // On error, hide notice (don't block user unnecessarily)
            notice.style.display = 'none';
        }
    }
    
    async hasAppPassword() {
        /**
         * Check if user has app password connected
         * Returns boolean
         */
        try {
            const token = await this.getOAuthToken();
            if (!token) {
                return false;
            }
            
            const response = await fetch('/api/user/credentials/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.connected === true;
            }
            
            return false;
        } catch (error) {
            console.warn('[Compose] Could not check credentials:', error);
            return false;
        }
    }
    
    async updateScheduleInputState() {
        /**
         * Update the schedule time input based on credential status
         * Enables/disables the input and updates visual state
         */
        const scheduleTime = document.getElementById('composeScheduleTime');
        if (!scheduleTime) return;
        
        try {
            const hasPassword = await this.hasAppPassword();
            
            if (hasPassword) {
                // Enable scheduling
                scheduleTime.disabled = false;
                scheduleTime.style.opacity = '1';
                scheduleTime.style.cursor = 'pointer';
                scheduleTime.title = 'Schedule this post for later';
                console.log('✅ [Compose] Schedule input enabled - credentials connected');
            } else {
                // Keep enabled but show modal on click (handled by existing click listener)
                scheduleTime.disabled = false;
                scheduleTime.style.opacity = '0.7';
                scheduleTime.title = 'Connect app password to schedule posts';
                console.log('ℹ️ [Compose] Schedule input ready - will prompt for credentials on click');
            }
        } catch (error) {
            console.error('❌ [Compose] Error updating schedule input state:', error);
        }
    }
    
    renderScheduledPost(post) {
        const scheduledDate = new Date(post.scheduled_for * 1000);
        const now = new Date();
        const isOverdue = scheduledDate < now;
        
        const timeStr = scheduledDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        
        return `
            <div class="compose-scheduled-item ${isOverdue ? 'overdue' : ''}">
                <div class="compose-scheduled-text">${this.escapeHtml(post.post_preview)}</div>
                <div class="compose-scheduled-meta">
                    <span class="compose-scheduled-time">${isOverdue ? '⚠️ ' : '📅 '}${timeStr}</span>
                    ${post.is_lore ? `<span class="compose-scheduled-lore">🌿 ${post.lore_type || 'lore'}</span>` : ''}
                </div>
                <div class="compose-scheduled-actions">
                    <button class="compose-scheduled-action-btn" onclick="window.dashboardWidget.cancelScheduledPost(${post.id})" title="Cancel this post">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        `;
    }
    
    async cancelScheduledPost(courierId) {
        if (!confirm('Cancel this scheduled post?')) {
            return;
        }
        
        try {
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                throw new Error('Not authenticated');
            }
            
            const response = await fetch(`/api/courier/${courierId}?user_did=${encodeURIComponent(userDid)}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error(result.error || 'Failed to cancel post');
            }
            
            // Reload scheduled posts
            await this.loadScheduledPosts();
            
        } catch (error) {
            console.error('❌ [Compose] Error cancelling post:', error);
            alert(`Error: ${error.message}`);
        }
    }
    
    // ========================================================================
    // AUTH STATUS CHECKING
    // ========================================================================
    
    async checkAuthStatus() {
        /**
         * Check if user has credential issues and show blocking modal if needed.
         * Called on dashboard load to proactively notify users of auth failures.
         */
        try {
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) return;
            
            const response = await fetch(`/api/credentials/status?user_did=${encodeURIComponent(userDid)}`);
            if (!response.ok) return;
            
            const data = await response.json();
            
            // Check if credentials are invalid (not present or explicitly invalid)
            if (!data.has_credentials && data.failed_posts_count > 0) {
                // Show blocking modal immediately
                this.showAuthFailureModal(data);
            }
            
        } catch (error) {
            console.error('❌ [Dashboard] Error checking auth status:', error);
        }
    }
    
    showAuthFailureModal(authInfo) {
        /**
         * Show blocking modal when app password has expired and posts are waiting.
         */
        const modal = document.createElement('div');
        modal.className = 'auth-failure-modal-overlay';
        modal.innerHTML = `
            <div class="auth-failure-modal">
                <h2>🔒 App Password Required</h2>
                <p>Your scheduled posts could not be sent because your app password is no longer valid.</p>
                <p><strong>${authInfo.failed_posts_count} post${authInfo.failed_posts_count !== 1 ? 's' : ''} waiting to be sent</strong></p>
                
                <div class="auth-reconnect-section">
                    <label for="authReconnectPassword">Enter your Bluesky app password:</label>
                    <input type="password" 
                           id="authReconnectPassword" 
                           placeholder="xxxx-xxxx-xxxx-xxxx"
                           class="auth-reconnect-input">
                    <button class="btn-primary" onclick="window.dashboardWidget.reconnectAndRetry()">
                        Reconnect & Retry Posts
                    </button>
                </div>
                
                <button class="auth-modal-dismiss" onclick="window.dashboardWidget.dismissAuthModal()">
                    I'll fix this later
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus the input
        setTimeout(() => {
            document.getElementById('authReconnectPassword')?.focus();
        }, 100);
    }
    
    async reconnectAndRetry() {
        /**
         * Reconnect app password and automatically retry all auth-failed posts.
         */
        try {
            const passwordInput = document.getElementById('authReconnectPassword');
            const password = passwordInput?.value;
            
            if (!password || password.length < 10) {
                alert('Please enter a valid app password');
                return;
            }
            
            const userDid = window.oauthManager?.currentSession?.did;
            if (!userDid) {
                alert('Not authenticated');
                return;
            }
            
            // Show loading state
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Reconnecting...';
            button.disabled = true;
            
            // Save new app password
            const saveResponse = await fetch(`/api/connect-app-password?user_did=${encodeURIComponent(userDid)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_password: password })
            });
            
            if (!saveResponse.ok) {
                const error = await saveResponse.json();
                throw new Error(error.error || 'Failed to save app password');
            }
            
            // Automatically retry all auth_failed posts
            const retryResponse = await fetch(`/api/courier/retry-auth-failed?user_did=${encodeURIComponent(userDid)}`, {
                method: 'POST'
            });
            
            if (!retryResponse.ok) {
                throw new Error('Failed to retry posts');
            }
            
            const retryData = await retryResponse.json();
            
            // Close modal and show success
            this.dismissAuthModal();
            this.showSuccessNotification(
                `✅ Reconnected! ${retryData.posts_reset} post${retryData.posts_reset !== 1 ? 's' : ''} will retry shortly.`
            );
            
            // Refresh schedule view
            await this.loadCourierSchedule();
            
        } catch (error) {
            console.error('❌ [Dashboard] Error reconnecting:', error);
            alert(`Error: ${error.message}`);
            
            // Reset button
            const button = event.target;
            if (button) {
                button.textContent = 'Reconnect & Retry Posts';
                button.disabled = false;
            }
        }
    }
    
    dismissAuthModal() {
        /**
         * Close the auth failure modal.
         */
        const modal = document.querySelector('.auth-failure-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.Dashboard = Dashboard;

