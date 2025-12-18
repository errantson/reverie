/**
 * Change Handle Widget
 * 
 * A modal for switching between available .reverie.house handles.
 * Users can have multiple handles (name + pseudonyms) and this widget
 * allows them to switch which one is currently active.
 */

class ChangeHandleWidget {
    constructor() {
        this.modal = null;
        this.config = null;
        this.onSuccess = null;
        this.availableHandles = [];
        this.currentHandle = null;
        this.selectedHandle = null;
    }

    /**
     * Show the change handle modal
     * @param {Object} config - Configuration object
     * @param {string} config.reason - Why the handle change is needed (e.g., 'food_request')
     * @param {string} config.provisionerHandle - The provisioner's handle to show in message
     * @param {Function} config.onSuccess - Called after successful handle change
     */
    async show(config = {}) {
        this.config = config;
        this.onSuccess = config.onSuccess || null;
        
        // First, fetch available handles
        const handles = await this.fetchAvailableHandles();
        
        if (!handles || handles.length === 0) {
            this.showError('No .reverie.house handles available.\n\nPlease contact a Greeter to get your Reverie House handle.');
            return;
        }
        
        // Check if user already has a .reverie.house handle available
        const reverieHandles = handles.filter(h => h.endsWith('.reverie.house'));
        
        if (reverieHandles.length === 0) {
            this.showError('You don\'t have any .reverie.house handles.\n\nPlease contact a Greeter to claim your Reverie House identity.');
            return;
        }
        
        this.availableHandles = reverieHandles;
        this.selectedHandle = reverieHandles[0]; // Default to first available
        this.render();
    }

    /**
     * Fetch available handles for the current user
     */
    async fetchAvailableHandles() {
        try {
            // Get auth token
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            if (!token) {
                console.error('❌ [ChangeHandle] No auth token available');
                return [];
            }
            
            // Get current session to find user's DID
            const session = window.oauthManager?.getSession();
            if (!session) {
                console.error('❌ [ChangeHandle] No active session');
                return [];
            }
            
            const userDid = session.sub || session.did;
            this.currentHandle = session.profile?.handle || session.handle;
            
            console.log('🔍 [ChangeHandle] Fetching handles for DID:', userDid);
            console.log('   Current handle:', this.currentHandle);
            
            // Fetch dreamer data to get name and alts
            const response = await fetch(`/api/dreamers/${userDid}`);
            
            if (!response.ok) {
                console.error('❌ [ChangeHandle] Failed to fetch dreamer data:', response.status);
                return [];
            }
            
            const dreamer = await response.json();
            console.log('📋 [ChangeHandle] Dreamer data:', dreamer);
            
            // Build list of available handles
            const handles = [];
            
            // Primary name
            if (dreamer.name) {
                handles.push(`${dreamer.name}.reverie.house`);
            }
            
            // Alternate names (pseudonyms)
            const alts = dreamer.alt_names || dreamer.alts || '';
            if (alts) {
                const altList = alts.split(',').map(a => a.trim()).filter(a => a);
                for (const alt of altList) {
                    handles.push(`${alt}.reverie.house`);
                }
            }
            
            console.log('✅ [ChangeHandle] Available handles:', handles);
            return handles;
            
        } catch (error) {
            console.error('❌ [ChangeHandle] Error fetching handles:', error);
            return [];
        }
    }

    render() {
        // Remove any existing modal
        this.close();
        
        // Create modal overlay
        this.modal = document.createElement('div');
        this.modal.id = 'change-handle-modal';
        this.modal.className = 'change-handle-overlay';
        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        };
        
        // Build dropdown options
        const optionsHTML = this.availableHandles.map(handle => {
            const isSelected = handle === this.selectedHandle;
            return `<option value="${handle}" ${isSelected ? 'selected' : ''}>@${handle}</option>`;
        }).join('');
        
        // Get provisioner handle for the message
        const provisionerHandle = this.config.provisionerHandle || 'the Head of Pantry';
        
