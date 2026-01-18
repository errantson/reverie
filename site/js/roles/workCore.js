/**
 * Work Core Module
 * 
 * Shared functionality for all work roles including:
 * - Role status loading and caching
 * - Worker activation/deactivation
 * - App password validation
 * - UI helpers (modals, celebrations, loading overlays)
 */

class WorkCore {
    constructor() {
        this.currentSession = null;
        this.roleStatuses = {
            greeter: null,
            mapper: null,
            cogitarian: null,
            provisioner: null,
            dreamstyler: null,
            bursar: null,
            cheerful: null,
            guardian: null
        };
        this.currentRole = 'greeter';
        this.isInitializing = false;
        this.profileLoaded = false;
        this.sessionCheckComplete = false;
        
        // Bind methods
        this.loadRoleStatus = this.loadRoleStatus.bind(this);
        this.activateRole = this.activateRole.bind(this);
        this.deactivateRole = this.deactivateRole.bind(this);
        this.setRoleRetiring = this.setRoleRetiring.bind(this);
    }
    
    /**
     * Initialize the work core
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
        window.addEventListener('oauth:profile-loaded', async (event) => {
            if (this.isInitializing) return;
            this.isInitializing = true;
            
            this.currentSession = event.detail.session;
            this.profileLoaded = true;
            this.sessionCheckComplete = true;
            
            // Load all role statuses
            await this.loadAllRoleStatuses();
            this.isInitializing = false;
            
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('work:statuses-loaded', {
                detail: { statuses: this.roleStatuses }
            }));
        });
        
        window.addEventListener('oauth:logout', () => {
            this.currentSession = null;
            this.profileLoaded = false;
            this.roleStatuses = {
                greeter: null,
                mapper: null,
                cogitarian: null,
                provisioner: null,
                dreamstyler: null,
                bursar: null,
                cheerful: null,
                guardian: null
            };
            
            window.dispatchEvent(new CustomEvent('work:statuses-cleared'));
        });
        
        // Role change events
        window.addEventListener('role:changed', (event) => {
            this.currentRole = event.detail.role;
        });
    }
    
    /**
     * Check initial session
     */
    async checkInitialSession() {
        if (window.oauthManager) {
            const session = window.oauthManager.getSession();
            if (session && session.profile?.handle) {
                this.isInitializing = true;
                this.currentSession = session;
                this.profileLoaded = true;
                this.sessionCheckComplete = true;
                
                await this.loadAllRoleStatuses();
                this.isInitializing = false;
                
                window.dispatchEvent(new CustomEvent('work:statuses-loaded', {
                    detail: { statuses: this.roleStatuses }
                }));
            }
        }
    }
    
    /**
     * Get authorization token
     */
    getAuthToken() {
        let token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
        if (!token && this.currentSession && this.currentSession.accessJwt) {
            token = this.currentSession.accessJwt;
        }
        return token;
    }
    
    /**
     * Load all role statuses
     */
    async loadAllRoleStatuses() {
        const roles = Object.keys(this.roleStatuses);
        await Promise.all(roles.map(role => this.loadRoleStatus(role)));
    }
    
