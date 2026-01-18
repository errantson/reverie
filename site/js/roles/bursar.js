/**
 * Bursar Role Component
 * 
 * Handles the Bursar role:
 * - Treasury display (OpenCollective)
 * - Scheme submissions
 */

class BursarRole {
    constructor(options = {}) {
        this.containerId = options.containerId || 'bursar-content-section';
        this.treasuryData = null;
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.loadTreasuryData = this.loadTreasuryData.bind(this);
    }
    
    /**
     * Get role configuration
     */
    static get config() {
        return RoleConfigs.getRole('bursar');
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
            if (event.detail.role === 'bursar') {
                this.show();
            } else {
                this.hide();
            }
        });
    }
    
    /**
     * Show the bursar content
     */
    show() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'block';
            this.loadTreasuryData();
        }
    }
    
    /**
     * Hide the bursar content
     */
    hide() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Load treasury data from OpenCollective
     */
    async loadTreasuryData() {
        try {
            const response = await fetch('/api/opencollective/stats');
            if (response.ok) {
                this.treasuryData = await response.json();
                this.renderTreasuryData();
            }
        } catch (error) {
            console.error('Failed to load treasury data:', error);
        }
    }
    
    /**
     * Render treasury data
     */
    renderTreasuryData() {
        if (!this.treasuryData) return;
        
        const formatCurrency = (cents) => {
            const amount = (cents || 0) / 100;
            return `$${amount.toFixed(2)}`;
        };
        
        const balanceEl = document.getElementById('oc-balance');
        const raisedEl = document.getElementById('oc-total-raised');
        const disbursedEl = document.getElementById('oc-disbursed');
        
        if (balanceEl) {
            balanceEl.textContent = formatCurrency(this.treasuryData.balance);
        }
        if (raisedEl) {
            raisedEl.textContent = formatCurrency(this.treasuryData.totalRaised);
        }
        if (disbursedEl) {
            raisedEl.textContent = formatCurrency(this.treasuryData.totalDisbursed);
        }
    }
    
    /**
     * Submit a scheme
     */
    async submitScheme() {
        const domainInput = document.getElementById('scheme-domain-input');
        const domain = domainInput?.value?.trim();
        
        if (!domain) {
            window.workCore?.showCelebration('Please enter a domain', 'error');
            return;
        }
        
        // Check if logged in
        if (!window.workCore?.getSession()) {
            if (window.loginWidget?.showLoginPopup) {
                window.loginWidget.showLoginPopup();
            }
            return;
        }
        
        window.workCore?.showCelebration('Scheme submissions opening soon', 'info');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BursarRole;
}

// Make available globally
window.BursarRole = BursarRole;

// Global function for HTML onclick handlers
window.submitScheme = function() {
    if (window.bursarRole) {
        window.bursarRole.submitScheme();
    }
};
