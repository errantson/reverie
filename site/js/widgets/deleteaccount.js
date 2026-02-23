/**
 * Delete Account Modal Widget — Mobile-optimized
 * 
 * Light-themed, mobile-first modal for permanently deleting Reverie House accounts.
 * - visualViewport keyboard awareness (collapses warning when keyboard up)
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
        this._kbCleanup = [];
        
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
    
    open(session) {
        if (this.isOpen) return;
        if (!session) { console.error('❌ No session provided to delete account modal'); return; }
        
        this.session = session;
        this.isOpen = true;
        this.clickCount = 0;
        this.isProcessing = false;
        
        this.render();
        
        requestAnimationFrame(() => {
            if (this.overlay) this.overlay.classList.add('visible');
        });
    }
    
    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'da-overlay';
        
        this.modal = document.createElement('div');
        this.modal.className = 'da-modal';
        
        const handleDisplay = this.session.handle || 'Unknown';
        
        this.modal.innerHTML = `
            <div class="da-header">
                <img src="/assets/icon.png" alt="" class="da-logo">
                <span class="da-title">Delete Account</span>
                <button class="da-close" aria-label="Close">&times;</button>
            </div>

            <div class="da-body">
                <div class="da-warning">
                    <p class="da-warning-primary">This action is permanent and cannot be undone.</p>
                    <p class="da-warning-handle">Deleting <strong>@${this._esc(handleDisplay)}</strong> will:</p>
                    <ul class="da-consequences">
                        <li><strong>Delete</strong> your PDS/Bluesky account completely</li>
                        <li><strong>Liberate</strong> your handle for others to claim</li>
                        <li><strong>Clear</strong> all credentials and sessions</li>
                        <li><strong>Record</strong> a permanent departure event</li>
                        <li><strong>Preserve</strong> your events, awards, and contributions</li>
                        <li><strong>Archive</strong> your avatar and banner</li>
                    </ul>
                    <p class="da-warning-final">Your AT Protocol account will be deleted. There is no recovery.</p>
                </div>

                <div class="da-confirm-section">
                    <label class="da-confirm-label" for="da-confirm-input">
                        Type <span class="da-required-text">${this.confirmationText}</span> to confirm:
                    </label>
                    <input type="text" id="da-confirm-input" class="da-confirm-input"
                        placeholder="Type here to confirm…"
                        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                </div>

                <div class="da-actions">
                    <button id="da-delete-btn" class="da-delete-btn stage-0" disabled>
                        <span class="da-btn-text">Permanently Delete Account</span>
                        <span class="da-crack da-crack-1"></span>
                        <span class="da-crack da-crack-2"></span>
                        <span class="da-crack da-crack-3"></span>
                        <span class="da-crack da-crack-4"></span>
                    </button>
                    <div id="da-progress" class="da-progress"></div>
                    <div class="da-transfer">
                        You can also <a href="https://pdsmoover.com/" target="_blank" rel="noopener noreferrer">transfer your data</a> to another server
                    </div>
                </div>
            </div>
        `;
        
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
        
        this.attachEventListeners();
        this.setupKeyboardHandling();
        
        setTimeout(() => {
            const input = document.getElementById('da-confirm-input');
            if (input) input.focus();
        }, 200);
    }

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    
    attachEventListeners() {
        this.modal.querySelector('.da-close')?.addEventListener('click', () => this.close());
        
        // Block overlay from closing on tap (only × closes)
        this.overlay.addEventListener('click', e => e.stopPropagation());
        
        const input = document.getElementById('da-confirm-input');
        if (input) input.addEventListener('input', () => this.validateConfirmation());
        
        const deleteBtn = document.getElementById('da-delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDeleteClick());
        
        this._escHandler = (e) => { if (e.key === 'Escape' && !this.isProcessing) this.close(); };
        document.addEventListener('keydown', this._escHandler);
    }

    setupKeyboardHandling() {
        const isMobile = window.matchMedia('(max-width: 600px)').matches;
        if (!isMobile) return;

        const kbThreshold = 100;

        if (window.visualViewport) {
            const onResize = () => {
                const keyboardOpen = (window.innerHeight - window.visualViewport.height) > kbThreshold;
                this.modal.classList.toggle('keyboard-active', keyboardOpen);
                this.overlay.classList.toggle('keyboard-active', keyboardOpen);
                if (keyboardOpen && document.activeElement?.closest('.da-confirm-section')) {
                    document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            };
            window.visualViewport.addEventListener('resize', onResize);
            this._kbCleanup.push(() => window.visualViewport.removeEventListener('resize', onResize));
        }

        const onFocus = (e) => {
            if (e.target.closest('.da-confirm-section')) {
                setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
            }
        };
        this.modal.addEventListener('focusin', onFocus);
        this._kbCleanup.push(() => this.modal.removeEventListener('focusin', onFocus));
    }
    
    validateConfirmation() {
        const input = document.getElementById('da-confirm-input');
        const deleteBtn = document.getElementById('da-delete-btn');
        if (!input || !deleteBtn) return;
        
        const isValid = input.value === this.confirmationText;
        
        if (input.value.length === 0) {
            deleteBtn.disabled = true;
            deleteBtn.classList.remove('valid');
            input.classList.remove('da-valid', 'da-invalid');
        } else if (isValid) {
            deleteBtn.disabled = false;
            deleteBtn.classList.add('valid');
            input.classList.add('da-valid');
            input.classList.remove('da-invalid');
        } else {
            deleteBtn.disabled = true;
            deleteBtn.classList.remove('valid');
            input.classList.remove('da-valid');
            input.classList.add('da-invalid');
        }
    }
    
    async handleDeleteClick() {
        if (this.isProcessing) return;
        
        const deleteBtn = document.getElementById('da-delete-btn');
        const progress = document.getElementById('da-progress');
        if (!deleteBtn) return;
        
        this.clickCount++;
        
        deleteBtn.classList.remove('stage-0', 'stage-1', 'stage-2', 'stage-3');
        deleteBtn.classList.add(`stage-${this.clickCount}`);
        
        deleteBtn.classList.add('shake');
        setTimeout(() => deleteBtn.classList.remove('shake'), 500);
        
        const remaining = this.maxClicks - this.clickCount;
        
        if (this.clickCount < this.maxClicks) {
            if (progress) progress.textContent = `Click ${remaining} more time${remaining === 1 ? '' : 's'} to confirm`;
        } else {
            deleteBtn.classList.add('destroying');
            if (progress) progress.innerHTML = '<span class="da-deleting">Deleting account…</span>';
            deleteBtn.disabled = true;
            this.isProcessing = true;
            setTimeout(() => this.processAccountDeletion(), 1000);
        }
    }
    
    async processAccountDeletion() {
        console.log('🗑️ [DeleteAccount] Processing account deletion for', this.session.handle);
        
        try {
            let token = null;
            
            // OAuth token
            if (window.oauthManager && typeof window.oauthManager.getTokenSet === 'function') {
                try {
                    const tokenSet = await window.oauthManager.getTokenSet("auto");
                    if (tokenSet?.access_token) token = tokenSet.access_token;
                } catch (_) {}
            }
            
            // Fallbacks
            if (!token) token = localStorage.getItem('admin_token');
            if (!token && this.session?.accessJwt) token = this.session.accessJwt;
            if (!token) {
                try {
                    const parsed = JSON.parse(localStorage.getItem('pds_session') || '{}');
                    if (parsed.accessJwt) token = parsed.accessJwt;
                } catch (_) {}
            }
            
            if (!token) throw new Error('No authentication token found. Please log in again.');
            
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
            
            if (!response.ok) {
                let msg = 'Failed to delete account';
                try { const e = await response.json(); msg = e.message || e.error || msg; } catch (_) {}
                throw new Error(msg);
            }
            
            // Logout after successful deletion
            if (window.oauthManager && typeof window.oauthManager.logout === 'function') {
                await window.oauthManager.logout();
            }
            localStorage.removeItem('admin_token');
            
            this.showDeletionComplete();
            
        } catch (error) {
            console.error('❌ [DeleteAccount] Error:', error);
            
            const deleteBtn = document.getElementById('da-delete-btn');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.classList.remove('destroying', 'stage-1', 'stage-2', 'stage-3');
                deleteBtn.classList.add('stage-0');
            }
            
            const progress = document.getElementById('da-progress');
            if (progress) progress.innerHTML = `<span class="da-error">${this._esc(error.message)}</span>`;
            
            this.isProcessing = false;
            this.clickCount = 0;
        }
    }
    
    showDeletionComplete() {
        const body = this.modal.querySelector('.da-body');
        if (!body) return;
        
        body.innerHTML = `
            <div class="da-complete">
                <h3 class="da-complete-title">Account Deleted</h3>
                <p class="da-complete-msg">
                    Your PDS account has been permanently deleted and your handle has been liberated.
                </p>
                <p class="da-complete-note">
                    Your contributions to Reverie House remain preserved as part of the world's history.
                </p>
                <p class="da-complete-farewell">
                    Thank you for being part of Reverie House.<br>
                    Safe travels, dreamer.
                </p>
                <div class="da-redirect">
                    Returning home in <span id="da-countdown">3</span>…
                </div>
            </div>
        `;
        
        let countdown = 3;
        const el = document.getElementById('da-countdown');
        const interval = setInterval(() => {
            countdown--;
            if (el) el.textContent = countdown;
            if (countdown <= 0) { clearInterval(interval); window.location.href = '/'; }
        }, 1000);
    }
    
    close() {
        if (!this.isOpen || this.isProcessing) return;
        
        if (this.overlay) this.overlay.classList.remove('visible');
        
        this._kbCleanup.forEach(fn => fn());
        this._kbCleanup = [];
        
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        
        setTimeout(() => {
            if (this.overlay?.parentNode) this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
            this.modal = null;
            this.isOpen = false;
        }, 300);
    }
}

window.DeleteAccountModal = DeleteAccountModal;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.deleteAccountModal) window.deleteAccountModal = new DeleteAccountModal();
    });
} else {
    if (!window.deleteAccountModal) window.deleteAccountModal = new DeleteAccountModal();
}