        this.modal.innerHTML = `
            <div class="change-handle-content">
                <div class="change-handle-header">
                    <h3 class="change-handle-title">Adopt Handle</h3>
                    <button class="change-handle-close" onclick="window.changeHandleWidget.close()">×</button>
                </div>
                
                <div class="change-handle-message">
                    <p class="change-handle-intro">Only confirmed dreamweavers may directly message our <strong>Head of Pantry</strong> for food pickups.</p>
                    <p class="change-handle-instruction">Adopt one of your available handles so that <strong>@${provisionerHandle}</strong> can receive your private message.</p>
                </div>
                
                <div class="handle-selector-container">
                    <select id="handle-dropdown" class="handle-dropdown">
                        ${optionsHTML}
                    </select>
                </div>
                
                <div class="change-handle-footer">
                    <p class="change-handle-current">Your current handle is: <strong>@${this.currentHandle || 'unknown'}</strong></p>
                    <p class="change-handle-preview">Adopting <strong id="preview-handle">@${this.selectedHandle}</strong> will be recognized across our wild mindscape.</p>
                </div>
                
                <div class="change-handle-actions">
                    <button class="handle-adopt-btn" id="adopt-handle-btn">ADOPT HANDLE</button>
                    <button class="handle-cancel-btn" onclick="window.changeHandleWidget.close()">CANCEL</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // Inject styles if needed
        this.injectStyles();
        
        // Add event listeners
        this.setupListeners();
        
        // Animate in
        setTimeout(() => this.modal.classList.add('active'), 10);
    }

    setupListeners() {
        // Handle dropdown change
        const dropdown = this.modal.querySelector('#handle-dropdown');
        const previewEl = this.modal.querySelector('#preview-handle');
        
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                this.selectedHandle = e.target.value;
                if (previewEl) {
                    previewEl.textContent = `@${this.selectedHandle}`;
                }
            });
        }
        
        // Handle adopt button click
        const adoptBtn = this.modal.querySelector('#adopt-handle-btn');
        if (adoptBtn) {
            adoptBtn.addEventListener('click', async () => {
                const name = this.selectedHandle.replace('.reverie.house', '');
                await this.switchHandle(name, this.selectedHandle);
            });
        }
    }

    async switchHandle(name, handle) {
        console.log('🔄 [ChangeHandle] Switching to:', name, handle);
        
        try {
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            if (!token) {
                throw new Error('No auth token available');
            }
            
            // Show loading state
            const adoptBtn = this.modal.querySelector('#adopt-handle-btn');
            if (adoptBtn) {
                adoptBtn.textContent = 'ADOPTING...';
                adoptBtn.disabled = true;
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
                throw new Error(error.error || 'Failed to adopt handle');
            }
            
            const result = await response.json();
            console.log('✅ [ChangeHandle] Handle adopted:', result);
            
            // Update the session with new handle if possible
            if (window.oauthManager) {
                const session = window.oauthManager.getSession();
                if (session && session.profile) {
                    session.profile.handle = handle;
                    // Dispatch event to notify other components
                    window.dispatchEvent(new CustomEvent('handle-changed', { 
                        detail: { 
                            newHandle: handle,
                            newName: name,
                            primaryName: result.primary_name,
                            altNames: result.alt_names
                        } 
                    }));
                }
            }
            
            // Close modal
            this.close();
            
            // Show success message
            if (window.showCelebration) {
                window.showCelebration(`Handle adopted: @${handle}\n\nYou can now continue.`, 'success');
            }
            
            // Call success callback
            if (this.onSuccess) {
                // Small delay to let the modal close animation complete
                setTimeout(() => {
                    this.onSuccess();
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ [ChangeHandle] Error adopting handle:', error);
            
            // Reset button state
            const adoptBtn = this.modal.querySelector('#adopt-handle-btn');
            if (adoptBtn) {
                adoptBtn.textContent = 'ADOPT HANDLE';
                adoptBtn.disabled = false;
            }
            
            if (window.showCelebration) {
                window.showCelebration(`Failed to adopt handle: ${error.message}`, 'error');
            } else {
                alert(`Failed to adopt handle: ${error.message}`);
            }
        }
    }

    showError(message) {
        if (window.showCelebration) {
            window.showCelebration(message, 'error');
        } else {
            alert(message);
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
            setTimeout(() => {
                if (this.modal && this.modal.parentNode) {
                    this.modal.remove();
                }
                this.modal = null;
            }, 300);
        }
    }

    injectStyles() {
        if (document.getElementById('change-handle-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'change-handle-styles';
        style.textContent = `
            .change-handle-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 999999;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .change-handle-overlay.active {
                display: flex;
                opacity: 1;
            }
            
