class AppPasswordModal {
    constructor() {
        this.userColor = '#734ba1';
        this.onSuccess = null;
        this.escapeHandler = null;
    }

    setUserColor(color) {
        this.userColor = color || '#734ba1';
    }

    show(onSuccessCallback) {
        this.onSuccess = onSuccessCallback;
        this.render();
    }

    showDisconnect(onSuccessCallback) {
        this.onSuccess = onSuccessCallback;
        this.renderDisconnect();
    }

    renderDisconnect() {
        const modal = document.createElement('div');
        modal.className = 'app-password-modal';
        modal.innerHTML = `
            <div class="app-password-modal-content" style="border: 3px solid ${this.userColor}; max-width: 500px;">
                <div class="modal-intro" style="background: ${this.userColor}; color: white; padding: 1rem; text-align: center; border-bottom: 3px solid rgba(0,0,0,0.2);">
                    <strong style="font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.5px; color: #000; text-shadow: 0 2px 4px rgba(255,255,255,0.3);">Disconnect App Password?</strong>
                </div>
                <div class="modal-body" style="padding: 1.5rem 2rem; text-align: center;">
                    <p style="margin: 0 0 1rem 0; font-size: 1rem; line-height: 1.6; color: #333;">
                        You will <strong>immediately lose access</strong> to all automated features and privileged roles.
                    </p>
                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.5; color: #666;">
                        All active roles will be deactivated and your app password will be removed from our system.
                    </p>
                </div>
                <div class="modal-actions" style="padding: 1.25rem 2rem; text-align: center; background: rgba(0,0,0,0.02); border-top: 1px solid rgba(0,0,0,0.1); display: flex; gap: 12px; justify-content: center;">
                    <button class="app-password-cancel-btn" style="padding: 0.75rem 2rem; background: #f0f0f0; color: #333; border: 2px solid #ddd; font-weight: 600; font-size: 0.95rem; cursor: pointer; border-radius: 0; transition: all 0.2s;">
                        NEVERMIND
                    </button>
                    <button class="app-password-disconnect-confirm-btn" style="padding: 0.75rem 2rem; background: #dc3545; color: white; border: 2px solid #bd2130; font-weight: 700; font-size: 0.95rem; cursor: pointer; border-radius: 0; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3); transition: all 0.2s; text-transform: uppercase;">
                        DISCONNECT NOW
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Setup event listeners
        this.setupDisconnectListeners(modal);
    }

    render() {
        const modal = document.createElement('div');
        modal.className = 'app-password-modal';
        modal.innerHTML = `
            <div class="app-password-modal-content" style="border: 3px solid ${this.userColor};">
                <div class="modal-intro" style="background: ${this.userColor}; color: white; padding: 1rem; text-align: center; border-bottom: 3px solid rgba(0,0,0,0.2);">
                    <strong style="font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.5px; color: #000; text-shadow: 0 2px 4px rgba(255,255,255,0.3);">App Password Connection</strong><br>
                    <div style="max-width: 520px; margin: 0.5rem auto 0 auto; font-size: 0.95rem; line-height: 1.5; color: rgba(255,255,255,0.95);">
                        Connect a Bluesky App Password to enable automated features across Reverie House and take part in more community features like automatic lore contributions, work opportunities, and privileged roles.
                    </div>
                </div>
                <div class="modal-body" style="padding: 1.5rem 2rem;">
                    <p style="margin: 0 0 0.75rem 0; font-weight: 600; color: #333; font-size: 1rem;">To connect your app password:</p>
                    <ol style="margin: 0 0 1.25rem 0; padding-left: 1.5rem; line-height: 1.7; color: #555;">
                        <li>Go to <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener" style="color: ${this.userColor}; font-weight: 600;">Bluesky Settings → App Passwords</a></li>
                        <li>Create a new password (name it "Reverie House")</li>
                        <li>Copy and paste it below</li>
                    </ol>
                    
                    <div class="app-password-form" style="text-align: center; margin-top: 1.25rem;">
                        <label for="appPasswordInput" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">App Password</label>
                        <input type="text" 
                               id="appPasswordInput" 
                               placeholder="xxxx-xxxx-xxxx-xxxx"
                               maxlength="19"
                               autocomplete="off"
                               autocorrect="off"
                               autocapitalize="off"
                               spellcheck="false"
                               style="width: 100%; max-width: 280px; padding: 0.75rem 1rem; font-size: 1.1rem; text-align: center; border: 2px solid ${this.userColor}; border-radius: 0; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                        <div class="app-password-error" id="connectError" style="display: none; margin-top: 1rem; padding: 0.75rem; background: #fee; border: 2px solid #c33; color: #c33; border-radius: 0; text-align: center; font-weight: 500;"></div>
                        <p style="margin-top: 0.75rem; font-size: 0.85rem; color: #777; line-height: 1.5; max-width: 500px; margin-left: auto; margin-right: auto;">
                            This allows features to work on your behalf. You can revoke this anytime in your <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener" style="color: ${this.userColor};">Bluesky settings</a>.
                        </p>
                    </div>
                </div>
                <div class="modal-actions" style="padding: 1.25rem 2rem; text-align: center; background: rgba(0,0,0,0.02); border-top: 1px solid rgba(0,0,0,0.1);">
                    <button class="app-password-submit-btn" style="padding: 0.85rem 3rem; background: ${this.userColor}; color: white; border: 3px solid rgba(0,0,0,0.2); font-weight: 700; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; border-radius: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s;">
                        CONNECT NOW
                    </button>
                    <div class="appreciation-text" style="margin-top: 0.75rem; font-size: 0.85rem; color: #999; font-style: italic; letter-spacing: 0.5px;">
                        we appreciate your authority in this matter
                    </div>
                    <button class="app-password-cancel-btn" style="margin-top: 0.75rem; padding: 0.5rem 1.5rem; background: transparent; color: #999; border: 1px solid #ddd; font-weight: 500; font-size: 0.85rem; cursor: pointer; border-radius: 0; transition: all 0.2s;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Setup event listeners
        this.setupEventListeners(modal);
        
        // Auto-focus on input
        const input = document.getElementById('appPasswordInput');
        input.focus();
    }

