/**
 * Work Sidebar Component
 * 
 * Renders and manages the left sidebar on the workshop page.
 * Displays user info, work status, and philosophy section.
 */

class WorkSidebar {
    constructor(options = {}) {
        this.containerId = options.containerId || 'work-sidebar';
        this.currentSession = null;
        this.roleStatuses = {};
        this.currentUserColor = '#8b7355'; // Default fallback
        
        // Bind methods
        this.updateUser = this.updateUser.bind(this);
        this.updateWorkStatus = this.updateWorkStatus.bind(this);
    }
    
    /**
     * Initialize the sidebar
     */
    init() {
        this.setupEventListeners();
        this.checkInitialSession();
        return this;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // OAuth events
        window.addEventListener('oauth:profile-loaded', (event) => {
            this.updateUser(event.detail.session);
        });
        
        window.addEventListener('oauth:login', (event) => {
            this.currentSession = event.detail.session;
        });
        
        window.addEventListener('oauth:logout', () => {
            this.currentSession = null;
            this.roleStatuses = {};
            this.showGuest();
        });
        
        // Work status updates
        window.addEventListener('work:status-updated', () => {
            this.updateWorkStatus();
        });
        
        window.addEventListener('work:role-changed', () => {
            setTimeout(() => this.updateWorkStatus(), 200);
        });
        
        // WorkEvents if available
        if (window.WorkEvents) {
            Object.keys(window.WorkEvents.EVENTS || {}).forEach(eventKey => {
                const eventName = window.WorkEvents.EVENTS[eventKey];
                window.WorkEvents.on(eventName, () => {
                    setTimeout(() => this.updateWorkStatus(), 200);
                });
            });
        }
    }
    
    /**
     * Check initial session state
     */
    checkInitialSession() {
        if (window.oauthManager) {
            const session = window.oauthManager.getSession();
            if (session && session.profile?.handle) {
                this.updateUser(session);
                setTimeout(() => this.updateWorkStatus(), 500);
            } else {
                this.showGuest();
            }
        } else {
            setTimeout(() => this.checkInitialSession(), 100);
        }
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (guestEl) guestEl.style.display = 'none';
        if (userEl) userEl.style.display = 'none';
    }
    
    /**
     * Show guest state
     */
    showGuest() {
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (guestEl) guestEl.style.display = 'flex';
        if (userEl) userEl.style.display = 'none';
    }
    
    /**
     * Update user display
     */
    async updateUser(session) {
        if (!session || !session.profile) {
            this.showGuest();
            return;
        }
        
        this.currentSession = session;
        
        const profile = session.profile;
        const displayName = profile.displayName || profile.handle || 'Unknown';
        const handle = profile.handle || 'unknown';
        const avatar = profile.avatar || '/assets/icon_face.png';
        const did = session.sub || session.did;
        
        // Update avatar
        const avatarEl = document.getElementById('sidebar-avatar');
        if (avatarEl) {
            avatarEl.src = avatar;
            avatarEl.alt = displayName;
        }
        
        // Fetch user color from database
        let userColor = '#8b7355';
        try {
            const response = await fetch(`/api/dreamers/${did}`);
            if (response.ok) {
                const dreamer = await response.json();
                userColor = dreamer.color_hex || userColor;
                this.currentUserColor = userColor;
            }
        } catch (error) {
            console.warn('Failed to fetch user color:', error);
        }
        
        // Update name and handle
        const nameEl = document.getElementById('sidebar-user-name');
        const handleEl = document.getElementById('sidebar-user-handle');
        
        if (nameEl) {
            nameEl.textContent = displayName;
            nameEl.style.color = userColor;
        }
        if (handleEl) {
            handleEl.textContent = `@${handle}`;
        }
        
        // Show user section
        const loadingEl = document.getElementById('sidebar-loading');
        const guestEl = document.getElementById('sidebar-guest');
        const userEl = document.getElementById('sidebar-user');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (guestEl) guestEl.style.display = 'none';
        if (userEl) userEl.style.display = 'flex';
        
        // Update work status
        setTimeout(() => this.updateWorkStatus(), 300);
    }
    
