/**
 * Provisioner Role Component
 * 
 * Handles the Head of Pantry role:
 * - Food pickup requests
 * - Sync follows functionality
 * - Tools for active provisioner
 */

class ProvisionerRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'provisioner-content-section';
        this.pendingRequestProvisionerDid = null;
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.requestFoodPickup = this.requestFoodPickup.bind(this);
        this.syncFollows = this.syncFollows.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('provisioner');
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
            if (event.detail.role === 'provisioner') {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Listen for status updates to show/hide tools
        window.addEventListener('work:status-updated', (event) => {
            if (event.detail.role === 'provisioner') {
                this.updateToolsVisibility();
            }
        });
    }
    
    /**
     * Show the provisioner content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.updateToolsVisibility();
        }
    }
    
    /**
     * Hide the provisioner content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Update tools visibility based on worker status
     */
    updateToolsVisibility() {
        const toolsSection = document.getElementById('provisioner-tools-section');
        if (!toolsSection) return;
        
        const status = window.workCore?.getRoleStatus('provisioner');
        const isActiveProvisioner = status && status.is_worker;
        
        toolsSection.style.display = isActiveProvisioner ? 'block' : 'none';
    }
    
    /**
     * Request food pickup - opens city input modal
     */
    async requestFoodPickup() {
        // Check if logged in
        if (!window.workCore?.getSession()) {
            if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        // Get current provisioner
        const status = window.workCore?.getRoleStatus('provisioner');
        if (!status || !status.role_info?.workers?.length) {
            window.workCore?.showCelebration('No Head of Pantry is currently available.', 'error');
            return;
        }
        
        const provisionerDid = status.role_info.workers[0].did;
        this.pendingRequestProvisionerDid = provisionerDid;
        
        // Show city modal
        this.showCityModal(provisionerDid);
    }
    
    /**
     * Show city input modal
     */
    async showCityModal(provisionerDid) {
        const modal = document.getElementById('cityInputModal');
        const input = document.getElementById('cityInput');
        const cityPreview = document.querySelector('.preview-city');
        const handlePreview = document.querySelector('.preview-handle');
        
        if (!modal) return;
        
        // Get provisioner's name
        try {
            const dreamer = await window.workCore?.fetchDreamerInfo(provisionerDid);
            if (dreamer) {
                const name = dreamer.name ? 
                    dreamer.name.charAt(0).toUpperCase() + dreamer.name.slice(1) : 
                    'friend';
                if (handlePreview) handlePreview.textContent = name;
            }
        } catch (error) {
            console.error('Error fetching provisioner name:', error);
            if (handlePreview) handlePreview.textContent = 'friend';
        }
        
        // Update preview as user types
        if (input) {
            input.value = '';
            input.addEventListener('input', function() {
                const city = this.value.trim();
                if (cityPreview) {
                    cityPreview.textContent = city || '...';
                    cityPreview.style.fontStyle = city ? 'normal' : 'italic';
                }
            });
        }
        
        if (cityPreview) {
            cityPreview.textContent = '...';
            cityPreview.style.fontStyle = 'italic';
        }
        
        modal.classList.add('show');
        document.body.setAttribute('data-current-role', 'provisioner');
        
        // Focus input after animation
        setTimeout(() => input?.focus(), 300);
    }
    
    /**
     * Close city modal
     */
    closeCityModal() {
        const modal = document.getElementById('cityInputModal');
        const input = document.getElementById('cityInput');
        const preview = document.querySelector('.preview-city');
        
        if (modal) modal.classList.remove('show');
        if (input) input.value = '';
        if (preview) {
            preview.textContent = '...';
            preview.style.fontStyle = 'italic';
        }
        this.pendingRequestProvisionerDid = null;
    }
    
    /**
     * Submit city and send request
     */
    async submitCityAndSendRequest() {
        const cityInput = document.getElementById('cityInput');
        const city = cityInput?.value?.trim();
        
        if (!city) {
            window.workCore?.showCelebration('Please enter your city', 'error');
            return;
        }
        
        if (!this.pendingRequestProvisionerDid) {
            window.workCore?.showCelebration('Request session expired. Please try again.', 'error');
            this.closeCityModal();
            return;
        }
        
        const provisionerDid = this.pendingRequestProvisionerDid;
        
        // Close modal and show loading
        this.closeCityModal();
        window.workCore?.showCelebration('Sending request...', 'info');
        
        try {
            const token = window.workCore?.getAuthToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch('/api/work/provisioner/send-request', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    city: city,
                    provisioner_did: provisionerDid
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                window.workCore?.showCelebration('Request sent successfully!\n\nThe Head of Pantry will respond via DM.', 'success');
            } else {
                if (data.needs_credentials) {
                    window.workCore?.showCelebration('You need to activate a work role first to send direct messages.', 'error');
                } else if (data.dm_restricted) {
                    const provHandle = data.provisioner_handle || 'the provisioner';
                    window.workCore?.showCelebration(`The Head of Pantry (@${provHandle}) has DM settings that require them to follow you first.`, 'error');
                } else {
                    window.workCore?.showCelebration(data.error || 'Failed to send request', 'error');
                }
            }
        } catch (error) {
            console.error('Error sending food request:', error);
            window.workCore?.showCelebration('Network error. Please try again.', 'error');
        }
    }
    
    /**
     * Sync provisioner follows
     */
    async syncFollows() {
        const syncBtn = document.getElementById('sync-follows-btn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="m3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                </svg>
                Syncing...
            `;
        }
        
        try {
            const token = window.workCore?.getAuthToken();
            
            const response = await fetch('/api/work/provisioner/sync-follows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                let message = `Follow sync complete!\n\n`;
                message += `✅ Followed: ${data.followed}\n`;
                message += `🗑️ Unfollowed: ${data.unfollowed}\n`;
                message += `📋 Already following: ${data.already_following}`;
                if (data.errors?.length > 0) {
                    message += `\n⚠️ Errors: ${data.errors.length}`;
                }
                window.workCore?.showCelebration(message, 'success');
            } else {
                window.workCore?.showCelebration(data.error || 'Failed to sync follows', 'error');
            }
        } catch (error) {
            console.error('Error syncing follows:', error);
            window.workCore?.showCelebration('Network error. Please try again.', 'error');
        } finally {
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="m3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                    </svg>
                    Sync Follows
                `;
            }
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProvisionerRole;
}

// Make available globally
window.ProvisionerRole = ProvisionerRole;

// Global functions for HTML onclick handlers
window.requestFoodPickup = function() {
    if (window.provisionerRole) {
        window.provisionerRole.requestFoodPickup();
    }
};

window.closeCityModal = function() {
    if (window.provisionerRole) {
        window.provisionerRole.closeCityModal();
    }
};

window.submitCityAndSendRequest = function() {
    if (window.provisionerRole) {
        window.provisionerRole.submitCityAndSendRequest();
    }
};

window.syncProvisionerFollows = function() {
    if (window.provisionerRole) {
        window.provisionerRole.syncFollows();
    }
};
