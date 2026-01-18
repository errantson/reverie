/**
 * Guardian Role Component
 * 
 * Handles the Guardian multi-worker role:
 * - Guardian list display
 * - Ward/Charge management
 * - Community shield stats
 */

class GuardianRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'guardian-content-section';
        this.workers = [];
        this.selectedGuardian = null;
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadGuardianList = this.loadGuardianList.bind(this);
        this.selectGuardian = this.selectGuardian.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('guardian');
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
            if (event.detail.role === 'guardian') {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Listen for activation/deactivation
        if (window.WorkEvents) {
            window.WorkEvents.on(window.WorkEvents.EVENTS.GUARDIAN_ACTIVATED, () => {
                this.loadGuardianList();
            });
            window.WorkEvents.on(window.WorkEvents.EVENTS.GUARDIAN_STEPPED_DOWN, () => {
                this.loadGuardianList();
            });
        }
    }
    
    /**
     * Show the guardian content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadGuardianList();
        }
    }
    
    /**
     * Hide the guardian content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load guardian list
     */
    async loadGuardianList() {
        const listContainer = document.getElementById('guardian-list');
        if (!listContainer) return;
        
        try {
            const response = await fetch('/api/work/guardian/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            this.workers = data.role_info?.workers || [];
            
            // Update stats
            const totalCountEl = document.getElementById('guardian-total-count');
            if (totalCountEl) totalCountEl.textContent = this.workers.length;
            
            if (this.workers.length === 0) {
                listContainer.innerHTML = `
                    <div class="guardian-empty">
                        <div class="guardian-empty-text">No Guardians yet</div>
                        <p style="color: #888; font-size: 0.75rem; margin-top: 0.5rem;">Be the first to protect your community</p>
                    </div>
                `;
                return;
            }
            
            // Fetch all worker details in parallel
            const workerPromises = this.workers.map(async (worker) => {
                try {
                    const [dreamer, stats] = await Promise.all([
                        window.workCore?.fetchDreamerInfo(worker.did),
                        fetch(`/api/work/guardian/${encodeURIComponent(worker.did)}/stats`).then(r => r.ok ? r.json() : null)
                    ]);
                    
                    return {
                        did: worker.did,
                        handle: dreamer?.handle || 'unknown',
                        displayName: dreamer?.display_name || dreamer?.handle || 'Unknown',
                        avatar: dreamer?.avatar || '/assets/default-avatar.png',
                        color: dreamer?.color_hex || 'var(--role-guardian)',
                        chargeCount: stats?.charge_count || 0,
                        wardCount: stats?.ward_count || 0
                    };
                } catch (e) {
                    console.error('Failed to fetch guardian info:', e);
                    return {
                        did: worker.did,
                        handle: 'unknown',
                        displayName: 'Unknown',
                        avatar: '/assets/default-avatar.png',
                        color: 'var(--role-guardian)',
                        chargeCount: 0,
                        wardCount: 0
                    };
                }
            });
            
            const workerInfos = await Promise.all(workerPromises);
            
            // Calculate total wards and charges
            let totalWards = 0;
            let totalCharges = 0;
            for (const w of workerInfos) {
                totalWards += w.wardCount || 0;
                totalCharges += w.chargeCount || 0;
            }
            
            // Update total stats
            const totalWardsEl = document.getElementById('guardian-total-wards');
            const totalChargesEl = document.getElementById('guardian-total-charges');
            if (totalWardsEl) totalWardsEl.textContent = totalWards;
            if (totalChargesEl) totalChargesEl.textContent = totalCharges;
            
            // Build guardian list HTML
            const html = workerInfos.map(w => {
                // Use the guardian's database color for their row, fallback to guardian brown
                const userColor = w.color || '#8B5A2B';
                const bgColor = userColor + '22'; // Add ~13% opacity hex suffix
                return `
                    <div class="guardian-row" data-did="${w.did}" data-handle="${w.handle}" data-name="${w.displayName}" data-avatar="${w.avatar}" data-color="${userColor}" onclick="window.guardianRole?.selectGuardian('${w.did}')" style="background: ${bgColor};">
                        <div class="guardian-link">
                            <img src="${w.avatar}" alt="${w.handle}" class="guardian-avatar">
                            <span class="guardian-name">${w.displayName}</span>
                        </div>
                        <div class="guardian-counts">
                            <span class="guardian-count charge-count" title="Charges (blacklisted)">
                                <svg class="guardian-count-icon" viewBox="0 0 20 20" fill="currentColor">
                                    <polygon points="17.17,15.76 20,18.59 18.59,20 15.76,17.17 14.35,18.59 12.93,17.17 14.35,15.76 10,10.98 5.65,15.76 7.07,17.17 5.65,18.59 4.24,17.17 1.41,20 0,18.59 2.83,15.76 1.41,14.35 2.83,12.93 4.24,14.35 9.06,9.96 0,0 10,9.1 20,0 10.94,9.96 15.76,14.35 17.17,12.93 18.59,14.35"/>
                                </svg>
                                ${w.chargeCount}
                            </span>
                            <span class="guardian-count-divider">|</span>
                            <span class="guardian-count ward-count" title="Wards (whitelisted)">
                                <svg class="guardian-count-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                </svg>
                                ${w.wardCount}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            
            listContainer.innerHTML = html;
            
            // Initialize dreamer hover
            setTimeout(() => {
                if (window.DreamerHover) window.DreamerHover.init();
            }, 100);
            
        } catch (error) {
            console.error('Failed to load guardian list:', error);
            listContainer.innerHTML = '<div class="guardian-empty">Error loading guardians</div>';
        }
    }
    
    /**
     * Select a guardian to view details
     */
    async selectGuardian(guardianDid) {
        this.selectedGuardian = guardianDid;
        
        // Hide default view, show selected view
        const defaultView = document.getElementById('guardian-default-view');
        const selectedView = document.getElementById('guardian-selected-view');
        
        if (defaultView) defaultView.style.display = 'none';
        if (selectedView) selectedView.style.display = 'block';
        
        // Find the guardian row to get cached info
        const guardianRow = document.querySelector(`.guardian-row[data-did="${guardianDid}"]`);
        const cachedName = guardianRow?.dataset.name || 'Guardian';
        const cachedHandle = guardianRow?.dataset.handle || 'unknown';
        const cachedAvatar = guardianRow?.dataset.avatar || '/assets/default-avatar.png';
        const cachedColor = guardianRow?.dataset.color || '#8B5A2B';
        
        // Update profile header with cached data first
        const profileAvatar = document.getElementById('guardian-profile-avatar');
        const profileName = document.getElementById('guardian-profile-name');
        const profileHandle = document.getElementById('guardian-profile-handle');
        const profileHeader = document.querySelector('.guardian-profile-header');
        
        if (profileAvatar) profileAvatar.src = cachedAvatar;
        if (profileName) profileName.textContent = cachedName;
        if (profileHandle) profileHandle.textContent = `@${cachedHandle}`;
        // Apply user's color as background tint
        if (profileHeader) profileHeader.style.background = cachedColor + '22';
        
        // Load ward and charge counts
        await this.loadGuardianDetails(guardianDid);
    }
    
    /**
     * Load guardian details (wards and charges)
     */
    async loadGuardianDetails(guardianDid) {
        try {
            const response = await fetch(`/api/work/guardian/${encodeURIComponent(guardianDid)}/details`);
            if (!response.ok) throw new Error('Failed to fetch guardian details');
            
            const data = await response.json();
            
            // Update counts in header
            const wardCountBadge = document.getElementById('ward-count-badge');
            const chargeCountBadge = document.getElementById('charge-count-badge');
            
            if (wardCountBadge) wardCountBadge.textContent = data.wards?.length || 0;
            if (chargeCountBadge) chargeCountBadge.textContent = data.charges?.length || 0;
            
            // Update button states based on current user
            this.updateActionButtons(guardianDid, data);
            
        } catch (error) {
            console.error('Failed to load guardian details:', error);
        }
    }
    
    /**
     * Update action button states
     */
    updateActionButtons(guardianDid, data) {
        const currentUserDid = window.workCore?.getUserDID();
        if (!currentUserDid) return;
        
        const wardBtn = document.getElementById('become-ward-btn');
        const chargeBtn = document.getElementById('become-charge-btn');
        
        const isWard = data.wards?.some(w => (w.did || w) === currentUserDid);
        const isCharge = data.charges?.some(c => (c.did || c) === currentUserDid);
        
        if (wardBtn) {
            const label = wardBtn.querySelector('.guardian-action-label');
            if (isWard) {
                wardBtn.classList.add('active');
                if (label) label.textContent = 'Leave Ward';
            } else {
                wardBtn.classList.remove('active');
                if (label) label.textContent = 'Become a Ward';
            }
        }
        
        if (chargeBtn) {
            const label = chargeBtn.querySelector('.guardian-action-label');
            if (isCharge) {
                chargeBtn.classList.add('active');
                if (label) label.textContent = 'Leave Charge';
            } else {
                chargeBtn.classList.remove('active');
                if (label) label.textContent = 'Become a Charge';
            }
        }
    }
    
    /**
     * Toggle ward status for current guardian
     */
    async toggleWardStatus() {
        if (!this.selectedGuardian) return;
        
        if (!window.workCore?.getSession()) {
            if (window.loginWidget?.showLoginPopup) {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        const token = window.workCore?.getAuthToken();
        
        try {
            const response = await fetch(`/api/work/guardian/${encodeURIComponent(this.selectedGuardian)}/toggle-ward`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                window.workCore?.showCelebration(data.message || 'Ward status updated', 'success');
                await this.loadGuardianDetails(this.selectedGuardian);
            } else {
                window.workCore?.showCelebration(data.error || 'Failed to update ward status', 'error');
            }
        } catch (error) {
            console.error('Failed to toggle ward status:', error);
            window.workCore?.showCelebration('Network error. Please try again.', 'error');
        }
    }
    
    /**
     * Toggle charge status for current guardian
     */
    async toggleChargeStatus() {
        if (!this.selectedGuardian) return;
        
        if (!window.workCore?.getSession()) {
            if (window.loginWidget?.showLoginPopup) {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        const token = window.workCore?.getAuthToken();
        
        try {
            const response = await fetch(`/api/work/guardian/${encodeURIComponent(this.selectedGuardian)}/toggle-charge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                window.workCore?.showCelebration(data.message || 'Charge status updated', 'success');
                await this.loadGuardianDetails(this.selectedGuardian);
            } else {
                window.workCore?.showCelebration(data.error || 'Failed to update charge status', 'error');
            }
        } catch (error) {
            console.error('Failed to toggle charge status:', error);
            window.workCore?.showCelebration('Network error. Please try again.', 'error');
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuardianRole;
}

// Make available globally
window.GuardianRole = GuardianRole;

// Global functions for HTML onclick handlers
window.selectGuardian = function(did) {
    if (window.guardianRole) {
        window.guardianRole.selectGuardian(did);
    }
};

window.toggleWardStatus = function() {
    if (window.guardianRole) {
        window.guardianRole.toggleWardStatus();
    }
};

window.toggleChargeStatus = function() {
    if (window.guardianRole) {
        window.guardianRole.toggleChargeStatus();
    }
};