    /**
     * Set role statuses (called from main work.js)
     */
    setRoleStatuses(statuses) {
        this.roleStatuses = statuses || {};
        this.updateWorkStatus();
    }
    
    /**
     * Update the work status display
     */
    updateWorkStatus() {
        const statusContentEl = document.getElementById('sidebar-status-content');
        if (!statusContentEl) return;
        
        // Find which role the user has
        let userRole = null;
        let roleStatus = null;
        
        const roleNames = ['greeter', 'mapper', 'cogitarian', 'provisioner', 'dreamstyler', 'bursar', 'cheerful', 'guardian'];
        
        for (const role of roleNames) {
            if (this.roleStatuses[role] && this.roleStatuses[role].is_worker) {
                userRole = role;
                roleStatus = this.roleStatuses[role];
                break;
            }
        }
        
        if (!userRole) {
            // Not working - show as DREAMWEAVER
            statusContentEl.innerHTML = `
                <span class="status-badge not-working">DREAMWEAVER</span>
            `;
            return;
        }
        
        const config = RoleConfigs.getRole(userRole);
        const roleTitle = config?.shortTitle?.toUpperCase() || userRole.toUpperCase();
        const isMultiWorker = RoleConfigs.isMultiWorker(userRole);
        const status = roleStatus.status || 'working';
        const statusClass = status === 'retiring' ? 'retiring' : 'working';
        const userColor = this.currentUserColor;
        
        // Build status HTML
        let statusHtml = `
            <span class="status-badge ${statusClass} role-${userRole}">${roleTitle}</span>
        `;
        
        // Add action buttons based on current status
        if (status === 'working') {
            if (isMultiWorker) {
                // Multi-worker roles only get a "Step Down" button
                statusHtml += `
                    <div class="sidebar-work-actions">
                        <button class="sidebar-action-btn stepdown-btn" 
                                onclick="window.workCore?.deactivateRole('${userRole}')" 
                                title="Step down from this role" 
                                style="background: ${userColor}; border-color: ${userColor};">
                            Step Down
                        </button>
                    </div>
                `;
            } else {
                statusHtml += `
                    <div class="sidebar-work-actions">
                        <button class="sidebar-action-btn retiring-btn" 
                                onclick="window.workCore?.setRoleRetiring('${userRole}')" 
                                title="Begin retiring from this role" 
                                style="background: ${userColor}; border-color: ${userColor};">
                            Begin Retiring
                        </button>
                        <button class="sidebar-action-btn stepdown-btn" 
                                onclick="window.workCore?.deactivateRole('${userRole}')" 
                                title="Step down immediately" 
                                style="background: ${userColor}; border-color: ${userColor}; filter: brightness(0.8);">
                            Step Down
                        </button>
                    </div>
                `;
            }
        } else if (status === 'retiring') {
            statusHtml += `
                <div class="sidebar-work-actions">
                    <button class="sidebar-action-btn stepdown-btn" 
                            onclick="window.workCore?.deactivateRole('${userRole}')" 
                            title="Step down immediately" 
                            style="background: ${userColor}; border-color: ${userColor}; filter: brightness(0.8);">
                        Step Down
                    </button>
                </div>
            `;
        }
        
        statusContentEl.innerHTML = statusHtml;
    }
    
    /**
     * Get user's current role
     */
    getUserRole() {
        for (const role of RoleConfigs.orderedRoles) {
            if (this.roleStatuses[role] && this.roleStatuses[role].is_worker) {
                return role;
            }
        }
        return null;
    }
    
    /**
     * Check if user has any active role
     */
    hasActiveRole() {
        return this.getUserRole() !== null;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkSidebar;
}

// Make available globally
window.WorkSidebar = WorkSidebar;
