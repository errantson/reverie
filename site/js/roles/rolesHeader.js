/**
 * Roles Header Component
 * 
 * Renders the role tabs/buttons at the top of the workshop page.
 * Handles role selection, mobile dropdown, and URL routing.
 */

class RolesHeader {
    constructor(options = {}) {
        this.containerId = options.containerId || 'role-tabs-container';
        this.mobileSelectId = options.mobileSelectId || 'role-selector-mobile';
        this.currentRole = options.initialRole || 'greeter';
        this.onRoleChange = options.onRoleChange || (() => {});
        this.isAdminUser = false;
        
        // Bind methods
        this.selectRole = this.selectRole.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
    }
    
    /**
     * Initialize the component
     */
    async init() {
        // Check URL for initial role
        this.determineInitialRole();
        
        // Render tabs
        this.render();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Replace initial history state
        history.replaceState({ role: this.currentRole }, '', `/${this.currentRole}`);
        
        return this;
    }
    
    /**
     * Determine initial role from URL, hash, or localStorage
     */
    determineInitialRole() {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        const urlRole = pathParts.length > 0 ? pathParts[0] : null;
        const hashRole = window.location.hash.replace('#', '');
        const savedTab = localStorage.getItem('work_current_tab');
        const allowedRoles = RoleConfigs.orderedRoles;
        
        // Priority: hash > URL path > saved > default
        if (allowedRoles.includes(hashRole)) {
            this.currentRole = hashRole;
        } else if (allowedRoles.includes(urlRole)) {
            this.currentRole = urlRole;
        } else if (savedTab && allowedRoles.includes(savedTab)) {
            this.currentRole = savedTab;
        }
    }
    
    /**
     * Render the role tabs
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn('[RolesHeader] Container not found:', this.containerId);
            return;
        }
        
        // Build desktop tabs HTML
        const tabsHtml = RoleConfigs.orderedRoles.map(roleName => {
            const config = RoleConfigs.getRole(roleName);
            if (!config) return '';
            
            const isActive = roleName === this.currentRole;
            const isHidden = config.hidden && !this.isAdminUser;
            
            return `
                <button class="role-tab ${isActive ? 'active' : ''}" 
                        data-role="${roleName}" 
                        id="role-tab-${roleName}"
                        style="${isHidden ? 'display: none;' : ''}"
                        onclick="window.rolesHeader?.selectRole('${roleName}')">
                    <span class="role-tab-icon">${config.icon}</span>
                    <span class="role-tab-name">${config.shortTitle}</span>
                </button>
            `;
        }).join('');
        
        container.innerHTML = `
            <div id="core-roles-panel" class="role-panel active" data-panel="core">
                <div class="role-tabs">
                    ${tabsHtml}
                </div>
            </div>
        `;
        
        // Render mobile select
        this.renderMobileSelect();
    }
    
    /**
     * Render mobile dropdown selector
     */
    renderMobileSelect() {
        const select = document.getElementById(this.mobileSelectId);
        if (!select) return;
        
        const optionsHtml = RoleConfigs.orderedRoles.map(roleName => {
            const config = RoleConfigs.getRole(roleName);
            if (!config) return '';
            
            const isSelected = roleName === this.currentRole;
            const isHidden = config.hidden && !this.isAdminUser;
            
            return `
                <option value="${roleName}" 
                        id="mobile-option-${roleName}"
                        ${isSelected ? 'selected' : ''}
                        ${isHidden ? 'style="display: none;"' : ''}>
                    ${config.shortTitle}
                </option>
            `;
        }).join('');
        
        select.innerHTML = optionsHtml;
        select.value = this.currentRole;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Browser back/forward navigation
        window.addEventListener('popstate', this.handlePopState);
        
        // Mobile select change
        const mobileSelect = document.getElementById(this.mobileSelectId);
        if (mobileSelect) {
            mobileSelect.addEventListener('change', (e) => {
                this.selectRole(e.target.value);
            });
        }
    }
    
    /**
     * Handle browser popstate (back/forward)
     */
    handlePopState(event) {
        let role = null;
        const allowedRoles = RoleConfigs.orderedRoles;
        
        if (event.state && event.state.role && allowedRoles.includes(event.state.role)) {
            role = event.state.role;
        } else {
            const path = window.location.pathname.replace('/', '');
            if (allowedRoles.includes(path)) {
                role = path;
            }
        }
        
        if (role) {
            this.selectRole(role, { skipPushState: true });
        }
    }
    
    /**
     * Select a role
     * @param {string} role - Role name
     * @param {Object} options - Options
     * @param {boolean} options.skipPushState - Skip adding to browser history
     */
    selectRole(role, options = {}) {
        const skipPushState = options.skipPushState || false;
        const config = RoleConfigs.getRole(role);
        
        if (!config) {
            console.warn('[RolesHeader] Unknown role:', role);
            return;
        }
        
        this.currentRole = role;
        
        // Update data attribute on body for CSS
        document.body.setAttribute('data-current-role', role);
        
        // Save to localStorage
        localStorage.setItem('work_current_tab', role);
        
        // Update URL
        if (!skipPushState) {
            const newUrl = `/${role}`;
            history.pushState({ role: role }, '', newUrl);
        }
        
        // Update tab button states
        document.querySelectorAll('.role-tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-role') === role) {
                btn.classList.add('active');
            }
        });
        
        // Update mobile selector
        const mobileSelector = document.getElementById(this.mobileSelectId);
        if (mobileSelector) {
            mobileSelector.value = role;
        }
        
        // Notify callback
        this.onRoleChange(role, config);
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('role:changed', { 
            detail: { role, config } 
        }));
    }
    
    /**
     * Get current role name
     */
    getCurrentRole() {
        return this.currentRole;
    }
    
    /**
     * Get current role config
     */
    getCurrentConfig() {
        return RoleConfigs.getRole(this.currentRole);
    }
    
    /**
     * Update admin visibility (show/hide admin-only tabs)
     */
    setAdminUser(isAdmin) {
        this.isAdminUser = isAdmin;
        
        // Update hidden roles visibility
        RoleConfigs.orderedRoles.forEach(roleName => {
            const config = RoleConfigs.getRole(roleName);
            if (!config || !config.hidden) return;
            
            const tab = document.getElementById(`role-tab-${roleName}`);
            const mobileOption = document.getElementById(`mobile-option-${roleName}`);
            
            if (tab) {
                tab.style.display = isAdmin ? 'flex' : 'none';
            }
            if (mobileOption) {
                mobileOption.style.display = isAdmin ? '' : 'none';
            }
        });
    }
    
    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('popstate', this.handlePopState);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RolesHeader;
}

// Make available globally
window.RolesHeader = RolesHeader;