    setupEventListeners(modal) {
        const input = document.getElementById('appPasswordInput');
        const submitBtn = modal.querySelector('.app-password-submit-btn');
        const cancelBtn = modal.querySelector('.app-password-cancel-btn');
        
        // Stop all events from propagating to layers below
        modal.addEventListener('mousedown', (e) => e.stopPropagation());
        modal.addEventListener('mouseup', (e) => e.stopPropagation());
        modal.addEventListener('touchstart', (e) => e.stopPropagation());
        modal.addEventListener('touchend', (e) => e.stopPropagation());
        
        // Auto-format app password as user types
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/-/g, '').replace(/\s/g, '');
            if (value.length > 16) value = value.substring(0, 16);
            
            const formatted = value.match(/.{1,4}/g)?.join('-') || value;
            e.target.value = formatted;
        });
        
        // Prevent keydown from propagating
        input.addEventListener('keydown', (e) => e.stopPropagation());
        
        // Submit button
        submitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSubmit();
        });
        
        // Cancel button
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        
        // Close on overlay click (but stop propagation)
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === modal) {
                this.close();
            }
        });
        
        // Enter key to submit
        input.addEventListener('keypress', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                this.handleSubmit();
            }
        });
        
        // Handle Escape key - stop propagation so drawer doesn't close
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && document.querySelector('.app-password-modal')) {
                e.stopPropagation();
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler, true);
    }

    async handleSubmit() {
        const input = document.getElementById('appPasswordInput');
        const errorDiv = document.getElementById('connectError');
        const submitBtn = document.querySelector('.app-password-submit-btn');
        const password = input.value.trim();

        // Validate format
        const formatted = password.replace(/\s/g, '').replace(/-/g, '');
        if (formatted.length !== 16) {
            errorDiv.textContent = 'Invalid format. Expected: xxxx-xxxx-xxxx-xxxx';
            errorDiv.style.display = 'block';
            return;
        }

        // Update button state
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'CONNECTING...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'wait';
        errorDiv.style.display = 'none';

        try {
            const token = localStorage.getItem('oauth_token');
            console.log('🔐 [AppPasswordModal] Connecting with password:', password.substring(0, 4) + '-****-****-****');
            console.log('🔐 [AppPasswordModal] Token:', token ? 'present' : 'missing');
            
            const response = await fetch('/api/user/credentials/connect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ app_password: password })
            });

            console.log('🔐 [AppPasswordModal] Response status:', response.status);
            const data = await response.json();
            console.log('🔐 [AppPasswordModal] Response data:', data);
            
            if (!response.ok || !data.success) {
                // Show detailed error if available
                const errorMsg = data.detail || data.error || 'Connection failed. Please check your password.';
                errorDiv.textContent = errorMsg;
                errorDiv.style.display = 'block';
                
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                return;
            }

            // Success! Close modal and call callback
            this.close();
            if (this.onSuccess) {
                this.onSuccess();
            }
            
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
    }

    setupDisconnectListeners(modal) {
        const confirmBtn = modal.querySelector('.app-password-disconnect-confirm-btn');
        const cancelBtn = modal.querySelector('.app-password-cancel-btn');
        
        // Stop all events from propagating to layers below
        modal.addEventListener('mousedown', (e) => e.stopPropagation());
        modal.addEventListener('mouseup', (e) => e.stopPropagation());
        modal.addEventListener('touchstart', (e) => e.stopPropagation());
        modal.addEventListener('touchend', (e) => e.stopPropagation());
        
        // Cancel button
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        
        // Confirm button
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDisconnect(confirmBtn);
        });
        
        // Close on overlay click (but stop propagation)
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === modal) {
                this.close();
            }
        });
        
        // Handle Escape key - stop propagation so drawer doesn't close
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && document.querySelector('.app-password-modal')) {
                e.stopPropagation();
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler, true);
    }

    async handleDisconnect(button) {
        const originalText = button.innerHTML;
        button.innerHTML = 'DISCONNECTING...';
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'wait';

        try {
            const token = localStorage.getItem('oauth_token');
            const response = await fetch('/api/user/credentials/disconnect', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                alert('Failed to disconnect: ' + (data.error || 'Unknown error'));
                
                // Reset button
                button.innerHTML = originalText;
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                return;
            }

            // Success! Close modal and call callback
            this.close();
            if (this.onSuccess) {
                this.onSuccess();
            }
            
        } catch (error) {
            alert('Network error. Please try again.');
            
            // Reset button
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        }
    }

    close() {
        // Remove escape key handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler, true);
            this.escapeHandler = null;
        }
        
        const modal = document.querySelector('.app-password-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Make it globally available
window.AppPasswordModal = AppPasswordModal;