            .change-handle-content {
                background: #f8f5e6;
                border: 3px solid var(--role-provisioner, #6b8e23);
                padding: 1.5rem;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                position: relative;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .change-handle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.75rem;
                border-bottom: 2px solid #e0d5c5;
            }
            
            .change-handle-title {
                margin: 0;
                font-size: 1.3rem;
                color: var(--role-provisioner-dark, #5a7a1f);
                font-weight: 700;
            }
            
            .change-handle-close {
                background: none;
                border: none;
                font-size: 1.8rem;
                cursor: pointer;
                color: #888;
                line-height: 1;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .change-handle-close:hover {
                color: #333;
            }
            
            .change-handle-message {
                color: #555;
                font-size: 0.95rem;
                line-height: 1.6;
                margin-bottom: 1.25rem;
                text-align: center;
            }
            
            .change-handle-message p {
                margin: 0 0 0.75rem 0;
            }
            
            .change-handle-intro {
                font-weight: 600;
                color: #444;
            }
            
            .change-handle-instruction {
                color: #666;
            }
            
            .handle-selector-container {
                margin-bottom: 1.25rem;
            }
            
            .handle-dropdown {
                width: 100%;
                padding: 0.75rem 1rem;
                font-size: 1rem;
                font-family: monospace;
                border: 2px solid #ddd;
                border-radius: 4px;
                background: #fff;
                color: #333;
                cursor: pointer;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 1rem center;
                transition: border-color 0.2s ease;
            }
            
            .handle-dropdown:hover,
            .handle-dropdown:focus {
                border-color: var(--role-provisioner, #6b8e23);
                outline: none;
            }
            
            .change-handle-footer {
                background: #f0ede0;
                border-radius: 4px;
                padding: 1rem;
                margin-bottom: 1.25rem;
            }
            
            .change-handle-current {
                font-size: 0.85rem;
                color: #888;
                margin: 0 0 0.5rem 0;
                text-align: center;
            }
            
            .change-handle-preview {
                font-size: 0.9rem;
                color: #555;
                margin: 0;
                text-align: center;
            }
            
            .change-handle-preview strong {
                color: var(--role-provisioner-dark, #5a7a1f);
            }
            
            .change-handle-actions {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
            }
            
            .handle-adopt-btn {
                background: var(--role-provisioner, #6b8e23);
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                font-size: 0.9rem;
                font-weight: 700;
                cursor: pointer;
                border-radius: 4px;
                text-transform: uppercase;
                transition: all 0.2s ease;
            }
            
            .handle-adopt-btn:hover {
                background: var(--role-provisioner-dark, #5a7a1f);
                transform: translateY(-1px);
            }
            
            .handle-adopt-btn:disabled {
                opacity: 0.6;
                cursor: wait;
            }
            
            .handle-cancel-btn {
                background: transparent;
                color: #888;
                border: 2px solid #ccc;
                padding: 0.75rem 1.5rem;
                font-size: 0.9rem;
                font-weight: 700;
                cursor: pointer;
                border-radius: 4px;
                text-transform: uppercase;
                transition: all 0.2s ease;
            }
            
            .handle-cancel-btn:hover {
                border-color: #999;
                color: #666;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Initialize widget on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.changeHandleWidget = new ChangeHandleWidget();
    console.log('✅ ChangeHandleWidget initialized');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangeHandleWidget;
}
