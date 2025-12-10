/**
 * Delete Account Modal Widget
 * 
 * A modal for permanently deleting Reverie House accounts.
 * Features:
 * - Red-themed warning design with shadowbox
 * - Text confirmation: "Goodbye, Reverie House"
 * - Three-stage destructive button with crack animations
 * - Deletes all account data including Bluesky posts and PDS data
 */

class DeleteAccountModal {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.isOpen = false;
        this.clickCount = 0;
        this.maxClicks = 3;
        this.confirmationText = "Goodbye, Reverie House";
        this.isProcessing = false;
        
        this.loadStyles();
    }
    
    loadStyles() {
        if (!document.querySelector('link[href*="css/widgets/deleteaccount.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/deleteaccount.css';
            document.head.appendChild(link);
        }
    }
    
    /**
     * Open the delete account modal
     * @param {Object} session - User session with handle, did, etc.
     */
    open(session) {
        if (this.isOpen) {
            console.log('⚠️ Delete account modal already open');
            return;
        }
        
        if (!session) {
            console.error('❌ No session provided to delete account modal');
            return;
        }
        
        this.session = session;
        this.isOpen = true;
        this.clickCount = 0;
        this.isProcessing = false;
        
        this.render();
        
        // Animate in
        requestAnimationFrame(() => {
            if (this.overlay) {
                this.overlay.classList.add('visible');
            }
        });
    }
    
    render() {
        // Create shadowbox (layer-block)
        this.overlay = document.createElement('div');
        this.overlay.className = 'delete-account-shadowbox';
        
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.className = 'delete-account-modal';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'delete-account-header';
        header.innerHTML = `
            <img src="/assets/icon.png" alt="Reverie House" class="delete-account-logo">
            <h2 class="delete-account-title">DELETE YOUR ENTIRE ACCOUNT</h2>
            <button class="delete-account-close" aria-label="Close">×</button>
        `;
        
        // Create body
        const body = document.createElement('div');
        body.className = 'delete-account-body';
        
        const handleDisplay = this.session.handle || 'Unknown';
        
        body.innerHTML = `
            <div class="delete-account-warning">
                <p class="warning-primary">
                    <strong>This action is PERMANENT and CANNOT be undone.</strong>
                </p>
                <p class="warning-details">
                    Deleting your account (<strong>@${handleDisplay}</strong>) will:
                </p>
                <ul class="delete-consequences">
                    <li><strong>DELETE</strong> your PDS/Bluesky account completely</li>
                    <li><strong>LIBERATE</strong> your handle (${handleDisplay.split('.')[0]}) for others to claim</li>
                    <li><strong>CLEAR</strong> all authentication credentials and active sessions</li>
                    <li><strong>RECORD</strong> a permanent "departure" event in world history</li>
                    <li><strong>PRESERVE</strong> all your events, awards, and contributions</li>
                    <li><strong>ARCHIVE</strong> your visual identity (avatar/banner) in formers table</li>
                </ul>
                <p class="warning-final">
                    <strong>Your AT Protocol account will be DELETED. There is NO recovery.</strong>
                </p>
            </div>
            
            <div class="delete-confirmation-section">
                <label for="delete-confirmation-input" class="confirmation-label">
                    To confirm permanent deletion, type: <span class="required-text">${this.confirmationText}</span>
                </label>
                <input 
                    type="text" 
                    id="delete-confirmation-input" 
                    class="delete-confirmation-input"
                    placeholder="Type here to confirm..."
                    autocomplete="off"
                    spellcheck="false">
                <div class="confirmation-status" id="confirmation-status"></div>
            </div>
            
            <div class="delete-button-container">
                <button 
                    id="delete-account-btn" 
                    class="delete-account-btn stage-0" 
                    disabled
                    aria-label="Delete account button - click 3 times to confirm">
                    <span class="btn-text">Permanently Delete Account</span>
                    <span class="btn-crack crack-1"></span>
                    <span class="btn-crack crack-2"></span>
                    <span class="btn-crack crack-3"></span>
                    <span class="btn-crack crack-4"></span>
                </button>
                <div class="transfer-notice">
                    You can also <a href="https://pdsmoover.com/" target="_blank" rel="noopener noreferrer">transfer your data</a> to another server
                </div>
            </div>
        `;
        
        // Assemble modal
        this.modal.appendChild(header);
        this.modal.appendChild(body);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('delete-confirmation-input');
            if (input) input.focus();
        }, 100);
    }
    
    attachEventListeners() {
        // Close button (only way to exit without completing deletion)
        const closeBtn = this.modal.querySelector('.delete-account-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Prevent overlay/shadowbox clicks from closing the modal
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                // Don't close the modal when clicking the overlay
            });
        }
        
        // Prevent modal from closing when clicking inside it
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Confirmation input
        const input = document.getElementById('delete-confirmation-input');
        if (input) {
            input.addEventListener('input', () => this.validateConfirmation());
            // Prevent input clicks from bubbling
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('focus', (e) => e.stopPropagation());
        }
        
        // Delete button
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleDeleteClick());
        }
    }
    
    validateConfirmation() {
        const input = document.getElementById('delete-confirmation-input');
        const status = document.getElementById('confirmation-status');
        const deleteBtn = document.getElementById('delete-account-btn');
        
        if (!input || !status || !deleteBtn) return;
        
        const value = input.value;
        const isValid = value === this.confirmationText;
        
        if (value.length === 0) {
            status.textContent = '';
            status.className = 'confirmation-status';
            deleteBtn.disabled = true;
            deleteBtn.classList.remove('valid');
        } else if (isValid) {
            status.textContent = '';
            status.className = 'confirmation-status valid';
            deleteBtn.disabled = false;
            deleteBtn.classList.add('valid');
        } else {
            status.textContent = '';
            status.className = 'confirmation-status invalid';
            deleteBtn.disabled = true;
            deleteBtn.classList.remove('valid');
        }
    }
    
    async handleDeleteClick() {
        if (this.isProcessing) return;
        
        const deleteBtn = document.getElementById('delete-account-btn');
        const progress = document.getElementById('delete-progress');
        const clicksRemaining = document.getElementById('clicks-remaining');
        const clicksPlural = document.getElementById('clicks-plural');
        
        if (!deleteBtn) return;
        
        this.clickCount++;
        
        // Update button stage (crack animation)
        deleteBtn.classList.remove('stage-0', 'stage-1', 'stage-2', 'stage-3');
        deleteBtn.classList.add(`stage-${this.clickCount}`);
        
        // Shake animation
        deleteBtn.classList.add('shake');
        setTimeout(() => deleteBtn.classList.remove('shake'), 500);
        
        // Update progress text
        const remaining = this.maxClicks - this.clickCount;
        if (clicksRemaining) clicksRemaining.textContent = remaining;
        if (clicksPlural) clicksPlural.textContent = remaining === 1 ? '' : 's';
        
        if (this.clickCount < this.maxClicks) {
            // Not ready yet
            if (progress) {
                progress.textContent = `Click ${remaining} more time${remaining === 1 ? '' : 's'} to confirm deletion`;
            }
        } else {
            // Final click - destroy and delete
            deleteBtn.classList.add('destroying');
            if (progress) {
                progress.innerHTML = '<span class="deleting-text">Deleting account...</span>';
            }
            
            // Disable button
            deleteBtn.disabled = true;
            this.isProcessing = true;
            
            // Wait for destruction animation
            setTimeout(() => {
                this.processAccountDeletion();
            }, 1000);
        }
    }
    
    async processAccountDeletion() {
        console.log('🗑️ [DeleteAccount] ===== STARTING ACCOUNT DELETION =====');
        console.log('🗑️ [DeleteAccount] Processing account deletion for', this.session.handle);
        console.log('🗑️ [DeleteAccount] Session info:', {
            handle: this.session.handle,
            did: this.session.did,
            hasAccessJwt: !!(this.session.accessJwt),
            accessJwtLength: this.session.accessJwt ? this.session.accessJwt.length : 0
        });
        
        try {
            // Step 1: Get authentication token BEFORE logging out
            // Support both OAuth tokens and PDS session tokens
            let token = null;
            
            console.log('🔐 [DeleteAccount] ===== TOKEN RETRIEVAL PHASE =====');
            
            // Try oauthManager first (OAuth flow)
            console.log('🔐 [DeleteAccount] Checking OAuth manager...');
            console.log('🔐 [DeleteAccount] window.oauthManager exists:', !!window.oauthManager);
            if (window.oauthManager) {
                console.log('🔐 [DeleteAccount] OAuth manager methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.oauthManager)));
                console.log('🔐 [DeleteAccount] getTokenSet method exists:', typeof window.oauthManager.getTokenSet === 'function');
                console.log('🔐 [DeleteAccount] OAuth manager sub (user DID):', window.oauthManager.sub);
                console.log('🔐 [DeleteAccount] OAuth manager session:', window.oauthManager.session);
            }
            
            if (window.oauthManager && typeof window.oauthManager.getTokenSet === 'function') {
                try {
                    console.log('🔐 [DeleteAccount] Attempting to get OAuth token set with "auto" refresh...');
                    const tokenSet = await window.oauthManager.getTokenSet("auto");
                    console.log('🔐 [DeleteAccount] OAuth token set retrieved:', tokenSet ? 'success' : 'null/undefined');
                    if (tokenSet) {
                        console.log('🔐 [DeleteAccount] Token set keys:', Object.keys(tokenSet));
                        console.log('🔐 [DeleteAccount] Has access_token:', !!tokenSet.access_token);
                        console.log('🔐 [DeleteAccount] Token type:', tokenSet.token_type);
                        console.log('🔐 [DeleteAccount] Expires at:', tokenSet.expires_at);
                        if (tokenSet.access_token) {
                            token = tokenSet.access_token;
                            console.log('🔐 [DeleteAccount] ✅ Using OAuth access token (length:', token.length, ')');
                        } else {
                            console.warn('🔐 [DeleteAccount] ❌ OAuth token set missing access_token');
                        }
                    } else {
                        console.warn('🔐 [DeleteAccount] ❌ getTokenSet() returned null/undefined');
                    }
                } catch (e) {
                    console.error('🔐 [DeleteAccount] ❌ Failed to get OAuth token:', e);
                    console.error('🔐 [DeleteAccount] Error details:', {
                        name: e.name,
                        message: e.message,
                        stack: e.stack
                    });
                }
            } else {
                console.warn('🔐 [DeleteAccount] ❌ OAuth manager not available or missing getTokenSet method');
            }
            
            // Fallback to admin_token
            if (!token && localStorage.getItem('admin_token')) {
                token = localStorage.getItem('admin_token');
                console.log('🔐 [DeleteAccount] ✅ Using admin_token from localStorage (length:', token.length, ')');
            } else {
                console.log('🔐 [DeleteAccount] ❌ No admin_token in localStorage');
            }
            
            // Fallback to PDS session (accessJwt)
            if (!token && this.session && this.session.accessJwt) {
                token = this.session.accessJwt;
                console.log('🔐 [DeleteAccount] ✅ Using PDS accessJwt token (length:', token.length, ')');
            } else {
                console.log('🔐 [DeleteAccount] ❌ No PDS accessJwt available');
            }
            
            // Last resort: check localStorage for pds_session
            if (!token) {
                const pdsSession = localStorage.getItem('pds_session');
                console.log('🔐 [DeleteAccount] Checking localStorage pds_session:', pdsSession ? 'exists' : 'not found');
                if (pdsSession) {
                    try {
                        const parsed = JSON.parse(pdsSession);
                        console.log('🔐 [DeleteAccount] Parsed pds_session keys:', Object.keys(parsed));
                        if (parsed.accessJwt) {
                            token = parsed.accessJwt;
                            console.log('🔐 [DeleteAccount] ✅ Using PDS session from localStorage (length:', token.length, ')');
                        } else {
                            console.log('🔐 [DeleteAccount] ❌ pds_session missing accessJwt');
                        }
                    } catch (e) {
                        console.error('🔐 [DeleteAccount] ❌ Failed to parse pds_session:', e);
                    }
                }
            }
            
            if (!token) {
                throw new Error('No authentication token found. Please log in again.');
            }
            
            console.log('🔐 [DeleteAccount] ===== TOKEN ACQUIRED =====');
            console.log('🔐 [DeleteAccount] Final token type: OAuth/admin/PDS');
            console.log('🔐 [DeleteAccount] Token length:', token.length);
            console.log('🔐 [DeleteAccount] Token starts with:', token.substring(0, 50) + '...');
            
            // Step 2: Call delete endpoint WHILE STILL AUTHENTICATED
            console.log('🌐 [DeleteAccount] ===== API CALL PHASE =====');
            console.log('🌐 [DeleteAccount] Preparing DELETE request to /api/user/delete');
            console.log('🌐 [DeleteAccount] Request payload:', {
                did: this.session.did,
                handle: this.session.handle,
                confirm: this.confirmationText
            });
            console.log('🌐 [DeleteAccount] Request headers:', {
                'Content-Type': 'application/json',
                'Authorization': `Bearer [TOKEN_LENGTH_${token.length}]`
            });
            
            const response = await fetch('/api/user/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    did: this.session.did,
                    handle: this.session.handle,
                    confirm: this.confirmationText
                })
            });
            
            console.log('🌐 [DeleteAccount] ===== API RESPONSE =====');
            console.log('🌐 [DeleteAccount] Response status:', response.status);
            console.log('🌐 [DeleteAccount] Response status text:', response.statusText);
            console.log('🌐 [DeleteAccount] Response ok:', response.ok);
            console.log('🌐 [DeleteAccount] Response headers:');
            for (const [key, value] of response.headers.entries()) {
                console.log(`  ${key}: ${value}`);
            }
            
            if (!response.ok) {
                let errorText;
                try {
                    errorText = await response.text();
                    console.error('🌐 [DeleteAccount] ❌ Response not ok, raw body:', errorText);
                    const error = JSON.parse(errorText);
                    console.error('🌐 [DeleteAccount] ❌ Parsed error:', error);
                    throw new Error(error.message || error.error || 'Failed to delete account');
                } catch (parseError) {
                    console.error('🌐 [DeleteAccount] ❌ Failed to parse error response:', parseError);
                    throw new Error('Failed to delete account - server error');
                }
            }
            
            const successData = await response.json();
            console.log('🌐 [DeleteAccount] ✅ Success response:', successData);
            
            // Step 3: NOW logout (after successful deletion)
            if (window.oauthManager && typeof window.oauthManager.logout === 'function') {
                await window.oauthManager.logout();
            }
            
            // Clear any admin tokens
            localStorage.removeItem('admin_token');
            
            // Show final message
            this.showDeletionComplete();
        } catch (error) {
            console.error('❌ [DeleteAccount] Error deleting account:', error);
            
            // Try to restore UI state
            const deleteBtn = document.getElementById('delete-account-btn');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.classList.remove('destroying', 'stage-1', 'stage-2', 'stage-3');
                deleteBtn.classList.add('stage-0');
            }
            
            // Show error message
            const progress = document.getElementById('delete-progress');
            if (progress) {
                progress.innerHTML = `<span class="error-text">Error: ${error.message}</span>`;
            }
            
            // Re-enable for retry
            this.isProcessing = false;
            this.clickCount = 0;
        }
    }
    
    showDeletionComplete() {
        // Replace modal content with goodbye message
        const body = this.modal.querySelector('.delete-account-body');
        if (!body) return;
        
        body.innerHTML = `
            <div class="deletion-complete">
                <h3 class="deletion-title">Account Deleted</h3>
                <p class="deletion-message">
                    Your PDS account has been permanently deleted and your handle has been liberated.
                </p>
                <p class="deletion-note">
                    Your contributions to Reverie House remain preserved as part of the world's history.
                    Anyone can now claim your former handle.
                </p>
                <p class="deletion-farewell">
                    Thank you for being part of Reverie House.<br>
                    Safe travels, dreamer.
                </p>
                <div class="deletion-redirect">
                    Returning to home page in <span id="redirect-countdown">3</span>...
                </div>
            </div>
        `;
        
        // Countdown and redirect
        let countdown = 3;
        const countdownEl = document.getElementById('redirect-countdown');
        const interval = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(interval);
                window.location.href = '/';
            }
        }, 1000);
    }
    
    close() {
        if (!this.isOpen) return;
        if (this.isProcessing) return; // Don't allow closing during deletion
        
        // Animate out
        if (this.overlay) {
            this.overlay.classList.remove('visible');
        }
        
        // Remove after animation
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.modal = null;
            this.isOpen = false;
            
            // Remove escape handler
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }
        }, 300);
    }
}

// Make available globally
window.DeleteAccountModal = DeleteAccountModal;

// Auto-initialize
if (document.readyState === 'loading') {
    // Still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.deleteAccountModal) {
            window.deleteAccountModal = new DeleteAccountModal();
            console.log('✅ Delete account modal initialized');
        }
    });
} else {
    // Already loaded (script loaded dynamically), initialize immediately
    if (!window.deleteAccountModal) {
        window.deleteAccountModal = new DeleteAccountModal();
        console.log('✅ Delete account modal initialized');
    }
}