    /**
     * Load status for a specific role
     */
    async loadRoleStatus(role) {
        try {
            const token = this.getAuthToken();
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/work/${role}/status`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                this.roleStatuses[role] = data;
                
                // Dispatch status update event
                window.dispatchEvent(new CustomEvent('work:status-updated', {
                    detail: { role, status: data }
                }));
                
                return data;
            } else {
                this.roleStatuses[role] = { is_worker: false, status: null };
            }
        } catch (error) {
            console.error(`Failed to load ${role} status:`, error);
            this.roleStatuses[role] = { is_worker: false, status: null };
        }
        
        return this.roleStatuses[role];
    }
    
    /**
     * Get role status
     */
    getRoleStatus(role) {
        return this.roleStatuses[role];
    }
    
    /**
     * Check if user is a worker for any role
     */
    getUserCurrentRole() {
        for (const [role, status] of Object.entries(this.roleStatuses)) {
            if (status && status.is_worker) {
                return role;
            }
        }
        return null;
    }
    
    /**
     * Check if app password exists for a role
     */
    async checkCredentials(role) {
        const token = this.getAuthToken();
        if (!token) return { has_credentials: false };
        
        try {
            const response = await fetch(`/api/work/${role}/check-credentials`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error(`Failed to check credentials for ${role}:`, error);
        }
        
        return { has_credentials: false };
    }
    
    /**
     * Activate a role with app password
     */
    async activateRole(role, appPassword) {
        const token = this.getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        this.showLoadingOverlay('Activating role...');
        
        try {
            const payload = {};
            if (appPassword) {
                payload.app_password = appPassword;
            }
            
            const response = await fetch(`/api/work/${role}/activate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadRoleStatus(role);
                
                // Emit WorkEvents if available
                const config = RoleConfigs.getRole(role);
                if (window.WorkEvents && config) {
                    const eventName = `${role.toUpperCase()}_ACTIVATED`;
                    if (window.WorkEvents.EVENTS[eventName]) {
                        window.WorkEvents.emit(window.WorkEvents.EVENTS[eventName], {
                            did: this.currentSession?.sub || this.currentSession?.did,
                            role: role
                        });
                    }
                }
                
                this.hideLoadingOverlay();
                return { success: true, data };
            } else {
                this.hideLoadingOverlay();
                return { success: false, error: data.error || 'Activation failed' };
            }
        } catch (error) {
            console.error(`Failed to activate ${role}:`, error);
            this.hideLoadingOverlay();
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Deactivate (step down from) a role
     */
    async deactivateRole(role) {
        const token = this.getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        this.showLoadingOverlay('Stepping down...');
        
        try {
            const response = await fetch(`/api/work/${role}/deactivate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadRoleStatus(role);
                
                // Emit WorkEvents if available
                if (window.WorkEvents) {
                    const eventName = `${role.toUpperCase()}_STEPPED_DOWN`;
                    if (window.WorkEvents.EVENTS[eventName]) {
                        window.WorkEvents.emit(window.WorkEvents.EVENTS[eventName], {
                            did: this.currentSession?.sub || this.currentSession?.did,
                            role: role
                        });
                    }
                }
                
                this.hideLoadingOverlay();
                return { success: true, data };
            } else {
                this.hideLoadingOverlay();
                return { success: false, error: data.error || 'Deactivation failed' };
            }
        } catch (error) {
            console.error(`Failed to deactivate ${role}:`, error);
            this.hideLoadingOverlay();
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Set role status to retiring
     */
    async setRoleRetiring(role) {
        const token = this.getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const response = await fetch(`/api/work/${role}/set-retiring`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadRoleStatus(role);
                return { success: true, data };
            } else {
                return { success: false, error: data.error || 'Failed to set retiring status' };
            }
        } catch (error) {
            console.error(`Failed to set ${role} retiring:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Set role status back to working
     */
    async setRoleWorking(role) {
        const token = this.getAuthToken();
        if (!token) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const response = await fetch(`/api/work/${role}/set-working`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadRoleStatus(role);
                return { success: true, data };
            } else {
                return { success: false, error: data.error || 'Failed to set working status' };
            }
        } catch (error) {
            console.error(`Failed to set ${role} working:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Show loading overlay
     */
    showLoadingOverlay(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const textElement = overlay.querySelector('.loading-text');
            if (textElement) {
                textElement.textContent = message;
            }
            overlay.style.display = 'flex';
        }
    }
    
    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    /**
     * Show celebration/notification message
     */
    showCelebration(message, type = 'success') {
        // Check if showCelebration exists globally
        if (typeof window.showCelebration === 'function') {
            window.showCelebration(message, type);
            return;
        }
        
        // Fallback implementation
        const colors = {
            success: '#4ade80',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem 2rem;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            white-space: pre-line;
            text-align: center;
            max-width: 90%;
            animation: fadeInUp 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    /**
     * Open worker modal for role activation
     */
    async openWorkerModal(role) {
        // Check if logged in
        if (!this.currentSession) {
            if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        const config = RoleConfigs.getRole(role);
        if (!config) {
            console.error(`Unknown role: ${role}`);
            return;
        }
        
        // Check if user already has a different role (for single-worker roles)
        const currentUserRole = this.getUserCurrentRole();
        const isMultiWorker = RoleConfigs.isMultiWorker(role);
        
        if (!isMultiWorker && currentUserRole && currentUserRole !== role) {
            this.showCelebration(`You must step down from ${currentUserRole} before becoming ${config.title}`, 'warning');
            return;
        }
        
        // Check if already a worker for this role
        const roleStatus = this.roleStatuses[role];
        if (roleStatus && roleStatus.is_worker) {
            this.showCelebration(`You are already a ${config.title}!`, 'info');
            return;
        }
        
        // Dispatch event to show modal
        window.dispatchEvent(new CustomEvent('work:show-modal', {
            detail: { role, config }
        }));
    }
    
    /**
     * Fetch dreamer info by DID
     */
    async fetchDreamerInfo(did) {
        try {
            const response = await fetch(`/api/dreamers/${did}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to fetch dreamer:', error);
        }
        return null;
    }
    
    /**
     * Get current session
     */
    getSession() {
        return this.currentSession;
    }
    
    /**
     * Get user's DID
     */
    getUserDID() {
        return this.currentSession?.sub || this.currentSession?.did;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkCore;
}

// Make available globally
window.WorkCore = WorkCore;

// Create global instance
window.workCore = new WorkCore();
